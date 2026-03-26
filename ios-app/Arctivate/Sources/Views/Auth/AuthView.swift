import SwiftUI

struct AuthView: View {
    @State private var authVM = AuthViewModel()
    @State private var isSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var displayName = ""

    var onAuthenticated: (() -> Void)?

    var body: some View {
        ZStack {
            ArcTheme.Colors.background
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: ArcTheme.Spacing.xxl) {
                    Spacer()
                        .frame(height: 60)

                    // Brand Header
                    brandHeader

                    // Form Fields
                    formFields

                    // Error Message
                    if let errorMessage = authVM.errorMessage {
                        errorBanner(errorMessage)
                    }

                    // Action Button
                    actionButton

                    // Toggle Mode
                    toggleModeButton

                    Spacer()
                }
                .padding(.horizontal, ArcTheme.Spacing.xxl)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Brand Header

    private var brandHeader: some View {
        VStack(spacing: ArcTheme.Spacing.md) {
            Image(systemName: "bolt.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(ArcTheme.Colors.primary)

            Text("ARCTIVATE")
                .font(.system(size: 34, weight: .black, design: .rounded))
                .tracking(4)
                .foregroundStyle(ArcTheme.Colors.primaryGradient)

            Text("Unlock your potential")
                .font(.subheadline)
                .foregroundStyle(ArcTheme.Colors.textSecondary)
        }
    }

    // MARK: - Form Fields

    private var formFields: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            if isSignUp {
                styledTextField(
                    placeholder: "Display Name",
                    text: $displayName,
                    icon: "person",
                    isSecure: false
                )
            }

            styledTextField(
                placeholder: "Email",
                text: $email,
                icon: "envelope",
                isSecure: false
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)

            styledTextField(
                placeholder: "Password",
                text: $password,
                icon: "lock",
                isSecure: true
            )
            .textContentType(isSignUp ? .newPassword : .password)

            if isSignUp {
                styledTextField(
                    placeholder: "Confirm Password",
                    text: $confirmPassword,
                    icon: "lock.shield",
                    isSecure: true
                )
            }
        }
    }

    // MARK: - Styled Text Field

    private func styledTextField(
        placeholder: String,
        text: Binding<String>,
        icon: String,
        isSecure: Bool
    ) -> some View {
        HStack(spacing: ArcTheme.Spacing.md) {
            Image(systemName: icon)
                .foregroundStyle(ArcTheme.Colors.textMuted)
                .frame(width: 20)

            if isSecure {
                SecureField(placeholder, text: text)
                    .foregroundStyle(ArcTheme.Colors.textPrimary)
            } else {
                TextField(placeholder, text: text)
                    .foregroundStyle(ArcTheme.Colors.textPrimary)
            }
        }
        .padding(ArcTheme.Spacing.lg)
        .background(ArcTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous)
                .stroke(ArcTheme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: ArcTheme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(ArcTheme.Colors.red)

            Text(message)
                .font(.caption)
                .foregroundStyle(ArcTheme.Colors.red)

            Spacer()
        }
        .padding(ArcTheme.Spacing.md)
        .background(ArcTheme.Colors.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Button {
            performAuth()
        } label: {
            HStack(spacing: ArcTheme.Spacing.sm) {
                if authVM.isLoading {
                    ProgressView()
                        .tint(.black)
                } else {
                    Text(isSignUp ? "Create Account" : "Sign In")
                        .font(.headline)
                        .fontWeight(.bold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, ArcTheme.Spacing.lg)
            .background(ArcTheme.Colors.primaryGradient)
            .foregroundStyle(.black)
            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
        }
        .disabled(authVM.isLoading)
    }

    // MARK: - Toggle Mode

    private var toggleModeButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.25)) {
                isSignUp.toggle()
                authVM.errorMessage = nil
            }
        } label: {
            HStack(spacing: ArcTheme.Spacing.xs) {
                Text(isSignUp ? "Already have an account?" : "Don't have an account?")
                    .foregroundStyle(ArcTheme.Colors.textSecondary)
                Text(isSignUp ? "Sign In" : "Sign Up")
                    .foregroundStyle(ArcTheme.Colors.primary)
                    .fontWeight(.semibold)
            }
            .font(.subheadline)
        }
    }

    // MARK: - Auth Logic

    private func performAuth() {
        authVM.errorMessage = nil

        guard !email.isEmpty, !password.isEmpty else {
            authVM.errorMessage = "Please fill in all fields."
            return
        }

        if isSignUp {
            guard password == confirmPassword else {
                authVM.errorMessage = "Passwords do not match."
                return
            }
            guard displayName.count >= 2 else {
                authVM.errorMessage = "Display name must be at least 2 characters."
                return
            }
        }

        Task {
            if isSignUp {
                await authVM.signUp(email: email, password: password)
            } else {
                await authVM.signIn(email: email, password: password)
            }

            if authVM.isAuthenticated {
                onAuthenticated?()
            }
        }
    }
}

#Preview {
    AuthView()
}
