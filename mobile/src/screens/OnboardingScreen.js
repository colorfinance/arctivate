import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

const GOALS = ['Lose Weight', 'Build Muscle', 'Get Stronger', 'Stay Active', 'Sport Performance'];
const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    username: '',
    age: '',
    weight: '',
    gender: '',
    goal: '',
    fitness_level: '',
  });
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleComplete() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        username: form.username,
        age: parseInt(form.age) || null,
        weight: parseFloat(form.weight) || null,
        gender: form.gender,
        goal: form.goal,
        fitness_level: form.fitness_level,
        completed_onboarding: true,
      });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        onComplete?.();
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  const steps = [
    // Step 0: Username
    <View key="username" style={styles.stepContainer}>
      <Ionicons name="person-outline" size={48} color={colors.primary} />
      <Text style={styles.stepTitle}>What should we call you?</Text>
      <TextInput
        style={styles.input}
        value={form.username}
        onChangeText={(v) => update('username', v)}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
    </View>,

    // Step 1: Basics
    <View key="basics" style={styles.stepContainer}>
      <Ionicons name="body-outline" size={48} color={colors.primary} />
      <Text style={styles.stepTitle}>Tell us about yourself</Text>
      <TextInput
        style={styles.input}
        value={form.age}
        onChangeText={(v) => update('age', v)}
        placeholder="Age"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        value={form.weight}
        onChangeText={(v) => update('weight', v)}
        placeholder="Weight (kg)"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />
      <View style={styles.chipRow}>
        {['Male', 'Female', 'Other'].map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, form.gender === g && styles.chipActive]}
            onPress={() => update('gender', g)}
          >
            <Text style={[styles.chipText, form.gender === g && styles.chipTextActive]}>
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 2: Goal
    <View key="goal" style={styles.stepContainer}>
      <Ionicons name="flag-outline" size={48} color={colors.primary} />
      <Text style={styles.stepTitle}>What's your goal?</Text>
      <View style={styles.chipRow}>
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, form.goal === g && styles.chipActive]}
            onPress={() => update('goal', g)}
          >
            <Text style={[styles.chipText, form.goal === g && styles.chipTextActive]}>
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 3: Fitness Level
    <View key="level" style={styles.stepContainer}>
      <Ionicons name="trending-up-outline" size={48} color={colors.primary} />
      <Text style={styles.stepTitle}>Your fitness level</Text>
      <View style={styles.chipRow}>
        {FITNESS_LEVELS.map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.chip, form.fitness_level === l && styles.chipActive]}
            onPress={() => update('fitness_level', l)}
          >
            <Text style={[styles.chipText, form.fitness_level === l && styles.chipTextActive]}>
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,
  ];

  const isLastStep = step === steps.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
            />
          ))}
        </View>

        {steps[step]}

        <View style={styles.nav}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, loading && { opacity: 0.6 }]}
            onPress={isLastStep ? handleComplete : () => setStep(step + 1)}
            disabled={loading}
          >
            <Text style={styles.nextText}>
              {loading ? 'Saving...' : isLastStep ? 'Let\'s Go' : 'Next'}
            </Text>
            {!isLastStep && <Ionicons name="arrow-forward" size={18} color={colors.background} />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  dotDone: { backgroundColor: colors.primaryDim },
  stepContainer: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: colors.primary },
  nav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: { padding: spacing.md },
  backText: { color: colors.textMuted, fontSize: 16 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  nextText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
