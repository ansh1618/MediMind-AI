import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface PatientRecord {
  id: string;
  created_at: string;
  patient_name: string;
  age: number;
  gender: string;
  chief_complaint: string;
  diagnoses: string[];
  medications: string[];
  vitals: Record<string, string>;
  lab_values: Record<string, { value: string; status: string }>;
  risk_scores: Record<string, { score: number; level: string }>;
  simplifiedExplanation?: string;
}

const riskColor = (level: string) => {
  const l = level?.toUpperCase();
  if (l === 'CRITICAL') return '#ef4444';
  if (l === 'HIGH') return '#f97316';
  if (l === 'MODERATE') return '#f59e0b';
  return '#10b981';
};

export default function PatientReports() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRecords = async () => {
    if (!user?.email) return;
    try {
      const { data } = await supabase
        .from('patient_records')
        .select('*')
        .eq('patient_email', user.email.toLowerCase())
        .order('created_at', { ascending: false });
      setRecords(data as PatientRecord[] ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, [user?.email]);

  const onRefresh = async () => { setRefreshing(true); await fetchRecords(); setRefreshing(false); };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient colors={['#10b981', '#3b82f6']} style={styles.iconWrap}>
            <Ionicons name="document-text" size={20} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.title}>My Reports</Text>
            <Text style={styles.subtitle}>Records shared by your doctor</Text>
          </View>
          {records.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{records.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#10b981" style={{ marginTop: 40 }} />
        ) : records.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={56} color="#334155" />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>When your doctor uploads and links a report to your email, it will appear here.</Text>
          </View>
        ) : (
          records.map(rec => {
            const isOpen = expanded === rec.id;
            const topRisk = Object.entries(rec.risk_scores ?? {})
              .sort((a, b) => ((b[1] as any)?.score ?? 0) - ((a[1] as any)?.score ?? 0))[0];
            return (
              <View key={rec.id} style={styles.recordCard}>
                {/* Card Header */}
                <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(isOpen ? null : rec.id)}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="flask" size={20} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{rec.patient_name}</Text>
                    <Text style={styles.cardMeta}>
                      {rec.age ? `${rec.age}y · ` : ''}{rec.gender}
                      {rec.chief_complaint ? ` · ${rec.chief_complaint}`.slice(0, 35) + '...' : ''}
                    </Text>
                    {rec.diagnoses?.length > 0 && (
                      <View style={styles.tagRow}>
                        {rec.diagnoses.slice(0, 2).map((d, i) => (
                          <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{d}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.cardRight}>
                    {topRisk && (
                      <Text style={[styles.riskBadge, { color: riskColor((topRisk[1] as any)?.level ?? '') }]}>
                        {(topRisk[1] as any)?.level}
                      </Text>
                    )}
                    <Text style={styles.dateText}>
                      {new Date(rec.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#475569" />
                  </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isOpen && (
                  <View style={styles.expandSection}>

                    {/* Risk Scores */}
                    {rec.risk_scores && Object.keys(rec.risk_scores).length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>AI Risk Assessment</Text>
                        <View style={styles.riskGrid}>
                          {Object.entries(rec.risk_scores).map(([key, val]: [string, any]) => (
                            <View key={key} style={styles.riskCard}>
                              <Text style={styles.riskKey}>{key}</Text>
                              <Text style={[styles.riskScore, { color: riskColor(val.level) }]}>{val.score}%</Text>
                              <Text style={[styles.riskLevel, { color: riskColor(val.level) }]}>{val.level}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Vitals */}
                    {rec.vitals && Object.keys(rec.vitals).length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Vitals</Text>
                        <View style={styles.vitalsGrid}>
                          {Object.entries(rec.vitals).map(([k, v]) => (
                            <View key={k} style={styles.vitalItem}>
                              <Text style={styles.vitalKey}>{k}</Text>
                              <Text style={styles.vitalVal}>{v as string}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Lab Values */}
                    {rec.lab_values && Object.keys(rec.lab_values).length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Lab Results</Text>
                        {Object.entries(rec.lab_values).map(([name, lab]: [string, any]) => (
                          <View key={name} style={styles.labRow}>
                            <Text style={styles.labName}>{name}</Text>
                            <View style={[styles.labBadge, {
                              backgroundColor: lab.status === 'High' || lab.status === 'Critical' ? '#ef444420' :
                                lab.status === 'Low' ? '#f9731620' : '#10b98120',
                            }]}>
                              <Text style={[styles.labVal, {
                                color: lab.status === 'High' || lab.status === 'Critical' ? '#ef4444' :
                                  lab.status === 'Low' ? '#f97316' : '#10b981',
                              }]}>{lab.value}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Medications */}
                    {rec.medications?.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Medications</Text>
                        <View style={styles.tagRow}>
                          {rec.medications.map((m, i) => (
                            <View key={i} style={styles.medTag}>
                              <Ionicons name="medical" size={10} color="#8b5cf6" />
                              <Text style={styles.medTagText}>{m}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
  countBadge: { marginLeft: 'auto', backgroundColor: '#10b98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { color: '#10b981', fontWeight: '700', fontSize: 14 },

  emptyBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 40, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#334155' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#475569' },
  emptyText: { fontSize: 13, color: '#334155', textAlign: 'center', lineHeight: 20 },

  recordCard: { backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  cardIcon: { width: 38, height: 38, backgroundColor: '#10b98115', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  cardMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  tag: { backgroundColor: '#10b98115', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, color: '#34d399' },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  riskBadge: { fontSize: 11, fontWeight: '800' },
  dateText: { fontSize: 10, color: '#475569' },

  expandSection: { borderTopWidth: 1, borderTopColor: '#334155', padding: 14, gap: 16 },
  section: {},
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  riskGrid: { flexDirection: 'row', gap: 8 },
  riskCard: { flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 10, alignItems: 'center' },
  riskKey: { fontSize: 10, color: '#64748b', textTransform: 'capitalize', marginBottom: 4 },
  riskScore: { fontSize: 20, fontWeight: '800' },
  riskLevel: { fontSize: 9, fontWeight: '700', marginTop: 2 },

  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalItem: { backgroundColor: '#0f172a', borderRadius: 10, padding: 10, minWidth: '30%' },
  vitalKey: { fontSize: 10, color: '#64748b' },
  vitalVal: { fontSize: 14, fontWeight: '700', color: '#f1f5f9', marginTop: 2 },

  labRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  labName: { fontSize: 13, color: '#94a3b8', flex: 1 },
  labBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  labVal: { fontSize: 13, fontWeight: '700' },

  medTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#8b5cf615', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#8b5cf630' },
  medTagText: { fontSize: 12, color: '#a78bfa' },
});
