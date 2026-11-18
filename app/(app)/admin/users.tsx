import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Header } from '@/components';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { grainApi } from '@/api';
import type { AdminUser } from '@/api/grain-api-client';

export default function AdminUsersScreen() {
  const [data, setData] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await grainApi.admin.listUsers(1, 50);
      setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
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

  const renderItem = ({ item }: { item: AdminUser }) => (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.role, item.role === 'admin' ? styles.roleAdmin : styles.roleFarmer]}>
          {item.role}
        </Text>
        <Text style={styles.verified}>{item.emailVerified ? 'Verified' : 'Unverified'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header showBack />
      <View style={styles.screenTitleWrap}>
        <Text style={styles.screenTitle}>Users</Text>
      </View>
      <View style={styles.listWrap}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No users</Text>
                <Text style={styles.emptySubtext}>No accounts found.</Text>
              </View>
            }
          />
        )}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
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
  email: { ...IOS_TYPOGRAPHY.footnote, color: COLORS.textSecondary },
  right: { alignItems: 'flex-end', gap: 6 },
  verified: { ...IOS_TYPOGRAPHY.caption2, color: COLORS.textSecondary },
  role: { ...IOS_TYPOGRAPHY.caption1, fontWeight: '600', textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  roleAdmin: { color: '#16A34A', backgroundColor: '#DCFCE7' },
  roleFarmer: { color: '#6B7280', backgroundColor: '#F3F4F6' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { ...IOS_TYPOGRAPHY.title3, fontWeight: '700', color: '#374151' },
  emptySubtext: { ...IOS_TYPOGRAPHY.footnote, color: COLORS.textSecondary, textAlign: 'center' },
  errorContainer: { padding: 16, alignItems: 'center' },
  errorText: { ...IOS_TYPOGRAPHY.body, color: COLORS.danger, textAlign: 'center' },
});