import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context/AppContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_CONFIG: Record<string, { bg: string; text: string; icon: IoniconName; duration: number }> = {
  success: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle', duration: 2500 },
  error: { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle', duration: 5000 },
  info: { bg: '#DBEAFE', text: '#2563EB', icon: 'information-circle', duration: 3000 },
  warning: { bg: '#FEF3C7', text: '#D97706', icon: 'warning', duration: 4000 },
};

export default function Toast() {
  const { toast, hideToast } = useAppContext();
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
  const autoDismiss = config.duration;

  useEffect(() => {
    if (toast.visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => hideToast());
      }, autoDismiss);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
    }
  }, [toast.visible]);

  if (!toast.visible) return null;

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Animated.View style={[styles.container, { backgroundColor: config.bg, opacity }]}>
        <Ionicons name={config.icon} size={18} color={config.text} />
        <Text style={[styles.message, { color: config.text }]}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
