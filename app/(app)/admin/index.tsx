import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

export default function AdminIndex() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Header showBack />
      <View style={styles.body}>
        <Text style={styles.screenTitle}>Admin Console</Text>
        <Card title="Devices" value="" unit="" onPress={() => router.push('/(app)/admin/devices' as any)} />
        <Card title="Users" value="" unit="" onPress={() => router.push('/(app)/admin/users' as any)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: 16, gap: 12 },
  screenTitle: { ...IOS_TYPOGRAPHY.title1, color: COLORS.textPrimary, marginBottom: 4 },
});
