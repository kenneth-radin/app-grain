import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Header, StatusBadge } from '@/components';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { DeviceStatus } from '@/utils/enums';
import { grainApi } from '@/api';
import type { AdminDevice, AdminUser } from '@/api/grain-api-client';

export default function AdminDevicesScreen() {
  const [data, setData] = useState<AdminDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<AdminDevice | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transferring, setTransferring] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, usersRes] = await Promise.all([
        grainApi.admin.listDevices(1, 50),
        grainApi.admin.listUsers(1, 50),
      ]);
      setData(devicesRes.data);
      setUsers(usersRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const openReassign = (device: AdminDevice) => {
    setSelectedDevice(device);
    setModalVisible(true);
  };

  const transferOwner = async (ownerId: string) => {
    if (!selectedDevice) return;
    setTransferring(true);
    try {
      await grainApi.admin.transferDeviceOwner(selectedDevice.deviceId, ownerId);
      setModalVisible(false);
      setSelectedDevice(null);
      Alert.alert('Success', 'Device ownership transferred');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const renderItem = ({ item }: { item: AdminDevice }) => (
    <TouchableOpacity style={styles.row} onPress={() => openReassign(item)} activeOpacity={0.7}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name || 'Unnamed device'}</Text>
        <Text style={styles.sub}>{item.deviceId}</Text>
        <Text style={styles.owner}>
          {item.owner ? `${item.owner.name} (${item.owner.email})` : 'Unassigned'}
        </Text>
      </View>
      <StatusBadge status={item.status === 'online' ? DeviceStatus.Online : DeviceStatus.Offline} size="sm" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header showBack />
      <View style={styles.screenTitleWrap}>
        <Text style={styles.screenTitle}>Devices</Text>
      </View>
      <View style={styles.listWrap}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.deviceId}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No devices</Text>
                <Text style={styles.emptySubtext}>Devices will appear here once registered.</Text>
              </View>
            }
          />
        )}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reassign owner</Text>
            <Text style={styles.modalSubtitle}>{selectedDevice?.name || selectedDevice?.deviceId}</Text>
            {transferring ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <FlatList
                data={users}
                keyExtractor={(u) => u._id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.userRow} onPress={() => transferOwner(item._id)} activeOpacity={0.7}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                    <Text style={styles.userRole}>{item.role}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptySubtext}>No users found</Text>}
              />
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenTitleWrap: { paddingHorizontal: 16, paddingTop: 8 },
  screenTitle: { ...IOS_TYPOGRAPHY.title1, color: COLORS.textPrimary },
  listWrap: { flex: 1 },
  spinner: { marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  info: { flex: 1, marginRight: 12, gap: 2 },
  name: { ...IOS_TYPOGRAPHY.headline, color: COLORS.textPrimary },
  sub: { ...IOS_TYPOGRAPHY.footnote, color: COLORS.textSecondary },
  owner: { ...IOS_TYPOGRAPHY.callout, color: COLORS.textSecondary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { ...IOS_TYPOGRAPHY.title3, fontWeight: '700', color: '#374151' },
  emptySubtext: { ...IOS_TYPOGRAPHY.footnote, color: COLORS.textSecondary, textAlign: 'center' },
  errorContainer: { padding: 16, alignItems: 'center', gap: 8 },
  errorText: { ...IOS_TYPOGRAPHY.body, color: COLORS.danger, textAlign: 'center' },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 50 },
  retryText: { color: '#FFFFFF', ...IOS_TYPOGRAPHY.headline },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '70%' },
  modalTitle: { ...IOS_TYPOGRAPHY.title2, color: COLORS.textPrimary, marginBottom: 4 },
  modalSubtitle: { ...IOS_TYPOGRAPHY.footnote, color: COLORS.textSecondary, marginBottom: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  userInfo: { flex: 1, gap: 2 },
  userName: { ...IOS_TYPOGRAPHY.body, color: COLORS.textPrimary },
  userEmail: { ...IOS_TYPOGRAPHY.footnote, color: COLORS.textSecondary },
  userRole: { ...IOS_TYPOGRAPHY.caption1, color: COLORS.textSecondary, textTransform: 'uppercase' },
  cancelButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { ...IOS_TYPOGRAPHY.body, color: COLORS.primary },
});