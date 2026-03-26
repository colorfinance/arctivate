import SwiftUI
import Supabase

@main
struct ArctivateApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            Group {
                switch authManager.state {
                case .loading:
                    SplashView()
                case .authenticated:
                    MainTabView()
                        .environmentObject(authManager)
                case .unauthenticated:
                    AuthView()
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

        // Create profile row
        let profile = Profile(
            id: userId,
            username: username,
            bio: nil,
            totalPoints: 0,
            currentStreak: 0,
            avatarUrl: nil,
            partnerId: nil,
            challengeStartDate: nil,
            challengeDaysGoal: 75,
            age: nil,
            weight: nil,
            gender: nil,
            goal: nil,
            fitnessLevel: nil,
            completedOnboarding: false,
            dailyCalorieGoal: 2800,
            createdAt: nil
        )
        try await supabase.from("profiles").insert(profile).execute()
    }

    func signOut() async throws {
        try await supabase.auth.signOut()
    }
}

// MARK: - Placeholder Views

struct SplashView: View {
    var body: some View {
        ZStack {
            ArcTheme.Colors.background.ignoresSafeArea()
            VStack(spacing: ArcTheme.Spacing.md) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(ArcTheme.Colors.primary)
                Text("Arctivate")
                    .font(ArcTheme.Typography.largeTitle)
                    .foregroundStyle(.white)
                ProgressView()
                    .tint(ArcTheme.Colors.primary)
            }
        }
    }
}

struct AuthView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var isSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        ZStack {
            ArcTheme.Colors.background.ignoresSafeArea()

            VStack(spacing: ArcTheme.Spacing.lg) {
                Spacer()

                Image(systemName: "flame.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(ArcTheme.Colors.primary)

                Text("Arctivate")
                    .font(ArcTheme.Typography.largeTitle)
                    .foregroundStyle(.white)

                Text(isSignUp ? "Create your account" : "Welcome back")
                    .font(ArcTheme.Typography.body)
                    .foregroundStyle(ArcTheme.Colors.textSecondary)

                VStack(spacing: ArcTheme.Spacing.sm) {
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
                .padding(.horizontal, ArcTheme.Spacing.lg)

                if let errorMessage {
                    Text(errorMessage)
                        .font(ArcTheme.Typography.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Button {
                    Task { await authenticate() }
                } label: {
                    Group {
                        if isLoading {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Text(isSignUp ? "Sign Up" : "Sign In")
                                .font(ArcTheme.Typography.headline)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(ArcTheme.Colors.primary)
                    .foregroundStyle(.black)
                    .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md))
                }
                .disabled(isLoading)
                .padding(.horizontal, ArcTheme.Spacing.lg)

                Button {
                    isSignUp.toggle()
                    errorMessage = nil
                } label: {
                    Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                        .font(ArcTheme.Typography.caption)
                        .foregroundStyle(ArcTheme.Colors.cyan)
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

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        TabView {
            Tab("Home", systemImage: "house.fill") {
                HomePlaceholderView()
            }
            Tab("Workout", systemImage: "dumbbell.fill") {
                WorkoutPlaceholderView()
            }
            Tab("Food", systemImage: "fork.knife") {
                FoodPlaceholderView()
            }
            Tab("Social", systemImage: "person.2.fill") {
                SocialPlaceholderView()
            }
            Tab("Profile", systemImage: "person.crop.circle.fill") {
                ProfilePlaceholderView()
            }
        }
        .tint(ArcTheme.Colors.primary)
    }
}

// MARK: - Tab Placeholders

struct HomePlaceholderView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background.ignoresSafeArea()
                Text("Home")
                    .foregroundStyle(.white)
            }
            .navigationTitle("Arctivate")
        }
    }
}

struct WorkoutPlaceholderView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background.ignoresSafeArea()
                Text("Workout")
                    .foregroundStyle(.white)
            }
            .navigationTitle("Workout")
        }
    }
}

struct FoodPlaceholderView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background.ignoresSafeArea()
                Text("Food")
                    .foregroundStyle(.white)
            }
            .navigationTitle("Nutrition")
        }
    }
}

struct SocialPlaceholderView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background.ignoresSafeArea()
                Text("Social")
                    .foregroundStyle(.white)
            }
            .navigationTitle("Community")
        }
    }
}

struct ProfilePlaceholderView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background.ignoresSafeArea()
                VStack(spacing: ArcTheme.Spacing.md) {
                    Text("Profile")
                        .foregroundStyle(.white)
                    Button("Sign Out") {
                        Task { try? await authManager.signOut() }
                    }
                    .foregroundStyle(.red)
                }
            }
            .navigationTitle("Profile")
        }
    }
}
