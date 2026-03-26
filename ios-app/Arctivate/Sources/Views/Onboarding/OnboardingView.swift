import SwiftUI

struct OnboardingView: View {
    @State private var currentPage = 0
    var onComplete: () -> Void

    let pages = [
        OnboardingPage(
            icon: "bolt.fill",
            title: "ARCTIVATE",
            subtitle: "Gamify Your Discipline",
            description: "Track workouts, habits, and nutrition. Earn points. Compete with friends. Level up your fitness."
        ),
        OnboardingPage(
            icon: "trophy.fill",
            title: "EARN POINTS",
            subtitle: "Every Rep Counts",
            description: "Habits: +10pts | Workouts: +50pts | New PBs: +100pts | Check-ins: +150pts"
        ),
        OnboardingPage(
            icon: "flame.fill",
            title: "BUILD STREAKS",
            subtitle: "75-Day Challenge",
            description: "Complete daily habits, log workouts, and track your nutrition to build an unbreakable streak."
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Page Content
            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    VStack(spacing: Theme.Spacing.lg) {
                        // Icon
                        ZStack {
                            Circle()
                                .fill(Theme.Colors.primaryDim)
                                .frame(width: 100, height: 100)
                            Image(systemName: page.icon)
                                .font(.system(size: 40))
                                .foregroundStyle(Theme.Colors.primary)
                        }

                        // Title
                        Text(page.title)
                            .font(.system(size: 32, weight: .black))
                            .italic()
                            .foregroundStyle(Theme.Colors.textPrimary)
                            .tracking(-1)

                        // Subtitle
                        Text(page.subtitle)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.Colors.primary)
                            .textCase(.uppercase)
                            .tracking(2)

                        // Description
                        Text(page.description)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.Colors.textMuted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            Spacer()

            // Page Indicators
            HStack(spacing: 8) {
                ForEach(0..<pages.count, id: \.self) { index in
                    Circle()
                        .fill(index == currentPage ? Theme.Colors.primary : Theme.Colors.textMuted.opacity(0.3))
                        .frame(width: index == currentPage ? 10 : 6, height: index == currentPage ? 10 : 6)
                        .animation(.easeInOut(duration: 0.2), value: currentPage)
                }
            }
            .padding(.bottom, Theme.Spacing.lg)

            // Button
            Button {
                if currentPage < pages.count - 1 {
                    withAnimation { currentPage += 1 }
                } else {
                    onComplete()
                }
            } label: {
                Text(currentPage < pages.count - 1 ? "NEXT" : "GET STARTED")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Colors.background)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.Spacing.lg)
                    .background(Theme.Colors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.bottom, Theme.Spacing.xxl)
        }
        .background(Theme.Colors.background)
    }
}

struct OnboardingPage {
    let icon: String
    let title: String
    let subtitle: String
    let description: String
}
