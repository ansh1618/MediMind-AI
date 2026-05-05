import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { analyzeSymptoms, type AIResponse } from '../../lib/aiService';

const RISK_COLORS: Record<string, string> = {
  low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626',
};

export default function DiagnosisScreen() {
  const [symptoms, setSymptoms] = useState('');
  const [patientInfo, setPatientInfo] = useState('');
  const [result, setResult] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!symptoms.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await analyzeSymptoms(symptoms, patientInfo);
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const riskColor = result?.risk_level ? RISK_COLORS[result.risk_level] ?? '#94a3b8' : '#94a3b8';

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="medical" size={24} color="#3b82f6" />
            <Text style={styles.title}>AI Diagnosis</Text>
          </View>
          <Text style={styles.subtitle}>Describe symptoms for Gemini-powered clinical analysis</Text>

          {/* Patient Info */}
          <Text style={styles.label}>Patient Info (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Age, gender, medical history..."
            placeholderTextColor="#475569"
            value={patientInfo}
            onChangeText={setPatientInfo}
            multiline
            numberOfLines={2}
          />

          {/* Symptoms */}
          <Text style={styles.label}>Symptoms *</Text>
          <TextInput
            style={[styles.input, styles.symptomsInput]}
            placeholder="Describe symptoms in detail..."
            placeholderTextColor="#475569"
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={4}
          />

          {/* Analyze Button */}
          <TouchableOpacity onPress={handleAnalyze} disabled={loading || !symptoms.trim()} style={styles.btnWrap}>
            <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={[styles.btn, (!symptoms.trim() || loading) && styles.btnDisabled]}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="analytics-outline" size={20} color="#fff" />
                    <Text style={styles.btnText}>Analyze with AI</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Result */}
          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Analysis Result</Text>

              {/* Risk Badge */}
              <View style={[styles.riskBadge, { borderColor: riskColor, backgroundColor: riskColor + '22' }]}>
                <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
                <Text style={[styles.riskText, { color: riskColor }]}>
                  {(result.risk_level ?? 'unknown').toUpperCase()} RISK
                </Text>
              </View>

              {/* Diagnosis */}
              {result.diagnosis && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>🔍 Diagnosis</Text>
                  <Text style={styles.sectionText}>{result.diagnosis}</Text>
                </View>
              )}

              {/* Summary */}
              {result.summary && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>📋 Clinical Summary</Text>
                  <Text style={styles.sectionText}>{result.summary}</Text>
                </View>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>💊 Recommendations</Text>
                  {result.recommendations.map((r, i) => (
                    <View key={i} style={styles.recRow}>
                      <View style={styles.recDot} />
                      <Text style={styles.recText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  label: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, color: '#f1f5f9', fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  symptomsInput: { minHeight: 100, textAlignVertical: 'top' },
  btnWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ef444420', padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
  resultCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', marginBottom: 24 },
  resultTitle: { fontSize: 17, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 14 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginBottom: 16, alignSelf: 'flex-start' },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskText: { fontSize: 12, fontWeight: '700' },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  sectionText: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6', marginTop: 6 },
  recText: { fontSize: 13, color: '#cbd5e1', flex: 1 },
});
