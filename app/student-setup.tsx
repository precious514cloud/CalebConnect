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

import { supabase } from '@/lib/supabase';

import {
  DEPARTMENTS,
  Department,
} from '@/constants/departments';

import {
  AcademicProfile,
  DepartmentMembership,
  Student,
} from '@/constants/academic-types';

// ----------------------------------------------------
// STORAGE KEYS
// ----------------------------------------------------

const STUDENT_PROFILE_KEY = '@calebconnect_student_profile';
const STUDENT_KEY = '@calebconnect_student';
const DEPARTMENT_MEMBERSHIP_KEY = '@calebconnect_department_membership';
const USER_ID_KEY = '@calebconnect_user_id';
const ROLE_KEY = '@calebconnect_user_role';
const ACADEMIC_PROFILE_KEY = '@calebconnect_academic_profile';

// ----------------------------------------------------
// STUDENT SETUP
// ----------------------------------------------------

export default function StudentSetupScreen() {
  const [fullName, setFullName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [level, setLevel] = useState('');
  const [selectedDepartment, setSelectedDepartment] =
    useState<Department | ''>('');
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // CHECK WHETHER A STRING IS A UUID
  // --------------------------------------------------

  const isValidUuid = (value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  };

  // --------------------------------------------------
  // SAVE STUDENT PROFILE
  // --------------------------------------------------

  const saveStudentProfile = async () => {
    const cleanName = fullName.trim();
    const cleanMatric = matricNumber.trim();
    const cleanLevel = level.trim();

    if (
      !cleanName ||
      !cleanMatric ||
      !cleanLevel ||
      !selectedDepartment
    ) {
      Alert.alert(
        'Incomplete Information',
        'Please complete all fields and select your department.'
      );
      return;
    }

    setLoading(true);

    try {
      // ------------------------------------------------
      // GET CURRENT SUPABASE AUTH USER
      // ------------------------------------------------

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error(
          'Error getting authenticated user:',
          authError
        );
      }

      let userId = authUser?.id || '';

      // ------------------------------------------------
      // FALLBACK TO EXISTING LOCAL UUID
      // ------------------------------------------------

      if (!userId) {
        const storedUserId = await AsyncStorage.getItem(
          USER_ID_KEY
        );

        if (storedUserId && isValidUuid(storedUserId)) {
          userId = storedUserId;
        }
      }

      if (!userId) {
        Alert.alert(
          'Student Account Not Connected',
          'Your student account is not connected to a Supabase account yet. Please sign in again and try the student setup.'
        );
        return;
      }

      // ------------------------------------------------
      // FIND SELECTED DEPARTMENT IN SUPABASE
      // ------------------------------------------------

      const {
        data: departmentRow,
        error: departmentError,
      } = await supabase
        .from('departments')
        .select('id, name')
        .eq('name', selectedDepartment)
        .maybeSingle();

      if (departmentError) {
        console.error(
          'Department lookup error:',
          departmentError
        );

        Alert.alert(
          'Department Error',
          departmentError.message
        );
        return;
      }

      if (!departmentRow) {
        Alert.alert(
          'Department Not Found',
          `${selectedDepartment} could not be found in the CalebConnect database.`
        );
        return;
      }

      // This is the department UUID, not the department name.
      const departmentId: string = departmentRow.id;

      // ------------------------------------------------
      // FIND EXISTING STUDENT PROFILE
      // ------------------------------------------------

      const {
        data: existingProfile,
        error: existingProfileError,
      } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          email,
          role,
          student_id,
          staff_id,
          department
          `
        )
        .eq('id', userId)
        .maybeSingle();

      if (existingProfileError) {
        console.error(
          'Profile lookup error:',
          existingProfileError
        );

        Alert.alert(
          'Profile Error',
          existingProfileError.message
        );
        return;
      }

      // ------------------------------------------------
      // CREATE OR UPDATE STUDENT PROFILE
      // ------------------------------------------------

      if (existingProfile) {
        const { error: updateProfileError } =
          await supabase
            .from('profiles')
            .update({
              full_name: cleanName,
              email:
                authUser?.email ||
                existingProfile.email ||
                null,
              role: 'student',
              student_id: cleanMatric,
              department: selectedDepartment,
              level: cleanLevel,
            })
            .eq('id', userId);

        if (updateProfileError) {
          console.error(
            'Profile update error:',
            updateProfileError
          );

          Alert.alert(
            'Unable to Save Student',
            updateProfileError.message
          );
          return;
        }
      } else {
        const { error: insertProfileError } =
          await supabase
            .from('profiles')
            .insert({
              id: userId,
              full_name: cleanName,
              email: authUser?.email || null,
              role: 'student',
              student_id: cleanMatric,
              staff_id: null,
              department: selectedDepartment,
              level: cleanLevel,
            });

        if (insertProfileError) {
          console.error(
            'Profile insert error:',
            insertProfileError
          );

          Alert.alert(
            'Unable to Create Student',
            insertProfileError.message
          );
          return;
        }
      }

      // ------------------------------------------------
      // FIND EXISTING STUDENT-DEPARTMENT CONNECTION
      //
      // A student has one department membership through
      // this setup flow. Update the existing row rather
      // than creating a duplicate connection.
      // ------------------------------------------------

      const {
        data: existingMembership,
        error: membershipLookupError,
      } = await supabase
        .from('student_departments')
        .select('id, student_id, department_id')
        .eq('student_id', userId)
        .maybeSingle();

      if (membershipLookupError) {
        console.error(
          'Student department lookup error:',
          membershipLookupError
        );

        Alert.alert(
          'Department Connection Error',
          membershipLookupError.message
        );
        return;
      }

      // ------------------------------------------------
      // UPDATE EXISTING MEMBERSHIP OR CREATE ONE
      // ------------------------------------------------

      let membershipId: string;

      if (existingMembership) {
        membershipId = existingMembership.id;

        if (
          existingMembership.department_id !== departmentId
        ) {
          const { error: membershipUpdateError } =
            await supabase
              .from('student_departments')
              .update({
                department_id: departmentId,
              })
              .eq('id', existingMembership.id);

          if (membershipUpdateError) {
            console.error(
              'Student department update error:',
              membershipUpdateError
            );

            Alert.alert(
              'Unable to Change Department',
              membershipUpdateError.message
            );
            return;
          }
        }
      } else {
        const {
          data: insertedMembership,
          error: membershipInsertError,
        } = await supabase
          .from('student_departments')
          .insert({
            student_id: userId,
            department_id: departmentId,
          })
          .select('id, student_id, department_id')
          .single();

        if (membershipInsertError) {
          console.error(
            'Student department insert error:',
            membershipInsertError
          );

          Alert.alert(
            'Unable to Connect Department',
            membershipInsertError.message
          );
          return;
        }

        membershipId = insertedMembership.id;
      }

      // ------------------------------------------------
      // LOCAL STUDENT OBJECT
      // ------------------------------------------------

      const now = new Date().toISOString();

      const student: Student = {
        id: userId,
        fullName: cleanName,
        matricNumber: cleanMatric,
        department: selectedDepartment,
        level: cleanLevel,
        role: 'student',
        createdAt: now,
        updatedAt: now,
      };

      // ------------------------------------------------
      // LOCAL DEPARTMENT MEMBERSHIP
      //
      // IMPORTANT FIX:
      // departmentId must contain the Supabase UUID,
      // not the department name.
      // ------------------------------------------------

      const membership: DepartmentMembership = {
        id: membershipId,
        userId,
        departmentId: departmentId,
        role: 'student',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      // ------------------------------------------------
      // ACADEMIC PROFILE
      //
      // Keep the department name here because this
      // profile is used for displaying academic details.
      // ------------------------------------------------

      const academicProfile: AcademicProfile = {
        userId,
        fullName: cleanName,
        role: 'student',
        departments: [selectedDepartment],
        level: cleanLevel,
        matricNumber: cleanMatric,
      };

      // ------------------------------------------------
      // SAVE LOCAL STUDENT DATA
      // ------------------------------------------------

      await AsyncStorage.setItem(
        STUDENT_KEY,
        JSON.stringify(student)
      );

      await AsyncStorage.setItem(
        DEPARTMENT_MEMBERSHIP_KEY,
        JSON.stringify(membership)
      );

      // Keep the department name for screens that display
      // the student's programme or department.
      await AsyncStorage.setItem(
        STUDENT_PROFILE_KEY,
        JSON.stringify({
          id: userId,
          fullName: cleanName,
          matricNumber: cleanMatric,
          programme: selectedDepartment,
          department: selectedDepartment,
          departmentId: departmentId,
          level: cleanLevel,
          userId,
          role: 'student',
          departments: [selectedDepartment],
        })
      );

      // ------------------------------------------------
      // SAVE USER ID
      // ------------------------------------------------

      await AsyncStorage.setItem(USER_ID_KEY, userId);

      // ------------------------------------------------
      // SAVE ROLE
      // ------------------------------------------------

      await AsyncStorage.setItem(ROLE_KEY, 'student');

      // ------------------------------------------------
      // SAVE ACADEMIC PROFILE
      // ------------------------------------------------

      await AsyncStorage.setItem(
        ACADEMIC_PROFILE_KEY,
        JSON.stringify(academicProfile)
      );

      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      Alert.alert(
        'Setup Complete',
        `${cleanName} is now connected to ${selectedDepartment}. Your student profile and department connection have been updated.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              router.replace('/(tabs)');
            },
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch (error) {
      console.error('Student setup error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save your student profile. Please try again.';

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // SCREEN
  // --------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* BACK BUTTON */}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* ICON */}

          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🎓</Text>
          </View>

          {/* HEADER */}

          <Text style={styles.title}>Student Setup</Text>

          <Text style={styles.subtitle}>
            Enter your details and select your department to
            set up your CalebConnect student profile.
          </Text>

          {/* FORM CARD */}

          <View style={styles.card}>
            {/* FULL NAME */}

            <Text style={styles.label}>Full Name</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoCorrect={false}
            />

            {/* MATRIC NUMBER */}

            <Text style={styles.label}>Matric Number</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your matric number"
              placeholderTextColor="#9CA3AF"
              value={matricNumber}
              onChangeText={setMatricNumber}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* LEVEL */}

            <Text style={styles.label}>Level</Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. 100 Level"
              placeholderTextColor="#9CA3AF"
              value={level}
              onChangeText={setLevel}
              autoCorrect={false}
            />

            {/* DEPARTMENT */}

            <Text style={styles.label}>
              Choose Your Department
            </Text>

            <Text style={styles.helperText}>
              Select the department you are studying.
            </Text>

            {/* DEPARTMENT OPTIONS */}

            <View style={styles.optionsContainer}>
              {DEPARTMENTS.map((department) => {
                const selected =
                  selectedDepartment === department;

                return (
                  <TouchableOpacity
                    key={department}
                    style={[
                      styles.option,
                      selected && styles.selectedOption,
                    ]}
                    onPress={() =>
                      setSelectedDepartment(department)
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.selectedCheckbox,
                      ]}
                    >
                      {selected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.selectedOptionText,
                      ]}
                    >
                      {department}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SELECTED DEPARTMENT */}

            {selectedDepartment ? (
              <View style={styles.selectedDepartmentCard}>
                <Text style={styles.selectedDepartmentLabel}>
                  Your Department
                </Text>

                <Text style={styles.selectedDepartmentText}>
                  {selectedDepartment}
                </Text>
              </View>
            ) : null}

            {/* SAVE BUTTON */}

            <TouchableOpacity
              style={[
                styles.saveButton,
                loading && styles.saveButtonDisabled,
              ]}
              onPress={saveStudentProfile}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveText}>
                    Complete Student Setup
                  </Text>
                  <Text style={styles.arrow}>→</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* INFORMATION */}

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🔒</Text>

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Your Academic Identity
              </Text>

              <Text style={styles.infoText}>
                Your department connects you with the correct
                lecturers, courses, notes, assignments, tests,
                announcements and attendance sessions.
              </Text>
            </View>
          </View>

          {/* FOOTER */}

          <Text style={styles.footer}>CalebConnect</Text>

          <Text style={styles.footerSubtext}>
            Student Portal
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// STYLES
// ----------------------------------------------------

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
    marginBottom: 30,
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
    backgroundColor: '#EEF2FF',
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

  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: -2,
    marginBottom: 12,
  },

  optionsContainer: {
    marginBottom: 12,
  },

  option: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },

  selectedOption: {
    backgroundColor: '#ECFDF5',
    borderColor: '#4CAF50',
  },

  checkbox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  selectedCheckbox: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingRight: 8,
  },

  selectedOptionText: {
    color: '#166534',
    fontWeight: '800',
  },

  selectedDepartmentCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },

  selectedDepartmentLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 4,
  },

  selectedDepartmentText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
    lineHeight: 20,
  },

  saveButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 21,
    marginLeft: 10,
  },

  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    marginTop: 18,
  },

  infoIcon: {
    fontSize: 22,
    marginRight: 11,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3730A3',
  },

  infoText: {
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