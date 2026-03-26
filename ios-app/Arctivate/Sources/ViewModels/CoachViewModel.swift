import Foundation
import Observation
import Supabase

// MARK: - Chat Message (local UI model)

struct ChatMessage: Identifiable, Sendable {
    let id: String
    let role: String          // "user" | "assistant"
    let content: String
    let createdAt: Date

    init(id: String = UUID().uuidString, role: String, content: String, createdAt: Date = Date()) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
    }
}

// MARK: - Coach API Response

private struct CoachResponse: Codable {
    let reply: String
}

// MARK: - CoachViewModel

/// Manages the AI coach chat: sends messages to /api/coach with recent conversation
/// history so the model has full context.
///
/// BUG FIX: The history payload now includes the latest user message that is being sent.
/// Previously the mobile app built the history *before* appending the new user message,
/// so the coach never saw the current question in the history array.
@Observable
final class CoachViewModel {

    // MARK: - State

    var messages: [ChatMessage] = [
        ChatMessage(
            id: "welcome",
            role: "assistant",
            content: "Hey! I'm your AI coach. Ask me about workouts, recovery, nutrition, or anything fitness related."
        )
    ]
    var input = ""
    var isLoading = false
    var errorMessage: String?

    // MARK: - Private

    private let supabase = SupabaseService.shared
    /// Number of recent messages to include as context for the coach.
    private let historyWindowSize = 10

    // MARK: - Send Message

    @MainActor
    func sendMessage() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }

        guard await currentUserId() != nil else {
            errorMessage = "You must be logged in to use the coach."
            return
        }

        // Append user message immediately for responsive UI
        let userMsg = ChatMessage(role: "user", content: text)
        messages.append(userMsg)
        input = ""
        isLoading = true
        errorMessage = nil

        do {
            // BUG FIX: Build history *after* appending the user message so the latest
            // question is included in the context sent to the API.
            let recentHistory = messages.suffix(historyWindowSize).map { msg in
                ["role": msg.role, "content": msg.content]
            }

            let reply = try await callCoachAPI(message: text, history: recentHistory)

            let assistantMsg = ChatMessage(role: "assistant", content: reply)
            messages.append(assistantMsg)
        } catch {
            let errorMsg = ChatMessage(
                role: "assistant",
                content: "Sorry, I couldn't connect. Please try again."
            )
            messages.append(errorMsg)
            errorMessage = "Failed to reach the coach. Check your connection."
        }

        isLoading = false
    }

    // MARK: - Clear Chat

    @MainActor
    func clearChat() {
        messages = [
            ChatMessage(
                id: "welcome",
                role: "assistant",
                content: "Hey! I'm your AI coach. Ask me about workouts, recovery, nutrition, or anything fitness related."
            )
        ]
        errorMessage = nil
    }

    // MARK: - API Call

    /// Posts the message and conversation history to the coach endpoint.
    private func callCoachAPI(message: String, history: [[String: String]]) async throws -> String {
        var request = URLRequest(url: URL(string: "\(SupabaseService.baseURL)/api/coach")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let session = try await supabase.auth.session
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "message": message,
            "history": history
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        let coachResponse = try JSONDecoder().decode(CoachResponse.self, from: data)
        return coachResponse.reply
    }

    // MARK: - Helpers

    private func currentUserId() async -> UUID? {
        try? await supabase.auth.session.user.id
    }
}
