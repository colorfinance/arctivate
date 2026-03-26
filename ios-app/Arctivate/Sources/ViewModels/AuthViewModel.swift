import Foundation
import Observation
import Supabase

// MARK: - AuthViewModel

/// Manages authentication state: sign in, sign up, sign out, and session observation.
@Observable
final class AuthViewModel {

    // MARK: - State

    var isAuthenticated = false
    var isLoading = false
    var errorMessage: String?
    var currentUserId: UUID?

    // MARK: - Private

    private let supabase = SupabaseService.shared
    private var authStateTask: Task<Void, Never>?

    // MARK: - Init / Deinit

    init() {
        observeAuthState()
    }

    deinit {
        authStateTask?.cancel()
    }

    // MARK: - Session Observation

    /// Listens for auth state changes and updates `isAuthenticated` / `currentUserId`.
    private func observeAuthState() {
        authStateTask = Task { [weak self] in
            guard let self else { return }

            // Check initial session
            do {
                let session = try await supabase.auth.session
                await MainActor.run {
                    self.currentUserId = session.user.id
                    self.isAuthenticated = true
                }
            } catch {
                await MainActor.run {
                    self.isAuthenticated = false
                    self.currentUserId = nil
                }
            }

            // Listen for ongoing changes
            for await (event, session) in supabase.auth.authStateChanges {
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    switch event {
                    case .signedIn, .tokenRefreshed:
                        self.currentUserId = session?.user.id
                        self.isAuthenticated = true
                    case .signedOut:
                        self.currentUserId = nil
                        self.isAuthenticated = false
                    default:
                        break
                    }
                }
            }
        }
    }

    // MARK: - Sign In

    @MainActor
    func signIn(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter both email and password."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let session = try await supabase.auth.signIn(
                email: email,
                password: password
            )
            currentUserId = session.user.id
            isAuthenticated = true
        } catch {
            errorMessage = mapAuthError(error)
        }

        isLoading = false
    }

    // MARK: - Sign Up

    @MainActor
    func signUp(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter both email and password."
            return
        }

        guard password.count >= 6 else {
            errorMessage = "Password must be at least 6 characters."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let response = try await supabase.auth.signUp(
                email: email,
                password: password
            )

            if let session = response.session {
                currentUserId = session.user.id
                isAuthenticated = true
            } else {
                // Email confirmation required
                errorMessage = "Check your email to confirm your account."
            }
        } catch {
            errorMessage = mapAuthError(error)
        }

        isLoading = false
    }

    // MARK: - Sign Out

    @MainActor
    func signOut() async {
        do {
            try await supabase.auth.signOut()
            currentUserId = nil
            isAuthenticated = false
        } catch {
            errorMessage = "Failed to sign out. Please try again."
        }
    }

    // MARK: - Helpers

    private func mapAuthError(_ error: Error) -> String {
        let message = error.localizedDescription.lowercased()
        if message.contains("invalid login") || message.contains("invalid credentials") {
            return "Invalid email or password."
        } else if message.contains("already registered") || message.contains("already been registered") {
            return "An account with this email already exists."
        } else if message.contains("network") || message.contains("connection") {
            return "Network error. Please check your connection."
        } else {
            return "Something went wrong. Please try again."
        }
    }
}
