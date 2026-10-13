import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const LECTURER_ID_KEY = '@calebconnect_lecturer_id';
const LECTURER_PROFILE_KEY = '@calebconnect_lecturer_profile';
const LECTURER_DEPARTMENTS_KEY = '@calebconnect_lecturer_departments';

type LecturerProfile = {
  id?: string;
  fullName?: string;
  full_name?: string;
  email?: string;
  department?: string;
  programme?: string;
};

type Department = {
  id: string;
  name: string;
  faculty: string | null;
};

type CourseRow = {
  id: string;
  lecturer_id: string;
  course_code: string;
  course_title: string;
  department: string;
  department_id: string | null;
  faculty: string | null;
  level: string;
  semester: string | null;
  credit_unit: number | null;
};

type AttendanceSessionInsert = {
  lecturer_id: string;
  course_id: string;
  session_code: string;
  topic: string;
  class_date: string;
  start_time: string;
  duration: number;
  qr_time_limit: number;
  qr_rotation_seconds: number;
  venue: string;
  status: string;
  level: string;
};

const LEVELS = ['100', '200', '300', '400'];
const QR_ROTATION_OPTIONS = [15, 30, 45, 60];

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function makeSessionCode(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `CC-${timePart}-${randomPart}`;
}

export default function CreateSessionScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lecturerId, setLecturerId] = useState('');
  const [lecturerProfile, setLecturerProfile] =
    useState<LecturerProfile | null>(null);

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDepartmentIds, setSelectedDepartmentIds] =
    useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('');

  const [topic, setTopic] = useState('');
  const [classDate, setClassDate] = useState(getLocalDate());
  const [startTime, setStartTime] = useState(getLocalTime());
  const [duration, setDuration] = useState('60');
  const [rotationSeconds, setRotationSeconds] = useState(30);
  const [venue, setVenue] = useState('');

  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [departmentModalVisible, setDepartmentModalVisible] =
    useState(false);
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [rotationModalVisible, setRotationModalVisible] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const selectedDepartments = useMemo(
    () =>
      departments.filter((department) =>
        selectedDepartmentIds.includes(department.id)
      ),
    [departments, selectedDepartmentIds]
  );

  const lecturerName =
    lecturerProfile?.fullName ||
    lecturerProfile?.full_name ||
    lecturerProfile?.email ||
    'Lecturer';

  useEffect(() => {
    void loadScreenData();
  }, []);

  const loadScreenData = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.warn('Could not retrieve authenticated user:', authError.message);
      }

      const storedLecturerId = await AsyncStorage.getItem(LECTURER_ID_KEY);
      const storedProfileText = await AsyncStorage.getItem(
        LECTURER_PROFILE_KEY
      );

      let storedProfile: LecturerProfile | null = null;

      if (storedProfileText) {
        try {
          storedProfile = JSON.parse(storedProfileText) as LecturerProfile;
        } catch {
          storedProfile = null;
        }
      }

      const currentLecturerId =
        user?.id || storedLecturerId || storedProfile?.id || '';

      if (!currentLecturerId) {
        Alert.alert(
          'Lecturer not found',
          'Please sign in to your lecturer account again.'
        );
        return;
      }

      setLecturerId(currentLecturerId);
      setLecturerProfile(storedProfile);

      await Promise.all([
        loadAllSchoolDepartments(),
        loadLecturerCourses(currentLecturerId),
      ]);
    } catch (error) {
      console.error('Error loading Start Attendance screen:', error);

      Alert.alert(
        'Unable to load Start Attendance',
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while loading the screen.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadAllSchoolDepartments() {
    /*
     * Load ALL school departments.
     *
     * The department selector is not limited to the lecturer's own
     * assigned department because lecturers may teach joint classes.
     */
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, faculty')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading all departments:', error);

      Alert.alert(
        'Department Loading Failed',
        `Unable to load the school's departments.\n\n${error.message}`
      );
      return;
    }

    const loadedDepartments: Department[] = (data ?? [])
      .filter(
        (item: any) =>
          item.id &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0
      )
      .map((item: any) => ({
        id: String(item.id),
        name: String(item.name).trim(),
        faculty: item.faculty ? String(item.faculty).trim() : null,
      }));

    setDepartments(loadedDepartments);

    try {
      await AsyncStorage.setItem(
        LECTURER_DEPARTMENTS_KEY,
        JSON.stringify(loadedDepartments)
      );
    } catch (storageError) {
      console.warn('Could not cache departments locally:', storageError);
    }
  }

  async function loadLecturerCourses(currentLecturerId: string) {
    /*
     * Load courses created or assigned to this lecturer.
     * These column names match the courses schema used by CalebConnect.
     */
    const { data, error } = await supabase
      .from('courses')
      .select(
        `
        id,
        lecturer_id,
        course_code,
        course_title,
        department,
        department_id,
        faculty,
        level,
        semester,
        credit_unit
        `
      )
      .eq('lecturer_id', currentLecturerId)
      .order('course_code', { ascending: true });

    if (error) {
      console.error('Error loading lecturer courses:', error);

      Alert.alert(
        'Course Loading Failed',
        `Unable to load your courses.\n\n${error.message}`
      );
      return;
    }

    const loadedCourses = (data ?? []) as CourseRow[];
    setCourses(loadedCourses);

    if (loadedCourses.length === 1) {
      setSelectedCourseId(loadedCourses[0].id);

      if (loadedCourses[0].level) {
        setSelectedLevel(String(loadedCourses[0].level));
      }
    }
  }

  function toggleDepartment(departmentId: string) {
    setSelectedDepartmentIds((current) => {
      if (current.includes(departmentId)) {
        return current.filter((id) => id !== departmentId);
      }

      return [...current, departmentId];
    });
  }

  function chooseCourse(course: CourseRow) {
    setSelectedCourseId(course.id);
    setCourseModalVisible(false);

    if (course.level && LEVELS.includes(String(course.level))) {
      setSelectedLevel(String(course.level));
    } else {
      setSelectedLevel('');
    }
  }

  function formatTimeForDatabase(value: string): string {
    const trimmed = value.trim();

    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }

    return trimmed;
  }

  function validateForm(): string | null {
    if (!lecturerId) {
      return 'Your lecturer account could not be identified. Please sign in again.';
    }

    if (!selectedCourseId || !selectedCourse) {
      return 'Please select a course.';
    }

    if (selectedDepartmentIds.length === 0) {
      return 'Please select at least one department.';
    }

    if (!selectedLevel) {
      return 'Please select the class level.';
    }

    if (!topic.trim()) {
      return 'Please enter the lecture topic.';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate.trim())) {
      return 'Enter the class date in YYYY-MM-DD format.';
    }

    if (!/^\d{2}:\d{2}$/.test(startTime.trim())) {
      return 'Enter the start time in 24-hour HH:MM format, for example 09:30.';
    }

    const [hours, minutes] = startTime.split(':').map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return 'The start time is invalid. Use 24-hour HH:MM format.';
    }

    const durationMinutes = Number(duration);

    if (
      !Number.isFinite(durationMinutes) ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 720
    ) {
      return 'Attendance duration must be a whole number between 1 and 720 minutes.';
    }

    if (!venue.trim()) {
      return 'Please enter the class venue.';
    }

    if (!QR_ROTATION_OPTIONS.includes(rotationSeconds)) {
      return 'Please select a valid QR rotation interval.';
    }

    return null;
  }

  async function createAttendanceSession() {
    if (saving) {
      return;
    }

    const validationMessage = validateForm();

    if (validationMessage) {
      Alert.alert('Check Attendance Details', validationMessage);
      return;
    }

    setSaving(true);

    let createdSessionId: string | null = null;

    try {
      const durationMinutes = Math.round(Number(duration));
      const qrTimeLimitSeconds = durationMinutes * 60;
      const sessionCode = makeSessionCode();

      const sessionStartedAt = Date.now();

      const sessionPayload: AttendanceSessionInsert = {
        lecturer_id: lecturerId,
        course_id: selectedCourse!.id,
        session_code: sessionCode,
        topic: topic.trim(),
        class_date: classDate.trim(),
        start_time: formatTimeForDatabase(startTime),
        duration: durationMinutes,
        qr_time_limit: qrTimeLimitSeconds,
        qr_rotation_seconds: rotationSeconds,
        venue: venue.trim(),
        status: 'active',
        level: selectedLevel,
      };

      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert(sessionPayload)
        .select('id, session_code')
        .single();

      if (sessionError) {
        console.error('Attendance session insert error:', sessionError);

        Alert.alert(
          'Attendance Session Failed',
          sessionError.message ||
            'The attendance session could not be created.'
        );
        return;
      }

      if (!session?.id) {
        Alert.alert(
          'Attendance Session Failed',
          'Supabase did not return the new attendance session ID.'
        );
        return;
      }

      createdSessionId = String(session.id);

      /*
       * IMPORTANT DATABASE FIX:
       *
       * Your attendance_session_departments table contains:
       *   id
       *   session_id
       *   department (TEXT)
       *   created_at
       *
       * It does NOT contain department_id.
       *
       * Therefore, save the selected department NAMES as text.
       */
      const departmentRows = selectedDepartments
        .map((department) => ({
          session_id: session.id,
          department: department.name,
        }))
        .filter(
          (item) =>
            typeof item.department === 'string' &&
            item.department.trim().length > 0
        );

      if (departmentRows.length === 0) {
        await supabase
          .from('attendance_sessions')
          .update({ status: 'closed' })
          .eq('id', session.id);

        Alert.alert(
          'Department Assignment Failed',
          'No valid department was selected. Please select at least one department and try again.'
        );
        return;
      }

      const { error: departmentError } = await supabase
        .from('attendance_session_departments')
        .insert(departmentRows);

      if (departmentError) {
        console.error(
          'Attendance session department insert error:',
          departmentError
        );

        /*
         * Close the session so an incomplete session is not left active
         * when its department assignments fail.
         */
        const { error: closeError } = await supabase
          .from('attendance_sessions')
          .update({ status: 'closed' })
          .eq('id', session.id);

        if (closeError) {
          console.error(
            'Could not close incomplete attendance session:',
            closeError
          );
        }

        Alert.alert(
          'Department Assignment Failed',
          `The attendance session was created, but the department assignments could not be saved.\n\n${departmentError.message}`
        );
        return;
      }

      /*
       * Open the QR screen only after the session and all department
       * assignments have been saved successfully.
       */
      router.replace({
        pathname: '/lecturer/attendance-qr',
        params: {
          sessionId: String(session.id),
          sessionCode: String(session.session_code || sessionCode),
          sessionStartedAt: String(sessionStartedAt),
        },
      });
    } catch (error) {
      console.error('Unexpected error creating attendance session:', error);

      /*
       * If we created a session but a later step failed, try to close it.
       */
      if (createdSessionId) {
        const { error: closeError } = await supabase
          .from('attendance_sessions')
          .update({ status: 'closed' })
          .eq('id', createdSessionId);

        if (closeError) {
          console.error(
            'Could not close incomplete attendance session:',
            closeError
          );
        }
      }

      Alert.alert(
        'Error Creating Attendance',
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function renderSelector(
    label: string,
    value: string,
    placeholder: string,
    iconName: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    helperText?: string
  ) {
    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>

        <TouchableOpacity
          style={styles.selector}
          onPress={onPress}
          activeOpacity={0.75}
          disabled={loading || saving}
        >
          <Ionicons
            name={iconName}
            size={25}
            color="#3264DB"
            style={styles.selectorIcon}
          />

          <Text
            style={[
              styles.selectorText,
              !value && styles.placeholderText,
            ]}
            numberOfLines={2}
          >
            {value || placeholder}
          </Text>

          <Ionicons
            name="chevron-down"
            size={22}
            color="#747B89"
          />
        </TouchableOpacity>

        {helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FC" />
        <ActivityIndicator size="large" color="#3159C8" />
        <Text style={styles.loadingText}>Loading attendance details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FC" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Ionicons name="arrow-back" size={25} color="#172033" />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.pageTitle}>Start Attendance</Text>
            <Text style={styles.pageSubtitle}>
              Create a live attendance session
            </Text>
          </View>
        </View>

        <View style={styles.lecturerCard}>
          <View style={styles.lecturerAvatar}>
            <Ionicons name="person" size={30} color="#3159C8" />
          </View>

          <View style={styles.lecturerDetails}>
            <Text style={styles.lecturerLabel}>Lecturer</Text>
            <Text style={styles.lecturerName}>{lecturerName}</Text>

            {lecturerProfile?.department ? (
              <Text style={styles.lecturerDepartment}>
                {lecturerProfile.department}
              </Text>
            ) : null}
          </View>
        </View>

        {renderSelector(
          'Course',
          selectedCourse
            ? `${selectedCourse.course_code} — ${selectedCourse.course_title}`
            : '',
          'Select course',
          'book-outline',
          () => setCourseModalVisible(true)
        )}

        {renderSelector(
          'Department(s)',
          selectedDepartments.length > 0
            ? selectedDepartments.map((item) => item.name).join(', ')
            : '',
          'Select department(s)',
          'business-outline',
          () => setDepartmentModalVisible(true),
          `${selectedDepartments.length} selected. Select more than one department for a joint class. Students will still appear under their own departments in Attendance Records.`
        )}

        {renderSelector(
          'Level',
          selectedLevel ? `Level ${selectedLevel}` : '',
          'Select level',
          'layers-outline',
          () => setLevelModalVisible(true)
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Lecture Topic</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="document-text-outline"
              size={23}
              color="#3264DB"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Enter lecture topic"
              placeholderTextColor="#9AA2B1"
              value={topic}
              onChangeText={setTopic}
              editable={!saving}
              maxLength={200}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Class Date</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="calendar-outline"
              size={23}
              color="#3264DB"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9AA2B1"
              value={classDate}
              onChangeText={setClassDate}
              editable={!saving}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <Text style={styles.helperText}>
            Use YYYY-MM-DD format, for example 2026-09-29.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Start Time</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="time-outline"
              size={23}
              color="#3264DB"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="HH:MM"
              placeholderTextColor="#9AA2B1"
              value={startTime}
              onChangeText={setStartTime}
              editable={!saving}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <Text style={styles.helperText}>
            Use 24-hour time, for example 14:30 for 2:30 PM.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Attendance Duration</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="pie-chart-outline"
              size={23}
              color="#3264DB"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Enter duration in minutes"
              placeholderTextColor="#9AA2B1"
              value={duration}
              onChangeText={setDuration}
              editable={!saving}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.unitText}>minutes</Text>
          </View>
          <Text style={styles.helperText}>
            Example: enter 10 for a 10-minute attendance session.
          </Text>
        </View>

        {renderSelector(
          'QR Rotation Interval',
          `${rotationSeconds} seconds`,
          'Select QR rotation interval',
          'qr-code-outline',
          () => setRotationModalVisible(true),
          'The QR code changes at the selected interval while attendance remains active.'
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Venue</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="location-outline"
              size={23}
              color="#3264DB"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Enter class venue"
              placeholderTextColor="#9AA2B1"
              value={venue}
              onChangeText={setVenue}
              editable={!saving}
              maxLength={150}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#3159C8"
          />
          <Text style={styles.infoText}>
            Your attendance session will be saved with the selected
            departments. The QR screen opens after the session and department
            assignments have been saved successfully.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.startButton,
            saving && styles.disabledButton,
          ]}
          onPress={createAttendanceSession}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="play-circle" size={25} color="#FFFFFF" />
          )}

          <Text style={styles.startButtonText}>
            {saving ? 'Creating Attendance...' : 'Start Attendance'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* COURSE SELECTION MODAL */}
      <Modal
        visible={courseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCourseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Course</Text>
                <Text style={styles.modalSubtitle}>
                  Choose the course for this attendance session.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setCourseModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#172033" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
            >
              {courses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="book-outline"
                    size={36}
                    color="#8A94A6"
                  />
                  <Text style={styles.emptyStateTitle}>No courses found</Text>
                  <Text style={styles.emptyStateText}>
                    No courses were found for this lecturer account.
                  </Text>
                </View>
              ) : (
                courses.map((course) => {
                  const isSelected = course.id === selectedCourseId;

                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        styles.optionRow,
                        isSelected && styles.selectedOptionRow,
                      ]}
                      onPress={() => chooseCourse(course)}
                    >
                      <View style={styles.optionMain}>
                        <Text style={styles.optionTitle}>
                          {course.course_code}
                        </Text>
                        <Text style={styles.optionDescription}>
                          {course.course_title}
                        </Text>
                        <Text style={styles.optionMeta}>
                          {course.department}
                          {course.level ? ` • Level ${course.level}` : ''}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          isSelected
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={24}
                        color={isSelected ? '#3159C8' : '#A0A7B4'}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MULTI-DEPARTMENT SELECTION MODAL */}
      <Modal
        visible={departmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDepartmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Select Departments</Text>
                <Text style={styles.modalSubtitle}>
                  Select one or more departments for this class.
                </Text>
                <Text style={styles.selectedCount}>
                  {selectedDepartmentIds.length} selected
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setDepartmentModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#172033" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
            >
              {departments.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="business-outline"
                    size={36}
                    color="#8A94A6"
                  />
                  <Text style={styles.emptyStateTitle}>
                    No departments found
                  </Text>
                  <Text style={styles.emptyStateText}>
                    Check that the departments table contains departments and
                    that authenticated users have permission to read them.
                  </Text>
                </View>
              ) : (
                departments.map((department) => {
                  const isSelected = selectedDepartmentIds.includes(
                    department.id
                  );

                  return (
                    <TouchableOpacity
                      key={department.id}
                      style={[
                        styles.optionRow,
                        isSelected && styles.selectedOptionRow,
                      ]}
                      onPress={() => toggleDepartment(department.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.optionMain}>
                        <Text style={styles.optionTitle}>
                          {department.name}
                        </Text>

                        {department.faculty ? (
                          <Text style={styles.optionDescription}>
                            {department.faculty}
                          </Text>
                        ) : null}
                      </View>

                      <Ionicons
                        name={
                          isSelected
                            ? 'checkbox'
                            : 'square-outline'
                        }
                        size={25}
                        color={isSelected ? '#3159C8' : '#A0A7B4'}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setDepartmentModalVisible(false)}
            >
              <Text style={styles.modalDoneButtonText}>
                Done ({selectedDepartmentIds.length} selected)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LEVEL SELECTION MODAL */}
      <Modal
        visible={levelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLevelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalCard}>
            <Text style={styles.modalTitle}>Select Level</Text>

            {LEVELS.map((level) => {
              const isSelected = selectedLevel === level;

              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.optionRow,
                    isSelected && styles.selectedOptionRow,
                  ]}
                  onPress={() => {
                    setSelectedLevel(level);
                    setLevelModalVisible(false);
                  }}
                >
                  <Text style={styles.optionTitle}>Level {level}</Text>

                  <Ionicons
                    name={
                      isSelected ? 'radio-button-on' : 'radio-button-off'
                    }
                    size={23}
                    color={isSelected ? '#3159C8' : '#A0A7B4'}
                  />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setLevelModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR ROTATION SELECTION MODAL */}
      <Modal
        visible={rotationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRotationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalCard}>
            <Text style={styles.modalTitle}>QR Rotation Interval</Text>
            <Text style={styles.modalSubtitle}>
              Choose how often the QR code changes.
            </Text>

            {QR_ROTATION_OPTIONS.map((seconds) => {
              const isSelected = rotationSeconds === seconds;

              return (
                <TouchableOpacity
                  key={seconds}
                  style={[
                    styles.optionRow,
                    isSelected && styles.selectedOptionRow,
                  ]}
                  onPress={() => {
                    setRotationSeconds(seconds);
                    setRotationModalVisible(false);
                  }}
                >
                  <Text style={styles.optionTitle}>{seconds} seconds</Text>

                  <Ionicons
                    name={
                      isSelected ? 'radio-button-on' : 'radio-button-off'
                    }
                    size={23}
                    color={isSelected ? '#3159C8' : '#A0A7B4'}
                  />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setRotationModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F7FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: '#647086',
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 30,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  backButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E7EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  pageTitle: {
    color: '#172033',
    fontSize: 27,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#778196',
    fontSize: 15,
    marginTop: 4,
  },
  lecturerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#EDF3FF',
    marginBottom: 28,
  },
  lecturerAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#DCE7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  lecturerDetails: {
    flex: 1,
  },
  lecturerLabel: {
    color: '#778196',
    fontSize: 14,
    marginBottom: 3,
  },
  lecturerName: {
    color: '#23458F',
    fontSize: 17,
    fontWeight: '800',
  },
  lecturerDepartment: {
    color: '#647086',
    fontSize: 13,
    marginTop: 3,
  },
  fieldGroup: {
    marginBottom: 26,
  },
  fieldLabel: {
    color: '#172033',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  selector: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E5EE',
    borderRadius: 20,
    paddingHorizontal: 17,
    paddingVertical: 15,
  },
  selectorIcon: {
    marginRight: 15,
  },
  selectorText: {
    flex: 1,
    color: '#25334D',
    fontSize: 16,
    marginRight: 12,
  },
  placeholderText: {
    color: '#9AA2B1',
  },
  helperText: {
    color: '#778196',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  inputContainer: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E5EE',
    borderRadius: 20,
    paddingHorizontal: 17,
  },
  inputIcon: {
    marginRight: 15,
  },
  textInput: {
    flex: 1,
    color: '#25334D',
    fontSize: 17,
    paddingVertical: 17,
  },
  unitText: {
    color: '#778196',
    fontSize: 14,
    marginLeft: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAF0FF',
    borderRadius: 16,
    padding: 16,
    marginTop: 2,
    marginBottom: 24,
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: '#465A84',
    fontSize: 13,
    lineHeight: 21,
  },
  startButton: {
    minHeight: 66,
    backgroundColor: '#3159C8',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.65,
  },
  bottomSpacing: {
    height: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 21, 39, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  smallModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    color: '#172033',
    fontSize: 21,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#778196',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  selectedCount: {
    color: '#3159C8',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F3F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
    gap: 12,
  },
  selectedOptionRow: {
    backgroundColor: '#EDF3FF',
  },
  optionMain: {
    flex: 1,
  },
  optionTitle: {
    color: '#25334D',
    fontSize: 16,
    fontWeight: '700',
  },
  optionDescription: {
    color: '#647086',
    fontSize: 14,
    marginTop: 4,
  },
  optionMeta: {
    color: '#778196',
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 35,
    paddingHorizontal: 18,
  },
  emptyStateTitle: {
    color: '#25334D',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyStateText: {
    color: '#778196',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7,
  },
  modalDoneButton: {
    backgroundColor: '#3159C8',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  modalDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    backgroundColor: '#F0F3F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  cancelButtonText: {
    color: '#25334D',
    fontSize: 15,
    fontWeight: '700',
  },
});