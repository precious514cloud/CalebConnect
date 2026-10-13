import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { supabase } from '../lib/supabase';

const ROLE_KEY = '@calebconnect_user_role';
const LECTURER_ID_KEY = '@calebconnect_lecturer_id';
const LECTURER_PROFILE_KEY = '@calebconnect_lecturer_profile';
const LECTURER_DEPARTMENTS_KEY =
  '@calebconnect_lecturer_departments';

type Department = {
  id: string;
  name: string;
  faculty: string | null;
};

type LecturerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  staff_id: string | null;
  department: string | null;
  faculty: string | null;
  phone: string | null;
  avatar_url: string | null;
  level: string | number | null;
};

export default function LecturerLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginAsLecturer = async () => {
    const cleanEmail = email.trim().toLowerCase();

    // Do not trim passwords: spaces may be part of a password.
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      Alert.alert(
        'Incomplete Information',
        'Please enter your registered email address and password.'
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate the individual lecturer account.
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (authError || !authData.user) {
        Alert.alert(
          'Login Failed',
          'The email address or password is incorrect. Please check your details and try again.'
        );
        return;
      }

      const userId = authData.user.id;

      // 2. Retrieve the profile belonging to the authenticated user.
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          email,
          role,
          staff_id,
          department,
          faculty,
          phone,
          avatar_url,
          level
          `
        )
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.log('Lecturer profile error:', profileError);

        await supabase.auth.signOut();

        Alert.alert(
          'Profile Error',
          'Your profile could not be loaded. Please try again.'
        );
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();

        Alert.alert(
          'Profile Not Found',
          'Your authenticated account does not have a linked CalebConnect profile. Please contact the administrator.'
        );
        return;
      }

      const lecturerProfile = profile as LecturerProfile;

      // 3. Verify the account's role and identity.
      if (
        lecturerProfile.id !== userId ||
        String(lecturerProfile.role ?? '')
          .trim()
          .toLowerCase() !== 'lecturer'
      ) {
        await supabase.auth.signOut();

        Alert.alert(
          'Access Denied',
          'This account is not authorised for Lecturer Mode.'
        );
        return;
      }

      // 4. Load department assignments for this authenticated user.
      const {
        data: assignments,
        error: assignmentError,
      } = await supabase
        .from('lecturer_departments')
        .select('department_id')
        .eq('lecturer_id', userId);

      if (assignmentError) {
        console.log(
          'Lecturer department assignment error:',
          assignmentError
        );

        await supabase.auth.signOut();

        Alert.alert(
          'Department Error',
          'Your department assignments could not be loaded. Please contact the administrator.'
        );
        return;
      }

      const departmentIds = [
        ...new Set(
          (assignments ?? [])
            .map((assignment) =>
              String(assignment.department_id ?? '')
            )
            .filter(Boolean)
        ),
      ];

      if (departmentIds.length === 0) {
        await supabase.auth.signOut();

        Alert.alert(
          'No Department Assigned',
          'Your lecturer account has no department assignment. Please ask the administrator to assign your department before logging in.'
        );
        return;
      }

      // 5. Retrieve only the departments assigned to this lecturer.
      const {
        data: departmentRows,
        error: departmentError,
      } = await supabase
        .from('departments')
        .select('id, name, faculty')
        .in('id', departmentIds)
        .order('name', { ascending: true });

      if (departmentError) {
        console.log(
          'Department retrieval error:',
          departmentError
        );

        await supabase.auth.signOut();

        Alert.alert(
          'Department Error',
          'Your assigned departments could not be retrieved. Please try again.'
        );
        return;
      }

      const departments: Department[] = (
        departmentRows ?? []
      ).map((department) => ({
        id: String(department.id),
        name: String(department.name),
        faculty: department.faculty
          ? String(department.faculty)
          : null,
      }));

      if (departments.length === 0) {
        await supabase.auth.signOut();

        Alert.alert(
          'Department Not Found',
          'Your department assignment does not match an available department. Please contact the administrator.'
        );
        return;
      }

      // 6. Save the authenticated lecturer's information.
      await AsyncStorage.multiSet([
        [ROLE_KEY, 'lecturer'],
        [LECTURER_ID_KEY, userId],
        [
          LECTURER_PROFILE_KEY,
          JSON.stringify(lecturerProfile),
        ],
        [
          LECTURER_DEPARTMENTS_KEY,
          JSON.stringify(departments),
        ],
      ]);

      console.log('Lecturer login successful:', {
        userId,
        email: authData.user.email,
        staffId: lecturerProfile.staff_id,
        departmentCount: departments.length,
      });

      // 7. Open the lecturer portal.
      router.replace('/lecturer');
    } catch (error) {
      console.log('Unexpected lecturer login error:', error);

      Alert.alert(
        'Login Error',
        'Unable to complete lecturer login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Text style={styles.icon}>👨‍🏫</Text>
          </View>

          <Text style={styles.title}>Lecturer Access</Text>

          <Text style={styles.subtitle}>
            Sign in with your registered email address and
            password to access CalebConnect Lecturer Mode.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email Address</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your registered email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              editable={!loading}
              onSubmitEditing={loginAsLecturer}
              returnKeyType="go"
            />

            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() =>
                setShowPassword((current) => !current)
              }
              disabled={loading}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? 'Hide password' : 'Show password'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={loginAsLecturer}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginText}>
                    Access Lecturer Mode
                  </Text>
                  <Text style={styles.arrow}>→</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.securityCard}>
            <Text style={styles.securityIcon}>🔒</Text>

            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>
                Authorised Access Only
              </Text>

              <Text style={styles.securityText}>
                Only authenticated accounts with an authorised
                lecturer profile and assigned departments can
                access Lecturer Mode.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>CalebConnect</Text>

          <Text style={styles.footerSubtext}>
            Lecturer Portal
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

  keyboardView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 45,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 35,
  },

  backArrow: {
    fontSize: 32,
    color: '#111827',
    marginRight: 5,
    lineHeight: 32,
  },

  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  iconCircle: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },

  icon: {
    fontSize: 38,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 9,
    paddingHorizontal: 10,
    marginBottom: 28,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
  },

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 18,
  },

  showPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 15,
    paddingVertical: 5,
  },

  showPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },

  loginButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 21,
    marginLeft: 10,
  },

  securityCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    marginTop: 18,
  },

  securityIcon: {
    fontSize: 22,
    marginRight: 11,
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },

  securityText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#4B5563',
    marginTop: 4,
  },

  footer: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    marginTop: 38,
  },

  footerSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});