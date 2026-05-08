import React, { useState, useRef, useCallback, type MutableRefObject } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { COLORS } from '@/utils/constants';

type Language = 'en' | 'fil';

interface Message {
  id: string;
  role: 'user' | 'bot' | 'typing';
  text: string;
  timestamp: Date;
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

interface QAPair {
  keywords: string[];
  answer: { en: string; fil: string };
}

const KNOWLEDGE_BASE: QAPair[] = [
  {
    keywords: ['what is grain', 'ano ang grain', 'system', 'tungkol', 'about', 'platform'],
    answer: {
      en: 'grAIn is an AI-assisted IoT solar-powered rice grain dryer monitoring system. It lets farmers monitor drying conditions in real time, control the dryer remotely, and get AI-powered predictions on moisture levels — all from your phone.',
      fil: 'Ang grAIn ay isang AI-assisted IoT solar-powered na sistema para sa pagmo-monitor ng grain dryer. Pinapayagan nito ang mga magsasaka na makita ang kondisyon ng pagpapatuyo sa real time, kontrolin ang dryer mula sa telepono, at makakuha ng AI predictions sa moisture levels.',
    },
  },
  {
    keywords: ['target moisture', 'safe storage', 'ligtas', 'bakit 14', 'why 14', 'storage moisture'],
    answer: {
      en: 'The target moisture content for safe rice storage is 14% wet basis. Above 14%, grains are prone to mold, fungal growth, and quality degradation. The AI automatically stops the dryer when this level is reached.',
      fil: 'Ang target moisture content para sa ligtas na imbakan ng bigas ay 14% wet basis. Kapag higit sa 14%, ang butil ay madaling magkaroon ng amag. Awtomatikong pinapatay ng AI ang dryer kapag naabot na ang level na ito.',
    },
  },
  {
    keywords: ['auto mode', 'auto', 'automatic', 'awtomatiko', 'ai control', 'ai mode', 'what does auto'],
    answer: {
      en: 'In Auto mode, the AI monitors live sensor data every 60 seconds and automatically adjusts settings:\n• MAINTAIN — conditions optimal, no change\n• REDUCE_TEMP — temp >65°C, reduces by 5°C\n• INCREASE_TEMP — temp <38°C, increases by 5°C\n• INCREASE_FAN — fan too low or humidity too high, +15%\n• STOP — target moisture reached, dryer auto-stops',
      fil: 'Sa Auto mode, ang AI ay nag-monitor ng live sensor data tuwing 60 segundo at awtomatikong inaayos ang mga setting:\n• MAINTAIN — optimal ang kondisyon\n• REDUCE_TEMP — temp >65°C, binababa ng 5°C\n• INCREASE_TEMP — temp <38°C, itinataas ng 5°C\n• INCREASE_FAN — mababa ang fan o mataas ang humidity, +15%\n• STOP — naabot ang target moisture, pinapatay ang dryer',
    },
  },
  {
    keywords: ['manual mode', 'manual', 'mano-mano', 'manual control'],
    answer: {
      en: 'In Manual mode, you have full control:\n• Set temperature (35–70°C) using the slider\n• Set fan speed (0–100%) using the slider\n• Control FAN1, FAN2, or ALL fans individually\n\nThe AI will NOT auto-adjust in Manual mode.',
      fil: 'Sa Manual mode, ikaw ang may kontrol:\n• Magtakda ng temperatura (35–70°C) gamit ang slider\n• Magtakda ng bilis ng fan (0–100%) gamit ang slider\n• Kontrolin ang FAN1, FAN2, o ALL fans nang isa-isa\n\nHindi awtomatikong inaayos ng AI ang mga setting sa Manual mode.',
    },
  },
  {
    keywords: ['ai prediction', 'prediction', 'predict', 'hula', 'forecast', 'random forest'],
    answer: {
      en: 'The AI Prediction uses a trained Random Forest model (R² = 0.91) to forecast:\n• Moisture in 30 minutes\n• Time to reach 14% target\n• Efficiency score (0–100)\n• Confidence level (65–97%)\n• 6-hour projected moisture curve\n• Recommendation (optimal / warning / critical)',
      fil: 'Ang AI Prediction ay gumagamit ng trained Random Forest model (R² = 0.91) para mahulaan ang:\n• Moisture pagkatapos ng 30 minuto\n• Oras para maabot ang 14% target\n• Efficiency score (0–100)\n• Confidence level (65–97%)\n• 6-oras na projected moisture curve\n• Rekomendasyon (optimal / warning / critical)',
    },
  },
  {
    keywords: ['sensor', 'sensors', 'temperature', 'humidity', 'moisture sensor', 'anong sensor', 'what sensors'],
    answer: {
      en: 'The grAIn dryer uses sensors connected to an ESP32:\n• DHT22 — temperature & humidity\n• Capacitive moisture sensor — grain moisture %\n• Load cell + HX711 — grain weight (kg)\n• INA219 — energy consumption (kWh)\n• Solar panel voltage monitor\n\nData is sent every 5–30 seconds.',
      fil: 'Ang grAIn dryer ay gumagamit ng mga sensor na konektado sa ESP32:\n• DHT22 — temperatura at humidity\n• Capacitive moisture sensor — moisture % ng butil\n• Load cell + HX711 — timbang ng butil (kg)\n• INA219 — konsumo ng enerhiya (kWh)\n• Solar panel voltage monitor\n\nAng data ay ipinapadala tuwing 5–30 segundo.',
    },
  },
  {
    keywords: ['solar', 'solar power', 'energy', 'enerhiya', 'solar panel', 'kuryente'],
    answer: {
      en: 'The dryer is powered by solar panels. Solar voltage is monitored in real time — higher voltage means better drying efficiency. The AI considers solar voltage when making recommendations.',
      fil: 'Ang dryer ay pinapagana ng solar panels. Ang solar voltage ay mino-monitor sa real time — mas mataas na voltage ay nangangahulugang mas magandang efficiency. Isinasaalang-alang ng AI ang solar voltage sa paggawa ng rekomendasyon.',
    },
  },
  {
    keywords: ['session', 'drying session', 'start session', 'start drying', 'paano magsimula', 'grain type'],
    answer: {
      en: 'To start a drying session:\n1. Go to Sessions tab\n2. Tap "Start Session"\n3. Select your device\n4. Choose grain type (rice, corn, wheat, soybean, coffee)\n5. Set target moisture (default: 14%)\n6. Tap Start\n\nThe session auto-completes when target moisture is reached.',
      fil: 'Para magsimula ng drying session:\n1. Pumunta sa Sessions tab\n2. I-tap ang "Start Session"\n3. Piliin ang iyong device\n4. Piliin ang uri ng butil (bigas, mais, trigo, soybean, kape)\n5. Itakda ang target moisture (default: 14%)\n6. I-tap ang Start\n\nAwtomatikong natatapos ang session kapag naabot ang target moisture.',
    },
  },
  {
    keywords: ['alert', 'alerto', 'warning', 'babala', 'critical', 'notification'],
    answer: {
      en: 'Three types of alerts:\n• Critical (red) — immediate action needed (e.g., temp >65°C)\n• Warning (yellow) — conditions not ideal\n• Info (blue) — general updates\n\nPush notifications are sent for critical alerts and when drying completes.',
      fil: 'Tatlong uri ng alerto:\n• Critical (pula) — kailangan ng agarang aksyon (hal., temp >65°C)\n• Warning (dilaw) — hindi ideal ang kondisyon\n• Info (asul) — pangkalahatang update\n\nPush notifications para sa critical alerts at kapag tapos ang pagpapatuyo.',
    },
  },
  {
    keywords: ['add device', 'magdagdag ng device', 'register device', 'device id', 'paano magdagdag'],
    answer: {
      en: 'To add a device:\n1. Tap + in the Dashboard top-right\n2. Enter Device ID (e.g., GR-001)\n3. Enter location (e.g., Farm A, Plot 1)\n4. Tap Register\n\nShows Online when the ESP32 sends sensor data.',
      fil: 'Para magdagdag ng device:\n1. I-tap ang + sa kanang sulok ng Dashboard\n2. Ilagay ang Device ID (hal., GR-001)\n3. Ilagay ang lokasyon (hal., Farm A, Plot 1)\n4. I-tap ang Register\n\nNagpapakita ng Online kapag nagpapadala ng sensor data ang ESP32.',
    },
  },
  {
    keywords: ['offline', 'no internet', 'walang internet', 'connection', 'queue'],
    answer: {
      en: 'grAIn works offline! Commands are queued locally and sent when connection is restored. The AI can still provide local rule-based predictions without internet.',
      fil: 'Gumagana ang grAIn kahit offline! Ang mga utos ay naka-queue nang lokal at ipinapadala kapag naibalik ang koneksyon. Ang AI ay maaari pa ring magbigay ng lokal na predictions nang walang internet.',
    },
  },
  {
    keywords: ['analytics', 'history', 'kasaysayan', 'chart', 'graph', 'trend', 'report'],
    answer: {
      en: 'The Analytics tab shows:\n• Moisture trend over time\n• Drying cycles history\n• Energy consumption per session\n• Period filter: daily / weekly / monthly\n• Device comparison filter',
      fil: 'Ang Analytics tab ay nagpapakita ng:\n• Trend ng moisture sa paglipas ng panahon\n• Kasaysayan ng drying cycles\n• Konsumo ng enerhiya bawat session\n• Period filter: araw-araw / linggo-linggo / buwan-buwan',
    },
  },
  {
    keywords: ['temperature too high', 'masyadong mainit', 'grain cracking', 'high temp', 'mataas na temperatura'],
    answer: {
      en: 'If temperature exceeds 65°C, the AI triggers a CRITICAL alert and recommends reducing by 5–10°C. High temperatures cause grain cracking and nutrient loss. Auto mode lowers temperature automatically.',
      fil: 'Kung ang temperatura ay lumampas sa 65°C, mag-ti-trigger ang AI ng CRITICAL alert at magrerekomenda ng pagbaba ng 5–10°C. Mataas na temperatura ay nagdudulot ng pagbasag ng butil. Sa Auto mode, awtomatikong bababa ang temperatura.',
    },
  },
  {
    keywords: ['fan', 'fan control', 'fan1', 'fan2', 'ventilation', 'airflow'],
    answer: {
      en: 'Two fans you can control:\n• FAN1 — primary drying fan\n• FAN2 — exhaust fan\n• ALL — control both together\n\nManual: turn ON/OFF from Control screen. Auto: AI adjusts speed based on conditions.',
      fil: 'Dalawang fan na maaaring kontrolin:\n• FAN1 — pangunahing fan\n• FAN2 — exhaust fan\n• ALL — pareho nang sabay\n\nManual: i-ON/OFF mula sa Control screen. Auto: inaayos ng AI ang bilis batay sa kondisyon.',
    },
  },
  {
    keywords: ['efficiency', 'episyente', 'efficiency score', 'score'],
    answer: {
      en: 'Drying efficiency (0–100%) is based on:\n• Temperature (optimal: 40–60°C)\n• Fan speed (optimal: 70–90%)\n• Humidity (lower = better)\n• Solar voltage (higher = better)\n\nScore above 70% is good. Auto mode targets maximum efficiency.',
      fil: 'Ang drying efficiency (0–100%) ay batay sa:\n• Temperatura (optimal: 40–60°C)\n• Bilis ng fan (optimal: 70–90%)\n• Humidity (mas mababa = mas maganda)\n• Solar voltage (mas mataas = mas maganda)\n\nScore na higit sa 70% ay mabuti. Tina-target ng Auto mode ang maximum efficiency.',
    },
  },
  {
    keywords: ['profile', 'settings', 'password', 'change password', 'palitan ang password'],
    answer: {
      en: 'Profile screen: edit name, bio, location, upload photo, change password.\n\nSettings: toggle push notifications, view app version.',
      fil: 'Profile screen: i-edit ang pangalan, bio, lokasyon, mag-upload ng photo, palitan ang password.\n\nSettings: i-toggle ang push notifications, tingnan ang bersyon ng app.',
    },
  },
  {
    keywords: ['help', 'tulong', 'what can you do', 'ano ang magagawa mo', 'topics', 'paksa'],
    answer: {
      en: 'I can help with:\n• System overview\n• Auto vs Manual mode\n• AI predictions & ML model\n• Moisture targets\n• Sensors & hardware\n• Drying sessions\n• Alerts & notifications\n• Adding devices\n• Analytics\n• Fan & temperature control\n• Offline mode\n• Profile & settings\n\nAsk anything in English or Filipino!',
      fil: 'Maaari akong tumulong sa:\n• Pangkalahatang-ideya ng sistema\n• Auto vs Manual mode\n• AI predictions at ML model\n• Target moisture\n• Mga sensor at hardware\n• Drying sessions\n• Mga alerto at notification\n• Pagdaragdag ng device\n• Analytics\n• Kontrol ng fan at temperatura\n• Offline mode\n• Profile at settings\n\nMagtanong sa English o Filipino!',
    },
  },
];

const QUICK_PROMPTS = [
  { en: 'How does Auto mode work?', fil: 'Paano gumagana ang Auto mode?' },
  { en: 'Why is 14% the target?', fil: 'Bakit 14% ang target?' },
  { en: 'What sensors are used?', fil: 'Anong mga sensor ang ginagamit?' },
  { en: 'How to start a session?', fil: 'Paano magsimula ng session?' },
];

function getBotResponse(input: string, lang: Language): string {
  const normalized = input.toLowerCase().trim();
  for (const qa of KNOWLEDGE_BASE) {
    if (qa.keywords.some(kw => normalized.includes(kw))) {
      return qa.answer[lang];
    }
  }
  return lang === 'en'
    ? 'I\'m not sure about that. Try asking about: Auto mode, AI predictions, sensors, drying sessions, or type "help" to see all topics.'
    : 'Hindi ko pa sigurado doon. Subukang magtanong tungkol sa: Auto mode, AI predictions, mga sensor, drying sessions, o mag-type ng "tulong" para sa lahat ng paksa.';
}

export default function AIChatbotScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: 'Hello! I\'m the grAIn Assistant 👋\n\nI can help with drying operations, AI predictions, sensors, and more.\n\nAsk me anything in English or Filipino!\n(Magtanong sa English o Filipino!)',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    scrollToBottom();

    await new Promise(r => setTimeout(r, 650));

    const botMsg: Message = {
      id: `b${Date.now()}`,
      role: 'bot',
      text: getBotResponse(trimmed, lang),
      timestamp: new Date(),
    };
    setIsTyping(false);
    setMessages(prev => [...prev, botMsg]);
    scrollToBottom();
  }, [lang, scrollToBottom]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const allData: Message[] = [
    ...messages,
    ...(isTyping ? [{ id: '__typing__', role: 'typing' as const, text: '', timestamp: new Date() }] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.botAvatar}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>grAIn Assistant</Text>
            <Text style={styles.headerSub}>AI-powered help</Text>
          </View>
        </View>
        <View style={styles.langToggle}>
          <TouchableOpacity
            style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
            onPress={() => { setLang('en'); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, lang === 'fil' && styles.langBtnActive]}
            onPress={() => { setLang('fil'); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.langBtnText, lang === 'fil' && styles.langBtnTextActive]}>FIL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Chat area + input ── */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={allData}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => {
            if (item.role === 'typing') {
              return (
                <View style={[styles.row, styles.rowBot]}>
                  <View style={styles.avatarSm}>
                    <Ionicons name="sparkles" size={10} color="#fff" />
                  </View>
                  <View style={[styles.bubble, styles.bubbleBot, { flexDirection: 'row', gap: 8 }]}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.typingText}>
                      {lang === 'en' ? 'Thinking...' : 'Nag-iisip...'}
                    </Text>
                  </View>
                </View>
              );
            }
            const isUser = item.role === 'user';
            return (
              <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
                {!isUser && (
                  <View style={styles.avatarSm}>
                    <Ionicons name="sparkles" size={10} color="#fff" />
                  </View>
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                  <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.timeText, isUser ? styles.timeUser : styles.timeBot]}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Quick prompts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={styles.chip}
              onPress={() => sendMessage(lang === 'en' ? p.en : p.fil)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{lang === 'en' ? p.en : p.fil}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputBar}>
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
            onSubmitEditing={() => { sendMessage(input); }}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnOff]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={17} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  botAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  headerSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  langToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 2 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  langBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  langBtnText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  langBtnTextActive: { color: COLORS.primary },

  // Body
  body: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 10 },

  // Messages
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
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextBot: { color: '#111' },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeUser: { color: 'rgba(255,255,255,0.65)' },
  timeBot: { color: '#9CA3AF' },
  typingText: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },

  // Quick prompts
  chipRow: { flexGrow: 0, backgroundColor: 'transparent' },
  chipRowContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
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
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
    flexShrink: 0,
  },
  sendBtnOff: { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0 },
});
