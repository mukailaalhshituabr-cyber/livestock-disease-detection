import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';

const SPECIES = ['goat', 'sheep', 'camel', 'cow'];

export default function FarmScreen() {
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState([]);
  const [animalsByFarm, setAnimalsByFarm] = useState({});

  const [showFarmModal, setShowFarmModal] = useState(false);
  const [farmName, setFarmName] = useState('');

  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [activeFarmId, setActiveFarmId] = useState(null);
  const [tagId, setTagId] = useState('');
  const [species, setSpecies] = useState(SPECIES[0]);
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState('female');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: farmsData, error: farmsError } = await supabase
      .from('farms')
      .select('id, farm_name, region_id, regions(name)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (farmsError) {
      showAlert('Error loading farms', farmsError.message);
      setLoading(false);
      return;
    }
    setFarms(farmsData || []);

    const grouped = {};
    for (const farm of farmsData || []) {
      const { data: animals } = await supabase
        .from('animals')
        .select('id, tag_id, species, breed, sex')
        .eq('farm_id', farm.id)
        .order('created_at', { ascending: false });
      grouped[farm.id] = animals || [];
    }
    setAnimalsByFarm(grouped);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddFarm = async () => {
    if (!farmName.trim()) {
      showAlert('Error', 'Enter a farm name');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('farms').insert({
      owner_id: user.id,
      farm_name: farmName.trim(),
    });
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    setFarmName('');
    setShowFarmModal(false);
    loadData();
  };

  const openAddAnimal = (farmId) => {
    setActiveFarmId(farmId);
    setTagId('');
    setBreed('');
    setSpecies(SPECIES[0]);
    setSex('female');
    setShowAnimalModal(true);
  };

  const handleAddAnimal = async () => {
    if (!tagId.trim()) {
      showAlert('Error', 'Enter a tag ID for the animal');
      return;
    }
    const { error } = await supabase.from('animals').insert({
      farm_id: activeFarmId,
      tag_id: tagId.trim(),
      species,
      breed: breed.trim() || null,
      sex,
    });
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    setShowAnimalModal(false);
    loadData();
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
      <FlatList
        data={farms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addFarmButton} onPress={() => setShowFarmModal(true)}>
            <Text style={styles.addFarmButtonText}>+ Add New Farm</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No farms yet. Add your first farm above.</Text>
        }
        renderItem={({ item: farm }) => (
          <View style={styles.farmCard}>
            <View style={styles.farmHeader}>
              <Text style={styles.farmName}>{farm.farm_name}</Text>
              {farm.regions?.name ? <Text style={styles.farmRegion}>{farm.regions.name}</Text> : null}
            </View>

            {(animalsByFarm[farm.id] || []).map((animal) => (
              <View key={animal.id} style={styles.animalRow}>
                <Text style={styles.animalTag}>#{animal.tag_id}</Text>
                <Text style={styles.animalSpecies}>{animal.species} · {animal.sex}{animal.breed ? ` · ${animal.breed}` : ''}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.addAnimalButton} onPress={() => openAddAnimal(farm.id)}>
              <Text style={styles.addAnimalButtonText}>+ Add Animal</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Add Farm Modal */}
      <Modal visible={showFarmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Farm</Text>
            <TextInput style={styles.input} placeholder="Farm name" value={farmName} onChangeText={setFarmName} />
            <TouchableOpacity style={styles.button} onPress={handleAddFarm}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowFarmModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Animal Modal */}
      <Modal visible={showAnimalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Animal</Text>
            <TextInput style={styles.input} placeholder="Tag ID (e.g. G-014)" value={tagId} onChangeText={setTagId} />
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={species} onValueChange={setSpecies}>
                {SPECIES.map((s) => <Picker.Item key={s} label={s} value={s} />)}
              </Picker>
            </View>
            <TextInput style={styles.input} placeholder="Breed (optional)" value={breed} onChangeText={setBreed} />
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={sex} onValueChange={setSex}>
                <Picker.Item label="Female" value="female" />
                <Picker.Item label="Male" value="male" />
              </Picker>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleAddAnimal}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAnimalModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addFarmButton: { backgroundColor: '#27ae60', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 16 },
  addFarmButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyText: { textAlign: 'center', color: '#95a5a6', marginTop: 30 },
  farmCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  farmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  farmName: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  farmRegion: { fontSize: 13, color: '#7f8c8d' },
  animalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  animalTag: { fontWeight: '600', color: '#34495e' },
  animalSpecies: { color: '#7f8c8d', textTransform: 'capitalize' },
  addAnimalButton: { marginTop: 10, alignSelf: 'flex-start' },
  addAnimalButtonText: { color: '#3498db', fontWeight: '600' },
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
