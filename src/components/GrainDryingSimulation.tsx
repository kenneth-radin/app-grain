import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

const AnimatedView = Animated.createAnimatedComponent(View);

interface GrainDryingProps {
  moisture: number;
  temperature: number;
  isRunning: boolean;
  targetMoisture?: number;
}

const COLS = 8;
const ROWS = 5;

const CONTAINER_WIDTH = 280;
const CONTAINER_HEIGHT = 160;

function getGrainColor(moisture: number): string {
  if (moisture > 30) return '#F97316';
  if (moisture >= 14) return '#EAB308';
  return '#FEF9C3';
}

function getProgressPercent(moisture: number, target: number): number {
  const maxMoisture = 100;
  if (moisture <= target) return 100;
  return Math.max(0, Math.round(((maxMoisture - moisture) / (maxMoisture - target)) * 100));
}

interface GrainParticle {
  id: number;
  cx: number;
  cy: number;
  rotation: number;
}

function generateGrains(): GrainParticle[] {
  const grains: GrainParticle[] = [];
  const spacingX = CONTAINER_WIDTH / (COLS + 1);
  const spacingY = CONTAINER_HEIGHT / (ROWS + 1);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const id = row * COLS + col;
      grains.push({
        id,
        cx: spacingX * (col + 1) + (Math.random() - 0.5) * 8,
        cy: spacingY * (row + 1) + (Math.random() - 0.5) * 6,
        rotation: Math.round((Math.random() - 0.5) * 30),
      });
    }
  }
  return grains;
}

export default function GrainDryingSimulation({
  moisture,
  temperature,
  isRunning,
  targetMoisture = 14,
}: GrainDryingProps) {
  const isFocused = useIsFocused();
  const grains = useMemo(() => generateGrains(), []);
  const grainColor = getGrainColor(moisture);
  const progress = getProgressPercent(moisture, targetMoisture);

  const steamOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isFocused) {
      // Freeze animation when screen is not visible
      cancelAnimation(steamOpacity);
      steamOpacity.value = withTiming(0, { duration: 0 });
      return;
    }

    if (isRunning && moisture > targetMoisture) {
      steamOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1
      );
    } else {
      steamOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isFocused, isRunning, moisture, targetMoisture]);

  const steamStyle = useAnimatedStyle(() => ({
    opacity: steamOpacity.value,
  }));

  const statusText =
    moisture <= targetMoisture
      ? 'Drying Complete'
      : moisture > 30
      ? 'Drying in Progress...'
      : 'Nearly Done';

  const moistureLabel =
    moisture > 30 ? 'HIGH' : moisture >= 14 ? 'MEDIUM' : 'DRY';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Grain Drying Simulation</Text>
        <View style={[
          styles.moistureBadge,
          moisture > 30 ? styles.badgeHigh : moisture >= 14 ? styles.badgeMedium : styles.badgeLow,
        ]}>
          <Text style={[
            styles.moistureBadgeText,
            moisture > 30 ? styles.badgeTextHigh : moisture >= 14 ? styles.badgeTextMedium : styles.badgeTextLow,
          ]}>
            {moisture.toFixed(1)}% — {moistureLabel}
          </Text>
        </View>
      </View>

      <View style={styles.grainArea}>
        <Svg width={CONTAINER_WIDTH} height={CONTAINER_HEIGHT} viewBox={`0 0 ${CONTAINER_WIDTH} ${CONTAINER_HEIGHT}`}>
          {grains.map((grain) => (
            <G
              key={grain.id}
              rotation={grain.rotation}
              origin={`${grain.cx}, ${grain.cy}`}
            >
              <Ellipse
                cx={grain.cx}
                cy={grain.cy}
                rx={6}
                ry={3}
                fill={grainColor}
                opacity={0.85}
              />
            </G>
          ))}
        </Svg>

        {isRunning && moisture > targetMoisture && (
          <AnimatedView style={[styles.steamOverlay, steamStyle]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.steamParticle,
                  {
                    left: 30 + i * 55,
                    top: 8 + (i % 2) * 12,
                  },
                ]}
              >
                <Svg width={20} height={24}>
                  <Ellipse cx={10} cy={12} rx={8} ry={10} fill="rgba(255,255,255,0.45)" />
                </Svg>
              </View>
            ))}
          </AnimatedView>
        )}
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Temperature</Text>
          <Text style={styles.infoValue}>{temperature.toFixed(1)}°C</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Target</Text>
          <Text style={styles.infoValue}>{targetMoisture}%</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={[styles.infoValue, { color: isRunning ? '#22C55E' : '#6B7280' }]}>
            {isRunning ? 'ON' : 'OFF'}
          </Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: progress >= 100 ? '#22C55E' : progress > 50 ? '#3B82F6' : '#F97316',
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>{statusText}</Text>
          <Text style={styles.progressPercent}>{progress}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  moistureBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeHigh: {
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  badgeMedium: {
    backgroundColor: 'rgba(234,179,8,0.15)',
  },
  badgeLow: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  moistureBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextHigh: {
    color: '#F97316',
  },
  badgeTextMedium: {
    color: '#B45309',
  },
  badgeTextLow: {
    color: '#22C55E',
  },
  grainArea: {
    position: 'relative',
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 12,
  },
  steamOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  steamParticle: {
    position: 'absolute',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    marginTop: 2,
  },
  progressSection: {
    gap: 6,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
});
