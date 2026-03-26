import SwiftUI

struct FeedView: View {
    @State private var posts: [FeedPost] = []
    @State private var isLoading = false
    @State private var highFivedPostIds: Set<UUID> = []

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    LazyVStack(spacing: ArcTheme.Spacing.md) {
                        if posts.isEmpty && !isLoading {
                            emptyFeedPlaceholder
                                .padding(.top, 80)
                        }

                        ForEach(posts) { post in
                            postCard(post)
                        }
                    }
                    .padding(.horizontal, ArcTheme.Spacing.lg)
                    .padding(.top, ArcTheme.Spacing.md)
                    .padding(.bottom, 100)
                }
                .refreshable {
                    await loadFeed()
                }

                if isLoading && posts.isEmpty {
                    ProgressView()
                        .tint(ArcTheme.Colors.primary)
                }
            }
            .navigationTitle("Feed")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task {
                await loadFeed()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Empty State

    private var emptyFeedPlaceholder: some View {
        VStack(spacing: ArcTheme.Spacing.md) {
            Image(systemName: "newspaper")
                .font(.system(size: 48))
                .foregroundStyle(ArcTheme.Colors.textMuted)
            Text("No posts yet")
                .font(ArcTheme.Typography.heading())
                .foregroundStyle(ArcTheme.Colors.textSecondary)
            Text("Share a workout from the Train tab to see it here")
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textMuted)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Post Card

    private func postCard(_ post: FeedPost) -> some View {
        VStack(alignment: .leading, spacing: ArcTheme.Spacing.md) {
            // Post Header
            HStack(spacing: ArcTheme.Spacing.md) {
                // Avatar
                ZStack {
                    Circle()
                        .fill(ArcTheme.Colors.primary.opacity(0.15))
                        .frame(width: 42, height: 42)
                    Text(avatarInitial(for: post))
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(ArcTheme.Colors.primary)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(post.profiles?.username ?? "User")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(ArcTheme.Colors.textPrimary)

                    if let createdAt = post.createdAt {
                        Text(relativeTimeString(from: createdAt))
                            .font(.system(size: 12))
                            .foregroundStyle(ArcTheme.Colors.textMuted)
                    }
                }

                Spacer()

                if post.workoutData?.isNewPb == true {
                    HStack(spacing: 4) {
                        Image(systemName: "trophy.fill")
                            .font(.caption2)
                        Text("PB")
                            .font(.caption2)
                            .fontWeight(.bold)
                    }
                    .foregroundStyle(.black)
                    .padding(.horizontal, ArcTheme.Spacing.sm)
                    .padding(.vertical, 4)
                    .background(ArcTheme.Colors.yellow)
                    .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                }
            }

            // Workout Data
            if let workout = post.workoutData {
                VStack(spacing: ArcTheme.Spacing.sm) {
                    HStack {
                        Text(workout.exerciseName ?? "Exercise")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(ArcTheme.Colors.textPrimary)
                        Spacer()

                        if let value = workout.value {
                            let unit = metricUnit(workout.metricType)
                            Text("\(Int(value)) \(unit)")
                                .font(ArcTheme.Typography.mono())
                                .foregroundStyle(ArcTheme.Colors.textSecondary)
                        }
                    }

                    if let points = workout.pointsEarned, points > 0 {
                        Divider()
                            .background(ArcTheme.Colors.border)

                        HStack(spacing: 4) {
                            Image(systemName: "bolt.fill")
                                .font(.caption)
                                .foregroundStyle(ArcTheme.Colors.orange)
                            Text("+\(points) pts")
                                .font(ArcTheme.Typography.mono())
                                .fontWeight(.semibold)
                                .foregroundStyle(ArcTheme.Colors.orange)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(ArcTheme.Spacing.md)
                .background(ArcTheme.Colors.surfaceLight)
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
            }

            // High Five Button
            Divider()
                .background(ArcTheme.Colors.border)

            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if highFivedPostIds.contains(post.id) {
                            highFivedPostIds.remove(post.id)
                        } else {
                            highFivedPostIds.insert(post.id)
                        }
                    }
                } label: {
                    let isHighFived = highFivedPostIds.contains(post.id)
                    HStack(spacing: 6) {
                        Image(systemName: isHighFived ? "hand.raised.fill" : "hand.raised")
                            .font(.system(size: 18))
                            .foregroundStyle(isHighFived ? ArcTheme.Colors.pink : ArcTheme.Colors.textMuted)

                        let count = (post.likesCount ?? 0) + (highFivedPostIds.contains(post.id) ? 1 : 0)
                        if count > 0 {
                            Text("\(count)")
                                .font(ArcTheme.Typography.caption())
                                .fontWeight(.medium)
                                .foregroundStyle(isHighFived ? ArcTheme.Colors.pink : ArcTheme.Colors.textMuted)
                        }
                    }
                }

                Spacer()
            }
        }
        .arcCard()
    }

    // MARK: - Helpers

    private func avatarInitial(for post: FeedPost) -> String {
        String((post.profiles?.username ?? "U").prefix(1)).uppercased()
    }

    private func metricUnit(_ type: String?) -> String {
        switch type {
        case "weight":   return "kg"
        case "time":     return "min"
        case "distance": return "km"
        case "reps":     return "reps"
        default:         return ""
        }
    }

    private func relativeTimeString(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func loadFeed() async {
        isLoading = true
        // Placeholder: connect FeedViewModel to load from Supabase
        try? await Task.sleep(for: .seconds(0.5))
        isLoading = false
    }
}

#Preview {
    FeedView()
}
