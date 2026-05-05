import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

type Role = 'doctor' | 'patient';

export default function LoginScreen() {
  const [activeRole, setActiveRole] = useState<Role>('doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role: activeRole } },
        });
        if (error) throw error;

        if (data.session) {
          await syncRole(data.session.user.id, activeRole);
          redirectByRole(activeRole);
          return;
        }

        // Try signing in immediately
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError && signInData.session) {
          await syncRole(signInData.session.user.id, activeRole);
          redirectByRole(activeRole);
          return;
        }

        Alert.alert('Check Your Email', 'A confirmation link was sent to your inbox. Click it then sign in.');
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            Alert.alert('Email Not Confirmed', 'Please check your inbox and click the confirmation link first.');
          } else {
            Alert.alert('Login Failed', 'Wrong email or password. Please try again.');
          }
          return;
        }
        if (data.session) {
          await syncRole(data.session.user.id, activeRole);
          redirectByRole(activeRole);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const syncRole = async (userId: string, role: Role) => {
    await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id' });
  };

  const redirectByRole = (role: Role) => {
    if (role === 'doctor') {
      router.replace('/(doctor)/dashboard');
    } else {
      router.replace('/(patient)/dashboard');
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={styles.logoBox}>
              <Text style={styles.logoText}>M</Text>
            </LinearGradient>
            <Text style={styles.appName}>MediMind AI</Text>
            <Text style={styles.tagline}>Predictive Clinical Intelligence</Text>
          </View>

          {/* Role Selector */}
          <Text style={styles.sectionLabel}>Select your role</Text>
          <View style={styles.roleRow}>
            {(['doctor', 'patient'] as Role[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, activeRole === r && styles.roleBtnActive]}
                onPress={() => setActiveRole(r)}
              >
                <Text style={styles.roleEmoji}>{r === 'doctor' ? '🩺' : '👤'}</Text>
                <Text style={[styles.roleLabel, activeRole === r && styles.roleLabelActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 chars)"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAuth}
              disabled={loading}
            >
              <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={styles.submitGradient}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitText}>
                      {isSignUp ? `Create ${activeRole === 'doctor' ? 'Doctor' : 'Patient'} Account` : `Sign In as ${activeRole === 'doctor' ? 'Doctor' : 'Patient'}`}
                    </Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleBtn}>
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoBox: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 4 },
  tagline: { fontSize: 13, color: '#64748b' },
  sectionLabel: { fontSize: 13, color: '#94a3b8', marginBottom: 10, textAlign: 'center' },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#334155', backgroundColor: '#1e293b',
  },
  roleBtnActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a5f' },
  roleEmoji: { fontSize: 24, marginBottom: 4 },
  roleLabel: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  roleLabelActive: { color: '#60a5fa' },
  card: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: '#334155',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 20, textAlign: 'center' },
  input: {
    backgroundColor: '#0f172a', borderRadius: 12, padding: 14,
    color: '#f1f5f9', fontSize: 15, marginBottom: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  submitBtn: { marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  submitGradient: { padding: 15, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  toggleBtn: { marginTop: 16, alignItems: 'center' },
  toggleText: { fontSize: 13, color: '#64748b' },
  toggleLink: { color: '#60a5fa', fontWeight: '600' },
});
