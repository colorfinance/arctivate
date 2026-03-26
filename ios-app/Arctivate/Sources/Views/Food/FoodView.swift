import SwiftUI

struct FoodView: View {
    @State private var foodVM = FoodViewModel()
    @State private var showManualAddSheet = false
    @State private var showCamera = false
    @State private var dailyGoal: Int = 2200

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ArcTheme.Spacing.xl) {
                        caloriesSummaryCard
                        macroBreakdown
                        actionButtons
                        foodLogList
                    }
                    .padding(.horizontal, ArcTheme.Spacing.lg)
                    .padding(.top, ArcTheme.Spacing.md)
                    .padding(.bottom, 100)
                }
            }
            .navigationTitle("Food")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showManualAddSheet) {
                ManualFoodEntrySheet(foodVM: foodVM)
            }
            .task {
                await foodVM.loadData()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Calories Summary Card

    private var caloriesSummaryCard: some View {
        VStack(spacing: ArcTheme.Spacing.lg) {
            HStack {
                VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                    Text("Today's Calories")
                        .font(ArcTheme.Typography.caption())
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: ArcTheme.Spacing.xs) {
                        Text("\(foodVM.dailyCalories)")
                            .font(ArcTheme.Typography.title(32))
                            .foregroundStyle(ArcTheme.Colors.textPrimary)
                        Text("/ \(dailyGoal) kcal")
                            .font(ArcTheme.Typography.body())
                            .foregroundStyle(ArcTheme.Colors.textMuted)
                    }
                }

                Spacer()

                let remaining = max(0, dailyGoal - foodVM.dailyCalories)
                VStack(alignment: .trailing, spacing: ArcTheme.Spacing.xs) {
                    Text("\(remaining)")
                        .font(ArcTheme.Typography.heading())
                        .foregroundStyle(ArcTheme.Colors.primary)
                    Text("remaining")
                        .font(ArcTheme.Typography.caption())
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.full)
                        .fill(ArcTheme.Colors.surfaceLight)
                        .frame(height: 8)

                    let progress = min(1.0, Double(foodVM.dailyCalories) / Double(max(1, dailyGoal)))
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.full)
                        .fill(ArcTheme.Colors.primaryGradient)
                        .frame(width: geo.size.width * progress, height: 8)
                }
            }
            .frame(height: 8)
        }
        .arcCard()
    }

    // MARK: - Macro Breakdown

    private var macroBreakdown: some View {
        HStack(spacing: ArcTheme.Spacing.lg) {
            macroItem(
                label: "Protein",
                grams: foodVM.dailyMacros.protein ?? 0,
                color: ArcTheme.Colors.cyan
            )

            macroItem(
                label: "Carbs",
                grams: foodVM.dailyMacros.carbs ?? 0,
                color: ArcTheme.Colors.orange
            )

            macroItem(
                label: "Fat",
                grams: foodVM.dailyMacros.fat ?? 0,
                color: ArcTheme.Colors.pink
            )
        }
        .arcCard()
    }

    private func macroItem(label: String, grams: Double, color: Color) -> some View {
        VStack(spacing: ArcTheme.Spacing.sm) {
            Circle()
                .fill(color.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay(
                    Text("\(Int(grams))g")
                        .font(ArcTheme.Typography.caption())
                        .fontWeight(.bold)
                        .foregroundStyle(color)
                )

            Text(label)
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: ArcTheme.Spacing.md) {
            Button {
                showCamera = true
            } label: {
                HStack(spacing: ArcTheme.Spacing.sm) {
                    Image(systemName: "camera.fill")
                    Text("Scan Food")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, ArcTheme.Spacing.lg)
                .foregroundStyle(.black)
                .background(ArcTheme.Colors.primaryGradient)
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
            }

            Button {
                showManualAddSheet = true
            } label: {
                HStack(spacing: ArcTheme.Spacing.sm) {
                    Image(systemName: "plus.circle.fill")
                    Text("Manual Add")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, ArcTheme.Spacing.lg)
                .foregroundStyle(ArcTheme.Colors.primary)
                .background(ArcTheme.Colors.primary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous)
                        .stroke(ArcTheme.Colors.primary.opacity(0.3), lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Food Log List

    private var foodLogList: some View {
        VStack(alignment: .leading, spacing: ArcTheme.Spacing.md) {
            Text("Today's Log")
                .font(ArcTheme.Typography.heading())
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            if foodVM.isLoading {
                ProgressView()
                    .tint(ArcTheme.Colors.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ArcTheme.Spacing.xxxl)
            } else if foodVM.todaysLogs.isEmpty {
                VStack(spacing: ArcTheme.Spacing.md) {
                    Image(systemName: "fork.knife.circle")
                        .font(.system(size: 40))
                        .foregroundStyle(ArcTheme.Colors.textMuted)
                    Text("No food logged today")
                        .font(.subheadline)
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, ArcTheme.Spacing.xxxl)
                .arcCard()
            } else {
                ForEach(foodVM.todaysLogs) { log in
                    foodLogRow(log)
                }
            }
        }
    }

    private func foodLogRow(_ log: FoodLog) -> some View {
        HStack(spacing: ArcTheme.Spacing.md) {
            Circle()
                .fill(ArcTheme.Colors.surfaceLight)
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: "fork.knife")
                        .foregroundStyle(ArcTheme.Colors.primary)
                )

            VStack(alignment: .leading, spacing: ArcTheme.Spacing.xxs) {
                Text(log.itemName ?? "Unknown")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(ArcTheme.Colors.textPrimary)

                if let macros = log.macros {
                    Text("P: \(Int(macros.protein ?? 0))g  C: \(Int(macros.carbs ?? 0))g  F: \(Int(macros.fat ?? 0))g")
                        .font(ArcTheme.Typography.caption())
                        .foregroundStyle(ArcTheme.Colors.textMuted)
                }
            }

            Spacer()

            Text("\(log.calories ?? 0) kcal")
                .font(ArcTheme.Typography.caption())
                .fontWeight(.semibold)
                .foregroundStyle(ArcTheme.Colors.orange)
        }
        .arcCard()
    }

    private func mealIcon(_ type: String?) -> String {
        switch type?.lowercased() {
        case "breakfast": return "sunrise.fill"
        case "lunch":     return "sun.max.fill"
        case "dinner":    return "moon.fill"
        case "snack":     return "carrot.fill"
        default:          return "fork.knife"
        }
    }
}

// MARK: - Manual Food Entry Sheet

struct ManualFoodEntrySheet: View {
    let foodVM: FoodViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var itemName = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var mealType = "snack"
    @State private var isSaving = false

    private let mealTypes = ["breakfast", "lunch", "dinner", "snack"]

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ArcTheme.Spacing.xl) {
                        formField(label: "Food Name", text: $itemName, placeholder: "e.g. Chicken Breast", keyboardType: .default)
                        formField(label: "Calories", text: $calories, placeholder: "0", keyboardType: .numberPad)

                        VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                            Text("Meal Type")
                                .font(ArcTheme.Typography.caption())
                                .foregroundStyle(ArcTheme.Colors.textSecondary)

                            Picker("Meal Type", selection: $mealType) {
                                ForEach(mealTypes, id: \.self) { type in
                                    Text(type.capitalized).tag(type)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        Divider()
                            .background(ArcTheme.Colors.border)

                        Text("Macros (optional)")
                            .font(ArcTheme.Typography.heading())
                            .foregroundStyle(ArcTheme.Colors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        HStack(spacing: ArcTheme.Spacing.md) {
                            formField(label: "Protein (g)", text: $protein, placeholder: "0", keyboardType: .decimalPad)
                            formField(label: "Carbs (g)", text: $carbs, placeholder: "0", keyboardType: .decimalPad)
                            formField(label: "Fat (g)", text: $fat, placeholder: "0", keyboardType: .decimalPad)
                        }

                        Spacer()
                            .frame(height: ArcTheme.Spacing.xl)

                        Button {
                            saveFood()
                        } label: {
                            HStack {
                                if isSaving {
                                    ProgressView()
                                        .tint(.black)
                                } else {
                                    Text("Add Food")
                                        .font(.headline)
                                        .fontWeight(.bold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, ArcTheme.Spacing.lg)
                            .background(itemName.isEmpty ? ArcTheme.Colors.textMuted : ArcTheme.Colors.primary)
                            .foregroundStyle(.black)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                        }
                        .disabled(itemName.isEmpty || isSaving)
                    }
                    .padding(ArcTheme.Spacing.xxl)
                }
            }
            .navigationTitle("Add Food")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
        .preferredColorScheme(.dark)
    }

    private func formField(label: String, text: Binding<String>, placeholder: String, keyboardType: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
            Text(label)
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textSecondary)
            TextField(placeholder, text: text)
                .keyboardType(keyboardType)
                .foregroundStyle(ArcTheme.Colors.textPrimary)
                .padding(ArcTheme.Spacing.md)
                .background(ArcTheme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous)
                        .stroke(ArcTheme.Colors.border, lineWidth: 1)
                )
        }
    }

    private func saveFood() {
        guard !itemName.isEmpty, let cal = Int(calories), cal > 0 else { return }

        isSaving = true
        Task {
            await foodVM.addFood(
                itemName: itemName,
                calories: cal,
                protein: Double(protein) ?? 0,
                carbs: Double(carbs) ?? 0,
                fat: Double(fat) ?? 0
            )
            isSaving = false
            dismiss()
        }
    }
}

#Preview {
    FoodView()
}
