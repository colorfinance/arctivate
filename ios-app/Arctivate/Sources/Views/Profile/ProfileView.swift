import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                // Avatar & Name
                VStack(spacing: Theme.Spacing.md) {
                    ZStack {
                        Circle()
                            .fill(Theme.Colors.primaryDim)
                            .frame(width: 80, height: 80)
                        Text(viewModel.avatarInitial)
                            .font(.system(size: 32, weight: .bold))
                            .foregroundStyle(Theme.Colors.primary)
                    }

                    Text(viewModel.displayName)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(Theme.Colors.textPrimary)

                    if let bio = viewModel.profile?.bio, !bio.isEmpty {
                        Text(bio)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Colors.textMuted)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.top, Theme.Spacing.lg)

                // Stats Grid
                HStack(spacing: Theme.Spacing.md) {
                    statCard(value: "\(viewModel.totalPoints)", label: "Points", icon: "bolt.fill")
                    statCard(value: "\(viewModel.currentStreak)", label: "Streak", icon: "flame.fill")
                    statCard(value: "Day \(viewModel.challengeDayNumber)", label: "Challenge", icon: "trophy.fill")
                }
                .padding(.horizontal, Theme.Spacing.lg)

                // Menu Items
                VStack(spacing: 2) {
                    menuItem(icon: "person.fill", title: "Edit Profile")
                    menuItem(icon: "bell.fill", title: "Notifications")
                    menuItem(icon: "gear", title: "Settings")
                    menuItem(icon: "questionmark.circle.fill", title: "Help & Support")
                }
                .background(Theme.Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
                .padding(.horizontal, Theme.Spacing.lg)

                // Sign Out
                Button {
                    Task { await viewModel.signOut() }
                } label: {
                    HStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                        Text("Sign Out")
                    }
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.Spacing.md)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.md)

                // App Version
                Text("Arctivate v1.0.0")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.textMuted)
                    .padding(.top, Theme.Spacing.md)
            }
            .padding(.bottom, 100)
        }
        .background(Theme.Colors.background)
        .task { await viewModel.loadProfile() }
    }

    func statCard(value: String, label: String, icon: String) -> some View {
        VStack(spacing: Theme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Theme.Colors.primary)

            Text(value)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.Colors.textPrimary)

            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.md)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }

    func menuItem(icon: String, title: String) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 24)

            Text(title)
                .font(.system(size: 16))
                .foregroundStyle(Theme.Colors.textPrimary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Colors.textMuted)
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md)
    }
}
