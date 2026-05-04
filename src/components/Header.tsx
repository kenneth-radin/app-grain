import React from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLogout } from '@/hooks';
import { IOS_TYPOGRAPHY } from '@/utils/constants';
import { Routes } from '@/types/navigation';

interface HeaderProps {
  showBack?: boolean;
  onBack?: () => void;
}

export default function Header({ showBack, onBack }: HeaderProps) {
  const handleLogout = useLogout();
  const router = useRouter();

  const confirmLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await handleLogout();
            router.replace('/(auth)/login');
          } catch (err) {
            console.error('Logout error:', err);
          }
        },
      },
    ]);
  };

  const handleLogoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(Routes.Dashboard);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {showBack ? (
          <TouchableOpacity onPress={onBack || (() => router.back())} style={styles.leftSection} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#22C55E" />
            <Text style={styles.title}>Back</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleLogoPress} style={styles.leftSection} activeOpacity={0.7}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Grain Dryer System</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={confirmLogout}
          style={styles.logoutButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="log-out-outline" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  title: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: '#111111',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
  },
});
