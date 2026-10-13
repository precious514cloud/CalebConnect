import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../lib/supabase';

const PROFILE_KEY = '@calebconnect_student_profile';

const STUDENT_STORAGE_KEYS = [
  PROFILE_KEY,
  '@calebconnect_student',
  '@calebconnect_student_profile',
  '@calebconnect_department_membership',
  '@calebconnect_academic_profile',
  '@calebconnect_user_id',
  '@calebconnect_user_role',
];

type StudentProfile = {
  fullName: string;
  matricNumber: string;
  programme: string;
  level: string;
};

export default function HomeScreen() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProfile(null);
        router.replace('/student-login');
        return;
      }

      const { data: savedProfile, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, role, full_name, student_id, department, level'
          )
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) {
        console.error(
          'Error retrieving student profile:',
          profileError.message
        );

        return;
      }

      if (!savedProfile || savedProfile.role !== 'student') {
        setProfile(null);
        router.replace('/student-login');
        return;
      }

      const studentProfile: StudentProfile = {
        fullName: savedProfile.full_name || '',
        matricNumber: savedProfile.student_id || '',
        programme: savedProfile.department || '',
        level:
          savedProfile.level !== null &&
          savedProfile.level !== undefined
            ? String(savedProfile.level)
            : '',
      };

      setProfile(studentProfile);

      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(studentProfile)
      );
    } catch (error) {
      console.error('Error loading student profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        if (active) {
          await loadProfile();
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [loadProfile])
  );

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of CalebConnect?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            void performLogout();
          },
        },
      ]
    );
  };

  const performLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      // Immediately remove the displayed student information.
      setProfile(null);

      // Sign out of the Supabase authentication session.
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Supabase logout error:', error.message);

        Alert.alert(
          'Logout Failed',
          'We could not complete your logout. Please try again.'
        );

        // Restore the authenticated profile if logout failed.
        await loadProfile();
        return;
      }

      // Clear student-specific cached information.
      // Do not clear lecturer or Course Representative data.
      const uniqueKeys = [...new Set(STUDENT_STORAGE_KEYS)];

      await AsyncStorage.multiRemove(uniqueKeys);

      // Return to the student login screen.
      // A logged-out user must sign in again.
      router.replace('/student-login');
    } catch (error) {
      console.error('Unexpected logout error:', error);

      Alert.alert(
        'Logout Error',
        'Something went wrong while logging out. Please try again.'
      );

      await loadProfile();
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading || loggingOut) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#2563EB" />

        <Text style={styles.loadingText}>
          {loggingOut
            ? 'Logging out of CalebConnect...'
            : 'Loading CalebConnect...'}
        </Text>
      </SafeAreaView>
    );
  }

  // Do not display a dashboard with missing student information.
  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#2563EB" />

        <Text style={styles.loadingText}>
          Opening student login...
        </Text>
      </SafeAreaView>
    );
  }

  const firstName =
    profile.fullName.trim().split(' ')[0] || 'Student';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>
              Welcome back 👋
            </Text>

            <Text style={styles.name}>
              {firstName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.logoutButton,
                loggingOut && styles.disabledButton,
              ]}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Log out of CalebConnect"
            >
              <Text style={styles.logoutButtonText}>
                Log Out
              </Text>
            </TouchableOpacity>

            <View style={styles.profileButton}>
              <Text style={styles.profileLetter}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* STUDENT INFORMATION */}

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.studentIcon}>
              <Text style={styles.studentIconText}>
                🎓
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.studentName}>
                {profile.fullName || 'Student'}
              </Text>

              <Text style={styles.matric}>
                {profile.matricNumber || 'No matric number'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.academicRow}>
            <View style={styles.academicItem}>
              <Text style={styles.smallLabel}>
                PROGRAMME
              </Text>

              <Text style={styles.academicValue}>
                {profile.programme || 'Not selected'}
              </Text>
            </View>

            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>
                {profile.level || 'Level'}
              </Text>
            </View>
          </View>
        </View>

        {/* QUICK ACCESS */}

        <Text style={styles.sectionTitle}>
          Quick Access
        </Text>

        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/courses')}
            activeOpacity={0.75}
          >
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>📚</Text>
            </View>

            <Text style={styles.quickTitle}>My Courses</Text>

            <Text style={styles.quickSubtitle}>
              View your courses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.75}
            onPress={() => router.push('/(tabs)/timetable')}
          >
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>📅</Text>
            </View>

            <Text style={styles.quickTitle}>Timetable</Text>

            <Text style={styles.quickSubtitle}>
              Check your classes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.75}
          >
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>📊</Text>
            </View>

            <Text style={styles.quickTitle}>GPA</Text>

            <Text style={styles.quickSubtitle}>
              Track your results
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.75}
          >
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>📝</Text>
            </View>

            <Text style={styles.quickTitle}>
              Past Questions
            </Text>

            <Text style={styles.quickSubtitle}>
              Prepare for exams
            </Text>
          </TouchableOpacity>
        </View>

        {/* ATTENDANCE */}

        <Text style={styles.sectionTitle}>
          Attendance
        </Text>

        <TouchableOpacity
          style={styles.attendanceCard}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <View style={styles.attendanceIcon}>
            <Text style={styles.attendanceIconText}>◫</Text>
          </View>

          <View style={styles.attendanceContent}>
            <Text style={styles.attendanceTitle}>
              Scan Attendance
            </Text>

            <Text style={styles.attendanceSubtitle}>
              Scan your lecturer or course rep's QR code
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* TODAY */}

        <Text style={styles.sectionTitle}>
          Today
        </Text>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📖</Text>

          <Text style={styles.emptyTitle}>
            Your classes will appear here
          </Text>

          <Text style={styles.emptyText}>
            Once your timetable is set up, your upcoming
            classes will be displayed here.
          </Text>
        </View>

        {/* FOOTER */}

        <Text style={styles.footer}>
          CalebConnect
        </Text>

        <Text style={styles.footerSubtext}>
          Your academic experience, connected.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 45,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  greetingContainer: {
    flex: 1,
  },

  greeting: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 3,
  },

  name: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  logoutButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoutButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.6,
  },

  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileLetter: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
  },

  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  studentIconText: {
    fontSize: 24,
  },

  profileInfo: {
    flex: 1,
  },

  studentName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  matric: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#eef0f4',
    marginVertical: 17,
  },

  academicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  academicItem: {
    flex: 1,
    paddingRight: 10,
  },

  smallLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.7,
    marginBottom: 5,
  },

  academicValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  levelBadge: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
  },

  levelBadgeText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  quickCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    minHeight: 135,
  },

  quickIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  quickIconText: {
    fontSize: 20,
  },

  quickTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  quickSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },

  attendanceCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  attendanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  attendanceIconText: {
    fontSize: 25,
    color: '#111827',
  },

  attendanceContent: {
    flex: 1,
  },

  attendanceTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  attendanceSubtitle: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  arrow: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '300',
    marginLeft: 8,
  },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 7,
  },

  footer: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#4f46e5',
    marginTop: 35,
  },

  footerSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
});