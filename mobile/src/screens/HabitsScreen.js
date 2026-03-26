import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function HabitsScreen() {
  const [habits, setHabits] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [toggling, setToggling] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [habitsRes, logsRes, profileRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('date', today),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ]);

    if (habitsRes.data) setHabits(habitsRes.data);
    if (logsRes.data) setTodayLogs(logsRes.data);
    if (profileRes.data) setProfile(profileRes.data);
  }

  const isCompleted = (habitId) => todayLogs.some((l) => l.habit_id === habitId);

  async function toggleHabit(habit) {
    if (toggling) return;
    setToggling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Error', 'Please log in first'); setToggling(false); return; }
      const completed = isCompleted(habit.id);

      if (completed) {
        await supabase.from('habit_logs').delete()
          .eq('user_id', user.id)
          .eq('habit_id', habit.id)
          .eq('date', today);
        // Deduct points when un-completing a habit
        const { error: rpcError } = await supabase.rpc('increment_points', {
          user_id: user.id,
          amount: -(habit.points_reward || 10),
        });
        if (rpcError) console.warn('Points decrement failed:', rpcError.message);
      } else {
        await supabase.from('habit_logs').insert({
          user_id: user.id,
          habit_id: habit.id,
          date: today,
        });
        const { error: rpcError } = await supabase.rpc('increment_points', {
          user_id: user.id,
          amount: habit.points_reward || 10,
        });
        if (rpcError) console.warn('Points increment failed:', rpcError.message);
      }
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Could not update habit.');
    }
    setToggling(false);
  }

  async function addHabit() {
    if (!newHabit.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('Error', 'Please log in first'); return; }
    const { error } = await supabase.from('habits').insert({
      user_id: user.id,
      title: newHabit.trim(),
    });
    if (error) Alert.alert('Error', error.message);
    else {
      setShowAdd(false);
      setNewHabit('');
      loadData();
    }
  }

  // Challenge progress
  const challengeDays = profile?.challenge_days_goal || 75;
  const startDate = profile?.challenge_start_date
    ? new Date(profile.challenge_start_date)
    : null;
  const dayNumber = startDate
    ? Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1
    : 0;
  const progress = challengeDays > 0 ? Math.min(dayNumber / challengeDays, 1) : 0;
  const completedToday = habits.length > 0
    ? todayLogs.length / habits.length
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Habits</Text>

        {/* Challenge Card */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>{challengeDays}-Day Challenge</Text>
            <Text style={styles.challengeDay}>
              Day {dayNumber > 0 ? Math.min(dayNumber, challengeDays) : '--'}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.challengeStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {Math.round(completedToday * 100)}%
              </Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?.current_streak || 0}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?.total_points || 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
          </View>
        </View>

        {/* Habit List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Habits</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {habits.map((habit) => {
          const done = isCompleted(habit.id);
          return (
            <TouchableOpacity
              key={habit.id}
              style={[styles.habitCard, done && styles.habitCardDone]}
              onPress={() => toggleHabit(habit)}
            >
              <View style={[styles.checkbox, done && styles.checkboxDone]}>
                {done && <Ionicons name="checkmark" size={18} color={colors.background} />}
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitTitle, done && styles.habitTitleDone]}>
                  {habit.title}
                </Text>
                <Text style={styles.habitPoints}>+{habit.points_reward || 10} pts</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {habits.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No habits yet</Text>
            <Text style={styles.emptySubtext}>Add daily habits to build your streak</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Habit Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Habit</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={newHabit}
              onChangeText={setNewHabit}
              placeholder="e.g. Drink 2L water"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <TouchableOpacity style={styles.submitBtn} onPress={addHabit}>
              <Text style={styles.submitText}>Add Habit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
  challengeCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  challengeTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  challengeDay: { fontSize: 16, fontWeight: '700', color: colors.primary, fontFamily: 'monospace' },
  progressBar: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  challengeStats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  habitCardDone: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,170,0.05)' },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  habitInfo: { flex: 1 },
  habitTitle: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  habitTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  habitPoints: { fontSize: 13, color: colors.primary, fontFamily: 'monospace', marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: 18, color: colors.textSecondary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
