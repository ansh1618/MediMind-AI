import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface StatsCard { label: string; value: string; icon: string; color: string }

export default function DoctorDashboard() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({ patients: 0, records: 0, diagnoses: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const [{ count: patients }, { count: records }] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ patients: patients ?? 0, records: records ?? 0, diagnoses: 0 });
    } catch {}
  };

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const statsCards: StatsCard[] = [
    { label: 'Total Patients', value: String(stats.patients), icon: 'people-outline', color: '#3b82f6' },
    { label: 'Medical Records', value: String(stats.records), icon: 'document-text-outline', color: '#8b5cf6' },
    { label: 'AI Diagnoses', value: String(stats.diagnoses), icon: 'analytics-outline', color: '#10b981' },
  ];

  const quickActions = [
    { label: 'AI Diagnosis', icon: 'medical-outline', color: '#3b82f6', route: '/(doctor)/diagnosis' },
    { label: 'Upload Record', icon: 'cloud-upload-outline', color: '#8b5cf6', route: '/(doctor)/upload' },
    { label: 'AI Chat', icon: 'chatbubble-outline', color: '#10b981', route: '/(doctor)/chat' },
  ];

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning, Doctor 👋</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Role Badge */}
        <View style={styles.badge}>
          <Ionicons name="medical" size={14} color="#60a5fa" />
          <Text style={styles.badgeText}>Doctor Portal · MediMind AI</Text>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {statsCards.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={28} color={s.color} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => router.push(a.route as any)}>
              <LinearGradient colors={[a.color + '33', a.color + '11']} style={styles.actionGradient}>
                <Ionicons name={a.icon as any} size={28} color={a.color} />
                <Text style={styles.actionLabel}>{a.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
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
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#f1f5f9' },
  email: { fontSize: 12, color: '#64748b', marginTop: 2, maxWidth: 240 },
  logoutBtn: { padding: 8, backgroundColor: '#ef444420', borderRadius: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 24, marginBottom: 24, backgroundColor: '#1e3a5f', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, color: '#60a5fa', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e2e8f0', marginHorizontal: 24, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 24, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#f1f5f9', marginTop: 8 },
  statLabel: { fontSize: 10, color: '#64748b', marginTop: 2, textAlign: 'center' },
  actionsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 24, marginBottom: 28 },
  actionCard: { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  actionGradient: { padding: 14, alignItems: 'center', gap: 8 },
  actionLabel: { fontSize: 11, color: '#e2e8f0', fontWeight: '600', textAlign: 'center' },
  aiStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 32 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  aiStatusText: { fontSize: 12, color: '#475569' },
});
