import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const COURSE_REP_PROFILE_KEY = '@calebconnect_course_rep_profile';

type CourseRepProfile = {
  id: string;
  fullName: string;
  matricNumber: string;
  department: string;
  level: string;
};

export default function CourseRepHomeScreen() {
  const [profile, setProfile] = useState<CourseRepProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadProfile = async () => {
        try {
          const stored = await AsyncStorage.getItem(COURSE_REP_PROFILE_KEY);

          if (!stored) {
            router.replace('/course-rep-login');
            return;
          }

          const parsed = JSON.parse(stored) as CourseRepProfile;

          if (active) {
            setProfile(parsed);
          }
        } catch {
          await AsyncStorage.removeItem(COURSE_REP_PROFILE_KEY);
          router.replace('/course-rep-login');
        } finally {
          if (active) setLoading(false);
        }
      };

      loadProfile();

      return () => {
        active = false;
      };
    }, []),
  );

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(COURSE_REP_PROFILE_KEY);
          router.replace('/');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>CALEB CONNECT</Text>
            <Text style={styles.title}>Course Rep Portal</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>Welcome</Text>
          <Text style={styles.name}>{profile.fullName || 'Course Rep'}</Text>
          <Text style={styles.matric}>{profile.matricNumber}</Text>
          <View style={styles.departmentBadge}>
            <Text style={styles.departmentLabel}>YOUR DEPARTMENT</Text>
            <Text style={styles.departmentName}>{profile.department}</Text>
          </View>
          <Text style={styles.level}>Level {profile.level || '—'}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your Course Rep workspace</Text>
          <Text style={styles.infoText}>
            Your access is associated with your assigned department. We will
            add the department's academic updates and course-rep tools here
            after we confirm this login works correctly.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
  },
  container: {
    flex: 1,
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
    marginTop: 5,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  welcomeCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 22,
  },
  welcomeLabel: {
    color: '#C4B5FD',
    fontSize: 14,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 7,
  },
  matric: {
    color: '#D1D5DB',
    fontSize: 14,
    marginTop: 6,
  },
  departmentBadge: {
    backgroundColor: '#2B2942',
    borderRadius: 14,
    padding: 15,
    marginTop: 23,
  },
  departmentLabel: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  departmentName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  level: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 14,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  infoText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 9,
  },
});