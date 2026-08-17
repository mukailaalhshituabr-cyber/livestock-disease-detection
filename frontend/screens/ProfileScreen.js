import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Modal, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import { showAlert, showConfirm } from '../lib/alert';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [regions, setRegions] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [regionId, setRegionId] = useState(null);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, role, phone, region_id, regions(name)')
      .eq('id', user.id)
      .single();
    setProfile({ ...data, email: user.email });
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
    (async () => {
      const { data } = await supabase.from('regions').select('id, name').order('name');
      if (data) setRegions(data);
    })();
  }, []);

  const openEdit = () => {
    setFirstName(profile?.first_name || '');
    setLastName(profile?.last_name || '');
    setPhone(profile?.phone || '');
    setRegionId(profile?.region_id ?? null);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert('Error', 'First and last name are required');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        region_id: regionId,
      })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      showAlert('Error', error.message);
      return;
    }
    setShowEditModal(false);
    loadProfile();
  };

  const handleLogout = () => {
    showConfirm('Log Out', 'Are you sure you want to log out?', async () => {
      setLoggingOut(true);
      await supabase.auth.signOut();
      // No need to manually navigate - App.js's onAuthStateChange listener
      // clears the session and switches back to the Auth screen.
    }, 'Log Out');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#27ae60" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.name}>{profile?.first_name} {profile?.last_name}</Text>
            <Text style={styles.email}>{profile?.email}</Text>
          </View>
          <TouchableOpacity onPress={openEdit} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile?.role}</Text>
        </View>
        {profile?.phone ? (
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{profile.phone}</Text>
          </View>
        ) : null}
        {profile?.regions?.name ? (
          <View style={styles.row}>
            <Text style={styles.label}>Region</Text>
            <Text style={styles.value}>{profile.regions.name}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.disabledButton]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.logoutText}>🚪 Log Out</Text>}
      </TouchableOpacity>

      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
            <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} />
            <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={regionId} onValueChange={setRegionId}>
                <Picker.Item label="Select your region..." value={null} />
                {regions.map((r) => <Picker.Item key={r.id} label={r.name} value={r.id} />)}
              </Picker>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowEditModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 24 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconButton: { paddingHorizontal: 8, paddingVertical: 4 },
  iconButtonText: { color: '#3498db', fontWeight: '600' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  email: { fontSize: 14, color: '#7f8c8d', marginTop: 2, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  label: { color: '#7f8c8d' },
  value: { color: '#2c3e50', fontWeight: '600', textTransform: 'capitalize' },
  logoutButton: { backgroundColor: '#e74c3c', borderRadius: 10, padding: 16, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12, backgroundColor: '#fafafa' },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 12, backgroundColor: '#fafafa' },
  button: { backgroundColor: '#27ae60', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { alignItems: 'center', marginTop: 12, marginBottom: 4 },
  cancelText: { color: '#7f8c8d' },
});
