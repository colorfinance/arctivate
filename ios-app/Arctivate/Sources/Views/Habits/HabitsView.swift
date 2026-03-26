import SwiftUI

struct HabitsView: View {
    @State private var showAddHabitSheet = false
    @State private var newHabitTitle = ""
    @State private var newHabitPoints = "10"

    // Placeholder state until HabitsViewModel is wired up
    @State private var habits: [Habit] = []
    @State private var completedHabitIds: Set<UUID> = []
    @State private var challengeDaysGoal: Int = 75
    @State private var currentDay: Int = 12
    @State private var currentStreak: Int = 12
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ArcTheme.Spacing.xl) {
                        challengeCard
                        habitsSection
                    }
                    .padding(.horizontal, ArcTheme.Spacing.lg)
                    .padding(.top, ArcTheme.Spacing.md)
                    .padding(.bottom, 100)
                }
            }
            .navigationTitle("Habits")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddHabitSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(ArcTheme.Colors.primary)
                    }
                }
            }
            .sheet(isPresented: $showAddHabitSheet) {
                AddHabitSheet(
                    title: $newHabitTitle,
                    points: $newHabitPoints,
                    onSave: {
                        let habit = Habit(
                            id: UUID(),
                            title: newHabitTitle,
                            pointsReward: Int(newHabitPoints) ?? 10,
                            isActive: true
                        )
                        habits.append(habit)
                        newHabitTitle = ""
                        newHabitPoints = "10"
                    }
                )
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Challenge Card

    private var challengeCard: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            HStack {
                VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                    Text("\(challengeDaysGoal)-Day Challenge")
                        .font(ArcTheme.Typography.heading())
                        .foregroundStyle(ArcTheme.Colors.textPrimary)
                    Text("Stay consistent, build your streak")
                        .font(ArcTheme.Typography.caption())
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
                Spacer()

                VStack(alignment: .trailing, spacing: ArcTheme.Spacing.xxs) {
                    Text("Day \(currentDay)")
                        .font(ArcTheme.Typography.heading())
                        .foregroundStyle(ArcTheme.Colors.primary)
                    HStack(spacing: ArcTheme.Spacing.xs) {
                        Image(systemName: "flame.fill")
                            .font(.caption)
                            .foregroundStyle(ArcTheme.Colors.orange)
                        Text("\(currentStreak) streak")
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.orange)
                    }
                }
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.full)
                        .fill(ArcTheme.Colors.surfaceLight)
                        .frame(height: 10)

                    let progress = min(1.0, Double(currentDay) / Double(max(1, challengeDaysGoal)))
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.full)
                        .fill(ArcTheme.Colors.primaryGradient)
                        .frame(width: geo.size.width * progress, height: 10)
                }
            }
            .frame(height: 10)

            HStack {
                Text("\(currentDay) / \(challengeDaysGoal) days")
                    .font(ArcTheme.Typography.caption())
                    .foregroundStyle(ArcTheme.Colors.textMuted)
                Spacer()
                Text("\(Int(Double(currentDay) / Double(max(1, challengeDaysGoal)) * 100))%")
                    .font(ArcTheme.Typography.caption())
                    .fontWeight(.bold)
                    .foregroundStyle(ArcTheme.Colors.primary)
            }
        }
        .arcCard()
    }

    // MARK: - Habits Section

    private var habitsSection: some View {
        VStack(alignment: .leading, spacing: ArcTheme.Spacing.md) {
            HStack {
                Text("Daily Habits")
                    .font(ArcTheme.Typography.heading())
                    .foregroundStyle(ArcTheme.Colors.textPrimary)
                Spacer()

                let completedCount = completedHabitIds.count
                let totalCount = habits.count
                if totalCount > 0 {
                    Text("\(completedCount)/\(totalCount)")
                        .font(ArcTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(ArcTheme.Colors.primary)
                        .padding(.horizontal, ArcTheme.Spacing.sm)
                        .padding(.vertical, ArcTheme.Spacing.xs)
                        .background(ArcTheme.Colors.primary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                }
            }

            if habits.isEmpty {
                emptyHabitsPlaceholder
            } else {
                ForEach(habits) { habit in
                    habitRow(habit)
                }
            }
        }
    }

    private var emptyHabitsPlaceholder: some View {
        VStack(spacing: ArcTheme.Spacing.md) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 40))
                .foregroundStyle(ArcTheme.Colors.textMuted)
            Text("No habits yet")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(ArcTheme.Colors.textSecondary)
            Text("Add daily habits to build your streak and earn points")
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ArcTheme.Spacing.xxxl)
        .arcCard()
    }

    private func habitRow(_ habit: Habit) -> some View {
        let isCompleted = completedHabitIds.contains(habit.id)

        return Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                if isCompleted {
                    completedHabitIds.remove(habit.id)
                } else {
                    completedHabitIds.insert(habit.id)
                }
            }
        } label: {
            HStack(spacing: ArcTheme.Spacing.md) {
                // Checkbox
                ZStack {
                    Circle()
                        .stroke(
                            isCompleted ? ArcTheme.Colors.primary : ArcTheme.Colors.textMuted,
                            lineWidth: 2
                        )
                        .frame(width: 28, height: 28)

                    if isCompleted {
                        Circle()
                            .fill(ArcTheme.Colors.primary)
                            .frame(width: 28, height: 28)

                        Image(systemName: "checkmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.black)
                    }
                }

                VStack(alignment: .leading, spacing: ArcTheme.Spacing.xxs) {
                    Text(habit.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(isCompleted ? ArcTheme.Colors.textMuted : ArcTheme.Colors.textPrimary)
                        .strikethrough(isCompleted)

                    if let desc = habit.description, !desc.isEmpty {
                        Text(desc)
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textMuted)
                    }
                }

                Spacer()

                Text("+\(habit.pointsReward ?? 10) pts")
                    .font(ArcTheme.Typography.mono())
                    .foregroundStyle(ArcTheme.Colors.primary)
            }
            .padding(ArcTheme.Spacing.lg)
            .background(isCompleted ? ArcTheme.Colors.primary.opacity(0.05) : ArcTheme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous)
                    .stroke(
                        isCompleted ? ArcTheme.Colors.primary.opacity(0.3) : ArcTheme.Colors.border,
                        lineWidth: 1
                    )
            )
        }
    }
}

// MARK: - Add Habit Sheet

struct AddHabitSheet: View {
    @Binding var title: String
    @Binding var points: String
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: ArcTheme.Spacing.xl) {
                    VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                        Text("Habit Name")
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textSecondary)
                        TextField("e.g. Drink 2L water", text: $title)
                            .foregroundStyle(ArcTheme.Colors.textPrimary)
                            .padding(ArcTheme.Spacing.md)
                            .background(ArcTheme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous)
                                    .stroke(ArcTheme.Colors.border, lineWidth: 1)
                            )
                    }

                    VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                        Text("Points Reward")
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textSecondary)
                        TextField("10", text: $points)
                            .keyboardType(.numberPad)
                            .foregroundStyle(ArcTheme.Colors.textPrimary)
                            .padding(ArcTheme.Spacing.md)
                            .background(ArcTheme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous)
                                    .stroke(ArcTheme.Colors.border, lineWidth: 1)
                            )
                    }

                    Spacer()

                    Button {
                        guard !title.isEmpty else { return }
                        onSave()
                        dismiss()
                    } label: {
                        Text("Add Habit")
                            .font(.headline)
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, ArcTheme.Spacing.lg)
                            .background(title.isEmpty ? ArcTheme.Colors.textMuted : ArcTheme.Colors.primary)
                            .foregroundStyle(.black)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                    }
                    .disabled(title.isEmpty)
                }
                .padding(ArcTheme.Spacing.xxl)
            }
            .navigationTitle("Add Habit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
            }
        }
        .presentationDetents([.medium])
        .preferredColorScheme(.dark)
    }
}

#Preview {
    HabitsView()
}
