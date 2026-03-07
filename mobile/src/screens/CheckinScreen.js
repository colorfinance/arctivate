import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme';

export default function CheckinScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState([]);

  useEffect(() => {
    loadCheckins();
  }, []);

  async function loadCheckins() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('check_ins')
      .select('*, partners(name)')
      .eq('user_id', user.id)
      .order('checked_in_at', { ascending: false })
      .limit(10);

    if (data) setRecentCheckins(data);
  }

  async function handleBarCodeScanned({ data: qrData }) {
    if (!qrData) return;
    setScanning(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Look up partner by QR UUID
    const { data: partner } = await supabase
      .from('partners')
      .select('*')
      .eq('qr_uuid', qrData)
      .single();

    if (!partner) {
      // Try rewards ledger
      const { data: reward } = await supabase
        .from('rewards_ledger')
        .select('*')
        .eq('code', qrData)
        .eq('is_used', false)
        .single();

      if (reward) {
        await supabase.from('rewards_ledger').update({
          is_used: true,
          used_by: user.id,
          used_at: new Date().toISOString(),
        }).eq('id', reward.id);

        await supabase.rpc('increment_points', {
          user_id: user.id,
          amount: reward.points_value || 0,
        });

        Alert.alert('Reward Claimed!', `+${reward.points_value} points`);
      } else {
        Alert.alert('Invalid Code', 'This QR code is not recognized.');
      }
      return;
    }

    // Check in at partner
    const { error } = await supabase.from('check_ins').insert({
      user_id: user.id,
      partner_id: partner.id,
      awarded_points: 150,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.rpc('increment_points', { user_id: user.id, amount: 150 });
    Alert.alert('Checked In!', `${partner.name} - +150 points`);
    loadCheckins();
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Camera Permission Needed</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan QR codes at partner locations
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {scanning ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>Point at QR code</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setScanning(false)}
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setScanning(true)}>
            <Ionicons name="qr-code" size={48} color={colors.background} />
            <Text style={styles.scanBtnTitle}>Scan QR Code</Text>
            <Text style={styles.scanBtnSubtitle}>Earn +150 points per check-in</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Recent Check-ins</Text>
          {recentCheckins.map((ci) => (
            <View key={ci.id} style={styles.checkinCard}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <View style={styles.checkinInfo}>
                <Text style={styles.checkinName}>{ci.partners?.name || 'Partner'}</Text>
                <Text style={styles.checkinTime}>
                  {new Date(ci.checked_in_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.checkinPoints}>+{ci.awarded_points}</Text>
            </View>
          ))}

          {recentCheckins.length === 0 && (
            <Text style={styles.noCheckins}>No check-ins yet</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  permissionText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  grantBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  grantBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  scanText: { color: colors.textPrimary, fontSize: 16, marginTop: spacing.lg, fontWeight: '600' },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, padding: spacing.lg },
  scanBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  scanBtnTitle: { color: colors.background, fontSize: 20, fontWeight: '700' },
  scanBtnSubtitle: { color: 'rgba(3,8,8,0.7)', fontSize: 14 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  checkinCard: {
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
  checkinInfo: { flex: 1 },
  checkinName: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  checkinTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  checkinPoints: { color: colors.primary, fontWeight: '700', fontFamily: 'monospace' },
  noCheckins: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
