import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const [message, setMessage] = useState(
    'Verifying your request...'
  );

  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const handleCallback = async () => {
      try {
        // Read the complete URL that opened this screen.
        const initialUrl = await Linking.getInitialURL();

        let url = initialUrl;

        // If the initial URL is unavailable, inspect the current
        // route parameters through the URL provided by Expo Router.
        if (!url) {
          url = Linking.createURL('/auth-callback');
        }

        if (initialUrl) {
          const parsedUrl = Linking.parse(initialUrl);
          const queryParams = parsedUrl.queryParams ?? {};

          const getParam = (
            value: unknown
          ): string | undefined => {
            if (typeof value === 'string') return value;

            if (
              Array.isArray(value) &&
              typeof value[0] === 'string'
            ) {
              return value[0];
            }

            return undefined;
          };

          const authError = getParam(queryParams.error);
          const errorDescription = getParam(
            queryParams.error_description
          );

          if (authError || errorDescription) {
            throw new Error(
              errorDescription ||
                authError ||
                'Authentication failed.'
            );
          }

          // Supabase PKCE flow.
          const code = getParam(queryParams.code);

          if (code) {
            const { error } =
              await supabase.auth.exchangeCodeForSession(code);

            if (error) throw error;
          }

          // Supabase recovery links can also return tokens in
          // the URL fragment rather than the query string.
          const fragment = initialUrl.includes('#')
            ? initialUrl.split('#').slice(1).join('#')
            : '';

          const fragmentParams = new URLSearchParams(fragment);

          const accessToken =
            fragmentParams.get('access_token');

          const refreshToken =
            fragmentParams.get('refresh_token');

          const fragmentType =
            fragmentParams.get('type');

          if (
            accessToken &&
            refreshToken
          ) {
            const { error } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

            if (error) throw error;
          }

          const recoveryRequested =
            getParam(queryParams.type) === 'recovery' ||
            fragmentType === 'recovery';

          // Confirm that Supabase has established a session.
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) throw sessionError;

          if (!session?.user) {
            throw new Error(
              'This link did not establish a valid session. Please request a new password-reset email and try again.'
            );
          }

          // PASSWORD RECOVERY
          if (recoveryRequested) {
            setMessage('Opening the password reset screen...');

            router.replace('/reset-password');
            return;
          }

          // EMAIL CONFIRMATION
          const { data: profile, error: profileError } =
            await supabase
              .from('profiles')
              .select(
                'id, role, full_name, student_id, department, level'
              )
              .eq('id', session.user.id)
              .maybeSingle();

          if (profileError) throw profileError;

          if (profile && profile.role !== 'student') {
            await supabase.auth.signOut();

            throw new Error(
              'This account is not registered as a student. Please use the correct portal.'
            );
          }

          const profileIsComplete = Boolean(
            profile &&
              typeof profile.full_name === 'string' &&
              profile.full_name.trim().length > 0 &&
              typeof profile.student_id === 'string' &&
              profile.student_id.trim().length > 0 &&
              typeof profile.department === 'string' &&
              profile.department.trim().length > 0 &&
              profile.level !== null &&
              profile.level !== undefined &&
              String(profile.level).trim().length > 0
          );

          setMessage(
            'Email verified. Opening CalebConnect...'
          );

          router.replace(
            profileIsComplete
              ? '/(tabs)'
              : '/student-setup'
          );

          return;
        }

        // The app screen opened without an incoming authentication URL.
        // Do not accidentally treat an existing session as a recovery.
        throw new Error(
          'No authentication link was received. Open the latest link from your Supabase email.'
        );
      } catch (error) {
        console.error(
          'Authentication callback error:',
          error
        );

        setFailed(true);

        setMessage(
          error instanceof Error
            ? error.message
            : 'We could not complete this request. Please return to Student Login and try again.'
        );
      }
    };

    void handleCallback();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {!failed && (
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
        )}

        <Text style={styles.title}>
          {failed ? 'Request Incomplete' : 'CalebConnect'}
        </Text>

        <Text style={styles.message}>{message}</Text>

        {failed && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/student-login')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              Return to Student Login
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginTop: 22,
    textAlign: 'center',
  },

  message: {
    fontSize: 15,
    lineHeight: 23,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 12,
  },

  button: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});