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
import { useAssistant } from '@/context/AssistantContext';
import { COLORS } from '@/utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Language = 'en' | 'fil';

interface Message {
  id: string;
  role: 'user' | 'bot' | 'typing';
  text: string;
  timestamp: Date;
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

const KB: Array<{ keywords: string[]; answer: { en: string; fil: string } }> = [
  {
    keywords: ['what is grain', 'ano ang grain', 'system', 'tungkol', 'about', 'platform'],
    answer: {
      en: 'grAIn is an AI-assisted IoT solar-powered rice grain dryer monitoring system. It lets farmers monitor drying conditions in real time, control the dryer remotely, and get AI-powered predictions — all from your phone.',
      fil: 'Ang grAIn ay isang AI-assisted IoT solar-powered na sistema para sa pagmo-monitor ng grain dryer. Makita ang kondisyon sa real time, kontrolin ang dryer mula sa telepono, at makakuha ng AI predictions.',
    },
  },
  {
    keywords: ['target moisture', 'safe storage', 'ligtas', 'bakit 14', 'why 14', 'storage moisture'],
    answer: {
      en: 'The target moisture content for safe rice storage is 14% wet basis. Above 14%, grains are prone to mold and quality loss. The AI auto-stops the dryer when this level is reached.',
      fil: 'Ang target moisture content para sa ligtas na imbakan ng bigas ay 14% wet basis. Kapag higit sa 14%, ang butil ay madaling magkaroon ng amag. Awtomatikong pinapatay ng AI ang dryer kapag naabot na ito.',
    },
  },
  {
    keywords: ['auto mode', 'auto', 'automatic', 'awtomatiko', 'ai control', 'ai mode', 'what does auto'],
    answer: {
      en: 'In Auto mode, the AI checks sensors every 60s and adjusts automatically:\n• MAINTAIN — conditions optimal\n• REDUCE_TEMP — temp >65°C, drops 5°C\n• INCREASE_TEMP — temp <38°C, raises 5°C\n• INCREASE_FAN — humidity high, +15% fan\n• STOP — target moisture reached',
      fil: 'Sa Auto mode, tinitingnan ng AI ang mga sensor tuwing 60 segundo:\n• MAINTAIN — optimal ang kondisyon\n• REDUCE_TEMP — temp >65°C, bababa ng 5°C\n• INCREASE_TEMP — temp <38°C, tataas ng 5°C\n• INCREASE_FAN — mataas ang humidity, +15% fan\n• STOP — naabot ang target moisture',
    },
  },
  {
    keywords: ['manual mode', 'manual', 'mano-mano', 'manual control'],
    answer: {
      en: 'In Manual mode you control everything:\n• Temperature slider (35–70°C)\n• Fan speed slider (0–100%)\n• FAN1, FAN2, or ALL fans independently\n\nThe AI does NOT auto-adjust in Manual mode.',
      fil: 'Sa Manual mode, ikaw ang may kontrol:\n• Temperature slider (35–70°C)\n• Fan speed slider (0–100%)\n• FAN1, FAN2, o ALL fans nang hiwalay\n\nHindi awtomatikong inaayos ng AI sa Manual mode.',
    },
  },
  {
    keywords: ['ai prediction', 'prediction', 'predict', 'hula', 'forecast', 'random forest'],
    answer: {
      en: 'AI Predictions use a trained Random Forest model (R² = 0.91) to forecast:\n• Moisture in 30 minutes\n• Time to reach 14% target\n• Efficiency score (0–100)\n• Confidence (65–97%)\n• 6-hour projected moisture curve',
      fil: 'Ang AI Predictions ay gumagamit ng trained Random Forest model (R² = 0.91) para mahulaan ang:\n• Moisture pagkatapos ng 30 minuto\n• Oras para maabot ang 14% target\n• Efficiency score (0–100)\n• Confidence (65–97%)\n• 6-oras na projected curve',
    },
  },
  {
    keywords: ['sensor', 'sensors', 'temperature', 'humidity', 'moisture sensor', 'anong sensor', 'what sensors'],
    answer: {
      en: 'Sensors connected to ESP32:\n• DHT22 — temperature & humidity\n• Capacitive sensor — grain moisture %\n• Load cell + HX711 — grain weight (kg)\n• INA219 — energy (kWh)\n• Solar panel voltage\n\nData sent every 5–30 seconds.',
      fil: 'Mga sensor na konektado sa ESP32:\n• DHT22 — temperatura at humidity\n• Capacitive sensor — moisture % ng butil\n• Load cell + HX711 — timbang (kg)\n• INA219 — enerhiya (kWh)\n• Solar panel voltage\n\nData tuwing 5–30 segundo.',
    },
  },
  {
    keywords: ['solar', 'solar power', 'energy', 'enerhiya', 'solar panel', 'kuryente'],
    answer: {
      en: 'The dryer runs on solar panels. Higher solar voltage = better efficiency. The AI factors solar voltage into its recommendations.',
      fil: 'Ang dryer ay pinapagana ng solar panels. Mas mataas na solar voltage = mas magandang efficiency. Isinasaalang-alang ng AI ang solar voltage sa rekomendasyon.',
    },
  },
  {
    keywords: ['session', 'drying session', 'start session', 'start drying', 'paano magsimula', 'grain type'],
    answer: {
      en: 'Start a drying session:\n1. Sessions tab → "Start Session"\n2. Select device\n3. Choose grain type (rice/corn/wheat/soybean/coffee)\n4. Set target moisture (default 14%)\n5. Tap Start\n\nAuto-completes when moisture target is reached.',
      fil: 'Magsimula ng drying session:\n1. Sessions tab → "Start Session"\n2. Piliin ang device\n3. Piliin ang uri ng butil (bigas/mais/trigo/soybean/kape)\n4. Itakda ang target moisture (default 14%)\n5. I-tap ang Start\n\nAwtomatikong natatapos kapag naabot ang target.',
    },
  },
  {
    keywords: ['alert', 'alerto', 'warning', 'babala', 'critical', 'notification'],
    answer: {
      en: '3 alert types:\n• Critical (red) — act immediately (temp >65°C)\n• Warning (yellow) — not ideal conditions\n• Info (blue) — general updates\n\nPush notifications for critical alerts and session completion.',
      fil: '3 uri ng alerto:\n• Critical (pula) — kailangan ng agarang aksyon\n• Warning (dilaw) — hindi ideal\n• Info (asul) — pangkalahatang update\n\nPush notifications para sa critical at kapag tapos ang session.',
    },
  },
  {
    keywords: ['add device', 'magdagdag ng device', 'register device', 'device id', 'paano magdagdag'],
    answer: {
      en: 'Add a device:\n1. Dashboard → tap +\n2. Enter Device ID (e.g. GR-001)\n3. Enter location\n4. Tap Register\n\nShows Online when ESP32 sends data.',
      fil: 'Magdagdag ng device:\n1. Dashboard → i-tap ang +\n2. Ilagay ang Device ID (hal. GR-001)\n3. Ilagay ang lokasyon\n4. I-tap ang Register\n\nNagpapakita ng Online kapag nagpapadala ng data ang ESP32.',
    },
  },
  {
    keywords: ['offline', 'no internet', 'walang internet', 'queue'],
    answer: {
      en: 'grAIn works offline! Commands queue locally and send when reconnected. AI still provides local rule-based predictions without internet.',
      fil: 'Gumagana ang grAIn kahit offline! Ang mga utos ay naka-queue at ipinapadala kapag naibalik ang koneksyon. Ang AI ay nagbibigay pa rin ng lokal na predictions.',
    },
  },
  {
    keywords: ['analytics', 'history', 'kasaysayan', 'chart', 'report'],
    answer: {
      en: 'Analytics tab shows:\n• Moisture trend over time\n• Drying cycles history\n• Energy per session\n• Daily / weekly / monthly filters',
      fil: 'Ang Analytics tab ay nagpapakita ng:\n• Trend ng moisture\n• Kasaysayan ng drying cycles\n• Enerhiya bawat session\n• Araw-araw / linggu-linggu / buwanang filter',
    },
  },
  {
    keywords: ['fan', 'fan control', 'fan1', 'fan2', 'airflow'],
    answer: {
      en: 'Two fans available:\n• FAN1 — primary drying fan\n• FAN2 — exhaust fan\n• ALL — both together\n\nManual: ON/OFF from Control screen. Auto: AI manages speed.',
      fil: 'Dalawang fan:\n• FAN1 — pangunahing fan\n• FAN2 — exhaust fan\n• ALL — pareho nang sabay\n\nManual: ON/OFF sa Control screen. Auto: AI ang namamahala.',
    },
  },
  {
    keywords: ['efficiency', 'episyente', 'score'],
    answer: {
      en: 'Efficiency (0–100%) based on:\n• Temperature (ideal 40–60°C)\n• Fan speed (ideal 70–90%)\n• Humidity (lower = better)\n• Solar voltage (higher = better)\n\nScore >70% is good.',
      fil: 'Efficiency (0–100%) batay sa:\n• Temperatura (ideal 40–60°C)\n• Fan speed (ideal 70–90%)\n• Humidity (mas mababa = mas maganda)\n• Solar voltage (mas mataas = mas maganda)\n\nScore >70% ay mabuti.',
    },
  },
  {
    keywords: ['help', 'tulong', 'what can you do', 'ano ang magagawa mo', 'topics'],
    answer: {
      en: 'I can help with:\n• System overview\n• Auto vs Manual mode\n• AI predictions\n• Sensors & hardware\n• Drying sessions\n• Alerts & notifications\n• Adding devices\n• Analytics\n• Fan & temperature control\n• Offline mode\n\nAsk in English or Filipino!',
      fil: 'Maaari akong tumulong sa:\n• Pangkalahatang-ideya ng sistema\n• Auto vs Manual mode\n• AI predictions\n• Mga sensor at hardware\n• Drying sessions\n• Mga alerto\n• Pagdaragdag ng device\n• Analytics\n• Fan at temperatura\n• Offline mode\n\nMagtanong sa English o Filipino!',
    },
  },
];

const QUICK: Array<{ en: string; fil: string }> = [
  { en: 'How does Auto mode work?', fil: 'Paano gumagana ang Auto mode?' },
  { en: 'Why is 14% the target?', fil: 'Bakit 14% ang target?' },
  { en: 'What sensors are used?', fil: 'Anong sensor ang ginagamit?' },
  { en: 'How to start a session?', fil: 'Paano magsimula ng session?' },
];

function getResponse(input: string, lang: Language): string {
  const q = input.toLowerCase().trim();
  for (const item of KB) {
    if (item.keywords.some(k => q.includes(k))) return item.answer[lang];
  }
  return lang === 'en'
    ? 'Not sure about that. Try asking about Auto mode, sensors, sessions, or type "help" for all topics.'
    : 'Hindi ko pa alam iyon. Subukan ang Auto mode, sensor, sessions, o mag-type ng "tulong".';
}

// ─── Component ────────────────────────────────────────────────────────────────

const LANG_KEY = '@grain_chat_lang';

export function AssistantModal() {
  const { isOpen, close } = useAssistant();
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState<Language>('en');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: 'Hello! I\'m the grAIn Assistant 👋\n\nAsk me anything about drying operations, AI predictions, or sensors — in English or Filipino!',
      timestamp: new Date(),
    },
  ]);
  const listRef = useRef<FlatList<Message>>(null);
  const [kbHeight, setKbHeight] = useState(0);

  // Persist language preference
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(v => { if (v === 'en' || v === 'fil') setLang(v); });
  }, []);

  // Manual keyboard tracking — only reliable approach inside transparent Modal on iOS
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

    const uMsg: Message = { id: `u${Date.now()}`, role: 'user', text: t, timestamp: new Date() };
    setMessages(p => [...p, uMsg]);
    setIsTyping(true);
    scrollBottom();

    await new Promise(r => setTimeout(r, 650));

    const bMsg: Message = { id: `b${Date.now()}`, role: 'bot', text: getResponse(t, lang), timestamp: new Date() };
    setIsTyping(false);
    setMessages(p => [...p, bMsg]);
    scrollBottom();
  }, [lang, scrollBottom]);

  const allData: Message[] = [
    ...messages,
    ...(isTyping ? [{ id: '__t__', role: 'typing' as const, text: '', timestamp: new Date() }] : []),
  ];

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />

      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>grAIn Assistant</Text>
              <Text style={styles.headerSub}>AI-powered help</Text>
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

        {/* Messages + input — padded by manual keyboard height tracking */}
        <View style={[styles.kav, { paddingBottom: kbHeight }]}>
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

          {/* Input bar — always above keyboard */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={lang === 'en' ? 'Ask anything...' : 'Magtanong...'}
              placeholderTextColor="#9CA3AF"
              maxLength={300}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  kav: { flex: 1 },
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
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
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
  chips: { flexGrow: 0, backgroundColor: 'transparent' },
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
