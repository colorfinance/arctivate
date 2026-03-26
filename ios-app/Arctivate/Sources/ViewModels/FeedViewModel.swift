import Foundation
import Observation
import Supabase

// MARK: - FeedViewModel

/// Loads the public activity feed with profile data and high-fives,
/// supports toggling high-fives, and formats relative timestamps.
@Observable
final class FeedViewModel {

    // MARK: - State

    var posts: [FeedPost] = []
    /// Maps feed post ID -> array of high-fives for that post.
    var highFivesByPost: [UUID: [HighFive]] = [:]
    var isLoading = false
    var errorMessage: String?

    // MARK: - Private

    private let supabase = SupabaseService.shared
    private let pageSize = 30

    // MARK: - Load Feed

    @MainActor
    func loadFeed() async {
        isLoading = true
        errorMessage = nil

        do {
            let fetchedPosts: [FeedPost] = try await supabase
                .from("public_feed")
                .select("*, profiles(id, username, avatar_url, total_points)")
                .order("created_at", ascending: false)
                .limit(pageSize)
                .execute()
                .value

            posts = fetchedPosts

            // Load high-fives for all fetched posts in a single query
            let postIds = fetchedPosts.map(\.id)
            if !postIds.isEmpty {
                let highFives: [HighFive] = try await supabase
                    .from("high_fives")
                    .select()
                    .in("feed_id", values: postIds.map(\.uuidString))
                    .execute()
                    .value

                var grouped: [UUID: [HighFive]] = [:]
                for hf in highFives {
                    guard let feedId = hf.feedId else { continue }
                    grouped[feedId, default: []].append(hf)
                }
                highFivesByPost = grouped
            }
        } catch {
            errorMessage = "Failed to load feed."
        }

        isLoading = false
    }

    // MARK: - Toggle High Five

    /// Toggles a high-five on a post. If the user already high-fived, it removes it.
    @MainActor
    func toggleHighFive(for post: FeedPost) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in to give high-fives."
            return
        }

        errorMessage = nil
        let postId = post.id
        let existing = highFivesByPost[postId]?.first(where: { $0.userId == userId })

        do {
            if let existing {
                // Remove high-five
                try await supabase
                    .from("high_fives")
                    .delete()
                    .eq("id", value: existing.id.uuidString)
                    .execute()

                highFivesByPost[postId]?.removeAll { $0.id == existing.id }

                // Decrement local likes_count
                if let index = posts.firstIndex(where: { $0.id == postId }) {
                    let currentCount = posts[index].likesCount ?? 0
                    posts[index].likesCount = max(0, currentCount - 1)
                }
            } else {
                // Add high-five
                let newHighFive: HighFive = try await supabase
                    .from("high_fives")
                    .insert([
                        "feed_id": postId.uuidString,
                        "user_id": userId.uuidString
                    ])
                    .select()
                    .single()
                    .execute()
                    .value

                highFivesByPost[postId, default: []].append(newHighFive)

                // Increment local likes_count
                if let index = posts.firstIndex(where: { $0.id == postId }) {
                    let currentCount = posts[index].likesCount ?? 0
                    posts[index].likesCount = currentCount + 1
                }
            }
        } catch {
            errorMessage = "Failed to update high-five."
        }
    }

    // MARK: - High Five Queries

    /// Whether the current user has high-fived a specific post (synchronous, for views).
    func hasHighFived(_ post: FeedPost, userId: UUID) -> Bool {
        highFivesByPost[post.id]?.contains(where: { $0.userId == userId }) == true
    }

    /// High-five count for a post, preferring the server likes_count.
    func highFiveCount(for post: FeedPost) -> Int {
        post.likesCount ?? highFivesByPost[post.id]?.count ?? 0
    }

    // MARK: - Relative Time Formatting

    /// Formats a date into a human-readable relative string.
    /// Returns "just now" for anything less than 1 minute ago.
    static func relativeTime(from date: Date?) -> String {
        guard let date else { return "" }

        let now = Date()
        let interval = now.timeIntervalSince(date)

        // Handle future dates or zero
        guard interval > 0 else { return "just now" }

        if interval < 60 {
            return "just now"
        }

        let minutes = Int(interval / 60)
        if minutes < 60 {
            return minutes == 1 ? "1 min ago" : "\(minutes) mins ago"
        }

        let hours = Int(interval / 3600)
        if hours < 24 {
            return hours == 1 ? "1 hour ago" : "\(hours) hours ago"
        }

        let days = Int(interval / 86400)
        if days < 7 {
            return days == 1 ? "1 day ago" : "\(days) days ago"
        }

        let weeks = Int(interval / 604800)
        if weeks < 4 {
            return weeks == 1 ? "1 week ago" : "\(weeks) weeks ago"
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    /// Convenience overload that parses an ISO 8601 string first.
    func formatRelativeTime(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString)
        return Self.relativeTime(from: date)
    }

    // MARK: - Helpers

    private func currentUserId() async -> UUID? {
        try? await supabase.auth.session.user.id
    }
}
