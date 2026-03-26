import Foundation

/// Service for calling the Arctivate Next.js API routes (coach, analyze, parse-voice, redeem).
final class APIService: Sendable {
    static let shared = APIService()

    private let baseURL: URL

    private init() {
        let urlString = ProcessInfo.processInfo.environment["API_BASE_URL"]
            ?? "https://arctivate.vercel.app"
        baseURL = URL(string: urlString)!
    }

    // MARK: - Errors

    enum APIError: LocalizedError {
        case invalidURL
        case httpError(statusCode: Int, message: String)
        case decodingError(String)
        case networkError(Error)

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid API URL."
            case .httpError(let code, let message):
                return "Server error (\(code)): \(message)"
            case .decodingError(let detail):
                return "Failed to parse response: \(detail)"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - AI Coach

    struct CoachRequest: Encodable {
        let message: String
        let context: CoachContext?
    }

    struct CoachContext: Encodable {
        var username: String?
        var totalPoints: Int?
        var currentStreak: Int?
        var recentWorkouts: [[String: String]]?
        var goal: String?
        var fitnessLevel: String?
    }

    struct CoachResponse: Decodable {
        let reply: String?
        let error: String?
    }

    /// Sends a message to the AI Coach and returns the reply text.
    func sendCoachMessage(message: String, context: CoachContext? = nil) async throws -> String {
        let request = CoachRequest(message: message, context: context)
        let response: CoachResponse = try await post(path: "/api/coach", body: request)

        if let error = response.error {
            throw APIError.httpError(statusCode: 400, message: error)
        }

        guard let reply = response.reply else {
            throw APIError.decodingError("No reply in coach response.")
        }

        return reply
    }

    // MARK: - Food Analysis (Camera)

    struct AnalyzeRequest: Encodable {
        let image: String // base64 data URI
    }

    struct AnalyzeResponse: Decodable {
        let name: String?
        let desc: String?
        let cals: Int?
        let p: Int?    // protein
        let c: Int?    // carbs
        let f: Int?    // fat
        let error: String?
    }

    /// Analyzes a food image and returns nutritional estimates.
    func analyzeFood(base64Image: String) async throws -> AnalyzeResponse {
        let request = AnalyzeRequest(image: base64Image)
        let response: AnalyzeResponse = try await post(path: "/api/analyze", body: request)

        if let error = response.error {
            throw APIError.httpError(statusCode: 400, message: error)
        }

        return response
    }

    // MARK: - Voice Parsing

    struct ParseVoiceRequest: Encodable {
        let transcript: String
        let exercises: [VoiceExerciseRef]?
    }

    struct VoiceExerciseRef: Encodable {
        let name: String
        let metricType: String?

        enum CodingKeys: String, CodingKey {
            case name
            case metricType = "metric_type"
        }
    }

    struct ParseVoiceResponse: Decodable {
        let exercise: String?
        let weight: Double?
        let reps: Int?
        let sets: Int?
        let rpe: Int?
        let matched: Bool?
        let notes: String?
        let error: String?
    }

    /// Parses a spoken workout transcript into structured data.
    func parseVoice(transcript: String, exercises: [VoiceExerciseRef]? = nil) async throws -> ParseVoiceResponse {
        let request = ParseVoiceRequest(transcript: transcript, exercises: exercises)
        let response: ParseVoiceResponse = try await post(path: "/api/parse-voice", body: request)

        if let error = response.error {
            throw APIError.httpError(statusCode: 400, message: error)
        }

        return response
    }

    // MARK: - QR Code Redemption

    struct RedeemRequest: Encodable {
        let code: String
        let userId: String

        enum CodingKeys: String, CodingKey {
            case code
            case userId = "user_id"
        }
    }

    struct RedeemResponse: Decodable {
        let success: Bool
        let type: String?
        let pointsAwarded: Int?
        let partnerId: String?
        let description: String?
        let error: String?

        enum CodingKeys: String, CodingKey {
            case success, type, description, error
            case pointsAwarded = "points_awarded"
            case partnerId = "partner_id"
        }
    }

    /// Redeems a QR code for points or partner check-in.
    func redeemCode(code: String, userId: UUID) async throws -> RedeemResponse {
        let request = RedeemRequest(code: code, userId: userId.uuidString)
        let response: RedeemResponse = try await post(path: "/api/redeem", body: request)

        if !response.success, let error = response.error {
            throw APIError.httpError(statusCode: 400, message: error)
        }

        return response
    }

    // MARK: - Private Helpers

    private func post<T: Encodable, R: Decodable>(path: String, body: T) async throws -> R {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.httpError(statusCode: 0, message: "Invalid response type.")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorBody = try? JSONDecoder().decode(ErrorBody.self, from: data)
            let message = errorBody?.error ?? "Request failed."
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        do {
            let decoder = JSONDecoder()
            return try decoder.decode(R.self, from: data)
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }
}

// MARK: - Generic Error Body

private struct ErrorBody: Decodable {
    let error: String?
}
