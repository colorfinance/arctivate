import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleLogin() {
    if (!email.trim()) return;
    setLoading(true);
    const redirectUrl = Linking.createURL('auth');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="flash" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>ARCTIVATE</Text>
          <Text style={styles.subtitle}>Gamify your discipline</Text>
        </View>

        {sent ? (
          <View style={styles.sentContainer}>
            <Ionicons name="mail-open-outline" size={64} color={colors.primary} />
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentText}>
              We sent a magic link to {email}. Tap it to sign in.
            </Text>
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => setSent(false)}
            >
              <Text style={styles.resendText}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.features}>
          {[
            { icon: 'barbell-outline', label: 'Track Workouts & PBs' },
            { icon: 'trophy-outline', label: 'Earn Points & Streaks' },
            { icon: 'people-outline', label: 'Community & Groups' },
          ].map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Ionicons name={f.icon} size={20} color={colors.primary} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  form: { marginBottom: spacing.xl },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  sentContainer: { alignItems: 'center', marginBottom: spacing.xl },
  sentTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  sentText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  resendBtn: { marginTop: spacing.lg },
  resendText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  features: { gap: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { color: colors.textSecondary, fontSize: 14 },
});
