import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// These are the client-safe credentials already present in the supplied Omosis website.
// Never replace the publishable key with a service-role key.
export const SUPABASE_URL = 'https://hupemzioubescjzpvuum.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ec814JH4dF0RWi_tISeLrg_TNedc4Px';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
