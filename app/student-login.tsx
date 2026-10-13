import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

type ScreenMode = 'login' | 'register' | 'registered';

type Department = {
  id: string;
  name: string;
};

const ACADEMIC_LEVELS = ['100', '200', '300', '400'];
const AUTH_CALLBACK_URL = 'calebconnect54://auth/callback';

export default function StudentLoginScreen() {
  const [mode, setMode] = useState<ScreenMode>('login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [matricNumber, setMatricNumber] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState('');

  const [level, setLevel] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  const selectedDepartment = departments.find(
    (item) => item.id === departmentId
  );

  // --------------------------------------------------
  // LOAD DEPARTMENTS FROM SUPABASE
  // --------------------------------------------------

  const loadDepartments = useCallback(async () => {
    setDepartmentLoading(true);
    setDepartmentError('');

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Department loading error:', error);
        setDepartmentError(error.message);
        return;
      }

      const validDepartments = (data ?? []).filter(
        (item): item is Department =>
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0
      );

      setDepartments(validDepartments);

      if (validDepartments.length === 0) {
        setDepartmentError(
          'No departments were found in the database.'
        );
      }
    } catch (error) {
      console.error(
        'Unexpected department loading error:',
        error
      );

      setDepartmentError(
        'Unable to load departments. Check your internet connection and try again.'
      );
    } finally {
      setDepartmentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'register') {
      void loadDepartments();
    }
  }, [mode, loadDepartments]);

  // --------------------------------------------------
  // REGISTRATION VALIDATION
  // --------------------------------------------------

  const validateRegistration = () => {
    if (
      !fullName.trim() ||
      !cleanEmail ||
      !matricNumber.trim() ||
      !departmentId ||
      !level ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        'Missing Information',
        'Please complete every registration field and select your department and academic level.'
      );

      return false;
    }

    if (!selectedDepartment) {
      Alert.alert(
        'Invalid Department',
        'Please select a department from the list loaded from Supabase.'
      );

      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );

      return false;
    }

    if (password.length < 8) {
      Alert.alert(
        'Password Too Short',
        'Your password must contain at least 8 characters.'
      );

      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both password fields match.'
      );

      return false;
    }

    if (!ACADEMIC_LEVELS.includes(level)) {
      Alert.alert(
        'Invalid Academic Level',
        'Please select level 100, 200, 300, or 400.'
      );

      return false;
    }

    return true;
  };

  // --------------------------------------------------
  // CREATE STUDENT AUTHENTICATION ACCOUNT
  // --------------------------------------------------

  const handleRegistration = async () => {
    if (loading || !validateRegistration()) {
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: AUTH_CALLBACK_URL,
          data: {
            full_name: fullName.trim(),
            student_id: matricNumber.trim(),
            department: selectedDepartment!.name,
            department_id: selectedDepartment!.id,
            level,
            requested_role: 'student',
          },
        },
      });

      if (error) {
        Alert.alert('Registration Failed', error.message);
        return;
      }

      if (!data.user) {
        Alert.alert(
          'Registration Incomplete',
          'We could not confirm that your account was created. Please try again.'
        );

        return;
      }

      if (data.session) {
        await supabase.auth.signOut();

        Alert.alert(
          'Account Created',
          'Your account was created. Please sign in to continue.',
          [
            {
              text: 'Continue to Login',
              onPress: () => {
                setPassword('');
                setConfirmPassword('');
                setMode('login');
              },
            },
          ]
        );

        return;
      }

      setPassword('');
      setConfirmPassword('');
      setMode('registered');
    } catch (error) {
      console.error('Student registration error:', error);

      Alert.alert(
        'Registration Error',
        'Unable to register right now. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // STUDENT LOGIN
  // --------------------------------------------------

  const handleStudentLogin = async () => {
    if (!cleanEmail || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email address and password.'
      );

      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        Alert.alert('Student Login Failed', error.message);
        return;
      }

      if (!data.user || !data.session) {
        Alert.alert(
          'Login Incomplete',
          'No active login session was returned. Please try again.'
        );

        return;
      }

      const userId = data.user.id;

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, role, full_name, email, student_id, department, level'
          )
          .eq('id', userId)
          .maybeSingle();

      if (profileError) {
        Alert.alert(
          'Profile Check Failed',
          profileError.message
        );

        return;
      }

      if (profile && profile.role !== 'student') {
        await supabase.auth.signOut();

        Alert.alert(
          'Account Type Mismatch',
          'This account is not registered as a student. Please use the correct portal.'
        );

        return;
      }

      const profileIsComplete =
        profile !== null &&
        typeof profile.full_name === 'string' &&
        profile.full_name.trim().length > 0 &&
        typeof profile.student_id === 'string' &&
        profile.student_id.trim().length > 0 &&
        typeof profile.department === 'string' &&
        profile.department.trim().length > 0 &&
        profile.level !== null &&
        profile.level !== undefined &&
        String(profile.level).trim().length > 0;

      if (!profileIsComplete || !profile) {
        router.replace('/student-setup');
        return;
      }

      const studentProfile = {
        fullName: profile.full_name,
        matricNumber: profile.student_id,
        programme: profile.department,
        level: String(profile.level),
      };

      await AsyncStorage.setItem(
        '@calebconnect_student_profile',
        JSON.stringify(studentProfile)
      );

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Student login error:', error);

      Alert.alert(
        'Login Error',
        'Unable to sign in right now. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // TEMPORARY PASSWORD-RECOVERY ASSISTANCE
  // --------------------------------------------------

  const handleForgotPassword = () => {
    Alert.alert(
      'Password Recovery Assistance',
      'Having trouble accessing your CalebConnect account?\n\nPlease contact the CalebConnect administrator for password recovery assistance.\n\nFor your security, never share your current password or verification codes with anyone.',
      [
        {
          text: 'OK',
          style: 'default',
        },
      ]
    );
  };

  // --------------------------------------------------
  // RETURN TO LOGIN
  // --------------------------------------------------

  const returnToLogin = () => {
    setMode('login');
    setPassword('');
    setConfirmPassword('');
  };

  // --------------------------------------------------
  // SCREEN
  // --------------------------------------------------

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
            disabled={loading}
          >
            <Text style={styles.backText}>‹  Back</Text>
          </TouchableOpacity>

          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>C</Text>
          </View>

          {mode === 'registered' ? (
            <>
              <Text style={styles.title}>Check Your Email</Text>

              <Text style={styles.subtitle}>
                We have submitted your registration for {cleanEmail}.
                Open the confirmation email from Supabase and follow
                its instructions to confirm your address.
              </Text>

              <View style={styles.card}>
                <Text style={styles.infoTitle}>
                  Verify Your Email
                </Text>

                <Text style={styles.infoText}>
                  After confirming your email, return here and sign
                  in using your registered email address and
                  password. If the email does not arrive, check
                  your spam folder.
                </Text>

                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={returnToLogin}
                >
                  <Text style={styles.loginButtonText}>
                    Return to Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {mode === 'login'
                  ? 'Student Login'
                  : 'Create Student Account'}
              </Text>

              <Text style={styles.subtitle}>
                {mode === 'login'
                  ? 'Sign in using your own CalebConnect student account.'
                  : 'Create your personal CalebConnect account using your own email address.'}
              </Text>

              <View style={styles.card}>
                {mode === 'register' && (
                  <>
                    <Text style={styles.label}>Full Name</Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor="#9CA3AF"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!loading}
                    />

                    <Text style={styles.label}>
                      Matriculation Number
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Enter your matric number"
                      placeholderTextColor="#9CA3AF"
                      value={matricNumber}
                      onChangeText={setMatricNumber}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!loading}
                    />

                    <Text style={styles.label}>Department</Text>

                    <Text style={styles.helperText}>
                      Select your department from the official
                      CalebConnect department list.
                    </Text>

                    {departmentLoading ? (
                      <View style={styles.loadingDepartments}>
                        <ActivityIndicator color="#2563EB" />

                        <Text style={styles.loadingText}>
                          Loading departments from Supabase...
                        </Text>
                      </View>
                    ) : departmentError ? (
                      <View style={styles.errorCard}>
                        <Text style={styles.errorText}>
                          {departmentError}
                        </Text>

                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={() => void loadDepartments()}
                        >
                          <Text style={styles.retryText}>
                            Retry Loading Departments
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.departmentList}>
                        {departments.map((item) => {
                          const selected = departmentId === item.id;

                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[
                                styles.departmentOption,
                                selected &&
                                  styles.selectedDepartmentOption,
                              ]}
                              onPress={() => setDepartmentId(item.id)}
                              disabled={loading}
                              activeOpacity={0.8}
                            >
                              <View
                                style={[
                                  styles.radioOuter,
                                  selected &&
                                    styles.radioOuterSelected,
                                ]}
                              >
                                {selected && (
                                  <View style={styles.radioInner} />
                                )}
                              </View>

                              <Text
                                style={[
                                  styles.departmentOptionText,
                                  selected &&
                                    styles.selectedDepartmentText,
                                ]}
                              >
                                {item.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {selectedDepartment && (
                      <View style={styles.selectedDepartmentCard}>
                        <Text style={styles.selectedDepartmentLabel}>
                          Selected Department
                        </Text>

                        <Text style={styles.selectedDepartmentName}>
                          {selectedDepartment.name}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.label}>Academic Level</Text>

                    <View style={styles.levelContainer}>
                      {ACADEMIC_LEVELS.map((item) => {
                        const selected = level === item;

                        return (
                          <TouchableOpacity
                            key={item}
                            style={[
                              styles.levelOption,
                              selected && styles.selectedLevelOption,
                            ]}
                            onPress={() => setLevel(item)}
                            disabled={loading}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.levelOptionText,
                                selected &&
                                  styles.selectedLevelOptionText,
                              ]}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.levelHint}>
                      Selected level: {level || 'None'}
                    </Text>
                  </>
                )}

                <Text style={styles.label}>Email Address</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>

                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                {mode === 'register' && (
                  <>
                    <Text style={styles.label}>
                      Confirm Password
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password again"
                      placeholderTextColor="#9CA3AF"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    loading && styles.disabledButton,
                  ]}
                  onPress={
                    mode === 'login'
                      ? handleStudentLogin
                      : handleRegistration
                  }
                  disabled={
                    loading ||
                    (mode === 'register' &&
                      (departmentLoading ||
                        !!departmentError ||
                        departments.length === 0))
                  }
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {mode === 'login'
                        ? 'Sign In'
                        : 'Create Student Account'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchButton}
                  onPress={() => {
                    setMode(
                      mode === 'login' ? 'register' : 'login'
                    );

                    setPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={loading}
                >
                  <Text style={styles.switchText}>
                    {mode === 'login'
                      ? 'New student? Create an account'
                      : 'Already registered? Sign in'}
                  </Text>
                </TouchableOpacity>

                {mode === 'login' && (
                  <TouchableOpacity
                    style={styles.forgotButton}
                    onPress={handleForgotPassword}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.forgotText}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <Text style={styles.footer}>
            CalebConnect · Student Portal
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

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
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 35,
    paddingVertical: 8,
  },

  backText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },

  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },

  title: {
    fontSize: 29,
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

  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    marginTop: -2,
    marginBottom: 12,
  },

  loadingDepartments: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 15,
  },

  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
  },

  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 19,
  },

  retryButton: {
    backgroundColor: '#B91C1C',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  departmentList: {
    marginBottom: 12,
  },

  departmentOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },

  selectedDepartmentOption: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  radioOuterSelected: {
    borderColor: '#2563EB',
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },

  departmentOptionText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },

  selectedDepartmentText: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  selectedDepartmentCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginBottom: 20,
  },

  selectedDepartmentLabel: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '800',
    marginBottom: 5,
  },

  selectedDepartmentName: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '800',
  },

  levelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },

  levelOption: {
    minWidth: 58,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedLevelOption: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  levelOptionText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
  },

  selectedLevelOptionText: {
    color: '#FFFFFF',
  },

  levelHint: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 20,
  },

  loginButton: {
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

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  switchButton: {
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 8,
  },

  switchText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  forgotButton: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    minHeight: 35,
    justifyContent: 'center',
  },

  forgotText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 20,
  },

  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 30,
  },
});