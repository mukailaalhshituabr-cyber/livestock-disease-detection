import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { showConfirm } from '../lib/alert';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, role, phone, regions(name)')
        .eq('id', user.id)
        .single();
      setProfile({ ...data, email: user.email });
      setLoading(false);
    })();
  }, []);

  const handleLogout = () => {
    showConfirm('Log Out', 'Are you sure you want to log out?', async () => {
      setLoggingOut(true);
      await supabase.auth.signOut();
      // No need to manually navigate - App.js's onAuthStateChange listener
      // clears the session and switches back to the Auth screen.
    });
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
        <Text style={styles.name}>{profile?.first_name} {profile?.last_name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 24 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  email: { fontSize: 14, color: '#7f8c8d', marginTop: 2, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  label: { color: '#7f8c8d' },
  value: { color: '#2c3e50', fontWeight: '600', textTransform: 'capitalize' },
  logoutButton: { backgroundColor: '#e74c3c', borderRadius: 10, padding: 16, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
