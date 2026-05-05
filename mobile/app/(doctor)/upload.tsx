import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function UploadScreen() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedFile({ uri: asset.uri, name: asset.fileName ?? 'record.jpg', type: asset.mimeType ?? 'image/jpeg' });
      setUploaded(false);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to scan documents.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedFile({ uri: asset.uri, name: `scan_${Date.now()}.jpg`, type: 'image/jpeg' });
      setUploaded(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' });
      setUploaded(false);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);
    try {
      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();
      const path = `${user.id}/${Date.now()}_${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-records')
        .upload(path, blob, { contentType: selectedFile.type });

      if (uploadError) throw uploadError;

      await supabase.from('medical_records').insert({
        user_id: user.id,
        file_name: selectedFile.name,
        file_path: path,
        file_type: selectedFile.type,
        uploaded_at: new Date().toISOString(),
      });

      setUploaded(true);
      Alert.alert('Success!', 'Medical record uploaded successfully.');
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="cloud-upload" size={24} color="#8b5cf6" />
          <Text style={styles.title}>Upload Medical Record</Text>
        </View>
        <Text style={styles.subtitle}>Upload lab reports, prescriptions, or scans</Text>

        {/* Pick Options */}
        <View style={styles.optionsGrid}>
          {[
            { label: 'Camera Scan', icon: 'camera-outline', action: pickFromCamera, color: '#3b82f6' },
            { label: 'Gallery', icon: 'images-outline', action: pickFromGallery, color: '#8b5cf6' },
            { label: 'Document', icon: 'document-outline', action: pickDocument, color: '#10b981' },
          ].map((opt) => (
            <TouchableOpacity key={opt.label} onPress={opt.action} style={styles.optionCard}>
              <LinearGradient colors={[opt.color + '33', opt.color + '11']} style={styles.optionGradient}>
                <Ionicons name={opt.icon as any} size={30} color={opt.color} />
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected File Preview */}
        {selectedFile && (
          <View style={styles.previewCard}>
            {selectedFile.type.startsWith('image/') ? (
              <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.docPreview}>
                <Ionicons name="document-text" size={48} color="#8b5cf6" />
              </View>
            )}
            <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>

            {uploaded ? (
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.successText}>Uploaded Successfully!</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={uploadFile} disabled={uploading} style={styles.uploadBtnWrap}>
                <LinearGradient colors={['#8b5cf6', '#3b82f6']} style={styles.uploadBtn}>
                  {uploading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                        <Text style={styles.uploadBtnText}>Upload Record</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" />
          <Text style={styles.infoText}>Files are securely stored and encrypted. Only authorized users can access them.</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  content: { padding: 24, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  optionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  optionCard: { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  optionGradient: { padding: 16, alignItems: 'center', gap: 8 },
  optionLabel: { fontSize: 11, color: '#e2e8f0', fontWeight: '600' },
  previewCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  previewImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 12 },
  docPreview: { height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', borderRadius: 10, marginBottom: 12 },
  fileName: { fontSize: 13, color: '#94a3b8', marginBottom: 14, textAlign: 'center' },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  successText: { color: '#10b981', fontWeight: '600' },
  uploadBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#1e293b', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  infoText: { fontSize: 12, color: '#64748b', flex: 1, lineHeight: 18 },
});
