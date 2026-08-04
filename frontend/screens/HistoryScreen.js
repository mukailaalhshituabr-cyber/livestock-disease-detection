import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function HistoryScreen() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPredictions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('predictions')
      .select(`
        id, image_url, confidence, created_at,
        diseases (name, severity, recommended_action),
        animals (tag_id, species),
        vet_reviews (agrees_with_ai, notes, confirmed_disease_id, veterinarian_id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setPredictions(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadPredictions(); }, [loadPredictions]));

  const onRefresh = () => {
    setRefreshing(true);
    loadPredictions();
  };

  const severityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#c0392b';
      case 'high': return '#e74c3c';
      case 'medium': return '#f39c12';
      default: return '#27ae60';
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#27ae60" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={predictions}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No detections yet.</Text>}
      renderItem={({ item }) => {
        const review = item.vet_reviews?.[0];
        return (
          <View style={styles.card}>
            <Image source={{ uri: item.image_url }} style={styles.image} />
            <View style={styles.info}>
              <Text style={styles.animal}>#{item.animals?.tag_id} · {item.animals?.species}</Text>
              <Text style={[styles.disease, { color: severityColor(item.diseases?.severity) }]}>
                {item.diseases?.name}
              </Text>
              <Text style={styles.confidence}>Confidence: {(item.confidence * 100).toFixed(0)}%</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              {review ? (
                <View style={styles.reviewBadge}>
                  <Text style={styles.reviewText}>
                    {review.agrees_with_ai ? '✅ Vet confirmed' : '⚠️ Vet corrected diagnosis'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>Awaiting veterinarian review</Text>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#95a5a6', marginTop: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  image: { width: 100, height: 100 },
  info: { flex: 1, padding: 12 },
  animal: { fontSize: 13, color: '#7f8c8d', textTransform: 'capitalize' },
  disease: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  confidence: { fontSize: 13, color: '#34495e', marginTop: 2 },
  date: { fontSize: 12, color: '#95a5a6', marginTop: 2 },
  reviewBadge: { marginTop: 6 },
  reviewText: { fontSize: 12, fontWeight: '600', color: '#2c3e50' },
  pendingText: { fontSize: 12, color: '#f39c12', marginTop: 6, fontStyle: 'italic' },
});
