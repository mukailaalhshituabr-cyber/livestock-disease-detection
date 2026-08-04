import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase, INFERENCE_API_URL } from '../lib/supabase';
import { showAlert } from '../lib/alert';

export default function DetectionScreen() {
  const [animals, setAnimals] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAnimals, setLoadingAnimals] = useState(true);

  const loadAnimals = useCallback(async () => {
    setLoadingAnimals(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('animals')
      .select('id, tag_id, species, farms!inner(owner_id)')
      .eq('farms.owner_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnimals(data);
      if (data.length && !selectedAnimalId) setSelectedAnimalId(data[0].id);
    }
    setLoadingAnimals(false);
  }, [selectedAnimalId]);

  useEffect(() => { loadAnimals(); }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow access to your photos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        setImage(result.assets[0]);
        setResult(null);
      }
    } catch (error) {
      showAlert('Gallery Error', error.message || 'Could not open the photo gallery');
    }
  };

  const takePhoto = async () => {
    try {
      if (Platform.OS === 'web') {
        showAlert(
          'Camera Not Available',
          'Most desktop browsers have no camera capture UI. Use "Gallery" here, or test the camera on a phone via Expo Go.'
        );
        return;
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow access to your camera in your phone\'s Settings for Expo Go');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        setImage(result.assets[0]);
        setResult(null);
      }
    } catch (error) {
      showAlert('Camera Error', error.message || 'Could not open the camera. Make sure your Expo Go app is updated to match this project\'s SDK version.');
    }
  };

  const detectDisease = async () => {
    if (!image) {
      showAlert('Error', 'Please select or take an image first');
      return;
    }
    if (!selectedAnimalId) {
      showAlert('Error', 'Add an animal on the "My Farm" tab first');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      // expo-file-system's readAsStringAsync (used below for native) isn't
      // implemented on web, and web's real FormData/fetch needs an actual
      // Blob rather than the {uri,name,type} object RN's fetch accepts -
      // so on web we read the picked image into a Blob once and reuse it
      // for both the inference upload and the Supabase Storage upload.
      const imageBlob = Platform.OS === 'web' ? await (await fetch(image.uri)).blob() : null;

      // 1. Run inference on the FastAPI model service
      const formData = new FormData();
      if (Platform.OS === 'web') {
        formData.append('file', imageBlob, 'livestock.jpg');
      } else {
        formData.append('file', {
          uri: image.uri,
          name: 'livestock.jpg',
          type: 'image/jpeg',
        });
      }

      const response = await fetch(`${INFERENCE_API_URL}/api/predict`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const inferenceResult = await response.json();
      if (!response.ok) throw new Error(inferenceResult.detail || 'Prediction failed');

      const prediction = inferenceResult.prediction;

      // If the animal-detection gate rejected the photo, there's no disease
      // to look up or save - just show the rejection message and stop here.
      if (prediction.is_animal === false) {
        setResult(prediction);
        return;
      }

      // 2. Upload the image to Supabase Storage
      const filePath = `${session.user.id}/${Date.now()}.jpg`;
      let uploadError;
      if (Platform.OS === 'web') {
        ({ error: uploadError } = await supabase.storage
          .from('livestock-images')
          .upload(filePath, imageBlob, { contentType: 'image/jpeg' }));
      } else {
        const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
        ({ error: uploadError } = await supabase.storage
          .from('livestock-images')
          .upload(filePath, decode(base64), { contentType: 'image/jpeg' }));
      }
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('livestock-images').getPublicUrl(filePath);
      const imageUrl = publicUrlData.publicUrl;

      // 3. Look up the disease's ID (predictions table stores a foreign key, not free text)
      const { data: diseaseRow, error: diseaseError } = await supabase
        .from('diseases')
        .select('id')
        .eq('name', prediction.disease)
        .single();
      if (diseaseError) throw diseaseError;

      // 4. Save the prediction record
      const { error: insertError } = await supabase.from('predictions').insert({
        animal_id: selectedAnimalId,
        user_id: session.user.id,
        image_url: imageUrl,
        predicted_disease_id: diseaseRow.id,
        confidence: prediction.confidence,
        all_probabilities: prediction.all_probabilities,
      });
      if (insertError) throw insertError;

      setResult(prediction);
    } catch (error) {
      showAlert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#27ae60';
    if (confidence >= 0.6) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Disease Detection</Text>
        <Text style={styles.subtitle}>Select an animal and upload a photo for AI diagnosis</Text>
      </View>

      {loadingAnimals ? (
        <ActivityIndicator color="#27ae60" />
      ) : animals.length === 0 ? (
        <Text style={styles.emptyText}>No animals registered yet. Add one in "My Farm".</Text>
      ) : (
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={selectedAnimalId} onValueChange={setSelectedAnimalId}>
            {animals.map((a) => (
              <Picker.Item key={a.id} label={`#${a.tag_id} (${a.species})`} value={a.id} />
            ))}
          </Picker>
        </View>
      )}

      <View style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🐄</Text>
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto}>
          <Text style={styles.buttonText}>📸 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={pickImage}>
          <Text style={styles.buttonText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.detectButton, (!image || loading) && styles.disabledButton]}
        onPress={detectDisease}
        disabled={!image || loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.detectText}>🔍 Detect Disease</Text>}
      </TouchableOpacity>

      {result && result.is_animal === false && (
        <View style={styles.mockWarning}>
          <Text style={styles.mockWarningTitle}>🚫 No animal detected</Text>
          <Text style={styles.mockWarningText}>{result.recommendation}</Text>
        </View>
      )}

      {result && result.is_animal !== false && result.uncertain && (
        <View style={styles.mockWarning}>
          <Text style={styles.mockWarningTitle}>⚠️ Uncertain result</Text>
          <Text style={styles.mockWarningText}>{result.recommendation}</Text>
        </View>
      )}

      {result && result.mock && (
        <View style={styles.mockWarning}>
          <Text style={styles.mockWarningTitle}>⚠️ Not a real diagnosis</Text>
          <Text style={styles.mockWarningText}>
            No trained AI model is connected yet - the backend is returning a
            random placeholder result so the app can be demoed while the real
            model is being built. Do not use this output to make any decision
            about an animal's health. Consult a veterinarian for anything you
            suspect is wrong.
          </Text>
        </View>
      )}

      {result && !result.mock && result.is_animal !== false && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Detection Results</Text>
          <View style={styles.resultCard}>
            <Text style={styles.resultDisease}>{result.disease}</Text>
            <View style={styles.confidenceBar}>
              <View style={[styles.confidenceFill, { width: `${result.confidence * 100}%`, backgroundColor: getConfidenceColor(result.confidence) }]} />
            </View>
            <Text style={styles.confidenceText}>Confidence: {(result.confidence * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.recommendationCard}>
            <Text style={styles.recommendationTitle}>📋 Recommendation</Text>
            <Text style={styles.recommendationText}>{result.recommendation}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 20 },
  header: { paddingVertical: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 13, color: '#7f8c8d', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#95a5a6', marginBottom: 16 },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 16, backgroundColor: '#fff' },
  imageContainer: { backgroundColor: '#fff', borderRadius: 12, height: 260, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  image: { width: '100%', height: '100%', borderRadius: 12, resizeMode: 'contain' },
  placeholder: { alignItems: 'center' },
  placeholderIcon: { fontSize: 56 },
  placeholderText: { color: '#95a5a6', marginTop: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  button: { flex: 0.48, padding: 14, borderRadius: 10, alignItems: 'center' },
  cameraButton: { backgroundColor: '#3498db' },
  galleryButton: { backgroundColor: '#9b59b6' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  detectButton: { backgroundColor: '#27ae60', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  disabledButton: { opacity: 0.5 },
  detectText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  mockWarning: { backgroundColor: '#fdecea', borderRadius: 12, padding: 16, marginBottom: 30, borderLeftWidth: 4, borderLeftColor: '#e74c3c' },
  mockWarningTitle: { fontSize: 15, fontWeight: 'bold', color: '#c0392b', marginBottom: 6 },
  mockWarningText: { fontSize: 13, color: '#7f2315', lineHeight: 19 },
  resultContainer: { marginBottom: 30 },
  resultTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 12 },
  resultCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  resultDisease: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 8 },
  confidenceBar: { height: 8, backgroundColor: '#ecf0f1', borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  confidenceFill: { height: '100%', borderRadius: 4 },
  confidenceText: { fontSize: 15, color: '#7f8c8d' },
  recommendationCard: { backgroundColor: '#fff8e1', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#f39c12' },
  recommendationTitle: { fontSize: 15, fontWeight: 'bold', color: '#2c3e50' },
  recommendationText: { fontSize: 14, color: '#34495e', marginTop: 4 },
});
