import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Get these from Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://sczltdmskktonghpbyzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Lc8CbMf9KuwsBsJfaa5K8w_1ertMyAf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Base URL of your FastAPI inference service (the one that runs the CNN).
// On web, the page already knows what host it was loaded from, so reuse
// that instead of a hardcoded IP that breaks every time the computer
// reconnects to WiFi and gets a new DHCP lease.
// On native (phone/emulator), there's no page origin to read, so this
// still needs your computer's current LAN IP -- check `ipconfig` (Windows)
// / `ifconfig` (Mac/Linux) if detection stops reaching the backend there.
const NATIVE_INFERENCE_HOST = 'http://40.41.5.180:8000';

export const INFERENCE_API_URL =
  Platform.OS === 'web' ? `http://${window.location.hostname}:8000` : NATIVE_INFERENCE_HOST;
