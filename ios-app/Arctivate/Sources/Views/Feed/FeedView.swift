import SwiftUI

struct FeedView: View {
    @State private var viewModel = FeedViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Feed")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.md)

            // Posts List
            ScrollView {
                LazyVStack(spacing: Theme.Spacing.md) {
                    if viewModel.posts.isEmpty && !viewModel.isLoading {
                        VStack(spacing: Theme.Spacing.sm) {
                            Image(systemName: "newspaper")
                                .font(.system(size: 48))
                                .foregroundStyle(Theme.Colors.textMuted)
                            Text("No posts yet")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(Theme.Colors.textSecondary)
                            Text("Share a workout from the Train tab")
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.Colors.textMuted)
                        }
                        .padding(.top, 80)
                    }

                    ForEach(viewModel.posts) { post in
                        postCard(post)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.bottom, 100)
            }
            .refreshable {
                await viewModel.loadFeed()
            }
        }
        .background(Theme.Colors.background)
        .task { await viewModel.loadFeed() }
    }

    func postCard(_ post: FeedPost) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            // Post Header
            HStack(spacing: Theme.Spacing.sm) {
                // Avatar
                ZStack {
                    Circle()
                        .fill(Theme.Colors.primaryDim)
                        .frame(width: 40, height: 40)
                    Text(String((post.profiles?.username ?? "U").prefix(1)).uppercased())
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Colors.primary)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(post.profiles?.username ?? "User")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text(viewModel.formatRelativeTime(post.createdAt ?? ""))
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.textMuted)
                }

                Spacer()
            }

            // Workout Data
            if let workout = post.workoutData {
                VStack(spacing: 0) {
                    if let exerciseName = workout["exercise_name"]?.stringValue {
                        HStack {
                            Text(exerciseName)
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.Colors.textPrimary)
                            Spacer()
                            if let value = workout["value"]?.doubleValue {
                                let unit = workout["metric_type"]?.stringValue == "time" ? "min" : "kg"
                                Text("\(Int(value))\(unit)")
                                    .font(.system(size: 14, design: .monospaced))
                                    .foregroundStyle(Theme.Colors.textSecondary)
                            }
                        }
                        .padding(.vertical, 3)
                    }

                    if let isNewPb = workout["is_new_pb"]?.boolValue, isNewPb {
                        HStack(spacing: 4) {
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Colors.primary)
                            Text("NEW PB!")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Theme.Colors.primary)
                        }
                        .padding(.top, Theme.Spacing.sm)
                    }

                    if let points = workout["points_earned"]?.intValue {
                        HStack(spacing: 4) {
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Colors.primary)
                            Text("+\(points) pts")
                                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                .foregroundStyle(Theme.Colors.primary)
                        }
                        .padding(.top, Theme.Spacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(alignment: .top) {
                            Divider().overlay(Theme.Colors.border)
                        }
                    }
                }
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
            }

            // High Five Button
            HStack {
                Button {
                    Task { await viewModel.toggleHighFive(post: post) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: viewModel.hasHighFived(post: post) ? "hand.raised.fill" : "hand.raised")
                            .font(.system(size: 18))
                            .foregroundStyle(viewModel.hasHighFived(post: post) ? Theme.Colors.primary : Theme.Colors.textMuted)
                        Text("\(viewModel.highFiveCount(post: post))")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(viewModel.hasHighFived(post: post) ? Theme.Colors.primary : Theme.Colors.textMuted)
                    }
                }
            }
            .padding(.top, Theme.Spacing.sm)
            .overlay(alignment: .top) {
                Divider().overlay(Theme.Colors.border)
            }
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.lg)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }
}

// Helper to extract values from AnyJSON-like workout_data
extension Dictionary where Key == String, Value == AnyCodableValue {
    // This is a placeholder - actual implementation depends on how workoutData is decoded
}

enum AnyCodableValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)

    var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }

    var intValue: Int? {
        if case .int(let v) = self { return v }
        return nil
    }

    var doubleValue: Double? {
        if case .double(let v) = self { return v }
        if case .int(let v) = self { return Double(v) }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let v) = self { return v }
        return nil
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(Bool.self) { self = .bool(v) }
        else if let v = try? container.decode(Int.self) { self = .int(v) }
        else if let v = try? container.decode(Double.self) { self = .double(v) }
        else if let v = try? container.decode(String.self) { self = .string(v) }
        else { self = .string("") }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        }
    }
}
