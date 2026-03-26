import Foundation

// MARK: - Profile

struct Profile: Codable, Identifiable, Sendable {
    let id: UUID
    var username: String?
    var bio: String?
    var totalPoints: Int?
    var currentStreak: Int?
    var avatarUrl: String?
    var partnerId: UUID?
    var challengeStartDate: Date?
    var challengeDaysGoal: Int?
    var age: Int?
    var weight: Double?
    var gender: String?
    var goal: String?
    var fitnessLevel: String?
    var completedOnboarding: Bool?
    var dailyCalorieGoal: Int?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, username, bio, gender, goal, weight, age
        case totalPoints = "total_points"
        case currentStreak = "current_streak"
        case avatarUrl = "avatar_url"
        case partnerId = "partner_id"
        case challengeStartDate = "challenge_start_date"
        case challengeDaysGoal = "challenge_days_goal"
        case fitnessLevel = "fitness_level"
        case completedOnboarding = "completed_onboarding"
        case dailyCalorieGoal = "daily_calorie_goal"
        case createdAt = "created_at"
    }
}

// MARK: - Exercise

struct Exercise: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var name: String
    var metricType: MetricType?
    var muscleGroup: String?
    var isBenchmark: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name
        case userId = "user_id"
        case metricType = "metric_type"
        case muscleGroup = "muscle_group"
        case isBenchmark = "is_benchmark"
    }
}

enum MetricType: String, Codable, Sendable, CaseIterable {
    case weight
    case time
    case reps
    case distance
}

// MARK: - Personal Best

struct PersonalBest: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var exerciseId: UUID?
    var value: Double
    var achievedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, value
        case userId = "user_id"
        case exerciseId = "exercise_id"
        case achievedAt = "achieved_at"
    }
}

// MARK: - Workout Log

struct WorkoutLog: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var exerciseId: UUID?
    var value: Double
    var sets: Int?
    var reps: Int?
    var rpe: Int?
    var notes: String?
    var isNewPb: Bool?
    var pointsAwarded: Int?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, value, sets, reps, rpe, notes
        case userId = "user_id"
        case exerciseId = "exercise_id"
        case isNewPb = "is_new_pb"
        case pointsAwarded = "points_awarded"
        case createdAt = "created_at"
    }
}

// MARK: - Habit

struct Habit: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var title: String
    var description: String?
    var pointsReward: Int?
    var isActive: Bool?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, description
        case userId = "user_id"
        case pointsReward = "points_reward"
        case isActive = "is_active"
        case createdAt = "created_at"
    }
}

// MARK: - Habit Log

struct HabitLog: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var habitId: UUID?
    var completedAt: Date?
    var date: String? // "YYYY-MM-DD" date string from PostgreSQL date type

    enum CodingKeys: String, CodingKey {
        case id, date
        case userId = "user_id"
        case habitId = "habit_id"
        case completedAt = "completed_at"
    }
}

// MARK: - Food Log

struct Macros: Codable, Sendable {
    var protein: Double?
    var carbs: Double?
    var fat: Double?
}

struct FoodLog: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var itemName: String?
    var calories: Int?
    var macros: Macros?
    var barcode: String?
    var eatenAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, calories, macros, barcode
        case userId = "user_id"
        case itemName = "item_name"
        case eatenAt = "eaten_at"
    }
}

// MARK: - Public Feed (Social Feed Post)

/// JSON payload stored in the workout_data column of public_feed.
struct FeedWorkoutData: Codable, Sendable {
    var exerciseName: String?
    var value: Double?
    var metricType: String?
    var isNewPb: Bool?
    var pointsEarned: Int?
    var date: String?

    enum CodingKeys: String, CodingKey {
        case value, date
        case exerciseName = "exercise_name"
        case metricType = "metric_type"
        case isNewPb = "is_new_pb"
        case pointsEarned = "points_earned"
    }
}

struct FeedPost: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var workoutData: FeedWorkoutData?
    var createdAt: Date?
    var likesCount: Int?

    // Joined profile (optional, populated via select query)
    var profiles: Profile?

    enum CodingKeys: String, CodingKey {
        case id, profiles
        case userId = "user_id"
        case workoutData = "workout_data"
        case createdAt = "created_at"
        case likesCount = "likes_count"
    }
}

// MARK: - High Five (Feed Like)

struct HighFive: Codable, Identifiable, Sendable {
    let id: UUID
    var feedId: UUID?
    var userId: UUID?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case feedId = "feed_id"
        case userId = "user_id"
        case createdAt = "created_at"
    }
}

// MARK: - Partner (Business / Check-in Location)

struct Partner: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var locationLat: Double?
    var locationLong: Double?
    var qrUuid: UUID?

    enum CodingKeys: String, CodingKey {
        case id, name
        case locationLat = "location_lat"
        case locationLong = "location_long"
        case qrUuid = "qr_uuid"
    }
}

// MARK: - Check-In

struct CheckIn: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var partnerId: UUID?
    var awardedPoints: Int?
    var checkedInAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case partnerId = "partner_id"
        case awardedPoints = "awarded_points"
        case checkedInAt = "checked_in_at"
    }
}

// MARK: - Rewards Ledger

struct RewardsLedger: Codable, Identifiable, Sendable {
    let id: UUID
    var code: String
    var codeType: String
    var pointsValue: Int?
    var partnerId: UUID?
    var isUsed: Bool?
    var usedBy: UUID?
    var usedAt: Date?
    var description: String?
    var expiresAt: Date?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, code, description
        case codeType = "code_type"
        case pointsValue = "points_value"
        case partnerId = "partner_id"
        case isUsed = "is_used"
        case usedBy = "used_by"
        case usedAt = "used_at"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}

// MARK: - Group

struct Group: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var description: String?
    var avatarUrl: String?
    var createdBy: UUID?
    var isPublic: Bool?
    var memberCount: Int?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case avatarUrl = "avatar_url"
        case createdBy = "created_by"
        case isPublic = "is_public"
        case memberCount = "member_count"
        case createdAt = "created_at"
    }
}

// MARK: - Group Member

struct GroupMember: Codable, Identifiable, Sendable {
    let id: UUID
    var groupId: UUID?
    var userId: UUID?
    var role: String?
    var joinedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, role
        case groupId = "group_id"
        case userId = "user_id"
        case joinedAt = "joined_at"
    }
}

// MARK: - Community Message (Group Message)

struct GroupMessage: Codable, Identifiable, Sendable {
    let id: UUID
    var userId: UUID?
    var groupId: UUID?
    var content: String
    var messageType: String?
    var metadata: [String: String]?
    var imageUrl: String?
    var likesCount: Int?
    var repliesCount: Int?
    var createdAt: Date?

    // Joined profile
    var profiles: Profile?

    enum CodingKeys: String, CodingKey {
        case id, content, metadata, profiles
        case userId = "user_id"
        case groupId = "group_id"
        case messageType = "message_type"
        case imageUrl = "image_url"
        case likesCount = "likes_count"
        case repliesCount = "replies_count"
        case createdAt = "created_at"
    }
}

// MARK: - Direct Message

struct DirectMessage: Codable, Identifiable, Sendable {
    let id: UUID
    var senderId: UUID?
    var receiverId: UUID?
    var content: String
    var imageUrl: String?
    var isRead: Bool?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, content
        case senderId = "sender_id"
        case receiverId = "receiver_id"
        case imageUrl = "image_url"
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}
