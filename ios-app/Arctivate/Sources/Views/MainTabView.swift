import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .train

    enum Tab: String, CaseIterable {
        case train, coach, feed, habits, food

        var title: String {
            switch self {
            case .train:  "Train"
            case .coach:  "Coach"
            case .feed:   "Feed"
            case .habits: "Habits"
            case .food:   "Food"
            }
        }

        var icon: String {
            switch self {
            case .train:  "dumbbell"
            case .coach:  "bubble.left.and.bubble.right"
            case .feed:   "person.2"
            case .habits: "checkmark.circle"
            case .food:   "fork.knife"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            TrainView()
                .tabItem {
                    Label(Tab.train.title, systemImage: Tab.train.icon)
                }
                .tag(Tab.train)

            CoachView()
                .tabItem {
                    Label(Tab.coach.title, systemImage: Tab.coach.icon)
                }
                .tag(Tab.coach)

            FeedView()
                .tabItem {
                    Label(Tab.feed.title, systemImage: Tab.feed.icon)
                }
                .tag(Tab.feed)

            HabitsView()
                .tabItem {
                    Label(Tab.habits.title, systemImage: Tab.habits.icon)
                }
                .tag(Tab.habits)

            FoodView()
                .tabItem {
                    Label(Tab.food.title, systemImage: Tab.food.icon)
                }
                .tag(Tab.food)
        }
        .tint(ArcTheme.Colors.primary)
        .preferredColorScheme(.dark)
        .onAppear {
            configureTabBarAppearance()
        }
    }

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(ArcTheme.Colors.background)

        let normalColor = UIColor(ArcTheme.Colors.textMuted)
        let selectedColor = UIColor(ArcTheme.Colors.primary)

        appearance.stackedLayoutAppearance.normal.iconColor = normalColor
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: normalColor
        ]
        appearance.stackedLayoutAppearance.selected.iconColor = selectedColor
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: selectedColor
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

#Preview {
    MainTabView()
}
