import Foundation
import Observation
import Supabase

// MARK: - Photo Analysis Result

struct PhotoAnalysisResult: Codable, Sendable {
    let itemName: String
    let calories: Int
    let macros: Macros

    enum CodingKeys: String, CodingKey {
        case itemName = "item_name"
        case calories
        case macros
    }
}

// MARK: - FoodViewModel

/// Manages today's food logs, calorie/macro totals, adding food, and photo analysis.
@Observable
final class FoodViewModel {

    // MARK: - State

    var todaysLogs: [FoodLog] = []
    var isLoading = false
    var isAnalyzing = false
    var errorMessage: String?

    // MARK: - Private

    private let supabase = SupabaseService.shared

    // MARK: - Computed Properties

    /// Total calories consumed today.
    var dailyCalories: Int {
        todaysLogs.compactMap(\.calories).reduce(0, +)
    }

    /// Aggregated protein for the day.
    var dailyProtein: Double {
        todaysLogs.compactMap { $0.macros?.protein }.reduce(0, +)
    }

    /// Aggregated carbs for the day.
    var dailyCarbs: Double {
        todaysLogs.compactMap { $0.macros?.carbs }.reduce(0, +)
    }

    /// Aggregated fat for the day.
    var dailyFat: Double {
        todaysLogs.compactMap { $0.macros?.fat }.reduce(0, +)
    }

    /// Aggregated macros as a single struct.
    var dailyMacros: Macros {
        Macros(
            protein: dailyProtein,
            carbs: dailyCarbs,
            fat: dailyFat,
            mealType: nil
        )
    }

    // MARK: - Load Data

    @MainActor
    func loadData() async {
        guard let userId = await currentUserId() else { return }

        isLoading = true
        errorMessage = nil

        do {
            let startOfDay = Calendar.current.startOfDay(for: Date())

            let logs: [FoodLog] = try await supabase
                .from("food_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("eaten_at", value: ISO8601DateFormatter().string(from: startOfDay))
                .order("eaten_at", ascending: false)
                .execute()
                .value

            todaysLogs = logs
        } catch {
            errorMessage = "Failed to load food logs."
        }

        isLoading = false
    }

    // MARK: - Add Food

    @MainActor
    func addFood(
        itemName: String,
        calories: Int,
        protein: Double = 0,
        carbs: Double = 0,
        fat: Double = 0,
        mealType: String? = nil
    ) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in to log food."
            return
        }

        let trimmedName = itemName.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else {
            errorMessage = "Please enter a food name."
            return
        }

        guard calories > 0 else {
            errorMessage = "Calories must be greater than zero."
            return
        }

        errorMessage = nil

        do {
            let macros = Macros(protein: protein, carbs: carbs, fat: fat, mealType: mealType)
            let macrosData = try JSONEncoder().encode(macros)
            let macrosJSON = String(data: macrosData, encoding: .utf8) ?? "{}"

            var insertData: [String: String] = [
                "user_id": userId.uuidString,
                "item_name": trimmedName,
                "calories": String(calories),
                "macros": macrosJSON,
                "eaten_at": ISO8601DateFormatter().string(from: Date())
            ]
            if let mealType {
                insertData["meal_type"] = mealType
            }

            let log: FoodLog = try await supabase
                .from("food_logs")
                .insert(insertData)
                .select()
                .single()
                .execute()
                .value

            todaysLogs.insert(log, at: 0)
        } catch {
            errorMessage = "Failed to add food log."
        }
    }

    // MARK: - Delete Food

    @MainActor
    func deleteFood(_ log: FoodLog) async {
        guard let userId = await currentUserId() else {
            errorMessage = "You must be logged in."
            return
        }

        do {
            try await supabase
                .from("food_logs")
                .delete()
                .eq("id", value: log.id.uuidString)
                .eq("user_id", value: userId.uuidString)
                .execute()

            todaysLogs.removeAll { $0.id == log.id }
        } catch {
            errorMessage = "Failed to delete food log."
        }
    }

    // MARK: - Analyze Photo

    /// Sends a photo (as base64 data) to the backend API for AI food recognition.
    @MainActor
    func analyzePhoto(imageData: Data) async -> PhotoAnalysisResult? {
        guard await currentUserId() != nil else {
            errorMessage = "You must be logged in."
            return nil
        }

        isAnalyzing = true
        errorMessage = nil

        defer { isAnalyzing = false }

        do {
            let base64String = imageData.base64EncodedString()

            var request = URLRequest(url: URL(string: "\(SupabaseService.baseURL)/api/analyze-food")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let session = try await supabase.auth.session
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

            let body: [String: String] = ["image": base64String]
            request.httpBody = try JSONEncoder().encode(body)

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                errorMessage = "Failed to analyze photo. Please try again."
                return nil
            }

            let result = try JSONDecoder().decode(PhotoAnalysisResult.self, from: data)
            return result
        } catch {
            errorMessage = "Failed to analyze photo. Please try again."
            return nil
        }
    }

    // MARK: - Helpers

    private func currentUserId() async -> UUID? {
        try? await supabase.auth.session.user.id
    }
}
