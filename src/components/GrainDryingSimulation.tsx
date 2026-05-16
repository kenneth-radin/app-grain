import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type BinaryState = 'ON' | 'OFF';
type StepperState = 'ON' | 'OFF' | 'CW' | 'CCW';

interface GrainDryingProps {
  moisture: number;
  temperature: number;
  humidity?: number;
  fanSpeed?: number;
  isRunning: boolean;
  fan1State?: BinaryState;
  fan2State?: BinaryState;
  heaterState?: BinaryState;
  stepperState?: StepperState;
  relayState?: BinaryState;
  targetMoisture?: number;
}

interface GrainParticle {
  id: number;
  x: number;
  y: number;
  drift: number;
  radius: number;
  delay: number;
}

const PANEL_HEIGHT = 280;
const CHAMBER = { x: 82, y: 42, width: 156, height: 124 };
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getMoistureColor(moisture: number, target: number) {
  if (moisture <= target) return COLORS.success;
  if (moisture <= 22) return '#F59E0B';
  return COLORS.info;
}

function getTemperatureColor(temperature: number) {
  if (temperature < 40) return COLORS.info;
  if (temperature <= 55) return COLORS.success;
  return COLORS.danger;
}

function getDrynessPercent(moisture: number, target: number) {
  if (moisture <= target) return 100;
  return Math.round(clamp(((35 - moisture) / (35 - target)) * 100, 0, 100));
}

function makeParticles(): GrainParticle[] {
  return Array.from({ length: 26 }, (_, id) => ({
    id,
    x: CHAMBER.x + 14 + ((id * 29) % (CHAMBER.width - 28)),
    y: CHAMBER.y + 8 + ((id * 17) % (CHAMBER.height - 20)),
    drift: ((id % 5) - 2) * 2.8,
    radius: 1.8 + (id % 3) * 0.45,
    delay: (id % 7) / 7,
  }));
}

function GrainParticleDot({
  particle,
  active,
  fanSpeed,
  color,
}: {
  particle: GrainParticle;
  active: boolean;
  fanSpeed: number;
  color: string;
}) {
  const progress = useSharedValue(particle.delay);

  useEffect(() => {
    cancelAnimation(progress);
    if (!active) {
      progress.value = withTiming(particle.delay, { duration: 350 });
      return;
    }

    const duration = 2600 - clamp(fanSpeed, 0, 100) * 17;
    progress.value = withRepeat(withTiming(1, { duration }), -1, false);
  }, [active, fanSpeed, particle.delay, progress]);

  const animatedProps = useAnimatedProps(() => {
    const travel = (progress.value + particle.delay) % 1;
    const cy = CHAMBER.y + 6 + travel * (CHAMBER.height - 12);
    const cx = particle.x + Math.sin(travel * Math.PI * 2) * particle.drift;

    return {
      cx,
      cy,
      opacity: active ? interpolate(travel, [0, 0.2, 0.82, 1], [0, 0.95, 0.95, 0]) : 0.42,
    };
  });

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      r={particle.radius}
      fill={color}
    />
  );
}

function FanRotor({
  x,
  y,
  active,
  fanSpeed,
}: {
  x: number;
  y: number;
  active: boolean;
  fanSpeed: number;
}) {
  const spin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(spin);
    if (!active || fanSpeed <= 0) {
      spin.value = withTiming(0, { duration: 250 });
      return;
    }

    const duration = 1000 - clamp(fanSpeed, 0, 100) * 7.4;
    spin.value = withRepeat(withTiming(360, { duration }), -1, false);
  }, [active, fanSpeed, spin]);

  const rotorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={[styles.fan, { left: x - 25, top: y - 25 }]}>
      <Svg width={50} height={50} viewBox="0 0 50 50">
        <Circle cx={25} cy={25} r={23} fill="#111827" stroke={active ? COLORS.success : '#4B5563'} strokeWidth={2} />
      </Svg>
      <AnimatedView style={[styles.rotor, rotorStyle]}>
        <Svg width={44} height={44} viewBox="0 0 44 44">
          <G origin="22,22">
            <Path d="M22 20 C29 6 39 9 35 18 C32 24 26 24 22 22 Z" fill={active ? '#9CA3AF' : '#4B5563'} />
            <Path d="M24 22 C38 29 35 39 26 35 C20 32 20 26 22 22 Z" fill={active ? '#D1D5DB' : '#4B5563'} />
            <Path d="M22 24 C15 38 5 35 9 26 C12 20 18 20 22 22 Z" fill={active ? '#9CA3AF' : '#4B5563'} />
            <Path d="M20 22 C6 15 9 5 18 9 C24 12 24 18 22 22 Z" fill={active ? '#D1D5DB' : '#4B5563'} />
            <Circle cx={22} cy={22} r={5} fill={active ? COLORS.success : '#6B7280'} />
          </G>
        </Svg>
      </AnimatedView>
    </View>
  );
}

function HeatWave({ left, delay, active, intensity }: { left: number; delay: number; active: boolean; intensity: number }) {
  const wave = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(wave);
    if (!active) {
      wave.value = withTiming(0, { duration: 250 });
      return;
    }

    wave.value = delay;
    wave.value = withRepeat(withTiming(1, { duration: 1450 - intensity * 650 }), -1, false);
  }, [active, delay, intensity, wave]);

  const waveStyle = useAnimatedStyle(() => ({
    opacity: active ? interpolate(wave.value, [0, 0.35, 1], [0.12, 0.88, 0]) : 0,
    transform: [{ translateY: interpolate(wave.value, [0, 1], [16, -16]) }],
  }));

  return (
    <AnimatedView style={[styles.heatWave, { left }, waveStyle]}>
      <Svg width={18} height={42} viewBox="0 0 18 42">
        <Path
          d="M9 40 C1 31 17 25 9 17 C1 9 15 6 9 1"
          fill="none"
          stroke={COLORS.orange}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </AnimatedView>
  );
}

function ConveyorArrow({
  index,
  active,
  direction,
}: {
  index: number;
  active: boolean;
  direction: 'CW' | 'CCW';
}) {
  const flow = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(flow);
    if (!active) {
      flow.value = withTiming(0, { duration: 250 });
      return;
    }

    flow.value = withRepeat(withTiming(1, { duration: 1050 }), -1, false);
  }, [active, flow]);

  const arrowStyle = useAnimatedStyle(() => {
    const offset = direction === 'CCW'
      ? interpolate(flow.value, [0, 1], [18, -18])
      : interpolate(flow.value, [0, 1], [-18, 18]);
    return {
      opacity: active ? 0.9 : 0.25,
      transform: [{ translateX: offset }, { rotate: direction === 'CCW' ? '180deg' : '0deg' }],
    };
  });

  return (
    <AnimatedView style={[styles.conveyorArrow, { left: 96 + index * 42 }, arrowStyle]}>
      <Svg width={28} height={14} viewBox="0 0 28 14">
        <Path d="M1 7 H20" stroke={COLORS.success} strokeWidth={3} strokeLinecap="round" />
        <Polygon points="19,1 27,7 19,13" fill={COLORS.success} />
      </Svg>
    </AnimatedView>
  );
}

function StatusLed({ label, active }: { label: string; active: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);
    if (!active) {
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1
    );
  }, [active, pulse]);

  const ledStyle = useAnimatedStyle(() => ({
    opacity: active ? interpolate(pulse.value, [0, 1], [0.62, 1]) : 1,
    transform: [{ scale: active ? interpolate(pulse.value, [0, 1], [1, 1.28]) : 1 }],
  }));

  return (
    <View style={styles.ledItem}>
      <AnimatedView style={[styles.ledDot, { backgroundColor: active ? COLORS.success : '#4B5563' }, ledStyle]} />
      <Text style={styles.ledLabel}>{label}</Text>
    </View>
  );
}

export default function GrainDryingSimulation({
  moisture,
  temperature,
  humidity = 0,
  fanSpeed = 0,
  isRunning,
  fan1State,
  fan2State,
  heaterState,
  stepperState = 'OFF',
  relayState,
  targetMoisture = 14,
}: GrainDryingProps) {
  const isFocused = useIsFocused();
  const unitPulse = useSharedValue(1);
  const moistureColor = getMoistureColor(moisture, targetMoisture);
  const tempColor = getTemperatureColor(temperature);
  const drynessPercent = getDrynessPercent(moisture, targetMoisture);
  const particles = useMemo(() => makeParticles(), []);

  const fan1Active = fan1State ? fan1State === 'ON' : isRunning && fanSpeed > 0;
  const fan2Active = fan2State ? fan2State === 'ON' : isRunning && fanSpeed > 45;
  const heaterActive = heaterState ? heaterState === 'ON' : isRunning && temperature >= 40;
  const relayActive = relayState ? relayState === 'ON' : isRunning;
  const stepperActive = stepperState !== 'OFF';
  const stepperDirection = stepperState === 'CCW' ? 'CCW' : 'CW';
  const grainFlowActive = isFocused && isRunning && (fan1Active || fan2Active || fanSpeed > 0);
  const heatIntensity = clamp((temperature - 30) / 35, 0.25, 1);

  useEffect(() => {
    cancelAnimation(unitPulse);
    if (!isFocused) {
      unitPulse.value = withTiming(1, { duration: 150 });
      return;
    }

    if (!isRunning) {
      unitPulse.value = withRepeat(
        withSequence(withTiming(1.015, { duration: 1400 }), withTiming(1, { duration: 1400 })),
        -1
      );
      return;
    }

    unitPulse.value = withTiming(1, { duration: 250 });
  }, [isFocused, isRunning, unitPulse]);

  const unitStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unitPulse.value }],
  }));

  return (
    <AnimatedView style={[styles.container, unitStyle]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerKicker}>LIVE HMI</Text>
          <Text style={styles.headerTitle}>Dryer Process Panel</Text>
        </View>
        <View style={[styles.runBadge, isRunning ? styles.runBadgeOn : styles.runBadgeOff]}>
          <Text style={styles.runBadgeText}>{isRunning ? 'RUN' : 'IDLE'}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Svg width="100%" height={188} viewBox="0 0 320 188">
          <Defs>
            <LinearGradient id="grainFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={moistureColor} stopOpacity="0.72" />
              <Stop offset="0.52" stopColor="#F59E0B" stopOpacity="0.48" />
              <Stop offset="1" stopColor={COLORS.success} stopOpacity="0.55" />
            </LinearGradient>
            <LinearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#374151" />
              <Stop offset="1" stopColor="#111827" />
            </LinearGradient>
          </Defs>

          <Rect x={20} y={18} width={280} height={158} rx={12} fill="#0B1120" stroke="#334155" strokeWidth={2} />
          <Rect x={CHAMBER.x} y={CHAMBER.y} width={CHAMBER.width} height={CHAMBER.height} rx={8} fill="url(#grainFill)" stroke="#94A3B8" strokeWidth={2} opacity={0.92} />
          <Rect x={CHAMBER.x} y={CHAMBER.y} width={CHAMBER.width} height={CHAMBER.height} rx={8} fill="none" stroke="#E5E7EB" strokeOpacity={0.3} />
          <Line x1={CHAMBER.x + 12} y1={CHAMBER.y + 28} x2={CHAMBER.x + CHAMBER.width - 12} y2={CHAMBER.y + 28} stroke="#F8FAFC" strokeOpacity={0.15} />
          <Line x1={CHAMBER.x + 12} y1={CHAMBER.y + 66} x2={CHAMBER.x + CHAMBER.width - 12} y2={CHAMBER.y + 66} stroke="#F8FAFC" strokeOpacity={0.12} />
          <Line x1={CHAMBER.x + 12} y1={CHAMBER.y + 104} x2={CHAMBER.x + CHAMBER.width - 12} y2={CHAMBER.y + 104} stroke="#F8FAFC" strokeOpacity={0.12} />

          {particles.map((particle) => (
            <GrainParticleDot
              key={particle.id}
              particle={particle}
              active={grainFlowActive}
              fanSpeed={fanSpeed}
              color={moisture <= targetMoisture ? '#DCFCE7' : '#FEF3C7'}
            />
          ))}

          <Path d="M82 42 L108 16 H212 L238 42 Z" fill="url(#metal)" stroke="#64748B" strokeWidth={2} />
          <Path d="M82 166 L62 178 H258 L238 166 Z" fill="url(#metal)" stroke="#64748B" strokeWidth={2} />
          <Rect x={68} y={168} width={184} height={10} rx={5} fill="#1F2937" stroke="#64748B" />

          <Circle cx={48} cy={74} r={24} fill="#111827" stroke={fan1Active ? COLORS.success : '#4B5563'} strokeWidth={2} />
          <Path d="M72 74 H82" stroke={fan1Active ? COLORS.success : '#64748B'} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={272} cy={74} r={24} fill="#111827" stroke={fan2Active ? COLORS.success : '#4B5563'} strokeWidth={2} />
          <Path d="M238 74 H248" stroke={fan2Active ? COLORS.success : '#64748B'} strokeWidth={4} strokeLinecap="round" />

          <Circle cx={160} cy={154} r={19} fill="#111827" stroke={tempColor} strokeWidth={4} strokeOpacity={heaterActive ? 0.95 : 0.35} />
          <Path d="M148 154 H172 M151 146 H169 M151 162 H169" stroke={heaterActive ? COLORS.orange : '#6B7280'} strokeWidth={3} strokeLinecap="round" />
        </Svg>

        <FanRotor x={48} y={74} active={fan1Active && isFocused} fanSpeed={fanSpeed} />
        <FanRotor x={272} y={74} active={fan2Active && isFocused} fanSpeed={fanSpeed} />

        {[0, 1, 2].map((index) => (
          <HeatWave
            key={index}
            left={142 + index * 14}
            delay={index * 0.2}
            active={isFocused && heaterActive}
            intensity={heatIntensity}
          />
        ))}

        {[0, 1, 2, 3].map((index) => (
          <ConveyorArrow
            key={index}
            index={index}
            active={isFocused && stepperActive && relayActive}
            direction={stepperDirection}
          />
        ))}
      </View>

      <View style={styles.telemetryRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>TEMP</Text>
          <Text style={[styles.metricValue, { color: tempColor }]}>{temperature.toFixed(1)} C</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>HUM</Text>
          <Text style={styles.metricValue}>{humidity.toFixed(0)}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>MOIST</Text>
          <Text style={[styles.metricValue, { color: moistureColor }]}>{moisture.toFixed(1)}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>FAN</Text>
          <Text style={styles.metricValue}>{Math.round(fanSpeed)}%</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.drynessTrack}>
          <View style={[styles.drynessFill, { width: `${drynessPercent}%`, backgroundColor: moistureColor }]} />
        </View>
        <View style={styles.ledRow}>
          <StatusLed label="F1" active={fan1Active} />
          <StatusLed label="F2" active={fan2Active} />
          <StatusLed label="HTR" active={heaterActive} />
          <StatusLed label="AUG" active={relayActive} />
        </View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PANEL_HEIGHT,
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerKicker: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  runBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  runBadgeOn: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: COLORS.success,
  },
  runBadgeOff: {
    backgroundColor: 'rgba(107,114,128,0.18)',
    borderColor: COLORS.gray[500],
  },
  runBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  panel: {
    height: 188,
    position: 'relative',
  },
  fan: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotor: {
    position: 'absolute',
    width: 44,
    height: 44,
  },
  heatWave: {
    position: 'absolute',
    top: 116,
    width: 18,
    height: 42,
  },
  conveyorArrow: {
    position: 'absolute',
    top: 169,
    width: 28,
    height: 14,
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metric: {
    flex: 1,
    backgroundColor: '#0B1120',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#243244',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0,
  },
  metricValue: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  drynessTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#0B1120',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#243244',
    overflow: 'hidden',
  },
  drynessFill: {
    height: '100%',
    borderRadius: 4,
  },
  ledRow: {
    flexDirection: 'row',
    gap: 7,
  },
  ledItem: {
    alignItems: 'center',
    gap: 2,
    width: 25,
  },
  ledDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ledLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0,
  },
});
