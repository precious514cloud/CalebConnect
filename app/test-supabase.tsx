import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function TestSupabase() {
  const [status, setStatus] = useState('Testing Supabase connection...');

  useEffect(() => {
    const testConnection = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        setStatus(`❌ Connection failed: ${error.message}`);
      } else {
        setStatus('✅ Supabase connection is working!');
      }
    };

    testConnection();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <ActivityIndicator size="large" />

      <Text
        style={{
          marginTop: 20,
          fontSize: 20,
          textAlign: 'center',
        }}
      >
        {status}
      </Text>
    </View>
  );
}