import SwiftUI

struct ProfileView: View {
    @State private var authVM = AuthViewModel()
    @State private var profile: Profile?
    @State private var showEditProfile = false
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ArcTheme.Spacing.xl) {
                        // Avatar and Username
                        avatarSection

                        // Stats
                        statsRow

                        // Menu Items
                        menuSection

                        // Sign Out
                        signOutButton

                        // App Version
                        Text("Arctivate v1.0.0")
                            .font(.system(size: 12))
                            .foregroundStyle(ArcTheme.Colors.textMuted)
                            .padding(.top, ArcTheme.Spacing.md)
                    }
                    .padding(.horizontal, ArcTheme.Spacing.lg)
                    .padding(.top, ArcTheme.Spacing.lg)
                    .padding(.bottom, 100)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Avatar Section

    private var avatarSection: some View {
        VStack(spacing: ArcTheme.Spacing.md) {
            ZStack {
                Circle()
                    .fill(ArcTheme.Colors.primary.opacity(0.15))
                    .frame(width: 88, height: 88)

                Text(avatarInitial)
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(ArcTheme.Colors.primary)

                // Online indicator
                Circle()
                    .fill(ArcTheme.Colors.primary)
                    .frame(width: 16, height: 16)
                    .overlay(
                        Circle()
                            .stroke(ArcTheme.Colors.background, lineWidth: 3)
                    )
                    .offset(x: 32, y: 32)
            }

            Text(profile?.username ?? "Athlete")
                .font(ArcTheme.Typography.heading(24))
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            if let bio = profile?.bio, !bio.isEmpty {
                Text(bio)
                    .font(ArcTheme.Typography.body())
                    .foregroundStyle(ArcTheme.Colors.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: ArcTheme.Spacing.md) {
            statCard(
                icon: "bolt.fill",
                value: "\(profile?.totalPoints ?? 0)",
                label: "Points",
                color: ArcTheme.Colors.orange
            )

            statCard(
                icon: "flame.fill",
                value: "\(profile?.currentStreak ?? 0)",
                label: "Streak",
                color: ArcTheme.Colors.yellow
            )

            statCard(
                icon: "calendar",
                value: dayNumberString,
                label: "Challenge",
                color: ArcTheme.Colors.cyan
            )
        }
    }

    private func statCard(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: ArcTheme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)

            Text(value)
                .font(ArcTheme.Typography.heading())
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(ArcTheme.Colors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(ArcTheme.Spacing.md)
        .background(ArcTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous)
                .stroke(ArcTheme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Menu Section

    private var menuSection: some View {
        VStack(spacing: 0) {
            menuItem(icon: "person.fill", title: "Edit Profile") {
                showEditProfile = true
            }
            menuDivider
            menuItem(icon: "bell.fill", title: "Notifications") { }
            menuDivider
            menuItem(icon: "gearshape.fill", title: "Settings") { }
            menuDivider
            menuItem(icon: "questionmark.circle.fill", title: "Help & Support") { }
        }
        .background(ArcTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous)
                .stroke(ArcTheme.Colors.border, lineWidth: 1)
        )
    }

    private var menuDivider: some View {
        Divider()
            .background(ArcTheme.Colors.border)
            .padding(.leading, ArcTheme.Spacing.xxxl + ArcTheme.Spacing.lg)
    }

    private func menuItem(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: ArcTheme.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(ArcTheme.Colors.textSecondary)
                    .frame(width: 24)

                Text(title)
                    .font(ArcTheme.Typography.body())
                    .foregroundStyle(ArcTheme.Colors.textPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13))
                    .foregroundStyle(ArcTheme.Colors.textMuted)
            }
            .padding(.horizontal, ArcTheme.Spacing.lg)
            .padding(.vertical, ArcTheme.Spacing.md)
        }
    }

    // MARK: - Sign Out

    private var signOutButton: some View {
        Button {
            Task {
                await authVM.signOut()
            }
        } label: {
            HStack(spacing: ArcTheme.Spacing.sm) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text("Sign Out")
            }
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(ArcTheme.Colors.red)
            .frame(maxWidth: .infinity)
            .padding(.vertical, ArcTheme.Spacing.lg)
            .background(ArcTheme.Colors.red.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous)
                    .stroke(ArcTheme.Colors.red.opacity(0.2), lineWidth: 1)
            )
        }
    }

    // MARK: - Helpers

    private var avatarInitial: String {
        String((profile?.username ?? "A").prefix(1)).uppercased()
    }

    private var dayNumberString: String {
        guard let startDate = profile?.challengeStartDate else { return "--" }
        let days = Calendar.current.dateComponents([.day], from: startDate, to: Date()).day ?? 0
        return "Day \(max(1, days + 1))"
    }
}

#Preview {
    ProfileView()
}
