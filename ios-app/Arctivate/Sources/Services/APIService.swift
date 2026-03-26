import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case serverError(Int)
    case decodingError
    case networkError(Error)
    case notAuthenticated

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL"
        case .serverError(let code): return "Server error (\(code))"
        case .decodingError: return "Failed to parse response"
        case .networkError(let error): return error.localizedDescription
        case .notAuthenticated: return "Please log in first"
        }
    }
}

final class APIService {
    static let shared = APIService()

    private let baseURL: String

    private init() {
        self.baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"]
            ?? "https://arctivate.vercel.app"
    }

    // MARK: - AI Coach

    struct CoachRequest: Encodable {
        let message: String
        let context: CoachContext
    }

    struct CoachContext: Encodable {
        let history: [[String: String]]
    }

    struct CoachResponse: Decodable {
        let reply: String?
        let message: String?
    }

    func sendCoachMessage(message: String, history: [[String: String]]) async throws -> String {
        let url = URL(string: "\(baseURL)/api/coach")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = CoachRequest(
            message: message,
            context: CoachContext(history: history)
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let result = try JSONDecoder().decode(CoachResponse.self, from: data)
        return result.reply ?? result.message ?? "Sorry, I could not process that."
    }

    // MARK: - Food Analysis

    struct AnalyzeRequest: Encodable {
        let image: String
    }

    struct AnalyzeResponse: Decodable {
        let name: String?
        let cals: Int?
        let p: Int?
        let c: Int?
        let f: Int?
    }

    func analyzeFood(imageBase64: String) async throws -> AnalyzeResponse {
        let url = URL(string: "\(baseURL)/api/analyze")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(AnalyzeRequest(image: imageBase64))

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(AnalyzeResponse.self, from: data)
    }

    // MARK: - Voice Parsing

    struct ParseVoiceRequest: Encodable {
        let transcript: String
        let exercises: [ExerciseRef]
    }

    struct ExerciseRef: Encodable {
        let name: String
        let metricType: String
        let id: String

        enum CodingKeys: String, CodingKey {
            case name
            case metricType = "metric_type"
            case id
        }
    }

    struct ParseVoiceResponse: Decodable {
        let exercise: String?
        let weight: Double?
        let reps: Int?
        let sets: Int?
        let rpe: Int?
        let notes: String?
        let matched: Bool?
    }

    func parseVoice(transcript: String, exercises: [ExerciseRef]) async throws -> ParseVoiceResponse {
        let url = URL(string: "\(baseURL)/api/parse-voice")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            ParseVoiceRequest(transcript: transcript, exercises: exercises)
        )

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw APIError.serverError(code)
        }

        return try JSONDecoder().decode(ParseVoiceResponse.self, from: data)
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
        let description: String?
        let error: String?

        enum CodingKeys: String, CodingKey {
            case success, type
            case pointsAwarded = "points_awarded"
            case description, error
        }
    }

    func redeemCode(code: String, userId: String) async throws -> RedeemResponse {
        let url = URL(string: "\(baseURL)/api/redeem")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            RedeemRequest(code: code, userId: userId)
        )

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(RedeemResponse.self, from: data)
    }
}
