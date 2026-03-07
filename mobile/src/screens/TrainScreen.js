import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function TrainScreen({ navigation }) {
  const [exercises, setExercises] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [newExercise, setNewExercise] = useState({ name: '', metric_type: 'weight', muscle_group: '' });
  const [logForm, setLogForm] = useState({ value: '', sets: '', reps: '', rpe: '' });

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [exRes, logRes] = await Promise.all([
      supabase.from('exercises').select('*').eq('user_id', user.id).order('name'),
      supabase
        .from('workout_logs')
        .select('*, exercises(name, metric_type)')
        .eq('user_id', user.id)
        .gte('logged_at', today)
        .order('logged_at', { ascending: false }),
    ]);

    if (exRes.data) setExercises(exRes.data);
    if (logRes.data) setTodayLogs(logRes.data);
  }

  async function handleAddExercise() {
    if (!newExercise.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('exercises').insert({
      user_id: user.id,
      name: newExercise.name.trim(),
      metric_type: newExercise.metric_type,
      muscle_group: newExercise.muscle_group.trim() || null,
    });
    if (error) Alert.alert('Error', error.message);
    else {
      setShowAddExercise(false);
      setNewExercise({ name: '', metric_type: 'weight', muscle_group: '' });
      loadData();
    }
  }

  async function handleLogSet() {
    if (!selectedExercise || !logForm.value) return;
    const { data: { user } } = await supabase.auth.getUser();
    const value = parseFloat(logForm.value);

    // Check for PB
    const { data: pb } = await supabase
      .from('personal_bests')
      .select('value')
      .eq('user_id', user.id)
      .eq('exercise_id', selectedExercise.id)
      .single();

    const isNewPB = !pb || value > pb.value;
    const points = isNewPB ? 150 : 50;

    const { error } = await supabase.from('workout_logs').insert({
      user_id: user.id,
      exercise_id: selectedExercise.id,
      value,
      sets: parseInt(logForm.sets) || 1,
      reps: parseInt(logForm.reps) || 1,
      rpe: parseInt(logForm.rpe) || null,
      is_new_pb: isNewPB,
      points_awarded: points,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (isNewPB) {
      await supabase.from('personal_bests').upsert({
        user_id: user.id,
        exercise_id: selectedExercise.id,
        value,
      });
    }

    // Award points
    await supabase.rpc('increment_points', { user_id: user.id, amount: points });

    setShowLogModal(false);
    setLogForm({ value: '', sets: '', reps: '', rpe: '' });
    setSelectedExercise(null);
    loadData();

    if (isNewPB) {
      Alert.alert('NEW PB!', `${selectedExercise.name}: ${value} - +100 bonus points!`);
    }
  }

  const metricLabel = (type) => {
    const labels = { weight: 'kg', time: 'sec', reps: 'reps', distance: 'm' };
    return labels[type] || type;
  };

  function renderExerciseItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.exerciseCard}
        onPress={() => {
          setSelectedExercise(item);
          setShowLogModal(true);
        }}
      >
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseMeta}>
            {item.muscle_group || 'General'} · {metricLabel(item.metric_type)}
          </Text>
        </View>
        <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Train</Text>
          <Text style={styles.subtitle}>{todayLogs.length} sets logged today</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Log Summary */}
      {todayLogs.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today's Session</Text>
          {todayLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logExercise}>{log.exercises?.name}</Text>
              <Text style={styles.logValue}>
                {log.value}{metricLabel(log.exercises?.metric_type)} x{log.reps} · {log.sets}s
              </Text>
              {log.is_new_pb && (
                <View style={styles.pbBadge}>
                  <Text style={styles.pbText}>PB</Text>
                </View>
              )}
            </View>
          ))}
          <View style={styles.totalPoints}>
            <Ionicons name="flash" size={16} color={colors.primary} />
            <Text style={styles.totalPointsText}>
              +{todayLogs.reduce((sum, l) => sum + (l.points_awarded || 0), 0)} pts
            </Text>
          </View>
        </View>
      )}

      {/* Exercise List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Exercises</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddExercise(true)}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={exercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No exercises yet</Text>
            <Text style={styles.emptySubtext}>Add your first exercise to start logging</Text>
          </View>
        }
      />

      {/* Add Exercise Modal */}
      <Modal visible={showAddExercise} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Exercise</Text>
              <TouchableOpacity onPress={() => setShowAddExercise(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={newExercise.name}
              onChangeText={(v) => setNewExercise((p) => ({ ...p, name: v }))}
              placeholder="Exercise name"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              value={newExercise.muscle_group}
              onChangeText={(v) => setNewExercise((p) => ({ ...p, muscle_group: v }))}
              placeholder="Muscle group (optional)"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Metric Type</Text>
            <View style={styles.chipRow}>
              {['weight', 'time', 'reps', 'distance'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, newExercise.metric_type === t && styles.chipActive]}
                  onPress={() => setNewExercise((p) => ({ ...p, metric_type: t }))}
                >
                  <Text style={[styles.chipText, newExercise.metric_type === t && styles.chipTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddExercise}>
              <Text style={styles.submitText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Log Set Modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log: {selectedExercise?.name}</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={logForm.value}
              onChangeText={(v) => setLogForm((p) => ({ ...p, value: v }))}
              placeholder={`Value (${metricLabel(selectedExercise?.metric_type)})`}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={logForm.sets}
                onChangeText={(v) => setLogForm((p) => ({ ...p, sets: v }))}
                placeholder="Sets"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={logForm.reps}
                onChangeText={(v) => setLogForm((p) => ({ ...p, reps: v }))}
                placeholder="Reps"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={logForm.rpe}
                onChangeText={(v) => setLogForm((p) => ({ ...p, rpe: v }))}
                placeholder="RPE"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleLogSet}>
              <Ionicons name="checkmark" size={20} color={colors.background} />
              <Text style={styles.submitText}>Log Set</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { padding: spacing.xs },
  summaryCard: {
    margin: spacing.lg,
    marginTop: 0,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  logExercise: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  logValue: { color: colors.textSecondary, fontSize: 13, fontFamily: 'monospace' },
  pbBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pbText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  totalPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalPointsText: { color: colors.primary, fontWeight: '600', fontFamily: 'monospace' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  exerciseMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: 18, color: colors.textSecondary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: colors.textMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
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
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 14 },
  chipTextActive: { color: colors.primary },
  row: { flexDirection: 'row', gap: spacing.sm },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
