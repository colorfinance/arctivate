import SwiftUI
import Supabase

@main
struct ArctivateApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            ZStack {
                switch authManager.state {
                case .loading:
                    SplashView()
                case .authenticated:
                    AppMainTabView()
                        .environmentObject(authManager)
                case .unauthenticated:
                    AppAuthView()
                        .environmentObject(authManager)
                }
            }
            .preferredColorScheme(.dark)
            .task {
                await authManager.observeAuthState()
            }
        }
    }
}

// MARK: - Auth State

enum AuthState {
    case loading
    case authenticated
    case unauthenticated
}

@MainActor
final class AuthManager: ObservableObject {
    @Published var state: AuthState = .loading
    @Published var currentUserId: UUID?

    private let supabase = SupabaseService.shared.client

    func observeAuthState() async {
        // Check for existing session
        do {
            let session = try await supabase.auth.session
            currentUserId = session.user.id
            state = .authenticated
        } catch {
            state = .unauthenticated
        }

        // Listen for auth changes
        for await (event, session) in supabase.auth.authStateChanges {
            switch event {
            case .signedIn:
                currentUserId = session?.user.id
                state = .authenticated
            case .signedOut:
                currentUserId = nil
                state = .unauthenticated
            default:
                break
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String, username: String) async throws {
        let authResponse = try await supabase.auth.signUp(email: email, password: password)
        let userId = authResponse.user.id

        try await supabase.from("profiles").insert([
            "id": userId.uuidString,
            "username": username,
            "total_points": "0",
            "current_streak": "0",
            "challenge_days_goal": "75"
        ]).execute()
    }

    func signOut() async throws {
        try await supabase.auth.signOut()
    }
}

// MARK: - Splash View

struct SplashView: View {
    var body: some View {
        ZStack {
            Color(red: 0.012, green: 0.031, blue: 0.031).ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Color(red: 0, green: 0.831, blue: 0.667))
                Text("ARCTIVATE")
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(.white)
                    .tracking(4)
                ProgressView()
                    .tint(Color(red: 0, green: 0.831, blue: 0.667))
            }
        }
    }
}

// MARK: - App Auth View (wrapper to avoid conflict with Views/Auth/AuthView)

struct AppAuthView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var isSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        ZStack {
            Color(red: 0.012, green: 0.031, blue: 0.031).ignoresSafeArea()

            VStack(spacing: 20) {
                Spacer()

                Image(systemName: "flame.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Color(red: 0, green: 0.831, blue: 0.667))

                Text("ARCTIVATE")
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(.white)
                    .tracking(4)

                Text(isSignUp ? "Create your account" : "Welcome back")
                    .font(.system(size: 15))
                    .foregroundStyle(.gray)

                VStack(spacing: 12) {
                    if isSignUp {
                        TextField("Username", text: $username)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(.horizontal, 24)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Button {
                    Task { await authenticate() }
                } label: {
                    ZStack {
                        if isLoading {
                            ProgressView().tint(.black)
                        } else {
                            Text(isSignUp ? "Sign Up" : "Sign In")
                                .font(.system(size: 16, weight: .bold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color(red: 0, green: 0.831, blue: 0.667))
                    .foregroundStyle(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(isLoading)
                .padding(.horizontal, 24)

                Button {
                    isSignUp.toggle()
                    errorMessage = nil
                } label: {
                    Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(red: 0.024, green: 0.714, blue: 0.831))
                }

                Spacer()
            }
        }
    }

    private func authenticate() async {
        isLoading = true
        errorMessage = nil
        do {
            if isSignUp {
                try await authManager.signUp(email: email, password: password, username: username)
            } else {
                try await authManager.signIn(email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - App Main Tab View (wrapper to avoid conflict with Views/MainTabView)

struct AppMainTabView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        TabView {
            TrainView()
                .tabItem {
                    Label("Train", systemImage: "dumbbell.fill")
                }
            CoachView()
                .tabItem {
                    Label("Coach", systemImage: "bubble.left.fill")
                }
            FeedView()
                .tabItem {
                    Label("Feed", systemImage: "person.2.fill")
                }
            HabitsView()
                .tabItem {
                    Label("Habits", systemImage: "checkmark.circle.fill")
                }
            FoodView()
                .tabItem {
                    Label("Food", systemImage: "fork.knife")
                }
        }
        .tint(Color(red: 0, green: 0.831, blue: 0.667))
    }
}
