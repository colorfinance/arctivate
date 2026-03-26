import Foundation
import Observation
import Supabase

// MARK: - ProfileViewModel

/// Loads and updates the user's profile, and handles sign out.
@Observable
final class ProfileViewModel {

    // MARK: - State

    var profile: Profile?
    var isLoading = false
    var isSaving = false
    var errorMessage: String?

    // MARK: - Private

    private let supabase = SupabaseService.shared

    // MARK: - Computed Properties

    var displayName: String {
        profile?.username ?? "User"
    }

    var avatarInitial: String {
        String((profile?.username ?? "U").prefix(1)).uppercased()
    }

    var totalPoints: Int {
        profile?.totalPoints ?? 0
    }

    var currentStreak: Int {
        profile?.currentStreak ?? 0
    }

    var challengeDaysGoal: Int {
        profile?.challengeDaysGoal ?? 75
    }

    /// The current day number in the challenge (1-indexed).
    var challengeDayNumber: Int {
        guard let startDate = profile?.challengeStartDate else { return 0 }
        let days = Calendar.current.dateComponents([.day], from: startDate, to: Date()).day ?? 0
        return max(0, days) + 1
    }

    /// Challenge progress as a fraction (0.0 to 1.0).
    var challengeProgress: Double {
        guard challengeDaysGoal > 0 else { return 0 }
        return min(1.0, Double(challengeDayNumber) / Double(challengeDaysGoal))
    }

    // MARK: - Load Profile

    @MainActor
    func loadProfile() async {
        guard let userId = await currentUserId() else {
            errorMessage = "Not authenticated."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let fetchedProfile: Profile = try await supabase
                .from("profiles")
                .select()
                .eq("id", value: userId.uuidString)
                .single()
                .execute()
                .value

            profile = fetchedProfile
        } catch {
            errorMessage = "Could not load profile."
        }

        isLoading = false
    }

    // MARK: - Update Profile

    @MainActor
    func updateProfile(
        username: String? = nil,
        bio: String? = nil,
        avatarUrl: String? = nil,
        challengeStartDate: Date? = nil,
        challengeDaysGoal: Int? = nil,
        dailyCalorieGoal: Int? = nil
    ) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in to update your profile."
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            var updates: [String: String] = [:]

            if let username {
                let trimmed = username.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else {
                    errorMessage = "Username cannot be empty."
                    isSaving = false
                    return
                }
                updates["username"] = trimmed
            }
            if let bio {
                updates["bio"] = bio.trimmingCharacters(in: .whitespaces)
            }
            if let avatarUrl {
                updates["avatar_url"] = avatarUrl
            }
            if let challengeStartDate {
                updates["challenge_start_date"] = ISO8601DateFormatter().string(from: challengeStartDate)
            }
            if let challengeDaysGoal {
                updates["challenge_days_goal"] = String(challengeDaysGoal)
            }
            if let dailyCalorieGoal {
                updates["daily_calorie_goal"] = String(dailyCalorieGoal)
            }

            guard !updates.isEmpty else {
                isSaving = false
                return
            }

            let updatedProfile: Profile = try await supabase
                .from("profiles")
                .update(updates)
                .eq("id", value: userId.uuidString)
                .select()
                .single()
                .execute()
                .value

            profile = updatedProfile
        } catch {
            errorMessage = "Failed to update profile."
        }

        isSaving = false
    }

    // MARK: - Sign Out

    @MainActor
    func signOut() async {
        do {
            try await supabase.auth.signOut()
            profile = nil
        } catch {
            errorMessage = "Could not sign out. Please try again."
        }
    }

    // MARK: - Helpers

    private func currentUserId() async -> UUID? {
        try? await supabase.auth.session.user.id
    }
}
