import { router, Slot, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const pathname = usePathname();

  const [checkingSession, setCheckingSession] = useState(true);

  const hasCheckedInitialSession = useRef(false);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Session restoration error:', error);
          return;
        }

        if (!mounted) return;

        // Only redirect from the app's general entry screen
        // or student login screen.
        const isEntryRoute =
          pathname === '/' ||
          pathname === '/student-login';

        if (session?.user && isEntryRoute) {
          // Check the authenticated user's profile before routing.
          const { data: profile, error: profileError } =
            await supabase
              .from('profiles')
              .select('id, role, full_name, student_id, department, level')
              .eq('id', session.user.id)
              .maybeSingle();

          if (profileError) {
            console.error(
              'Profile restoration error:',
              profileError
            );
            return;
          }

          if (!mounted) return;

          if (profile?.role === 'student') {
            const profileIsComplete = Boolean(
              profile.full_name?.trim() &&
                profile.student_id?.trim() &&
                profile.department?.trim() &&
                profile.level !== null &&
                profile.level !== undefined &&
                String(profile.level).trim() !== ''
            );

            if (profileIsComplete) {
              router.replace('/(tabs)');
            } else {
              router.replace('/student-setup');
            }
          }

          // If this belongs to another role, do not redirect it
          // into the student dashboard.
        }
      } catch (error) {
        console.error('Unexpected session restoration error:', error);
      } finally {
        if (mounted) {
          hasCheckedInitialSession.current = true;
          setCheckingSession(false);
        }
      }
    };

    setCheckingSession(true);
    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (checkingSession && !hasCheckedInitialSession.current) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
  },
});