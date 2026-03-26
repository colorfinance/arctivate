import SwiftUI

// MARK: - Supporting Types

enum MetricType: String, CaseIterable, Identifiable {
    case weight   = "Weight (kg)"
    case distance = "Distance (km)"
    case time     = "Time (min)"
    case reps     = "Reps Only"

    var id: String { rawValue }
}

enum MuscleGroup: String, CaseIterable, Identifiable {
    case chest     = "Chest"
    case back      = "Back"
    case shoulders = "Shoulders"
    case arms      = "Arms"
    case legs      = "Legs"
    case core      = "Core"
    case cardio    = "Cardio"
    case fullBody  = "Full Body"

    var id: String { rawValue }
}

// MARK: - Train View

struct TrainView: View {
    @State private var trainVM = TrainViewModel()
    @State private var showLogSetSheet = false
    @State private var showAddExerciseSheet = false
    @State private var selectedExerciseId: UUID?

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ArcTheme.Spacing.xl) {
                        todaySummaryCard
                        exercisesSection
                        addExerciseButton
                    }
                    .padding(.horizontal, ArcTheme.Spacing.lg)
                    .padding(.top, ArcTheme.Spacing.md)
                    .padding(.bottom, 100)
                }
            }
            .navigationTitle("Train")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showAddExerciseSheet) {
                AddExerciseSheet(trainVM: trainVM)
            }
            .sheet(isPresented: $showLogSetSheet) {
                if let exerciseId = selectedExerciseId,
                   let exercise = trainVM.exercises.first(where: { $0.id == exerciseId }) {
                    LogSetSheet(exercise: exercise, trainVM: trainVM)
                }
            }
            .task {
                await trainVM.loadData()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Today's Summary

    private var todaySummaryCard: some View {
        HStack(spacing: ArcTheme.Spacing.xl) {
            summaryItem(
                icon: "flame.fill",
                value: "\(trainVM.todaysTotalPoints)",
                label: "Points",
                color: ArcTheme.Colors.orange
            )

            Divider()
                .frame(height: 40)
                .background(ArcTheme.Colors.border)

            summaryItem(
                icon: "arrow.up.circle.fill",
                value: "\(trainVM.todaysTotalSets)",
                label: "Sets",
                color: ArcTheme.Colors.primary
            )

            Divider()
                .frame(height: 40)
                .background(ArcTheme.Colors.border)

            summaryItem(
                icon: "trophy.fill",
                value: "\(trainVM.todaysPBCount)",
                label: "PBs",
                color: ArcTheme.Colors.yellow
            )
        }
        .padding(ArcTheme.Spacing.xl)
        .frame(maxWidth: .infinity)
        .arcCard()
    }

    private func summaryItem(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: ArcTheme.Spacing.xs) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            Text(value)
                .font(ArcTheme.Typography.heading())
                .foregroundStyle(ArcTheme.Colors.textPrimary)
            Text(label)
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Exercises Section

    private var exercisesSection: some View {
        VStack(alignment: .leading, spacing: ArcTheme.Spacing.md) {
            Text("Exercises")
                .font(ArcTheme.Typography.heading())
                .foregroundStyle(ArcTheme.Colors.textPrimary)

            if trainVM.exercises.isEmpty && !trainVM.isLoading {
                emptyExercisesPlaceholder
            } else if trainVM.isLoading {
                ProgressView()
                    .tint(ArcTheme.Colors.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ArcTheme.Spacing.xxxl)
            } else {
                ForEach(trainVM.exercises) { exercise in
                    exerciseCard(exercise)
                }
            }
        }
    }

    private var emptyExercisesPlaceholder: some View {
        VStack(spacing: ArcTheme.Spacing.md) {
            Image(systemName: "dumbbell")
                .font(.system(size: 40))
                .foregroundStyle(ArcTheme.Colors.textMuted)
            Text("No exercises yet")
                .font(.subheadline)
                .foregroundStyle(ArcTheme.Colors.textSecondary)
            Text("Tap the button below to add your first exercise")
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ArcTheme.Spacing.xxxl)
        .arcCard()
    }

    private func exerciseCard(_ exercise: Exercise) -> some View {
        let logsForExercise = trainVM.todaysLogs.filter { $0.exerciseId == exercise.id }

        return VStack(alignment: .leading, spacing: ArcTheme.Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                    Text(exercise.name)
                        .font(.headline)
                        .foregroundStyle(ArcTheme.Colors.textPrimary)

                    if let group = exercise.muscleGroup, !group.isEmpty {
                        Text(group)
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textSecondary)
                    }
                }

                Spacer()

                Button {
                    selectedExerciseId = exercise.id
                    showLogSetSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(ArcTheme.Colors.primary)
                }
            }

            if !logsForExercise.isEmpty {
                Divider()
                    .background(ArcTheme.Colors.border)

                ForEach(logsForExercise) { log in
                    HStack {
                        Text("\(log.value, specifier: "%.1f") \(exercise.metricType == "weight" ? "kg" : "")")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(ArcTheme.Colors.textPrimary)

                        if let sets = log.sets, let reps = log.reps {
                            Text("\(sets)x\(reps)")
                                .font(.subheadline)
                                .foregroundStyle(ArcTheme.Colors.textSecondary)
                        }

                        if let rpe = log.rpe {
                            Text("RPE \(rpe)")
                                .font(ArcTheme.Typography.caption())
                                .foregroundStyle(ArcTheme.Colors.orange)
                                .padding(.horizontal, ArcTheme.Spacing.sm)
                                .padding(.vertical, 2)
                                .background(ArcTheme.Colors.orange.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                        }

                        Spacer()

                        if log.isNewPb == true {
                            HStack(spacing: 4) {
                                Image(systemName: "trophy.fill")
                                    .font(.caption2)
                                Text("PB")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                            }
                            .foregroundStyle(.black)
                            .padding(.horizontal, ArcTheme.Spacing.sm)
                            .padding(.vertical, 4)
                            .background(ArcTheme.Colors.yellow)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                        }

                        if let points = log.pointsAwarded, points > 0 {
                            Text("+\(points)")
                                .font(ArcTheme.Typography.caption())
                                .fontWeight(.semibold)
                                .foregroundStyle(ArcTheme.Colors.orange)
                        }
                    }
                }
            }
        }
        .arcCard()
    }

    // MARK: - Add Exercise Button

    private var addExerciseButton: some View {
        Button {
            showAddExerciseSheet = true
        } label: {
            HStack(spacing: ArcTheme.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                Text("Add Exercise")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, ArcTheme.Spacing.lg)
            .foregroundStyle(ArcTheme.Colors.primary)
            .background(ArcTheme.Colors.primary.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous)
                    .strokeBorder(ArcTheme.Colors.primary.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [8]))
            )
        }
    }
}

// MARK: - Log Set Sheet

struct LogSetSheet: View {
    let exercise: Exercise
    let trainVM: TrainViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var value: String = ""
    @State private var sets: String = "3"
    @State private var reps: String = "10"
    @State private var rpe: String = ""
    @State private var isSaving = false
    @State private var showPBAlert = false

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: ArcTheme.Spacing.xl) {
                    Text(exercise.name)
                        .font(ArcTheme.Typography.heading())
                        .foregroundStyle(ArcTheme.Colors.textPrimary)

                    VStack(spacing: ArcTheme.Spacing.lg) {
                        sheetField(label: exercise.metricType ?? "Value", text: $value, placeholder: "0")
                        sheetField(label: "Sets", text: $sets, placeholder: "3")
                        sheetField(label: "Reps", text: $reps, placeholder: "10")
                        sheetField(label: "RPE (optional)", text: $rpe, placeholder: "7")
                    }

                    Spacer()

                    Button {
                        saveSet()
                    } label: {
                        HStack {
                            if isSaving {
                                ProgressView()
                                    .tint(.black)
                            } else {
                                Text("Log Set")
                                    .font(.headline)
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ArcTheme.Spacing.lg)
                        .background(ArcTheme.Colors.primary)
                        .foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                    }
                    .disabled(isSaving)
                }
                .padding(ArcTheme.Spacing.xxl)
            }
            .navigationTitle("Log Set")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
            }
            .alert("New Personal Best!", isPresented: $showPBAlert) {
                Button("OK") { dismiss() }
            } message: {
                Text("Congratulations! You just set a new PB for \(exercise.name)!")
            }
        }
        .presentationDetents([.medium])
        .preferredColorScheme(.dark)
    }

    private func sheetField(label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
            Text(label)
                .font(ArcTheme.Typography.caption())
                .foregroundStyle(ArcTheme.Colors.textSecondary)
            TextField(placeholder, text: text)
                .keyboardType(.decimalPad)
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

    private func saveSet() {
        guard let val = Double(value), val > 0,
              let setsCount = Int(sets), setsCount > 0,
              let repsCount = Int(reps), repsCount > 0 else { return }

        isSaving = true

        Task {
            let isPB = await trainVM.logSet(
                exerciseId: exercise.id,
                value: val,
                sets: setsCount,
                reps: repsCount,
                rpe: Double(rpe)
            )

            isSaving = false

            if isPB {
                showPBAlert = true
            } else {
                dismiss()
            }
        }
    }
}

// MARK: - Add Exercise Sheet

struct AddExerciseSheet: View {
    let trainVM: TrainViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var metricType: MetricType = .weight
    @State private var muscleGroup: MuscleGroup = .chest
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            ZStack {
                ArcTheme.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: ArcTheme.Spacing.xl) {
                    VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                        Text("Exercise Name")
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textSecondary)
                        TextField("e.g. Bench Press", text: $name)
                            .foregroundStyle(ArcTheme.Colors.textPrimary)
                            .padding(ArcTheme.Spacing.md)
                            .background(ArcTheme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous)
                                    .stroke(ArcTheme.Colors.border, lineWidth: 1)
                            )
                    }

                    VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                        Text("Metric Type")
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textSecondary)
                        Picker("Metric Type", selection: $metricType) {
                            ForEach(MetricType.allCases) { type in
                                Text(type.rawValue).tag(type)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(ArcTheme.Colors.primary)
                        .padding(ArcTheme.Spacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ArcTheme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                    }

                    VStack(alignment: .leading, spacing: ArcTheme.Spacing.xs) {
                        Text("Muscle Group")
                            .font(ArcTheme.Typography.caption())
                            .foregroundStyle(ArcTheme.Colors.textSecondary)
                        Picker("Muscle Group", selection: $muscleGroup) {
                            ForEach(MuscleGroup.allCases) { group in
                                Text(group.rawValue).tag(group)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(ArcTheme.Colors.primary)
                        .padding(ArcTheme.Spacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ArcTheme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.sm, style: .continuous))
                    }

                    Spacer()

                    Button {
                        guard !name.isEmpty else { return }
                        isSaving = true
                        Task {
                            await trainVM.addExercise(
                                name: name,
                                metricType: metricType.rawValue,
                                muscleGroup: muscleGroup.rawValue
                            )
                            isSaving = false
                            dismiss()
                        }
                    } label: {
                        HStack {
                            if isSaving {
                                ProgressView()
                                    .tint(.black)
                            } else {
                                Text("Add Exercise")
                                    .font(.headline)
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ArcTheme.Spacing.lg)
                        .background(name.isEmpty ? ArcTheme.Colors.textMuted : ArcTheme.Colors.primary)
                        .foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: ArcTheme.Radius.md, style: .continuous))
                    }
                    .disabled(name.isEmpty || isSaving)
                }
                .padding(ArcTheme.Spacing.xxl)
            }
            .navigationTitle("Add Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ArcTheme.Colors.textSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(.dark)
    }
}

#Preview {
    TrainView()
}
