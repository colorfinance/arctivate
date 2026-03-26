import SwiftUI

struct CoachView: View {
    @State private var messages: [CoachMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var scrollProxy: ScrollViewProxy?

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    coachHeader

                    // Messages
                    messagesScrollView

                    // Typing indicator
                    if isLoading {
                        typingIndicator
                    }

                    // Input bar
                    inputBar
                }
            }
            .navigationBarHidden(true)
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Coach Header

    private var coachHeader: some View {
        HStack(spacing: ArcTheme.Spacing.md) {
            ZStack {
                Circle()
                    .fill(ArcTheme.Colors.primary.opacity(0.15))
                    .frame(width: 44, height: 44)
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 20))
                    .foregroundStyle(ArcTheme.Colors.primary)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text("AI Coach")
                    .font(ArcTheme.Typography.heading())
                    .foregroundStyle(ArcTheme.Colors.textPrimary)
                Text("Powered by AI")
                    .font(ArcTheme.Typography.caption())
                    .foregroundStyle(ArcTheme.Colors.textMuted)
            }

            Spacer()
        }
        .padding(.horizontal, ArcTheme.Spacing.lg)
        .padding(.vertical, ArcTheme.Spacing.md)
        .background(ArcTheme.Colors.background)
        .overlay(alignment: .bottom) {
            Divider().overlay(ArcTheme.Colors.border)
        }
    }

    // MARK: - Messages List

    private var messagesScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: ArcTheme.Spacing.md) {
                    if messages.isEmpty {
                        welcomeMessage
                            .padding(.top, ArcTheme.Spacing.xxxl)
                    }

                    ForEach(messages) { message in
                        messageBubble(message)
                            .id(message.id)
                    }
                }
                .padding(.horizontal, ArcTheme.Spacing.lg)
                .padding(.vertical, ArcTheme.Spacing.md)
            }
            .onAppear { scrollProxy = proxy }
            .onChange(of: messages.count) {
                if let lastId = messages.last?.id {
                    withAnimation {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var welcomeMessage: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(ArcTheme.Colors.primary.opacity(0.15))
                    .frame(width: 80, height: 80)
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 36))
                    .foregroundStyle(ArcTheme.Colors.primaryGradient)
            }

            Text("AI Fitness Coach")
                .font(ArcTheme.Typography.heading())
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            Text("Ask me about workout plans, nutrition advice, form tips, or anything fitness related.")
                .font(ArcTheme.Typography.body())
                .foregroundStyle(ArcTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, ArcTheme.Spacing.xxl)

            // Suggestion chips
            VStack(spacing: ArcTheme.Spacing.sm) {
                suggestionChip("Create a push/pull/legs split")
                suggestionChip("How much protein should I eat?")
                suggestionChip("Warm-up routine for leg day")
            }
        }
    }

    private func suggestionChip(_ text: String) -> some View {
        Button {
            inputText = text
            sendMessage()
        } label: {
            Text(text)
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.primary)
                .padding(.horizontal, ArcTheme.Spacing.lg)
                .padding(.vertical, ArcTheme.Spacing.sm)
                .background(ArcTheme.Colors.primary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.full, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.full, style: .continuous)
                        .stroke(ArcTheme.Colors.primary.opacity(0.3), lineWidth: 1)
                )
        }
    }

    // MARK: - Message Bubble

    private func messageBubble(_ message: CoachMessage) -> some View {
        let isUser = message.role == "user"

        return HStack(alignment: .bottom, spacing: ArcTheme.Spacing.sm) {
            if isUser { Spacer(minLength: 60) }

            if !isUser {
                ZStack {
                    Circle()
                        .fill(ArcTheme.Colors.primary.opacity(0.15))
                        .frame(width: 28, height: 28)
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 12))
                        .foregroundStyle(ArcTheme.Colors.primary)
                }
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: ArcTheme.Spacing.xs) {
                Text(message.content)
                    .font(ArcTheme.Typography.body())
                    .foregroundStyle(isUser ? .black : ArcTheme.Colors.textPrimary)
                    .padding(.horizontal, ArcTheme.Spacing.lg)
                    .padding(.vertical, ArcTheme.Spacing.md)
                    .background(
                        Group {
                            if isUser {
                                ArcTheme.Colors.primaryGradient
                            } else {
                                LinearGradient(
                                    colors: [ArcTheme.Colors.surface, ArcTheme.Colors.surface],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            }
                        }
                    )
                    .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous))
                    .overlay(
                        Group {
                            if !isUser {
                                RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous)
                                    .stroke(ArcTheme.Colors.border, lineWidth: 1)
                            }
                        }
                    )

                if let createdAt = message.createdAt {
                    Text(createdAt, style: .time)
                        .font(.system(size: 11))
                        .foregroundStyle(ArcTheme.Colors.textMuted)
                }
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }

    // MARK: - Typing Indicator

    private var typingIndicator: some View {
        HStack(spacing: ArcTheme.Spacing.sm) {
            ProgressView()
                .tint(ArcTheme.Colors.primary)
            Text("Coach is thinking...")
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textMuted)
        }
        .padding(.horizontal, ArcTheme.Spacing.lg)
        .padding(.vertical, ArcTheme.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: ArcTheme.Spacing.sm) {
            TextField("Ask your coach...", text: $inputText, axis: .vertical)
                .lineLimit(1...4)
                .foregroundStyle(ArcTheme.Colors.textPrimary)
                .padding(.horizontal, ArcTheme.Spacing.md)
                .padding(.vertical, ArcTheme.Spacing.sm)
                .background(ArcTheme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.lg, style: .continuous)
                        .stroke(ArcTheme.Colors.border, lineWidth: 1)
                )

            Button {
                sendMessage()
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(
                        inputText.trimmingCharacters(in: .whitespaces).isEmpty
                            ? ArcTheme.Colors.textMuted
                            : .black
                    )
                    .frame(width: 40, height: 40)
                    .background(
                        inputText.trimmingCharacters(in: .whitespaces).isEmpty
                            ? ArcTheme.Colors.surface
                            : ArcTheme.Colors.primary
                    )
                    .clipShape(Circle())
            }
            .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
        }
        .padding(.horizontal, ArcTheme.Spacing.md)
        .padding(.vertical, ArcTheme.Spacing.md)
        .background(ArcTheme.Colors.background)
        .overlay(alignment: .top) {
            Divider().overlay(ArcTheme.Colors.border)
        }
    }

    // MARK: - Send Message

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        let userMessage = CoachMessage(
            id: UUID(),
            role: "user",
            content: text,
            createdAt: Date()
        )
        messages.append(userMessage)
        inputText = ""
        isLoading = true

        // Placeholder: connect CoachViewModel / API for real responses
        Task {
            try? await Task.sleep(for: .seconds(1.5))

            let assistantMessage = CoachMessage(
                id: UUID(),
                role: "assistant",
                content: "I'm your AI fitness coach. This is a placeholder response -- connect the CoachViewModel for real coaching advice powered by AI.",
                createdAt: Date()
            )

            await MainActor.run {
                messages.append(assistantMessage)
                isLoading = false
            }
        }
    }
}

#Preview {
    CoachView()
}
