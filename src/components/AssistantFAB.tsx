import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAssistant } from '@/context/AssistantContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function AssistantFAB() {
  const { isOpen, open } = useAssistant();
  const glow = useSharedValue(1);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glow.value }],
    shadowOpacity: (glow.value - 1) * 5 + 0.3,
  }));

  if (isOpen) return null;

  return (
    <AnimatedTouchable
      style={[styles.fab, animStyle]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); open(); }}
      activeOpacity={0.85}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 900,
  },
});
