import Foundation
import Supabase

/// Singleton service wrapping the Supabase Swift SDK for all database and auth operations.
final class SupabaseService: Sendable {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        let url = URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"]
            ?? "https://your-project.supabase.co")!
        let key = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
            ?? "your-anon-key"

        client = SupabaseClient(supabaseURL: url, supabaseKey: key)
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async throws -> UUID {
        let response = try await client.auth.signUp(email: email, password: password)
        return response.user.id
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    func getSession() async throws -> Session {
        try await client.auth.session
    }

    func getCurrentUserId() async throws -> UUID {
        let session = try await getSession()
        return session.user.id
    }

    // MARK: - Profiles

    func fetchProfile(userId: UUID) async throws -> Profile {
        try await client
            .from("profiles")
            .select()
            .eq("id", value: userId.uuidString)
            .single()
            .execute()
            .value
    }

    func updateProfile(_ updates: ProfileUpdate, userId: UUID) async throws {
        try await client
            .from("profiles")
            .update(updates)
            .eq("id", value: userId.uuidString)
            .execute()
    }

    // MARK: - Exercises

    func fetchExercises(userId: UUID) async throws -> [Exercise] {
        try await client
            .from("exercises")
            .select()
            .eq("user_id", value: userId.uuidString)
            .order("name")
            .execute()
            .value
    }

    func createExercise(_ exercise: Exercise) async throws {
        try await client
            .from("exercises")
            .insert(exercise)
            .execute()
    }

    func deleteExercise(id: UUID) async throws {
        try await client
            .from("exercises")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Personal Bests

    func fetchPersonalBests(userId: UUID) async throws -> [PersonalBest] {
        try await client
            .from("personal_bests")
            .select()
            .eq("user_id", value: userId.uuidString)
            .order("achieved_at", ascending: false)
            .execute()
            .value
    }

    func upsertPersonalBest(_ pb: PersonalBest) async throws {
        try await client
            .from("personal_bests")
            .upsert(pb)
            .execute()
    }

    // MARK: - Workout Logs

    func fetchWorkoutLogs(userId: UUID, limit: Int = 50) async throws -> [WorkoutLog] {
        try await client
            .from("workout_logs")
            .select()
            .eq("user_id", value: userId.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func createWorkoutLog(_ log: WorkoutLog) async throws {
        try await client
            .from("workout_logs")
            .insert(log)
            .execute()
    }

    func deleteWorkoutLog(id: UUID) async throws {
        try await client
            .from("workout_logs")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Habits

    func fetchHabits(userId: UUID) async throws -> [Habit] {
        try await client
            .from("habits")
            .select()
            .eq("user_id", value: userId.uuidString)
            .eq("is_active", value: true)
            .order("created_at")
            .execute()
            .value
    }

    func createHabit(_ habit: Habit) async throws {
        try await client
            .from("habits")
            .insert(habit)
            .execute()
    }

    func updateHabit(_ habit: Habit) async throws {
        try await client
            .from("habits")
            .update(habit)
            .eq("id", value: habit.id.uuidString)
            .execute()
    }

    func deleteHabit(id: UUID) async throws {
        try await client
            .from("habits")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Habit Logs

    func fetchHabitLogs(userId: UUID, date: String) async throws -> [HabitLog] {
        try await client
            .from("habit_logs")
            .select()
            .eq("user_id", value: userId.uuidString)
            .eq("date", value: date)
            .execute()
            .value
    }

    func createHabitLog(_ log: HabitLog) async throws {
        try await client
            .from("habit_logs")
            .insert(log)
            .execute()
    }

    func deleteHabitLog(id: UUID) async throws {
        try await client
            .from("habit_logs")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Food Logs

    func fetchFoodLogs(userId: UUID, date: String? = nil) async throws -> [FoodLog] {
        var query = client
            .from("food_logs")
            .select()
            .eq("user_id", value: userId.uuidString)
            .order("eaten_at", ascending: false)

        if let date {
            let start = "\(date)T00:00:00Z"
            let end = "\(date)T23:59:59Z"
            query = query
                .gte("eaten_at", value: start)
                .lte("eaten_at", value: end)
        }

        return try await query.limit(100).execute().value
    }

    func createFoodLog(_ log: FoodLog) async throws {
        try await client
            .from("food_logs")
            .insert(log)
            .execute()
    }

    func deleteFoodLog(id: UUID) async throws {
        try await client
            .from("food_logs")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Public Feed

    func fetchFeed(limit: Int = 30) async throws -> [FeedPost] {
        try await client
            .from("public_feed")
            .select("*, profiles(*)")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func createFeedPost(_ post: FeedPost) async throws {
        try await client
            .from("public_feed")
            .insert(post)
            .execute()
    }

    func deleteFeedPost(id: UUID) async throws {
        try await client
            .from("public_feed")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - High Fives

    func fetchHighFives(feedId: UUID) async throws -> [HighFive] {
        try await client
            .from("high_fives")
            .select()
            .eq("feed_id", value: feedId.uuidString)
            .execute()
            .value
    }

    func toggleHighFive(feedId: UUID, userId: UUID) async throws {
        let existing: [HighFive] = try await client
            .from("high_fives")
            .select()
            .eq("feed_id", value: feedId.uuidString)
            .eq("user_id", value: userId.uuidString)
            .execute()
            .value

        if let first = existing.first {
            try await client
                .from("high_fives")
                .delete()
                .eq("id", value: first.id.uuidString)
                .execute()
        } else {
            let hf = HighFive(
                id: UUID(),
                feedId: feedId,
                userId: userId,
                createdAt: nil
            )
            try await client
                .from("high_fives")
                .insert(hf)
                .execute()
        }
    }

    // MARK: - Partners

    func fetchPartners() async throws -> [Partner] {
        try await client
            .from("partners")
            .select()
            .execute()
            .value
    }

    // MARK: - Check-Ins

    func fetchCheckIns(userId: UUID) async throws -> [CheckIn] {
        try await client
            .from("check_ins")
            .select()
            .eq("user_id", value: userId.uuidString)
            .order("checked_in_at", ascending: false)
            .execute()
            .value
    }

    func createCheckIn(_ checkIn: CheckIn) async throws {
        try await client
            .from("check_ins")
            .insert(checkIn)
            .execute()
    }

    // MARK: - Rewards Ledger

    func fetchRewards(userId: UUID) async throws -> [RewardsLedger] {
        try await client
            .from("rewards_ledger")
            .select()
            .eq("used_by", value: userId.uuidString)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    // MARK: - Groups

    func fetchGroups() async throws -> [Group] {
        try await client
            .from("groups")
            .select()
            .eq("is_public", value: true)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    func fetchUserGroups(userId: UUID) async throws -> [Group] {
        let memberships: [GroupMember] = try await client
            .from("group_members")
            .select()
            .eq("user_id", value: userId.uuidString)
            .execute()
            .value

        let groupIds = memberships.compactMap { $0.groupId?.uuidString }
        guard !groupIds.isEmpty else { return [] }

        return try await client
            .from("groups")
            .select()
            .in("id", values: groupIds)
            .execute()
            .value
    }

    // MARK: - Group Messages

    func fetchGroupMessages(groupId: UUID?, limit: Int = 50) async throws -> [GroupMessage] {
        var query = client
            .from("community_messages")
            .select("*, profiles(*)")
            .order("created_at", ascending: false)
            .limit(limit)

        if let groupId {
            query = query.eq("group_id", value: groupId.uuidString)
        } else {
            query = query.is("group_id", value: "null")
        }

        return try await query.execute().value
    }

    func createGroupMessage(_ message: GroupMessage) async throws {
        try await client
            .from("community_messages")
            .insert(message)
            .execute()
    }

    // MARK: - Direct Messages

    func fetchDirectMessages(otherUserId: UUID, currentUserId: UUID, limit: Int = 50) async throws -> [DirectMessage] {
        try await client
            .from("direct_messages")
            .select()
            .or("and(sender_id.eq.\(currentUserId.uuidString),receiver_id.eq.\(otherUserId.uuidString)),and(sender_id.eq.\(otherUserId.uuidString),receiver_id.eq.\(currentUserId.uuidString))")
            .order("created_at", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    func sendDirectMessage(_ message: DirectMessage) async throws {
        try await client
            .from("direct_messages")
            .insert(message)
            .execute()
    }

    // MARK: - Points RPC

    /// Calls the increment_points database function to atomically add points to a user profile.
    func incrementPoints(userId: UUID, points: Int) async throws {
        try await client
            .rpc("increment_points", params: [
                "p_user_id": AnyJSON.string(userId.uuidString),
                "p_points": AnyJSON.integer(points)
            ])
            .execute()
    }

    // MARK: - Storage (Voice Memos)

    /// Uploads a voice memo audio file to Supabase Storage and returns the public URL.
    func uploadVoiceMemo(data: Data, userId: UUID, fileName: String? = nil) async throws -> String {
        let bucket = "voice-memos"
        let name = fileName ?? "\(userId.uuidString)/\(UUID().uuidString).m4a"

        try await client.storage
            .from(bucket)
            .upload(
                name,
                data: data,
                options: FileOptions(contentType: "audio/mp4")
            )

        let publicURL = try client.storage
            .from(bucket)
            .getPublicURL(path: name)

        return publicURL.absoluteString
    }
}

// MARK: - Profile Update DTO

/// Partial update struct for profile fields. Only non-nil fields are sent.
struct ProfileUpdate: Codable, Sendable {
    var username: String?
    var bio: String?
    var avatarUrl: String?
    var age: Int?
    var weight: Double?
    var gender: String?
    var goal: String?
    var fitnessLevel: String?
    var completedOnboarding: Bool?
    var challengeStartDate: Date?
    var challengeDaysGoal: Int?
    var dailyCalorieGoal: Int?

    enum CodingKeys: String, CodingKey {
        case username, bio, age, weight, gender, goal
        case avatarUrl = "avatar_url"
        case fitnessLevel = "fitness_level"
        case completedOnboarding = "completed_onboarding"
        case challengeStartDate = "challenge_start_date"
        case challengeDaysGoal = "challenge_days_goal"
        case dailyCalorieGoal = "daily_calorie_goal"
    }
}
