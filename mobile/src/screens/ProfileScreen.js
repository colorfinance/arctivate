import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ workouts: 0, pbs: 0, habits: 0 });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

      const [profileRes, workoutRes, pbRes, habitRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('workout_logs').select('id', { count: 'exact' })
          .eq('user_id', user.id).gte('logged_at', monthAgo),
        supabase.from('personal_bests').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('habit_logs').select('id', { count: 'exact' })
          .eq('user_id', user.id).gte('date', monthAgo),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setStats({
        workouts: workoutRes.count || 0,
        pbs: pbRes.count || 0,
        habits: habitRes.count || 0,
      });
    } catch (err) {
      console.warn('Profile load error:', err);
    }
    setLoading(false);
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>Could not load profile</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>{profile.username || 'User'}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {/* Points & Streak */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="flash" size={24} color={colors.primary} />
          <Text style={styles.statValue}>{profile.total_points || 0}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="flame" size={24} color={colors.accent} />
          <Text style={styles.statValue}>{profile.current_streak || 0}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* Monthly Stats */}
      <Text style={styles.sectionTitle}>Last 30 Days</Text>
      <View style={styles.monthStats}>
        <View style={styles.monthStat}>
          <Text style={styles.monthValue}>{stats.workouts}</Text>
          <Text style={styles.monthLabel}>Sets Logged</Text>
        </View>
        <View style={styles.monthStat}>
          <Text style={styles.monthValue}>{stats.pbs}</Text>
          <Text style={styles.monthLabel}>Personal Bests</Text>
        </View>
        <View style={styles.monthStat}>
          <Text style={styles.monthValue}>{stats.habits}</Text>
          <Text style={styles.monthLabel}>Habits Done</Text>
        </View>
      </View>

      {/* Quick Links */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      {[
        { icon: 'qr-code-outline', label: 'Check In', screen: 'Checkin' },
        { icon: 'people-outline', label: 'Groups', screen: 'Groups' },
      ].map((item) => (
        <TouchableOpacity
          key={item.label}
          style={styles.linkRow}
          onPress={() => navigation.navigate(item.screen)}
        >
          <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
          <Text style={styles.linkText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ))}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.primary, fontSize: 32, fontWeight: '700' },
  username: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  bio: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' },
  statLabel: { fontSize: 13, color: colors.textMuted },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  monthStats: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthStat: { flex: 1, alignItems: 'center' },
  monthValue: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' },
  monthLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: { flex: 1, fontSize: 16, color: colors.textPrimary },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
