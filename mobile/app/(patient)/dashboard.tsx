import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface DoctorRecord {
  id: string;
  created_at: string;
  patient_name: string;
  age: number;
  gender: string;
  chief_complaint: string;
  diagnoses: string[];
  medications: string[];
  risk_scores: Record<string, { score: number; level: string }>;
  patient_email?: string;
}

const riskColor = (level: string) => {
  const l = level?.toUpperCase();
  if (l === 'CRITICAL') return '#ef4444';
  if (l === 'HIGH') return '#f97316';
  if (l === 'MODERATE') return '#f59e0b';
  return '#10b981';
};

export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  const [records, setRecords] = useState<DoctorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systolic, setSystolicVal] = useState(120);
  const [diastolic, setDiastolicVal] = useState(80);

  const fetchRecords = async () => {
    if (!user?.email) return;
    try {
      const { data } = await supabase
        .from('patient_records')
        .select('*')
        .eq('patient_email', user.email.toLowerCase())
        .order('created_at', { ascending: false });
      setRecords(data as DoctorRecord[] ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, [user?.email]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const riskScore = Math.min(100, Math.round(
    (systolic > 140 ? 30 : systolic > 120 ? 15 : 0) +
    (diastolic > 90 ? 25 : diastolic > 80 ? 10 : 0) + 20
  ));
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 45 ? 'MODERATE' : 'LOW';

  const quickActions = [
    { label: 'Scan Report', icon: 'scan', color: '#8b5cf6', route: '/(patient)/scan' },
    { label: 'AI Assistant', icon: 'chatbubble-ellipses', color: '#3b82f6', route: '/(patient)/chat' },
    { label: 'My Reports', icon: 'document-text', color: '#10b981', route: '/(patient)/reports' },
  ];

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>My Health 👋</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Patient Badge */}
        <View style={styles.badge}>
          <Ionicons name="heart" size={13} color="#ec4899" />
          <Text style={styles.badgeText}>Patient Portal · MediMind AI</Text>
        </View>

        {/* Risk Score Hero */}
        <View style={styles.riskHero}>
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.riskCard}>
            <Text style={styles.riskTitle}>Your Risk Score</Text>
            <View style={styles.riskCircle}>
              <LinearGradient colors={[riskColor(riskLevel) + '40', riskColor(riskLevel) + '10']} style={styles.riskCircleGrad}>
                <Text style={[styles.riskNumber, { color: riskColor(riskLevel) }]}>{riskScore}</Text>
                <Text style={styles.riskMax}>/100</Text>
              </LinearGradient>
            </View>
            <Text style={[styles.riskLevelText, { color: riskColor(riskLevel) }]}>{riskLevel} RISK</Text>
            <Text style={styles.riskNote}>Based on your vitals · Tap to update</Text>
          </LinearGradient>

          {/* Quick vitals */}
          <View style={styles.vitalsQuick}>
            <Text style={styles.sectionTitle}>Quick Vitals</Text>
            <View style={styles.vitalsRow}>
              {[
                { label: 'Systolic BP', value: systolic, unit: 'mmHg', icon: 'heart', color: '#ef4444', onChange: (v: number) => setSystolicVal(v) },
                { label: 'Diastolic BP', value: diastolic, unit: 'mmHg', icon: 'pulse', color: '#f97316', onChange: (v: number) => setDiastolicVal(v) },
              ].map(v => (
                <View key={v.label} style={styles.vitalCard}>
                  <Ionicons name={v.icon as any} size={18} color={v.color} />
                  <Text style={[styles.vitalNum, { color: v.color }]}>{v.value}</Text>
                  <Text style={styles.vitalUnit}>{v.unit}</Text>
                  <Text style={styles.vitalLabel}>{v.label}</Text>
                  <View style={styles.vitalBtns}>
                    <TouchableOpacity onPress={() => v.onChange(v.value - 1)} style={styles.vitalBtn}><Text style={styles.vitalBtnText}>−</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => v.onChange(v.value + 1)} style={styles.vitalBtn}><Text style={styles.vitalBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map(a => (
            <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => router.push(a.route as any)}>
              <LinearGradient colors={[a.color + '30', a.color + '10']} style={styles.actionGrad}>
                <Ionicons name={a.icon as any} size={26} color={a.color} />
                <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Doctor Records */}
        <View style={styles.recordsSection}>
          <View style={styles.recordsHeader}>
            <Text style={styles.sectionTitle}>My Medical Records</Text>
            {records.length > 0 && (
              <View style={styles.recordCount}>
                <Text style={styles.recordCountText}>{records.length}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#8b5cf6" style={{ marginVertical: 20 }} />
          ) : records.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color="#334155" />
              <Text style={styles.emptyTitle}>No records yet</Text>
              <Text style={styles.emptyText}>Your doctor will share records with you here</Text>
            </View>
          ) : (
            records.map(rec => {
              const topRisk = Object.entries(rec.risk_scores ?? {})
                .sort((a, b) => ((b[1] as any)?.score ?? 0) - ((a[1] as any)?.score ?? 0))[0];
              return (
                <View key={rec.id} style={styles.recordCard}>
                  <View style={styles.recordCardHeader}>
                    <View style={styles.recordIcon}>
                      <Ionicons name="document-text" size={20} color="#8b5cf6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordName}>{rec.patient_name}</Text>
                      <Text style={styles.recordMeta}>
                        {rec.age ? `${rec.age}y · ` : ''}{rec.gender ?? ''}{rec.chief_complaint ? ` · ${rec.chief_complaint}`.slice(0, 40) : ''}
                      </Text>
                    </View>
                    <View style={styles.recordDate}>
                      <Text style={styles.recordDateText}>
                        {new Date(rec.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                      {topRisk && (
                        <Text style={[styles.recordRisk, { color: riskColor((topRisk[1] as any)?.level ?? '') }]}>
                          {(topRisk[1] as any)?.level}
                        </Text>
                      )}
                    </View>
                  </View>

                  {rec.diagnoses?.length > 0 && (
                    <View style={styles.tagRow}>
                      {rec.diagnoses.slice(0, 3).map((d, i) => (
                        <View key={i} style={styles.diagTag}>
                          <Text style={styles.diagTagText}>{d}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {topRisk && (
                    <View style={styles.riskBar}>
                      <Text style={styles.riskBarLabel}>{topRisk[0]} risk</Text>
                      <View style={styles.riskBarBg}>
                        <LinearGradient
                          colors={[riskColor((topRisk[1] as any)?.level ?? ''), riskColor((topRisk[1] as any)?.level ?? '') + '80']}
                          style={[styles.riskBarFill, { width: `${Math.min(100, (topRisk[1] as any)?.score ?? 0)}%` }]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        />
                      </View>
                      <Text style={[styles.riskBarVal, { color: riskColor((topRisk[1] as any)?.level ?? '') }]}>
                        {(topRisk[1] as any)?.score}%
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* AI Status */}
        <View style={styles.aiStatus}>
          <View style={styles.aiDot} />
          <Text style={styles.aiStatusText}>Gemini AI · System Online</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingTop: 56 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  email: { fontSize: 12, color: '#64748b', marginTop: 2, maxWidth: 240 },
  logoutBtn: { padding: 8, backgroundColor: '#ef444420', borderRadius: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 24, marginBottom: 20, backgroundColor: '#831843', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, color: '#f9a8d4', fontWeight: '600' },

  riskHero: { marginHorizontal: 24, marginBottom: 24, gap: 12 },
  riskCard: { borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  riskTitle: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 16 },
  riskCircle: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 14 },
  riskCircleGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  riskNumber: { fontSize: 40, fontWeight: '900' },
  riskMax: { fontSize: 12, color: '#64748b' },
  riskLevelText: { fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  riskNote: { fontSize: 11, color: '#475569', marginTop: 6 },

  vitalsQuick: { gap: 8 },
  vitalsRow: { flexDirection: 'row', gap: 10 },
  vitalCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#334155' },
  vitalNum: { fontSize: 26, fontWeight: '900' },
  vitalUnit: { fontSize: 10, color: '#64748b' },
  vitalLabel: { fontSize: 10, color: '#475569', textAlign: 'center' },
  vitalBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  vitalBtn: { width: 28, height: 28, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vitalBtnText: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', lineHeight: 22 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e2e8f0', marginHorizontal: 24, marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 24, marginBottom: 28 },
  actionCard: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  actionGrad: { padding: 14, alignItems: 'center', gap: 8 },
  actionLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  recordsSection: { marginHorizontal: 24, marginBottom: 24 },
  recordsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  recordCount: { marginLeft: 8, backgroundColor: '#8b5cf620', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  recordCountText: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },

  emptyBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#334155' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569' },
  emptyText: { fontSize: 12, color: '#334155', textAlign: 'center' },

  recordCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155', gap: 10 },
  recordCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recordIcon: { width: 38, height: 38, backgroundColor: '#8b5cf620', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recordName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  recordMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  recordDate: { alignItems: 'flex-end', gap: 4 },
  recordDateText: { fontSize: 11, color: '#475569' },
  recordRisk: { fontSize: 11, fontWeight: '700' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  diagTag: { backgroundColor: '#8b5cf615', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  diagTagText: { fontSize: 11, color: '#a78bfa' },

  riskBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  riskBarLabel: { fontSize: 11, color: '#64748b', textTransform: 'capitalize', width: 70 },
  riskBarBg: { flex: 1, height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
  riskBarFill: { height: '100%', borderRadius: 3 },
  riskBarVal: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  aiStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 40 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  aiStatusText: { fontSize: 12, color: '#475569' },
});
