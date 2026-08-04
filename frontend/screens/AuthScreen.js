import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';

const REGIONS_FALLBACK = [
  'Agadez', 'Diffa', 'Dosso', 'Maradi', 'Niamey', 'Tahoua', 'Tillabéri', 'Zinder',
];

export default function AuthScreen() {
  const [step, setStep] = useState('login'); // login | register | otp | reset
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [regions, setRegions] = useState(REGIONS_FALLBACK.map((name, i) => ({ id: i + 1, name })));
  const [regionId, setRegionId] = useState(null);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('regions').select('id, name').order('name');
      if (!error && data && data.length) setRegions(data);
    })();
  }, []);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      showAlert('Error', 'Please fill all required fields');
      return;
    }
    if (!validateEmail(email)) {
      showAlert('Error', 'Invalid email format');
      return;
    }
    if (password.length < 8) {
      showAlert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: 'farmer',
          region_id: regionId,
          phone,
        },
      },
    });
    setLoading(false);

    if (error) {
      showAlert('Registration failed', error.message);
      return;
    }
    showAlert('Check your email', 'Enter the 6-digit code we sent you to verify your account.');
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      showAlert('Error', 'Enter the 6-digit code');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
    setLoading(false);

    if (error) {
      showAlert('Verification failed', error.message);
      return;
    }
    showAlert('Success', 'Email verified. You can now log in.');
    setStep('login');
  };

  const handleResendOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    showAlert('Code sent', 'A new verification code has been sent to your email.');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes('confirm')) {
        showAlert('Email not verified', 'Please verify your email first.');
        setStep('otp');
      } else {
        showAlert('Login failed', error.message);
      }
    }
    // On success, App.js's onAuthStateChange listener takes over navigation.
  };

  const handleRequestReset = async () => {
    if (!validateEmail(email)) {
      showAlert('Error', 'Enter a valid email first');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    showAlert('Check your email', 'We sent you a password reset link.');
    setStep('login');
  };

  const renderLogin = () => (
    <View style={styles.form}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => setStep('reset')}>
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.switchButton} onPress={() => setStep('register')}>
        <Text style={styles.switchText}>Don't have an account? <Text style={styles.switchHighlight}>Sign Up</Text></Text>
      </TouchableOpacity>
    </View>
  );

  const renderRegister = () => (
    <View style={styles.form}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join to protect your livestock</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.halfInput]} placeholder="First name" value={firstName} onChangeText={setFirstName} />
        <TextInput style={[styles.input, styles.halfInput]} placeholder="Last name" value={lastName} onChangeText={setLastName} />
      </View>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={regionId} onValueChange={setRegionId}>
          <Picker.Item label="Select your region..." value={null} />
          {regions.map((r) => <Picker.Item key={r.id} label={r.name} value={r.id} />)}
        </Picker>
      </View>
      <TextInput style={styles.input} placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.switchButton} onPress={() => setStep('login')}>
        <Text style={styles.switchText}>Already have an account? <Text style={styles.switchHighlight}>Login</Text></Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtp = () => (
    <View style={styles.form}>
      <Text style={styles.title}>Verify Email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
      <TextInput style={styles.input} placeholder="6-digit code" value={otp} onChangeText={setOtp} keyboardType="numeric" maxLength={6} />
      <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={handleResendOtp} disabled={loading}>
        <Text style={styles.linkText}>Didn't get a code? Resend</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.switchButton} onPress={() => setStep('login')}>
        <Text style={styles.switchText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReset = () => (
    <View style={styles.form}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TouchableOpacity style={styles.button} onPress={handleRequestReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.switchButton} onPress={() => setStep('login')}>
        <Text style={styles.switchText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🐄</Text>
          <Text style={styles.appName}>Livestock AI</Text>
        </View>
        {step === 'login' && renderLogin()}
        {step === 'register' && renderRegister()}
        {step === 'otp' && renderOtp()}
        {step === 'reset' && renderReset()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 56 },
  appName: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', marginTop: 6 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#7f8c8d', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 14, backgroundColor: '#fafafa' },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 14, backgroundColor: '#fafafa' },
  button: { backgroundColor: '#27ae60', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkButton: { alignItems: 'center', marginTop: 12 },
  linkText: { color: '#3498db', fontSize: 14 },
  switchButton: { alignItems: 'center', marginTop: 18 },
  switchText: { color: '#7f8c8d', fontSize: 14 },
  switchHighlight: { color: '#27ae60', fontWeight: 'bold' },
});
