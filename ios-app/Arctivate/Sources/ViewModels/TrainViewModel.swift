import Foundation
import Observation
import Supabase

// MARK: - TrainViewModel

/// Manages exercises, today's workout logs, logging sets with PB detection and points.
@Observable
final class TrainViewModel {

    // MARK: - State

    var exercises: [Exercise] = []
    var todaysLogs: [WorkoutLog] = []
    var isLoading = false
    var errorMessage: String?

    // MARK: - Private

    private let supabase = SupabaseService.shared
    private let pointsPerSet = 5
    private let pbBonusPoints = 20

    // MARK: - Computed Properties

    /// Today's total sets across all exercises.
    var todaysTotalSets: Int {
        todaysLogs.compactMap(\.sets).reduce(0, +)
    }

    /// Today's total points earned.
    var todaysTotalPoints: Int {
        todaysLogs.compactMap(\.pointsAwarded).reduce(0, +)
    }

    /// Number of new PBs achieved today.
    var todaysPBCount: Int {
        todaysLogs.filter { $0.isNewPb == true }.count
    }

    // MARK: - Load Data

    /// Loads exercises and today's workout logs for the current user.
    @MainActor
    func loadData() async {
        guard let userId = await currentUserId() else { return }

        isLoading = true
        errorMessage = nil

        do {
            let startOfDay = Calendar.current.startOfDay(for: Date())
            let isoFormatter = ISO8601DateFormatter()

            async let fetchedExercises: [Exercise] = supabase
                .from("exercises")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("name")
                .execute()
                .value

            async let fetchedLogs: [WorkoutLog] = supabase
                .from("workout_logs")
                .select("*, exercises(id, user_id, name, metric_type, muscle_group)")
                .eq("user_id", value: userId.uuidString)
                .gte("created_at", value: isoFormatter.string(from: startOfDay))
                .order("created_at", ascending: false)
                .execute()
                .value

            exercises = try await fetchedExercises
            todaysLogs = try await fetchedLogs
        } catch {
            errorMessage = "Failed to load workout data."
        }

        isLoading = false
    }

    // MARK: - Add Exercise

    @MainActor
    func addExercise(name: String, metricType: String, muscleGroup: String?) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in to add exercises."
            return
        }

        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else {
            errorMessage = "Exercise name cannot be empty."
            return
        }

        errorMessage = nil

        do {
            let newExercise: Exercise = try await supabase
                .from("exercises")
                .insert([
                    "user_id": userId.uuidString,
                    "name": trimmedName,
                    "metric_type": metricType,
                    "muscle_group": muscleGroup ?? ""
                ])
                .select()
                .single()
                .execute()
                .value

            exercises.append(newExercise)
            exercises.sort { $0.name < $1.name }
        } catch {
            errorMessage = "Failed to add exercise."
        }
    }

    // MARK: - Log Set

    /// Logs a set for an exercise, checks for a new personal best, and awards points.
    /// Returns `true` if a new PB was achieved.
    @MainActor
    @discardableResult
    func logSet(
        exerciseId: UUID,
        value: Double,
        sets: Int,
        reps: Int,
        rpe: Int? = nil
    ) async -> Bool {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in to log sets."
            return false
        }

        errorMessage = nil

        do {
            // 1. Check current personal best
            let currentPBs: [PersonalBest] = try await supabase
                .from("personal_bests")
                .select()
                .eq("user_id", value: userId.uuidString)
                .eq("exercise_id", value: exerciseId.uuidString)
                .order("value", ascending: false)
                .limit(1)
                .execute()
                .value

            let isNewPB = currentPBs.isEmpty || value > (currentPBs.first?.value ?? 0)

            // 2. Calculate points
            var points = sets * pointsPerSet
            if isNewPB {
                points += pbBonusPoints
            }

            // 3. Insert workout log
            var insertData: [String: String] = [
                "user_id": userId.uuidString,
                "exercise_id": exerciseId.uuidString,
                "value": String(value),
                "sets": String(sets),
                "reps": String(reps),
                "is_new_pb": isNewPB ? "true" : "false",
                "points_awarded": String(points)
            ]
            if let rpe {
                insertData["rpe"] = String(rpe)
            }

            let log: WorkoutLog = try await supabase
                .from("workout_logs")
                .insert(insertData)
                .select("*, exercises(id, user_id, name, metric_type, muscle_group)")
                .single()
                .execute()
                .value

            todaysLogs.insert(log, at: 0)

            // 4. Update personal best if new PB
            if isNewPB {
                let isoNow = ISO8601DateFormatter().string(from: Date())
                if currentPBs.isEmpty {
                    try await supabase
                        .from("personal_bests")
                        .insert([
                            "user_id": userId.uuidString,
                            "exercise_id": exerciseId.uuidString,
                            "value": String(value),
                            "achieved_at": isoNow
                        ])
                        .execute()
                } else {
                    try await supabase
                        .from("personal_bests")
                        .update(["value": String(value), "achieved_at": isoNow])
                        .eq("user_id", value: userId.uuidString)
                        .eq("exercise_id", value: exerciseId.uuidString)
                        .execute()
                }
            }

            // 5. Award points to profile
            try await supabase.rpc(
                "increment_points",
                params: ["row_id": userId.uuidString, "x": points]
            )

            return isNewPB
        } catch {
            errorMessage = "Failed to log set."
            return false
        }
    }

    // MARK: - Helpers

    private func currentUserId() async -> UUID? {
        try? await supabase.auth.session.user.id
    }
}
