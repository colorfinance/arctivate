import SwiftUI

struct HabitsView: View {
    @State private var viewModel = HabitsViewModel()
    @State private var showAddSheet = false
    @State private var newHabitTitle = ""

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                // Header
                Text("Habits")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Challenge Card
                VStack(spacing: Theme.Spacing.md) {
                    HStack {
                        Text("\(viewModel.challengeDaysGoal)-Day Challenge")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Spacer()
                        Text("Day \(viewModel.dayNumber > 0 ? String(min(viewModel.dayNumber, viewModel.challengeDaysGoal)) : "--")")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(Theme.Colors.primary)
                    }

                    // Progress Bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Theme.Colors.surface)
                                .frame(height: 8)
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Theme.Colors.primary)
                                .frame(width: geo.size.width * viewModel.challengeProgress, height: 8)
                        }
                    }
                    .frame(height: 8)

                    // Stats Row
                    HStack(spacing: 0) {
                        statItem(value: "\(Int(viewModel.todayCompletion * 100))%", label: "Today")
                        Spacer()
                        statItem(value: "\(viewModel.currentStreak)", label: "Streak")
                        Spacer()
                        statItem(value: "\(viewModel.totalPoints)", label: "Points")
                    }
                }
                .padding(Theme.Spacing.lg)
                .background(Theme.Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )

                // Section Header
                HStack {
                    Text("Daily Habits")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Spacer()
                    Button {
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 20))
                            .foregroundStyle(Theme.Colors.primary)
                            .frame(width: 36, height: 36)
                            .background(Theme.Colors.primaryDim)
                            .clipShape(Circle())
                    }
                }

                // Habit List
                if viewModel.habits.isEmpty {
                    VStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.Colors.textMuted)
                        Text("No habits yet")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Theme.Colors.textSecondary)
                        Text("Add daily habits to build your streak")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Colors.textMuted)
                    }
                    .padding(.top, Theme.Spacing.xxl)
                } else {
                    ForEach(viewModel.habits) { habit in
                        let done = viewModel.isCompleted(habitId: habit.id)
                        Button {
                            Task { await viewModel.toggleHabit(habit) }
                        } label: {
                            HStack(spacing: Theme.Spacing.md) {
                                // Checkbox
                                ZStack {
                                    Circle()
                                        .stroke(done ? Theme.Colors.primary : Theme.Colors.textMuted, lineWidth: 2)
                                        .frame(width: 28, height: 28)
                                    if done {
                                        Circle()
                                            .fill(Theme.Colors.primary)
                                            .frame(width: 28, height: 28)
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundStyle(Theme.Colors.background)
                                    }
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(habit.title)
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(done ? Theme.Colors.textMuted : Theme.Colors.textPrimary)
                                        .strikethrough(done)
                                    Text("+\(habit.pointsReward ?? 10) pts")
                                        .font(.system(size: 13, design: .monospaced))
                                        .foregroundStyle(Theme.Colors.primary)
                                }

                                Spacer()
                            }
                            .padding(Theme.Spacing.md)
                            .background(done ? Theme.Colors.primary.opacity(0.05) : Theme.Colors.card)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.md)
                                    .stroke(done ? Theme.Colors.primary : Theme.Colors.border, lineWidth: 1)
                            )
                        }
                    }
                }
            }
            .padding(Theme.Spacing.lg)
            .padding(.bottom, 100)
        }
        .background(Theme.Colors.background)
        .task { await viewModel.loadData() }
        .alert("Add Habit", isPresented: $showAddSheet) {
            TextField("e.g. Drink 2L water", text: $newHabitTitle)
            Button("Cancel", role: .cancel) { newHabitTitle = "" }
            Button("Add") {
                Task {
                    await viewModel.addHabit(title: newHabitTitle)
                    newHabitTitle = ""
                }
            }
        }
    }

    func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.Colors.textPrimary)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.textMuted)
        }
    }
}
