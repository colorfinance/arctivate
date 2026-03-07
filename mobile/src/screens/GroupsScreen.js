import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function GroupsScreen() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data } = await supabase
      .from('groups')
      .select('*, group_members(user_id)')
      .order('created_at', { ascending: false });

    if (data) setGroups(data);
  }

  async function openGroup(group) {
    setSelectedGroup(group);
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles(username)')
      .eq('group_id', group.id)
      .order('sent_at', { ascending: true })
      .limit(100);

    if (data) setMessages(data);
  }

  async function sendGroupMessage() {
    if (!newMessage.trim() || !selectedGroup) return;

    const { error } = await supabase.from('group_messages').insert({
      group_id: selectedGroup.id,
      user_id: currentUserId,
      content: newMessage.trim(),
    });

    if (!error) {
      setNewMessage('');
      openGroup(selectedGroup);
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;

    const { data, error } = await supabase.from('groups').insert({
      name: newGroupName.trim(),
      created_by: currentUserId,
    }).select().single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // Add creator as member
    await supabase.from('group_members').insert({
      group_id: data.id,
      user_id: currentUserId,
    });

    setShowCreate(false);
    setNewGroupName('');
    loadGroups();
  }

  if (selectedGroup) {
    return (
      <View style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedGroup(null)}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.chatTitle}>{selectedGroup.name}</Text>
          <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View style={[
              styles.msgBubble,
              item.user_id === currentUserId ? styles.myMsg : styles.otherMsg,
            ]}>
              {item.user_id !== currentUserId && (
                <Text style={styles.msgAuthor}>{item.profiles?.username}</Text>
              )}
              <Text style={[
                styles.msgText,
                item.user_id === currentUserId && { color: colors.background },
              ]}>
                {item.content}
              </Text>
            </View>
          )}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.msgInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendGroupMessage}>
            <Ionicons name="send" size={20} color={colors.background} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.createBtnText}>Create Group</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.groupCard} onPress={() => openGroup(item)}>
            <View style={styles.groupAvatar}>
              <Ionicons name="people" size={24} color={colors.primary} />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupMembers}>
                {item.group_members?.length || 0} members
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No groups yet</Text>
          </View>
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Group</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group name"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <TouchableOpacity style={styles.submitBtn} onPress={createGroup}>
              <Text style={styles.submitText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 40 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryDim,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  createBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  groupCard: {
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
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  groupMembers: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: 16, color: colors.textMuted },
  // Chat
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  messageList: { padding: spacing.lg },
  msgBubble: {
    maxWidth: '80%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  myMsg: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMsg: {
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  msgAuthor: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 2 },
  msgText: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  msgInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
