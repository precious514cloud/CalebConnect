import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

const COURSE_REP_PROFILE_KEY = '@calebconnect_course_rep_profile';

type Department = {
  id: string;
  name: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  student_id: string | null;
  department: string | null;
  level: string | null;
};

type CourseRepAssignment = {
  id: string;
  student_id: string;
  department_id: string;
  level: string;
  position: 'course_rep' | 'assistant';
  is_active: boolean;
};

export default function CourseRepLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departmentModalVisible, setDepartmentModalVisible] =
    useState(false);

  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);

      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Load departments error:', error);

        Alert.alert(
          'Unable to load departments',
          'Please check your internet connection and try again.',
        );

        return;
      }

      setDepartments(data ?? []);
    } catch (error) {
      console.error('Unexpected department error:', error);

      Alert.alert(
        'Error',
        'Unable to load departments. Please try again.',
      );
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.',
      );
      return;
    }

    if (!selectedDepartment) {
      Alert.alert(
        'Select department',
        'Please select the department for your active appointment.',
      );
      return;
    }

    const chosenDepartment = departments.find(
      (department) => department.name === selectedDepartment,
    );

    if (!chosenDepartment) {
      Alert.alert(
        'Invalid department',
        'Please select a valid department from the list.',
      );
      return;
    }

    setLoggingIn(true);

    try {
      // 1. Authenticate the student.
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (authError || !authData.user) {
        Alert.alert(
          'Login unsuccessful',
          authError?.message || 'Please check your login details.',
        );
        return;
      }

      const authUser = authData.user;

      // 2. Load the student's profile.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, role, student_id, department, level',
        )
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('Student profile error:', profileError);

        await supabase.auth.signOut();

        Alert.alert(
          'Unable to verify profile',
          'We could not verify your student profile. Please try again.',
        );
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();

        Alert.alert(
          'Profile not found',
          'Your student profile could not be found. Please contact the app administrator.',
        );
        return;
      }

      const studentProfile = profile as StudentProfile;

      if (studentProfile.role !== 'student') {
        await supabase.auth.signOut();

        Alert.alert(
          'Student account required',
          'Please sign in using the student account appointed as Course Rep or Assistant.',
        );
        return;
      }

      // 3. Verify the student's active appointment.
      // The assignment table, not profiles.is_course_rep, determines access.
      const { data: assignments, error: assignmentError } =
        await supabase
          .from('course_rep_assignments')
          .select(
            'id, student_id, department_id, level, position, is_active',
          )
          .eq('student_id', studentProfile.id)
          .eq('department_id', chosenDepartment.id)
          .eq('is_active', true);

      if (assignmentError) {
        console.error(
          'Course Rep assignment verification error:',
          assignmentError,
        );

        await supabase.auth.signOut();

        Alert.alert(
          'Unable to verify appointment',
          'We could not verify your Course Rep appointment. Please try again. If the problem continues, the assignment table permissions may need checking.',
        );
        return;
      }

      const activeAssignments =
        (assignments ?? []) as CourseRepAssignment[];

      // Only allow appointments matching the student's own department
      // and level as recorded in their profile.
      const profileDepartment = (
        studentProfile.department ?? ''
      )
        .trim()
        .toLowerCase();

      const selectedDepartmentName = chosenDepartment.name
        .trim()
        .toLowerCase();

      const profileLevel = String(
        studentProfile.level ?? '',
      ).trim();

      const validAssignments = activeAssignments.filter(
        (assignment) =>
          assignment.student_id === studentProfile.id &&
          assignment.department_id === chosenDepartment.id &&
          String(assignment.level).trim() === profileLevel &&
          (assignment.position === 'course_rep' ||
            assignment.position === 'assistant'),
      );

      if (profileDepartment !== selectedDepartmentName) {
        await supabase.auth.signOut();

        Alert.alert(
          'Department mismatch',
          'The selected department does not match your student profile. Please contact your department lecturer if your profile is incorrect.',
        );
        return;
      }

      if (validAssignments.length === 0) {
        await supabase.auth.signOut();

        Alert.alert(
          'No active appointment',
          'There is no active Course Rep or Assistant appointment for your account in this department and level. Please contact your lecturer if you believe this is incorrect.',
        );
        return;
      }

      // There should only be one active appointment for this
      // student, department, and level. Use the verified record.
      const assignment = validAssignments[0];

      const positionName =
        assignment.position === 'course_rep'
          ? 'Course Rep'
          : 'Assistant';

      // 4. Save verified profile and appointment information.
      // Keep the existing profile fields so the current portal remains
      // compatible while we connect the next features.
      await AsyncStorage.setItem(
        COURSE_REP_PROFILE_KEY,
        JSON.stringify({
          id: studentProfile.id,
          fullName: studentProfile.full_name ?? '',
          email:
            studentProfile.email ?? authUser.email ?? '',
          matricNumber: studentProfile.student_id ?? '',
          department: chosenDepartment.name,
          departmentId: chosenDepartment.id,
          level: assignment.level,
          role: studentProfile.role,
          position: assignment.position,
          positionName,
          assignmentId: assignment.id,
          isCourseRep: assignment.position === 'course_rep',
          isAssistant: assignment.position === 'assistant',
        }),
      );

      // 5. Open the Course Rep portal.
      router.replace('/course-rep');
    } catch (error) {
      console.error('Course Rep login error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      Alert.alert('Login error', message);
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
            disabled={loggingIn}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#111827"
            />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.logoCircle}>
            <Ionicons
              name="people"
              size={36}
              color="#7C3AED"
            />
          </View>

          <Text style={styles.title}>Course Rep Access</Text>

          <Text style={styles.subtitle}>
            Sign in with your student account to access your
            department's Course Rep or Assistant workspace.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Student Email</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your registered email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loggingIn}
              autoComplete="email"
            />

            <Text style={styles.label}>Password</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loggingIn}
                autoComplete="current-password"
              />

              <TouchableOpacity
                onPress={() =>
                  setShowPassword((previous) => !previous)
                }
                disabled={loggingIn}
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
              >
                <Ionicons
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={22}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              Department of Appointment
            </Text>

            <TouchableOpacity
              style={styles.departmentButton}
              onPress={() => setDepartmentModalVisible(true)}
              disabled={loadingDepartments || loggingIn}
            >
              <Ionicons
                name="school-outline"
                size={21}
                color="#7C3AED"
              />

              <Text
                style={[
                  styles.departmentButtonText,
                  !selectedDepartment && styles.placeholder,
                ]}
                numberOfLines={1}
              >
                {loadingDepartments
                  ? 'Loading departments...'
                  : selectedDepartment ||
                    'Choose your department'}
              </Text>

              <Ionicons
                name="chevron-down"
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                loggingIn && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loggingIn || loadingDepartments}
              activeOpacity={0.85}
            >
              {loggingIn ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>
                    Verifying appointment...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.loginButtonText}>
                    Sign In
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={21}
                    color="#FFFFFF"
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.notice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#7C3AED"
              />

              <Text style={styles.noticeText}>
                Access is granted only when your account has an active
                Course Rep or Assistant appointment for the selected
                department and your registered level.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={departmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setDepartmentModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Department
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setDepartmentModalVisible(false)
                }
                accessibilityLabel="Close department selector"
              >
                <Ionicons
                  name="close"
                  size={25}
                  color="#111827"
                />
              </TouchableOpacity>
            </View>

            {departments.length === 0 ? (
              <Text style={styles.emptyText}>
                No departments found. Please try again later.
              </Text>
            ) : (
              <ScrollView style={styles.departmentList}>
                {departments.map((department) => {
                  const isSelected =
                    selectedDepartment === department.name;

                  return (
                    <TouchableOpacity
                      key={department.id}
                      style={[
                        styles.departmentOption,
                        isSelected && styles.selectedOption,
                      ]}
                      disabled={loggingIn}
                      onPress={() => {
                        setSelectedDepartment(department.name);
                        setDepartmentModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.departmentOptionText,
                          isSelected && styles.selectedOptionText,
                        ]}
                      >
                        {department.name}
                      </Text>

                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={21}
                          color="#7C3AED"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },

  flex: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
  },

  backText: {
    marginLeft: 8,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },

  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 30,
    marginBottom: 22,
  },

  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 10,
    marginBottom: 32,
  },

  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
  },

  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 15,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },

  passwordContainer: {
    height: 54,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },

  departmentButton: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  departmentButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },

  placeholder: {
    color: '#9CA3AF',
  },

  loginButton: {
    minHeight: 56,
    backgroundColor: '#111827',
    borderRadius: 15,
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },

  disabledButton: {
    opacity: 0.65,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 22,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
  },

  noticeText: {
    flex: 1,
    color: '#5B556E',
    fontSize: 12,
    lineHeight: 18,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
    maxHeight: '75%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },

  departmentList: {
    flexGrow: 0,
  },

  departmentOption: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },

  selectedOption: {
    backgroundColor: '#F5F3FF',
  },

  departmentOptionText: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
  },

  selectedOptionText: {
    color: '#6D28D9',
    fontWeight: '700',
  },

  emptyText: {
    color: '#6B7280',
    paddingVertical: 25,
    textAlign: 'center',
  },
});