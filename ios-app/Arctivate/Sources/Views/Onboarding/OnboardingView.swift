import SwiftUI

// MARK: - Onboarding Page Model

struct OnboardingPage {
    let icon: String
    let title: String
    let subtitle: String
    let description: String
}

// MARK: - Onboarding View

struct OnboardingView: View {
    @State private var currentPage = 0
    @State private var selectedGoals: Set<String> = []
    @State private var selectedHabits: Set<String> = []

    var onComplete: () -> Void

    private let pages: [OnboardingPage] = [
        OnboardingPage(
            icon: "bolt.fill",
            title: "ARCTIVATE",
            subtitle: "Gamify Your Discipline",
            description: "Track workouts, habits, and nutrition. Earn points. Compete with friends. Level up your fitness."
        ),
        OnboardingPage(
            icon: "trophy.fill",
            title: "SET YOUR GOALS",
            subtitle: "What drives you?",
            description: "Select the goals that matter most to you. We'll tailor your experience."
        ),
        OnboardingPage(
            icon: "flame.fill",
            title: "DAILY HABITS",
            subtitle: "Build Your Routine",
            description: "Choose habits to track daily. Complete them to build streaks and earn points."
        ),
    ]

    private let goalOptions = [
        "Build Muscle", "Lose Weight", "Increase Strength",
        "Improve Endurance", "Better Nutrition", "Build Consistency"
    ]

    private let habitOptions = [
        "Drink 2L water", "8 hours sleep", "10k steps",
        "Eat 5 servings of veg", "Morning stretch", "Track all meals"
    ]

    var body: some View {
        ZStack {
            ArcTheme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Page Content
                TabView(selection: $currentPage) {
                    welcomePage
                        .tag(0)
                    goalsPage
                        .tag(1)
                    habitsPage
                        .tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                Spacer()

                // Page Indicators
                pageIndicators

                // Action Button
                actionButton
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Welcome Page

    private var welcomePage: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(ArcTheme.Colors.primary.opacity(0.15))
                    .frame(width: 100, height: 100)
                Image(systemName: pages[0].icon)
                    .font(.system(size: 40))
                    .foregroundStyle(ArcTheme.Colors.primaryGradient)
            }

            Text(pages[0].title)
                .font(.system(size: 34, weight: .black, design: .rounded))
                .tracking(4)
                .foregroundStyle(ArcTheme.Colors.primaryGradient)

            Text(pages[0].subtitle)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(ArcTheme.Colors.primary)
                .textCase(.uppercase)
                .tracking(2)

            Text(pages[0].description)
                .font(ArcTheme.Typography.body())
                .foregroundStyle(ArcTheme.Colors.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            // Points breakdown
            VStack(spacing: ArcTheme.Spacing.sm) {
                pointsRow(label: "Habits", points: "+10 pts", icon: "checkmark.circle.fill")
                pointsRow(label: "Workouts", points: "+50 pts", icon: "dumbbell.fill")
                pointsRow(label: "New PBs", points: "+100 pts", icon: "trophy.fill")
                pointsRow(label: "Check-ins", points: "+150 pts", icon: "mappin.circle.fill")
            }
            .padding(.top, ArcTheme.Spacing.md)
        }
    }

    private func pointsRow(label: String, points: String, icon: String) -> some View {
        HStack(spacing: ArcTheme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(ArcTheme.Colors.primary)
                .frame(width: 24)

            Text(label)
                .font(ArcTheme.Typography.body())
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            Spacer()

            Text(points)
                .font(ArcTheme.Typography.mono())
                .foregroundStyle(ArcTheme.Colors.orange)
        }
        .padding(.horizontal, ArcTheme.Spacing.xxxl)
    }

    // MARK: - Goals Page

    private var goalsPage: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(ArcTheme.Colors.primary.opacity(0.15))
                    .frame(width: 80, height: 80)
                Image(systemName: pages[1].icon)
                    .font(.system(size: 36))
                    .foregroundStyle(ArcTheme.Colors.yellow)
            }

            Text(pages[1].title)
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            Text(pages[1].subtitle)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(ArcTheme.Colors.primary)
                .textCase(.uppercase)
                .tracking(2)

            // Goal chips
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: ArcTheme.Spacing.md) {
                ForEach(goalOptions, id: \.self) { goal in
                    let isSelected = selectedGoals.contains(goal)
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            if isSelected {
                                selectedGoals.remove(goal)
                            } else {
                                selectedGoals.insert(goal)
                            }
                        }
                    } label: {
                        Text(goal)
                            .font(ArcTheme.Typography.caption())
                            .fontWeight(.semibold)
                            .foregroundStyle(isSelected ? .black : ArcTheme.Colors.textPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, ArcTheme.Spacing.md)
                            .background(isSelected ? ArcTheme.Colors.primary : ArcTheme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous)
                                    .stroke(
                                        isSelected ? ArcTheme.Colors.primary : ArcTheme.Colors.border,
                                        lineWidth: 1
                                    )
                            )
                    }
                }
            }
            .padding(.horizontal, ArcTheme.Spacing.xxl)
        }
    }

    // MARK: - Habits Page

    private var habitsPage: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(ArcTheme.Colors.primary.opacity(0.15))
                    .frame(width: 80, height: 80)
                Image(systemName: pages[2].icon)
                    .font(.system(size: 36))
                    .foregroundStyle(ArcTheme.Colors.orange)
            }

            Text(pages[2].title)
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            Text(pages[2].subtitle)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(ArcTheme.Colors.primary)
                .textCase(.uppercase)
                .tracking(2)

            // Habit selection list
            VStack(spacing: ArcTheme.Spacing.sm) {
                ForEach(habitOptions, id: \.self) { habit in
                    let isSelected = selectedHabits.contains(habit)
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            if isSelected {
                                selectedHabits.remove(habit)
                            } else {
                                selectedHabits.insert(habit)
                            }
                        }
                    } label: {
                        HStack(spacing: ArcTheme.Spacing.md) {
                            ZStack {
                                Circle()
                                    .stroke(
                                        isSelected ? ArcTheme.Colors.primary : ArcTheme.Colors.textMuted,
                                        lineWidth: 2
                                    )
                                    .frame(width: 24, height: 24)

                                if isSelected {
                                    Circle()
                                        .fill(ArcTheme.Colors.primary)
                                        .frame(width: 24, height: 24)
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(.black)
                                }
                            }

                            Text(habit)
                                .font(ArcTheme.Typography.body())
                                .foregroundStyle(ArcTheme.Colors.textPrimary)

                            Spacer()

                            Text("+10 pts")
                                .font(ArcTheme.Typography.mono())
                                .foregroundStyle(ArcTheme.Colors.primary)
                        }
                        .padding(.horizontal, ArcTheme.Spacing.lg)
                        .padding(.vertical, ArcTheme.Spacing.md)
                        .background(isSelected ? ArcTheme.Colors.primary.opacity(0.05) : ArcTheme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous)
                                .stroke(
                                    isSelected ? ArcTheme.Colors.primary.opacity(0.3) : ArcTheme.Colors.border,
                                    lineWidth: 1
                                )
                        )
                    }
                }
            }
            .padding(.horizontal, ArcTheme.Spacing.xxl)
        }
    }

    // MARK: - Page Indicators

    private var pageIndicators: some View {
        HStack(spacing: 8) {
            ForEach(0..<pages.count, id: \.self) { index in
                RoundedRectangle(cornerRadius: ArcTheme.Radius.full)
                    .fill(index == currentPage ? ArcTheme.Colors.primary : ArcTheme.Colors.textMuted.opacity(0.3))
                    .frame(width: index == currentPage ? 24 : 8, height: 8)
                    .animation(.easeInOut(duration: 0.2), value: currentPage)
            }
        }
        .padding(.bottom, ArcTheme.Spacing.lg)
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Button {
            if currentPage < pages.count - 1 {
                withAnimation(.easeInOut) {
                    currentPage += 1
                }
            } else {
                onComplete()
            }
        } label: {
            Text(currentPage < pages.count - 1 ? "NEXT" : "GET STARTED")
                .font(.system(size: 16, weight: .bold))
                .tracking(1)
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, ArcTheme.Spacing.lg)
                .background(ArcTheme.Colors.primaryGradient)
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
        }
        .padding(.horizontal, ArcTheme.Spacing.lg)
        .padding(.bottom, ArcTheme.Spacing.xxl)
    }
}

#Preview {
    OnboardingView {
        print("Onboarding complete")
    }
}
