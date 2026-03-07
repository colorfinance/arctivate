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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function FoodScreen() {
  const [logs, setLogs] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({
    item_name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [dailyGoal, setDailyGoal] = useState(2000);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [logsRes, profileRes] = await Promise.all([
      supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('eaten_at', today)
        .order('eaten_at', { ascending: false }),
      supabase.from('profiles').select('daily_calorie_goal').eq('id', user.id).maybeSingle(),
    ]);

    if (logsRes.data) setLogs(logsRes.data);
    if (profileRes.data?.daily_calorie_goal) setDailyGoal(profileRes.data.daily_calorie_goal);
  }

  async function analyzePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) return;

    setAnalyzing(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://your-app.vercel.app';
      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: result.assets[0].base64 }),
      });

      const data = await response.json();
      if (data.name) {
        setForm({
          item_name: data.name,
          calories: String(data.cals || ''),
          protein: String(data.p || ''),
          carbs: String(data.c || ''),
          fat: String(data.f || ''),
        });
        setShowAdd(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not analyze image');
    }
    setAnalyzing(false);
  }

  async function handleAdd() {
    if (!form.item_name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('food_logs').insert({
      user_id: user.id,
      item_name: form.item_name.trim(),
      calories: parseInt(form.calories) || 0,
      macros: {
        protein: parseInt(form.protein) || 0,
        carbs: parseInt(form.carbs) || 0,
        fat: parseInt(form.fat) || 0,
      },
    });

    if (error) Alert.alert('Error', error.message);
    else {
      setShowAdd(false);
      setForm({ item_name: '', calories: '', protein: '', carbs: '', fat: '' });
      loadData();
    }
  }

  const totalCals = logs.reduce((sum, l) => sum + (l.calories || 0), 0);
  const totalProtein = logs.reduce((sum, l) => sum + (l.macros?.protein || 0), 0);
  const totalCarbs = logs.reduce((sum, l) => sum + (l.macros?.carbs || 0), 0);
  const totalFat = logs.reduce((sum, l) => sum + (l.macros?.fat || 0), 0);
  const calProgress = dailyGoal > 0 ? Math.min(totalCals / dailyGoal, 1) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Food</Text>

        {/* Daily Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.calRow}>
            <Text style={styles.calValue}>{totalCals}</Text>
            <Text style={styles.calGoal}>/ {dailyGoal} cal</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${calProgress * 100}%` }]} />
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: '#3B82F6' }]}>{totalProtein}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: '#F59E0B' }]}>{totalCarbs}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: '#EF4444' }]}>{totalFat}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={analyzePhoto}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="camera" size={24} color={colors.background} />
                <Text style={styles.cameraBtnText}>Scan Food</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => setShowAdd(true)}
          >
            <Ionicons name="add" size={24} color={colors.primary} />
            <Text style={styles.manualBtnText}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* Food Log */}
        <Text style={styles.sectionTitle}>Today's Log</Text>
        {logs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logInfo}>
              <Text style={styles.logName}>{log.item_name}</Text>
              <Text style={styles.logMacros}>
                P:{log.macros?.protein || 0}g · C:{log.macros?.carbs || 0}g · F:{log.macros?.fat || 0}g
              </Text>
            </View>
            <Text style={styles.logCals}>{log.calories} cal</Text>
          </View>
        ))}

        {logs.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No food logged today</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Food Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Food</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={form.item_name}
              onChangeText={(v) => setForm((p) => ({ ...p, item_name: v }))}
              placeholder="Food name"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              value={form.calories}
              onChangeText={(v) => setForm((p) => ({ ...p, calories: v }))}
              placeholder="Calories"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.protein}
                onChangeText={(v) => setForm((p) => ({ ...p, protein: v }))}
                placeholder="Protein (g)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.carbs}
                onChangeText={(v) => setForm((p) => ({ ...p, carbs: v }))}
                placeholder="Carbs (g)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.fat}
                onChangeText={(v) => setForm((p) => ({ ...p, fat: v }))}
                placeholder="Fat (g)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
              <Text style={styles.submitText}>Add to Log</Text>
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginBottom: spacing.sm },
  calValue: { fontSize: 36, fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' },
  calGoal: { fontSize: 16, color: colors.textMuted },
  progressBar: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center' },
  macroValue: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  macroLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  cameraBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  cameraBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  manualBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logInfo: { flex: 1 },
  logName: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  logMacros: { fontSize: 13, color: colors.textMuted, fontFamily: 'monospace', marginTop: 2 },
  logCals: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: 16, color: colors.textMuted },
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
  row: { flexDirection: 'row', gap: spacing.sm },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
