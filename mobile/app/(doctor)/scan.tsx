import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { extractTextFromImage, analyzeMedicalText, type AnalysisResult } from '../../lib/ai';

type Step = 'idle' | 'scanning' | 'extracting' | 'analyzing' | 'done';

const STEP_LABELS: Record<Step, string> = {
  idle: '', scanning: 'Scanning document...', extracting: 'Extracting text with AI OCR...',
  analyzing: 'Running clinical AI analysis...', done: '',
};

const riskColor = (level: string) => {
  const l = level?.toUpperCase();
  if (l === 'CRITICAL') return '#ef4444';
  if (l === 'HIGH') return '#f97316';
  if (l === 'MODERATE') return '#f59e0b';
  return '#10b981';
};

export default function ScanAnalyzeScreen() {
  const { user, role } = useAuth();
  const isDoctor = role === 'doctor';

  const [step, setStep] = useState<Step>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [patientEmail, setPatientEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const captureAndProcess = async (source: 'camera' | 'gallery' | 'document') => {
    let dataUrl: string | null = null;
    let rawText: string | null = null;

    setResult(null);
    setExtractedText('');
    setSaved(false);
    setImageUri(null);

    try {
      if (source === 'document') {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        if (asset.mimeType?.startsWith('image/')) {
          const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
          dataUrl = `data:${asset.mimeType};base64,${b64}`;
          setImageUri(asset.uri);
        } else {
          Alert.alert('PDF Support', 'For PDF files, please paste the text manually in the text field below.');
          return;
        }
      } else if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Required', 'Camera access needed.'); return; }
        const res = await ImagePicker.launchCameraAsync({
          quality: 1, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        dataUrl = `data:image/jpeg;base64,${asset.base64}`;
        setImageUri(asset.uri);
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({
          quality: 1, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        dataUrl = `data:image/jpeg;base64,${asset.base64}`;
        setImageUri(asset.uri);
      }

      // Step 1: Extract text
      setStep('extracting');
      rawText = await extractTextFromImage(dataUrl!);
      setExtractedText(rawText);

      // Step 2: Analyze
      setStep('analyzing');
      const analysis = await analyzeMedicalText(rawText);
      setResult(analysis);
      setStep('done');
    } catch (e: any) {
      Alert.alert('Processing Failed', e.message ?? 'Could not process file.');
      setStep('idle');
    }
  };

  const analyzeManualText = async () => {
    if (!extractedText.trim()) { Alert.alert('No text', 'Please enter or paste report text.'); return; }
    setStep('analyzing');
    setResult(null);
    setSaved(false);
    try {
      const analysis = await analyzeMedicalText(extractedText);
      setResult(analysis);
      setStep('done');
    } catch (e: any) {
      Alert.alert('Analysis Failed', e.message);
      setStep('idle');
    }
  };

  const saveRecord = async () => {
    if (!result || !user) return;
    const emailToLink = isDoctor ? patientEmail.trim().toLowerCase() : (user.email?.toLowerCase() ?? '');
    if (isDoctor && !patientEmail.trim()) {
      Alert.alert('Required', 'Enter the patient\'s email to link this record.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('patient_records').insert({
        created_by: user.id,
        patient_name: result.patient_name,
        patient_email: emailToLink || undefined,
        age: result.age,
        gender: result.gender,
        chief_complaint: result.summary?.slice(0, 100),
        vitals: result.vitals,
        lab_values: {},
        medications: result.medications ?? [],
        diagnoses: result.diagnoses ?? [],
        raw_text: extractedText,
        risk_scores: result.risk_scores,
        nlp_extracted_data: result as any,
      });
      if (error) throw error;
      setSaved(true);
      Alert.alert('Saved!', isDoctor ? `Linked to ${emailToLink}` : 'Record saved to your profile.');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const isProcessing = step === 'extracting' || step === 'analyzing' || step === 'scanning';

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.iconWrap}>
              <Ionicons name="scan" size={22} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.title}>Scan & Analyze</Text>
              <Text style={styles.subtitle}>AI-powered medical document scanner</Text>
            </View>
          </View>

          {/* Scan Options */}
          <View style={styles.scanGrid}>
            {[
              { label: 'Camera Scan', icon: 'camera', color: '#3b82f6', action: () => captureAndProcess('camera') },
              { label: 'Gallery', icon: 'images', color: '#8b5cf6', action: () => captureAndProcess('gallery') },
              { label: 'File / PDF', icon: 'document-text', color: '#10b981', action: () => captureAndProcess('document') },
            ].map(opt => (
              <TouchableOpacity key={opt.label} onPress={opt.action} disabled={isProcessing} style={styles.scanCard}>
                <LinearGradient colors={[opt.color + '30', opt.color + '10']} style={styles.scanGradient}>
                  <Ionicons name={opt.icon as any} size={28} color={opt.color} />
                  <Text style={[styles.scanLabel, { color: opt.color }]}>{opt.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Image Preview */}
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="large" color="#8b5cf6" />
              <Text style={styles.processingText}>{STEP_LABELS[step]}</Text>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#8b5cf6', '#3b82f6']}
                  style={[styles.progressFill, {
                    width: step === 'extracting' ? '40%' : step === 'analyzing' ? '80%' : '20%'
                  }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
              </View>
            </View>
          )}

          {/* Manual Text Input */}
          {!isProcessing && step !== 'done' && (
            <View style={styles.textInputSection}>
              <Text style={styles.sectionLabel}>Or paste report text manually</Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={6}
                placeholder="Paste lab report, prescription, or notes here..."
                placeholderTextColor="#475569"
                value={extractedText}
                onChangeText={setExtractedText}
                textAlignVertical="top"
              />
              {extractedText.trim().length > 0 && (
                <TouchableOpacity onPress={analyzeManualText} style={styles.analyzeBtn}>
                  <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.analyzeBtnGrad}>
                    <Ionicons name="analytics" size={18} color="#fff" />
                    <Text style={styles.analyzeBtnText}>Analyze with AI</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Results */}
          {result && step === 'done' && (
            <View style={styles.resultsContainer}>
              {/* Report Header */}
              <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.resultHeader}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.successBadgeText}>Analysis Complete</Text>
                </View>
                <Text style={styles.resultTitle}>{result.title}</Text>
                {result.patient_name && result.patient_name !== 'Unknown' && (
                  <Text style={styles.resultPatient}>{result.patient_name} · {result.age > 0 ? `${result.age}y` : ''} {result.gender}</Text>
                )}
              </LinearGradient>

              {/* Summary */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📋 Clinical Summary</Text>
                <Text style={styles.cardText}>{result.summary}</Text>
              </View>

              {/* Risk Scores */}
              {result.risk_scores && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>⚡ AI Risk Assessment</Text>
                  <View style={styles.riskGrid}>
                    {Object.entries(result.risk_scores).map(([key, val]: [string, any]) => (
                      <View key={key} style={styles.riskCard}>
                        <Text style={styles.riskLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                        <Text style={[styles.riskScore, { color: riskColor(val.level) }]}>{val.score}%</Text>
                        <Text style={[styles.riskLevel, { color: riskColor(val.level) }]}>{val.level}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Key Findings */}
              {result.keyFindings?.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🔬 Key Findings</Text>
                  {result.keyFindings.map((f, i) => (
                    <View key={i} style={styles.findingRow}>
                      <Ionicons
                        name={f.status === 'critical' ? 'warning' : f.status === 'abnormal' ? 'alert-circle' : 'checkmark-circle'}
                        size={16}
                        color={f.status === 'critical' ? '#ef4444' : f.status === 'abnormal' ? '#f97316' : '#10b981'}
                      />
                      <Text style={styles.findingText} numberOfLines={3}>{f.finding}</Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor: f.status === 'critical' ? '#ef444420' : f.status === 'abnormal' ? '#f9731620' : '#10b98120',
                      }]}>
                        <Text style={[styles.statusText, {
                          color: f.status === 'critical' ? '#ef4444' : f.status === 'abnormal' ? '#f97316' : '#10b981',
                        }]}>{f.status}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Vitals */}
              {result.vitals && Object.keys(result.vitals).length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>💓 Vitals</Text>
                  <View style={styles.vitalsGrid}>
                    {Object.entries(result.vitals).map(([k, v]) => (
                      <View key={k} style={styles.vitalItem}>
                        <Text style={styles.vitalKey}>{k}</Text>
                        <Text style={styles.vitalVal}>{v as string}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Medications */}
              {result.medications?.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>💊 Medications</Text>
                  <View style={styles.tagRow}>
                    {result.medications.map((m, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{m}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Diagnoses */}
              {result.diagnoses?.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🩺 Diagnoses</Text>
                  {result.diagnoses.map((d, i) => (
                    <View key={i} style={styles.diagnosisRow}>
                      <View style={styles.diagnosisDot} />
                      <Text style={styles.diagnosisText}>{d}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Plain Language */}
              <View style={[styles.card, styles.explainCard]}>
                <Text style={styles.cardTitle}>💬 Plain Language Explanation</Text>
                <Text style={styles.explainText}>{result.simplifiedExplanation}</Text>
              </View>

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>✅ Recommendations</Text>
                  {result.recommendations.map((r, i) => (
                    <View key={i} style={styles.recRow}>
                      <Ionicons name="chevron-forward-circle" size={14} color="#8b5cf6" />
                      <Text style={styles.recText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Save Section */}
              {!saved && (
                <View style={styles.saveSection}>
                  {isDoctor && (
                    <>
                      <Text style={styles.saveSectionLabel}>Link to Patient Account</Text>
                      <View style={styles.emailInputRow}>
                        <Ionicons name="mail-outline" size={16} color="#64748b" />
                        <TextInput
                          style={styles.emailInput}
                          placeholder="patient@email.com"
                          placeholderTextColor="#475569"
                          value={patientEmail}
                          onChangeText={setPatientEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </>
                  )}
                  <TouchableOpacity onPress={saveRecord} disabled={saving} style={styles.saveBtnWrap}>
                    <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.saveBtn}>
                      {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Ionicons name="save" size={18} color="#fff" />
                          <Text style={styles.saveBtnText}>
                            {isDoctor ? 'Save & Link to Patient' : 'Save My Record'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {saved && (
                <View style={styles.savedRow}>
                  <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                  <Text style={styles.savedText}>
                    {isDoctor ? `Saved & linked to ${patientEmail}` : 'Record saved to your profile!'}
                  </Text>
                </View>
              )}

              {/* Scan Again */}
              <TouchableOpacity onPress={() => { setStep('idle'); setResult(null); setImageUri(null); setExtractedText(''); setSaved(false); }} style={styles.scanAgainBtn}>
                <Ionicons name="refresh" size={16} color="#8b5cf6" />
                <Text style={styles.scanAgainText}>Scan Another Document</Text>
              </TouchableOpacity>

              <Text style={styles.disclaimer}>⚠️ AI-generated analysis. Always consult a qualified physician.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

  scanGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  scanCard: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  scanGradient: { padding: 16, alignItems: 'center', gap: 8 },
  scanLabel: { fontSize: 11, fontWeight: '700' },

  preview: { width: '100%', height: 220, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },

  processingBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  processingText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  progressBar: { width: '100%', height: 4, backgroundColor: '#334155', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  textInputSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, color: '#64748b', marginBottom: 10, fontWeight: '600' },
  textInput: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 14, color: '#f1f5f9', fontSize: 13, minHeight: 120, fontFamily: 'monospace' },
  analyzeBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  analyzeBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  analyzeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  resultsContainer: { gap: 14 },
  resultHeader: { borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155' },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, alignSelf: 'flex-start', backgroundColor: '#10b98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  successBadgeText: { color: '#10b981', fontSize: 12, fontWeight: '700' },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  resultPatient: { fontSize: 13, color: '#64748b' },

  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#e2e8f0', marginBottom: 12 },
  cardText: { fontSize: 13, color: '#94a3b8', lineHeight: 20 },

  riskGrid: { flexDirection: 'row', gap: 10 },
  riskCard: { flex: 1, backgroundColor: '#0f172a', borderRadius: 12, padding: 12, alignItems: 'center' },
  riskLabel: { fontSize: 11, color: '#64748b', textTransform: 'capitalize', marginBottom: 4 },
  riskScore: { fontSize: 22, fontWeight: '800' },
  riskLevel: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  findingText: { flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalItem: { backgroundColor: '#0f172a', borderRadius: 10, padding: 10, minWidth: '30%' },
  vitalKey: { fontSize: 10, color: '#64748b', marginBottom: 2 },
  vitalVal: { fontSize: 13, color: '#f1f5f9', fontWeight: '700' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#8b5cf620', borderWidth: 1, borderColor: '#8b5cf630', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: 12, color: '#a78bfa' },

  diagnosisRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  diagnosisDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8b5cf6' },
  diagnosisText: { fontSize: 13, color: '#94a3b8', flex: 1 },

  explainCard: { borderColor: '#8b5cf630', backgroundColor: '#8b5cf610' },
  explainText: { fontSize: 13, color: '#c4b5fd', lineHeight: 20 },

  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  recText: { fontSize: 13, color: '#94a3b8', flex: 1, lineHeight: 18 },

  saveSection: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155', gap: 12 },
  saveSectionLabel: { fontSize: 13, fontWeight: '700', color: '#e2e8f0' },
  emailInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' },
  emailInput: { flex: 1, color: '#f1f5f9', fontSize: 14 },
  saveBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#10b98115', padding: 14, borderRadius: 12 },
  savedText: { color: '#10b981', fontWeight: '700', fontSize: 14 },

  scanAgainBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', padding: 12 },
  scanAgainText: { color: '#8b5cf6', fontSize: 14, fontWeight: '600' },

  disclaimer: { fontSize: 11, color: '#475569', textAlign: 'center', fontStyle: 'italic' },
});
