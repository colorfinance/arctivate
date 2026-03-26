import Foundation
import Observation
import Supabase

// MARK: - HabitsViewModel

/// Manages habits list, today's logs, toggling completion (with points award/deduction),
/// adding habits, and challenge progress calculation.
///
/// BUG FIX: When un-completing a habit, points are now correctly deducted from the profile.
/// Previously the mobile app only awarded points but never removed them on un-toggle.
@Observable
final class HabitsViewModel {

    // MARK: - State

    var habits: [Habit] = []
    var todaysLogs: [HabitLog] = []
    var profile: Profile?
    var isLoading = false
    var errorMessage: String?

    // MARK: - Private

    private let supabase = SupabaseService.shared

    // MARK: - Computed Properties

    /// Set of habit IDs completed today.
    var completedHabitIds: Set<UUID> {
        Set(todaysLogs.compactMap(\.habitId))
    }

    /// Whether a specific habit is completed today.
    func isCompleted(_ habit: Habit) -> Bool {
        completedHabitIds.contains(habit.id)
    }

    /// Today's total points earned from habits.
    var todaysHabitPoints: Int {
        todaysLogs.compactMap { log in
            habits.first(where: { $0.id == log.habitId })?.pointsReward
        }.reduce(0, +)
    }

    /// Challenge progress: days elapsed since challenge start date.
    var challengeDaysElapsed: Int {
        guard let startDate = profile?.challengeStartDate else { return 0 }
        let calendar = Calendar.current
        return max(0, calendar.dateComponents([.day], from: startDate, to: Date()).day ?? 0)
    }

    /// Challenge progress as a fraction (0.0 to 1.0).
    var challengeProgress: Double {
        guard let goal = profile?.challengeDaysGoal, goal > 0 else { return 0 }
        return min(1.0, Double(challengeDaysElapsed) / Double(goal))
    }

    /// Number of active habits.
    var activeHabitCount: Int {
        habits.filter { $0.isActive == true }.count
    }

    // MARK: - Load Data

    @MainActor
    func loadData() async {
        guard let userId = await currentUserId() else { return }

        isLoading = true
        errorMessage = nil

        do {
            let todayString = todayDateString()

            async let fetchedHabits: [Habit] = supabase
                .from("habits")
                .select()
                .eq("user_id", value: userId.uuidString)
                .eq("is_active", value: "true")
                .order("created_at")
                .execute()
                .value

            async let fetchedLogs: [HabitLog] = supabase
                .from("habit_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .eq("date", value: todayString)
                .execute()
                .value

            async let fetchedProfile: Profile = supabase
                .from("profiles")
                .select()
                .eq("id", value: userId.uuidString)
                .single()
                .execute()
                .value

            habits = try await fetchedHabits
            todaysLogs = try await fetchedLogs
            profile = try await fetchedProfile
        } catch {
            errorMessage = "Failed to load habits."
        }

        isLoading = false
    }

    // MARK: - Toggle Habit

    /// Toggles a habit's completion for today.
    /// - Awards points when completing.
    /// - **Deducts points when un-completing** (bug fix).
    @MainActor
    func toggleHabit(_ habit: Habit) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in."
            return
        }

        errorMessage = nil

        let alreadyCompleted = isCompleted(habit)
        let points = habit.pointsReward ?? 0

        do {
            if alreadyCompleted {
                // Un-complete: remove the log and deduct points
                guard let existingLog = todaysLogs.first(where: { $0.habitId == habit.id }) else {
                    return
                }

                try await supabase
                    .from("habit_logs")
                    .delete()
                    .eq("id", value: existingLog.id.uuidString)
                    .eq("user_id", value: userId.uuidString)
                    .execute()

                todaysLogs.removeAll { $0.id == existingLog.id }

                // BUG FIX: Deduct points when un-completing a habit.
                // The mobile app previously did not deduct points, letting users
                // farm points by toggling habits on and off.
                if points > 0 {
                    try await supabase.rpc(
                        "increment_points",
                        params: ["row_id": userId.uuidString, "x": -points]
                    )
                    if let current = profile?.totalPoints {
                        profile?.totalPoints = max(0, current - points)
                    }
                }
            } else {
                // Complete: insert a log and award points
                let todayString = todayDateString()

                let log: HabitLog = try await supabase
                    .from("habit_logs")
                    .insert([
                        "user_id": userId.uuidString,
                        "habit_id": habit.id.uuidString,
                        "date": todayString,
                        "completed_at": ISO8601DateFormatter().string(from: Date())
                    ])
                    .select()
                    .single()
                    .execute()
                    .value

                todaysLogs.append(log)

                // Award points
                if points > 0 {
                    try await supabase.rpc(
                        "increment_points",
                        params: ["row_id": userId.uuidString, "x": points]
                    )
                    if let current = profile?.totalPoints {
                        profile?.totalPoints = current + points
                    }
                }
            }
        } catch {
            errorMessage = alreadyCompleted
                ? "Failed to un-complete habit."
                : "Failed to complete habit."
            // Reload to get back in sync
            await loadData()
        }
    }

    // MARK: - Add Habit

    @MainActor
    func addHabit(title: String, description: String?, pointsReward: Int = 10) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in to add habits."
            return
        }

        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else {
            errorMessage = "Habit title cannot be empty."
            return
        }

        errorMessage = nil

        do {
            var insertData: [String: String] = [
                "user_id": userId.uuidString,
                "title": trimmedTitle,
                "points_reward": String(pointsReward),
                "is_active": "true"
            ]
            if let description, !description.trimmingCharacters(in: .whitespaces).isEmpty {
                insertData["description"] = description.trimmingCharacters(in: .whitespaces)
            }

            let newHabit: Habit = try await supabase
                .from("habits")
                .insert(insertData)
                .select()
                .single()
                .execute()
                .value

            habits.append(newHabit)
        } catch {
            errorMessage = "Failed to add habit."
        }
    }

    // MARK: - Delete Habit (soft-delete by deactivating)

    @MainActor
    func deactivateHabit(_ habit: Habit) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in."
            return
        }

        do {
            try await supabase
                .from("habits")
                .update(["is_active": "false"])
                .eq("id", value: habit.id.uuidString)
                .eq("user_id", value: userId.uuidString)
                .execute()

            habits.removeAll { $0.id == habit.id }
        } catch {
            errorMessage = "Failed to remove habit."
        }
    }

    // MARK: - Helpers

    /// Returns today's date as "YYYY-MM-DD" to match the PostgreSQL date column.
    private func todayDateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: Date())
    }

    private func currentUserId() async -> UUID? {
        try? await supabase.auth.session.user.id
    }
}
