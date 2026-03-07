import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data } = await supabase
      .from('public_feed')
      .select('*, profiles(username, avatar_url), high_fives(user_id)')
      .order('shared_at', { ascending: false })
      .limit(50);

    if (data) setPosts(data);
  }

  async function toggleHighFive(post) {
    if (!currentUserId) return;
    const hasHighFived = post.high_fives?.some((h) => h.user_id === currentUserId);

    if (hasHighFived) {
      await supabase.from('high_fives').delete()
        .eq('feed_id', post.id)
        .eq('user_id', currentUserId);
    } else {
      await supabase.from('high_fives').insert({
        feed_id: post.id,
        user_id: currentUserId,
      });
    }
    loadFeed();
  }

  function formatTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function renderPost({ item }) {
    const workout = item.workout_data || {};
    const hasHighFived = item.high_fives?.some((h) => h.user_id === currentUserId);
    const highFiveCount = item.high_fives?.length || item.likes_count || 0;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(item.profiles?.username || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.username}>{item.profiles?.username || 'User'}</Text>
            <Text style={styles.time}>{formatTime(item.shared_at)}</Text>
          </View>
        </View>

        {workout.exercises && (
          <View style={styles.workoutSummary}>
            {workout.exercises.slice(0, 4).map((ex, i) => (
              <View key={i} style={styles.exerciseRow}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exDetail}>
                  {ex.value}{ex.unit || 'kg'} x{ex.reps}
                </Text>
              </View>
            ))}
            {workout.totalPoints && (
              <View style={styles.pointsRow}>
                <Ionicons name="flash" size={14} color={colors.primary} />
                <Text style={styles.pointsText}>+{workout.totalPoints} pts</Text>
              </View>
            )}
          </View>
        )}

        {item.caption && <Text style={styles.caption}>{item.caption}</Text>}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => toggleHighFive(item)}
          >
            <Ionicons
              name={hasHighFived ? 'hand-left' : 'hand-left-outline'}
              size={22}
              color={hasHighFived ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.actionText, hasHighFived && { color: colors.primary }]}>
              {highFiveCount}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Groups')}>
          <Ionicons name="people-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={loadFeed}
        refreshing={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Share a workout from the Train tab</Text>
          </View>
        }
      />
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  postMeta: { flex: 1 },
  username: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  time: { fontSize: 12, color: colors.textMuted },
  workoutSummary: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  exName: { color: colors.textPrimary, fontSize: 14 },
  exDetail: { color: colors.textSecondary, fontSize: 14, fontFamily: 'monospace' },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pointsText: { color: colors.primary, fontWeight: '600', fontFamily: 'monospace', fontSize: 13 },
  caption: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.sm },
  postActions: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: spacing.xxl * 2, gap: spacing.sm },
  emptyText: { fontSize: 18, color: colors.textSecondary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: colors.textMuted },
});
