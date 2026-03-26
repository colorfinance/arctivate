import SwiftUI

struct CoachView: View {
    @State private var viewModel = CoachViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: Theme.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.primaryDim)
                        .frame(width: 44, height: 44)
                    Image(systemName: "figure.run")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.Colors.primary)
                }

                VStack(alignment: .leading) {
                    Text("AI Coach")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Powered by Gemini")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Colors.textMuted)
                }

                Spacer()
            }
            .padding(Theme.Spacing.lg)
            .background(Theme.Colors.background)
            .overlay(alignment: .bottom) {
                Divider().overlay(Theme.Colors.border)
            }

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: Theme.Spacing.md) {
                        ForEach(viewModel.messages) { msg in
                            messageBubble(msg)
                                .id(msg.id)
                        }
                    }
                    .padding(Theme.Spacing.lg)
                }
                .onChange(of: viewModel.messages.count) {
                    if let lastId = viewModel.messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }

            // Typing Indicator
            if viewModel.isLoading {
                HStack(spacing: Theme.Spacing.sm) {
                    ProgressView()
                        .tint(Theme.Colors.primary)
                    Text("Coach is thinking...")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Colors.textMuted)
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.bottom, Theme.Spacing.sm)
            }

            // Input Bar
            HStack(alignment: .bottom, spacing: Theme.Spacing.sm) {
                TextField("Ask your coach...", text: $viewModel.input, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, Theme.Spacing.sm)
                    .background(Theme.Colors.surface)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg)
                            .stroke(Theme.Colors.border, lineWidth: 1)
                    )

                Button {
                    Task { await viewModel.sendMessage() }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(
                            viewModel.input.trimmingCharacters(in: .whitespaces).isEmpty
                                ? Theme.Colors.textMuted
                                : Theme.Colors.background
                        )
                        .frame(width: 40, height: 40)
                        .background(
                            viewModel.input.trimmingCharacters(in: .whitespaces).isEmpty
                                ? Theme.Colors.surface
                                : Theme.Colors.primary
                        )
                        .clipShape(Circle())
                }
                .disabled(viewModel.input.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
            }
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.card)
            .overlay(alignment: .top) {
                Divider().overlay(Theme.Colors.border)
            }
        }
        .background(Theme.Colors.background)
    }

    @ViewBuilder
    func messageBubble(_ msg: ChatMessage) -> some View {
        let isUser = msg.role == "user"

        HStack(alignment: .bottom, spacing: Theme.Spacing.sm) {
            if isUser { Spacer(minLength: 60) }

            if !isUser {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.primaryDim)
                        .frame(width: 28, height: 28)
                    Image(systemName: "figure.run")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.primary)
                }
            }

            Text(msg.content)
                .font(.system(size: 15))
                .foregroundStyle(isUser ? Theme.Colors.background : Theme.Colors.textPrimary)
                .padding(Theme.Spacing.md)
                .background(isUser ? Theme.Colors.primary : Theme.Colors.card)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg)
                )
                .overlay(
                    !isUser
                        ? RoundedRectangle(cornerRadius: Theme.Radius.lg)
                            .stroke(Theme.Colors.border, lineWidth: 1)
                        : nil
                )

            if !isUser { Spacer(minLength: 60) }
        }
    }
}
