import SwiftUI

/// Arc Fitness design system. Deep blacks, slate grays, orange/teal accents.
enum ArcTheme {

    // MARK: - Colors

    enum Colors {
        /// Primary brand color - teal/green accent (#00D4AA)
        static let primary = Color(red: 0.0, green: 0.831, blue: 0.667)

        /// Cyan accent (#06B6D4)
        static let cyan = Color(red: 0.024, green: 0.714, blue: 0.831)

        /// Orange accent for warnings, PBs, fire streaks (#F97316)
        static let orange = Color(red: 0.976, green: 0.451, blue: 0.086)

        /// Deep black background (#030808)
        static let background = Color(red: 0.012, green: 0.031, blue: 0.031)

        /// Slightly lighter surface for cards (#0A1414)
        static let surface = Color(red: 0.039, green: 0.078, blue: 0.078)

        /// Elevated surface / card backgrounds (#111C1C)
        static let surfaceElevated = Color(red: 0.067, green: 0.110, blue: 0.110)

        /// Border / divider color (#1E2E2E)
        static let border = Color(red: 0.118, green: 0.180, blue: 0.180)

        /// Primary text - white
        static let textPrimary = Color.white

        /// Secondary text - muted gray (#9CA3AF)
        static let textSecondary = Color(red: 0.612, green: 0.639, blue: 0.686)

        /// Tertiary text - darker gray (#6B7280)
        static let textTertiary = Color(red: 0.420, green: 0.447, blue: 0.502)

        /// Muted text - alias for textTertiary
        static let textMuted = textTertiary

        /// Lighter surface variant (#162020)
        static let surfaceLight = Color(red: 0.086, green: 0.125, blue: 0.125)

        /// Red for destructive actions
        static let red = Color(red: 0.937, green: 0.267, blue: 0.267)

        /// Yellow for badges/PBs (#FBBF24)
        static let yellow = Color(red: 0.984, green: 0.749, blue: 0.141)

        /// Pink for high-fives (#EC4899)
        static let pink = Color(red: 0.925, green: 0.282, blue: 0.600)

        /// Success green (#10B981)
        static let success = Color(red: 0.063, green: 0.725, blue: 0.506)

        /// Error / destructive red (#EF4444)
        static let error = Color(red: 0.937, green: 0.267, blue: 0.267)

        /// Points / gold (#FBBF24)
        static let gold = Color(red: 0.984, green: 0.749, blue: 0.141)

        /// Gradient used for primary buttons and highlights
        static let primaryGradient = LinearGradient(
            colors: [primary, cyan],
            startPoint: .leading,
            endPoint: .trailing
        )

        /// Dark card gradient overlay
        static let cardGradient = LinearGradient(
            colors: [surface, surfaceElevated],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    // MARK: - Spacing

    enum Spacing {
        /// 2pt
        static let xxs: CGFloat = 2
        /// 4pt
        static let xxxs: CGFloat = 4
        /// 8pt
        static let xs: CGFloat = 8
        /// 12pt
        static let sm: CGFloat = 12
        /// 16pt
        static let md: CGFloat = 16
        /// 24pt
        static let lg: CGFloat = 24
        /// 32pt
        static let xl: CGFloat = 32
        /// 48pt
        static let xxl: CGFloat = 48
        /// 64pt
        static let xxxl: CGFloat = 64
    }

    // MARK: - Corner Radius

    enum Radius {
        /// 6pt - small chips, tags
        static let sm: CGFloat = 6
        /// 12pt - cards, buttons
        static let md: CGFloat = 12
        /// 16pt - large cards
        static let lg: CGFloat = 16
        /// 24pt - bottom sheets
        static let xl: CGFloat = 24
        /// Fully rounded
        static let full: CGFloat = 9999
    }

    // MARK: - Typography

    enum Typography {
        /// 34pt bold - hero numbers, main stats
        static let largeTitle: Font = .system(size: 34, weight: .bold, design: .rounded)

        /// 28pt bold - section headers
        static let title: Font = .system(size: 28, weight: .bold, design: .rounded)

        /// 22pt semibold - card titles
        static let title2: Font = .system(size: 22, weight: .semibold, design: .rounded)

        /// 20pt semibold - sub-headings
        static let title3: Font = .system(size: 20, weight: .semibold, design: .default)

        /// 17pt semibold - emphasized body text, button labels
        static let headline: Font = .system(size: 17, weight: .semibold, design: .default)

        /// 17pt regular - main body text
        static let body: Font = .system(size: 17, weight: .regular, design: .default)

        /// 15pt regular - secondary descriptions
        static let subheadline: Font = .system(size: 15, weight: .regular, design: .default)

        /// 13pt regular - timestamps, metadata
        static let caption: Font = .system(size: 13, weight: .regular, design: .default)

        /// 11pt medium - small badges, labels
        static let caption2: Font = .system(size: 11, weight: .medium, design: .default)

        /// 48pt bold rounded - large stat numbers (points, streaks)
        static let statNumber: Font = .system(size: 48, weight: .bold, design: .rounded)

        /// 60pt bold monospaced - timer displays
        static let timer: Font = .system(size: 60, weight: .bold, design: .monospaced)

        // Function variants for customizable sizes
        static func heading(_ size: CGFloat = 20) -> Font {
            .system(size: size, weight: .bold)
        }

        static func title(_ size: CGFloat = 28) -> Font {
            .system(size: size, weight: .bold, design: .rounded)
        }

        static func body(_ size: CGFloat = 15) -> Font {
            .system(size: size, weight: .regular)
        }

        static func caption(_ size: CGFloat = 13) -> Font {
            .system(size: size, weight: .regular)
        }

        static func mono(_ size: CGFloat = 14) -> Font {
            .system(size: size, weight: .semibold, design: .monospaced)
        }
    }

    // MARK: - Shadows

    enum Shadow {
        static let card = SwiftUI.Color.black.opacity(0.3)
        static let cardRadius: CGFloat = 8
        static let cardY: CGFloat = 4

        static let glow = Colors.primary.opacity(0.3)
        static let glowRadius: CGFloat = 12
    }

    // MARK: - Animation

    enum Animation {
        static let quick: SwiftUI.Animation = .easeInOut(duration: 0.2)
        static let standard: SwiftUI.Animation = .easeInOut(duration: 0.3)
        static let spring: SwiftUI.Animation = .spring(response: 0.4, dampingFraction: 0.75)
        static let bounce: SwiftUI.Animation = .spring(response: 0.5, dampingFraction: 0.6)
    }
}

// MARK: - View Modifiers

struct ArcCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(ArcTheme.Spacing.md)
            .background(ArcTheme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: ArcTheme.Radius.md)
                    .stroke(ArcTheme.Colors.border, lineWidth: 1)
            )
    }
}

struct ArcPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ArcTheme.Typography.headline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(
                configuration.isPressed
                    ? ArcTheme.Colors.primary.opacity(0.8)
                    : ArcTheme.Colors.primary
            )
            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md))
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(ArcTheme.Animation.quick, value: configuration.isPressed)
    }
}

extension View {
    func arcCard() -> some View {
        modifier(ArcCardModifier())
    }
}

extension ButtonStyle where Self == ArcPrimaryButtonStyle {
    static var arcPrimary: ArcPrimaryButtonStyle { ArcPrimaryButtonStyle() }
}
