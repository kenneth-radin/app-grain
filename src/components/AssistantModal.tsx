import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAssistant } from '@/context/AssistantContext';
import { grainApi } from '@/api';
import { COLORS } from '@/utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Language = 'en' | 'fil';

interface Message {
  id: string;
  role: 'user' | 'bot' | 'typing';
  text: string;
  timestamp: Date;
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Quick prompts by language ────────────────────────────────────────────────

const QUICK: { en: string; fil: string }[] = [
  { en: 'What\'s the current status?', fil: 'Ano ang current status?' },
  { en: 'How does Auto mode work?', fil: 'Paano gumagana ang Auto mode?' },
  { en: 'Why is 14% the target?', fil: 'Bakit 14% ang target?' },
  { en: 'Diagnose my current readings', fil: 'I-diagnose ang current readings ko' },
];

// ─── Fallback KB (used when API unreachable) 

const FALLBACK: { keywords: string[]; en: string; fil: string }[] = [
  {
    keywords: ['auto', 'automatic', 'awtomatiko'],
    en: 'Auto mode runs the AI control loop every 60s. It adjusts temperature and fan speed automatically using actions: MAINTAIN, REDUCE_TEMP, INCREASE_TEMP, INCREASE_FAN, or STOP when 14% moisture is reached.',
    fil: 'Sa Auto mode, ang AI ay nag-a-adjust ng temperature at fan speed every 60 segundo: MAINTAIN, REDUCE_TEMP, INCREASE_TEMP, INCREASE_FAN, o STOP kapag naabot na ang 14%.',
  },
  {
    keywords: ['14', 'target', 'moisture', 'safe storage', 'ligtas'],
    en: '14% is the Philippine standard for safe rice storage. Above 14% risks mold and spoilage. Below 12% causes grain cracking.',
    fil: 'Ang 14% ang Philippine standard para sa ligtas na imbakan. Kung mataas pa, may panganib na amag. Kung mababa sa 12%, mag-crack ang butil.',
  },
  {
    keywords: ['sensor', 'temperature', 'humidity', 'moisture sensor'],
    en: 'Sensors: DHT22 (temp + humidity), Capacitive sensor (grain moisture %), Load cell + HX711 (weight kg), INA219 (energy kWh), Solar voltage monitor. All connected to ESP32.',
    fil: 'Mga sensor: DHT22 (temp + humidity), Capacitive sensor (grain moisture %), Load cell + HX711 (timbang kg), INA219 (enerhiya kWh), Solar voltage. Lahat nakakonekta sa ESP32.',
  },
  {
    keywords: ['session', 'start', 'simula', 'how to'],
    en: 'Start a session: Sessions tab → "Start Session" → select device → choose grain type → set target moisture (14%) → tap Start. Auto-completes when moisture target is reached.',
    fil: 'Mag-start ng session: Sessions tab → "Start Session" → piliin ang device → uri ng butil → target moisture (14%) → i-tap ang Start. Awtomatikong natatapos kapag naabot ang target.',
  },
];

function fallbackReply(input: string, lang: Language): string {
  const q = input.toLowerCase();
  for (const item of FALLBACK) {
    if (item.keywords.some(k => q.includes(k))) {
      return lang === 'en' ? item.en : item.fil;
    }
  }
  return lang === 'en'
    ? 'The AI service is temporarily unavailable. Try asking about: Auto mode, target moisture, sensors, or how to start a session.'
    : 'Hindi maabot ang AI service ngayon. Subukan magtanong tungkol sa: Auto mode, target moisture, sensors, o paano mag-start ng session.';
}

// ─── Fetch live sensor data from Firebase ─────────────────────────────────────

async function fetchLiveDeviceId(): Promise<string | null> {
  try {
    const devices = await grainApi.devices.list();
    return devices?.[0]?.deviceId ?? null;
  } catch {
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_KEY = '@grain_chat_lang';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://grain-web-admin.onrender.com/api';

// ─── Component ────────────────────────────────────────────────────────────────

export function AssistantModal() {
  const { isOpen, close } = useAssistant();
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState<Language>('en');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: 'Hello! I\'m the grAIn Assistant 👋\n\nI know everything about your dryer system — hardware, AI, sensors, drying science. Ask me anything in English or Filipino!\n\n(Magtanong ka sa English o Filipino!)',
      timestamp: new Date(),
    },
  ]);
  // Conversation history sent to Claude (role: user/assistant only)
  const apiHistory = useRef<ApiMessage[]>([]);
  const listRef = useRef<FlatList<Message>>(null);
  const [kbHeight, setKbHeight] = useState(0);

  // Restore language + fetch device ID when modal opens
  useEffect(() => {
    if (!isOpen) return;
    AsyncStorage.getItem(LANG_KEY).then(v => { if (v === 'en' || v === 'fil') setLang(v as Language); });
    fetchLiveDeviceId().then(id => setDeviceId(id));
  }, [isOpen]);

  // Keyboard tracking for transparent modal
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: { endCoordinates: { height: number } }) => setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const switchLang = (l: Language) => {
    setLang(l);
    AsyncStorage.setItem(LANG_KEY, l);
    Haptics.selectionAsync();
  };

  const scrollBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text: t, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
    setIsTyping(true);
    scrollBottom();

    // Add to API history
    apiHistory.current.push({ role: 'user', content: t });
    // Keep last 12 messages to stay within token limits
    if (apiHistory.current.length > 12) {
      apiHistory.current = apiHistory.current.slice(-12);
    }

    try {
      const token = await SecureStore.getItemAsync('grain_token');
      const response = await fetch(`${API_BASE}/v1/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: apiHistory.current,
          language: lang === 'en' ? 'EN' : 'FIL',
          deviceId,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const reply: string = data.data?.reply ?? data.reply ?? fallbackReply(t, lang);

      // Add assistant reply to history
      apiHistory.current.push({ role: 'assistant', content: reply });

      const botMsg: Message = { id: `b${Date.now()}`, role: 'bot', text: reply, timestamp: new Date() };
      setIsTyping(false);
      setMessages(p => [...p, botMsg]);
    } catch {
      // Fallback to local KB if API unreachable
      const reply = fallbackReply(t, lang);
      apiHistory.current.push({ role: 'assistant', content: reply });
      const botMsg: Message = { id: `b${Date.now()}`, role: 'bot', text: reply, timestamp: new Date() };
      setIsTyping(false);
      setMessages(p => [...p, botMsg]);
    }

    scrollBottom();
  }, [lang, deviceId, scrollBottom]);

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const allData: Message[] = [
    ...messages,
    ...(isTyping ? [{ id: '__t__', role: 'typing' as const, text: '', timestamp: new Date() }] : []),
  ];

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />

      <View style={[styles.sheet, { paddingBottom: kbHeight > 0 ? 0 : insets.bottom }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>grAIn Assistant</Text>
              <Text style={styles.headerSub}>
                {deviceId ? `📡 ${deviceId}` : 'AI-powered help'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                onPress={() => switchLang('en')}
              >
                <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'fil' && styles.langBtnActive]}
                onPress={() => switchLang('fil')}
              >
                <Text style={[styles.langText, lang === 'fil' && styles.langTextActive]}>FIL</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages + input pushed by keyboard */}
        <View style={[styles.body, { paddingBottom: kbHeight }]}>
          <FlatList
            ref={listRef}
            data={allData}
            keyExtractor={i => i.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => {
              if (item.role === 'typing') {
                return (
                  <View style={[styles.row, styles.rowBot]}>
                    <View style={styles.avatarSm}><Ionicons name="sparkles" size={10} color="#fff" /></View>
                    <View style={[styles.bubble, styles.bubbleBot, { flexDirection: 'row', gap: 8, paddingVertical: 12 }]}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.typingText}>{lang === 'en' ? 'Thinking...' : 'Nag-iisip...'}</Text>
                    </View>
                  </View>
                );
              }
              const isUser = item.role === 'user';
              return (
                <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
                  {!isUser && <View style={styles.avatarSm}><Ionicons name="sparkles" size={10} color="#fff" /></View>}
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                    <Text style={[styles.bubbleText, isUser ? styles.textUser : styles.textBot]}>{item.text}</Text>
                    <Text style={[styles.timeText, isUser ? styles.timeUser : styles.timeBot]}>{fmt(item.timestamp)}</Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Quick prompts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
            keyboardShouldPersistTaps="handled"
          >
            {QUICK.map((q, i) => (
              <TouchableOpacity key={i} style={styles.chip} onPress={() => send(lang === 'en' ? q.en : q.fil)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{lang === 'en' ? q.en : q.fil}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={lang === 'en' ? 'Ask anything about your dryer...' : 'Magtanong tungkol sa dryer...'}
              placeholderTextColor="#9CA3AF"
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
              enablesReturnKeyAutomatically
              onSubmitEditing={() => send(input)}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnOff]}
              onPress={() => send(input)}
              disabled={!input.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.87,
    backgroundColor: '#F0FDF4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  headerSub: { fontSize: 11, color: '#6B7280' },
  langToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 2 },
  langBtn: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12 },
  langBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  langText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  langTextActive: { color: COLORS.primary },
  closeBtn: { padding: 4, borderRadius: 8, backgroundColor: '#F3F4F6' },
  body: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  avatarSm: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2, flexShrink: 0,
  },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleBot: {
    backgroundColor: '#fff', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  textUser: { color: '#fff' },
  textBot: { color: '#111' },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeUser: { color: 'rgba(255,255,255,0.65)' },
  timeBot: { color: '#9CA3AF' },
  typingText: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },
  chips: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 7, gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 13, paddingVertical: 7,
    borderWidth: 1, borderColor: '#D1FAE5',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#111',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 3,
    flexShrink: 0,
  },
  sendBtnOff: { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0 },
});
