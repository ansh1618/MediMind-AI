import { useState, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { chatWithAI } from '../../lib/ai';

interface Message { id: string; role: 'user' | 'assistant'; content: string; ts: Date }

const QUICK_PROMPTS = [
  'What does high HbA1c mean?',
  'Explain eGFR in simple terms',
  'What is a normal blood pressure?',
  'Signs of diabetic kidney disease?',
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant',
    content: 'Hello! I\'m MediMind AI. I can help explain medical reports, lab values, symptoms, and health questions. How can I assist you today?',
    ts: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await chatWithAI(history);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, ts: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '⚠️ Sorry, I\'m having trouble connecting. Please try again.', ts: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
          <Text style={[styles.tsText, isUser && { color: '#c4b5fd' }]}>
            {item.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.headerIcon}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>MediMind AI</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online · Powered by Groq</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={i => i.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Loading */}
        {loading && (
          <View style={styles.typingRow}>
            <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.aiAvatarSm}>
              <Ionicons name="sparkles" size={10} color="#fff" />
            </LinearGradient>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          </View>
        )}

        {/* Quick Prompts */}
        {messages.length <= 2 && (
          <View style={styles.quickRow}>
            {QUICK_PROMPTS.map(q => (
              <TouchableOpacity key={q} onPress={() => send(q)} style={styles.quickChip}>
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your health..."
            placeholderTextColor="#475569"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity onPress={() => send()} disabled={!input.trim() || loading} style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}>
            <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.sendBtnGrad}>
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  onlineText: { fontSize: 11, color: '#64748b' },

  msgList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  msgRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aiAvatarSm: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleAI: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: '#8b5cf6', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: '#e2e8f0', lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  tsText: { fontSize: 10, color: '#475569', marginTop: 4, textAlign: 'right' },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  typingBubble: { backgroundColor: '#1e293b', borderRadius: 16, padding: 12, borderBottomLeftRadius: 4 },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  quickChip: { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#334155' },
  quickChipText: { fontSize: 12, color: '#94a3b8' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#1e293b', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  input: { flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: '#334155', maxHeight: 100 },
  sendBtn: { marginBottom: 2 },
  sendBtnGrad: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
