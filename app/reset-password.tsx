import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (loading) return;

    if (!password || !confirmPassword) {
      Alert.alert(
        'Missing Information',
        'Please enter and confirm your new password.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Password Too Short',
        'Your new password must contain at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both password fields match.'
      );
      return;
    }

    setLoading(true);

    try {
      // Confirm that the password-reset link established
      // an authenticated Supabase session.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        Alert.alert(
          'Reset Link Required',
          'Please request a new password-reset email and open its link before setting a new password.',
          [
            {
              text: 'Return to Login',
              onPress: () => router.replace('/student-login'),
            },
          ]
        );
        return;
      }

      // Save the new password.
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      // End the recovery session so the student can sign in
      // normally using the new password.
      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Password Changed',
        'Your password has been changed successfully. Please sign in using your new password.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/student-login'),
          },
        ]
      );
    } catch (error) {
      console.error('Password reset error:', error);

      Alert.alert(
        'Password Reset Failed',
        error instanceof Error
          ? error.message
          : 'Unable to change your password. Please request a new reset link and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>C</Text>
          </View>

          <Text style={styles.title}>Reset Your Password</Text>

          <Text style={styles.subtitle}>
            Choose a new password for your CalebConnect account.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>New Password</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your new password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>Confirm New Password</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter the new password again"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                styles.button,
                loading && styles.disabledButton,
              ]}
              onPress={handleUpdatePassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  Change Password
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/student-login')}
              disabled={loading}
            >
              <Text style={styles.backText}>
                Return to Student Login
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            CalebConnect · Student Portal
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  keyboard: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 40,
  },

  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 22,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
  },

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
  },

  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    paddingHorizontal: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    fontSize: 14,
    marginBottom: 20,
  },

  button: {
    minHeight: 55,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 5,
  },

  disabledButton: {
    opacity: 0.65,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  backButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 10,
  },

  backText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },

  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 30,
  },
});