import { useEffect, useMemo, useRef, useState } from 'react';
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
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../lib/supabase';

type Course = {
  id: string;
  course_code: string;
  course_title: string;
  department: string | null;
  faculty: string | null;
  level: string | null;
  semester: string | null;
  credit_unit: number | null;
};

type Student = {
  id: string;
  full_name: string;
  student_id: string | null;
  department: string | null;
  faculty: string | null;
  level: string | null;
};

export default function CreateAttendanceScreen() {
  /* =========================================================
     USER / LOADING
  ========================================================= */

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  /* =========================================================
     DEPARTMENTS
  ========================================================= */

  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    []
  );

  /* =========================================================
     LEVEL
     ONLY ONE LEVEL CAN BE SELECTED
  ========================================================= */

  const [levels, setLevels] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('');

  /* =========================================================
     COURSES
  ========================================================= */

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  /* =========================================================
     QR SETTINGS
  ========================================================= */

  const [qrTimeLimit, setQrTimeLimit] = useState('60');
  const [qrRotationSeconds, setQrRotationSeconds] = useState('10');

  /* =========================================================
     ATTENDANCE SESSION
  ========================================================= */

  const [sessionId, setSessionId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [qrData, setQrData] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  /* =========================================================
     QR ROTATION
  ========================================================= */

  const [qrCounter, setQrCounter] = useState(0);

  /*
   * Keeps track of the currently active attendance session.
   * This prevents an old QR rotation timer from continuing
   * after the lecturer creates another attendance session.
   */
  const activeSessionRef = useRef('');

  /*
   * Keeps track of the current QR rotation timer.
   */
  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* =========================================================
     LOAD INITIAL DATA
  ========================================================= */

  useEffect(() => {
    loadAttendanceOptions();

    return () => {
      if (qrTimerRef.current) {
        clearTimeout(qrTimerRef.current);
      }

      activeSessionRef.current = '';
    };
  }, []);

  const loadAttendanceOptions = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        Alert.alert(
          'Not Signed In',
          'Please sign in as a lecturer before creating attendance.'
        );
        return;
      }

      /* -------------------------------------------------------
         LOAD PROFILES
      ------------------------------------------------------- */

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('department, level, role');

      if (profileError) {
        throw profileError;
      }

      const departmentList = Array.from(
        new Set(
          (profileData || [])
            .map((item: any) => item.department)
            .filter(
              (department: any): department is string =>
                typeof department === 'string' &&
                department.trim() !== ''
            )
        )
      ).sort();

      const levelList = Array.from(
        new Set(
          (profileData || [])
            .map((item: any) => item.level)
            .filter(
              (level: any): level is string =>
                typeof level === 'string' &&
                level.trim() !== ''
            )
        )
      ).sort(sortLevels);

      setDepartments(departmentList);
      setLevels(levelList);

      /* -------------------------------------------------------
         LOAD COURSES BELONGING TO CURRENT LECTURER
      ------------------------------------------------------- */

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(
          `
          id,
          course_code,
          course_title,
          department,
          faculty,
          level,
          semester,
          credit_unit
        `
        )
        .eq('lecturer_id', user.id)
        .order('course_code', { ascending: true });

      if (courseError) {
        throw courseError;
      }

      setCourses(courseData || []);
    } catch (error: any) {
      console.error('Error loading attendance options:', error);

      Alert.alert(
        'Unable to Load',
        error?.message ||
          'We could not load the departments, levels and courses.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     SORT LEVELS
  ========================================================= */

  const sortLevels = (a: string, b: string) => {
    const getNumber = (value: string) => {
      const match = value.match(/\d+/);
      return match ? Number(match[0]) : 9999;
    };

    return getNumber(a) - getNumber(b);
  };

  /* =========================================================
     SELECT / UNSELECT DEPARTMENT
  ========================================================= */

  const toggleDepartment = (department: string) => {
    setSelectedDepartments((current) => {
      if (current.includes(department)) {
        return current.filter((item) => item !== department);
      }

      return [...current, department];
    });
  };

  /* =========================================================
     SELECT LEVEL
     ONLY ONE LEVEL
  ========================================================= */

  const selectLevel = (level: string) => {
    setSelectedLevel(level);

    /*
     * Clear the selected course if it does not belong
     * to the newly selected level.
     *
     * normalize() now safely handles null values.
     */
    const matchingCourse = courses.find(
      (course) =>
        course.id === selectedCourseId &&
        normalize(course.level) === normalize(level)
    );

    if (!matchingCourse) {
      setSelectedCourseId('');
    }
  };

  /* =========================================================
     AVAILABLE COURSES
  ========================================================= */

  const availableCourses = useMemo(() => {
    if (!selectedLevel) {
      return [];
    }

    return courses.filter((course) => {
      /*
       * FIX:
       * course.level may be null.
       * normalize() safely accepts null.
       */
      const sameLevel =
        normalize(course.level) === normalize(selectedLevel);

      if (!sameLevel) {
        return false;
      }

      if (selectedDepartments.length === 0) {
        return true;
      }

      /*
       * A course with no department can still appear.
       * Otherwise it must belong to one of the selected
       * departments.
       */
      return (
        course.department === null ||
        selectedDepartments.some(
          (department) =>
            normalize(department) ===
            normalize(course.department)
        )
      );
    });
  }, [courses, selectedLevel, selectedDepartments]);

  /* =========================================================
     SELECTED COURSE
  ========================================================= */

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId
  );

  /* =========================================================
     START ATTENDANCE
  ========================================================= */

  const startAttendance = async () => {
    try {
      if (selectedDepartments.length === 0) {
        Alert.alert(
          'Select Department',
          'Please select at least one department.'
        );
        return;
      }

      if (!selectedLevel) {
        Alert.alert(
          'Select Level',
          'Please select one level before starting attendance.'
        );
        return;
      }

      if (!selectedCourse) {
        Alert.alert(
          'Select Course',
          'Please select the course for this attendance session.'
        );
        return;
      }

      const timeLimit = Number(qrTimeLimit);
      const rotation = Number(qrRotationSeconds);

      if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
        Alert.alert(
          'Invalid QR Time Limit',
          'Enter a valid QR time limit in seconds.'
        );
        return;
      }

      if (!Number.isFinite(rotation) || rotation <= 0) {
        Alert.alert(
          'Invalid QR Rotation',
          'Enter a valid QR rotation time in seconds.'
        );
        return;
      }

      if (rotation >= timeLimit) {
        Alert.alert(
          'QR Settings',
          'QR rotation should be shorter than the total QR time limit.'
        );
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        Alert.alert(
          'Not Signed In',
          'Please sign in again before starting attendance.'
        );
        return;
      }

      setStarting(true);

      const now = new Date();
      const isoNow = now.toISOString();

      /* -------------------------------------------------------
         CREATE SESSION CODE
      ------------------------------------------------------- */

      const newSessionCode =
        `ATT-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

      /* -------------------------------------------------------
         CREATE ATTENDANCE SESSION IN SUPABASE
      ------------------------------------------------------- */

      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          lecturer_id: user.id,
          course_id: selectedCourse.id,
          session_code: newSessionCode,
          topic: selectedCourse.course_title,
          class_date: now.toISOString().split('T')[0],
          start_time: now.toTimeString().split(' ')[0],
          duration: timeLimit,
          status: 'active',
          level: selectedLevel,
          qr_time_limit: timeLimit,
          qr_rotation_seconds: rotation,
          departments: selectedDepartments,
        })
        .select()
        .single();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error(
          'The attendance session could not be created.'
        );
      }

      /* -------------------------------------------------------
         SET ACTIVE SESSION
      ------------------------------------------------------- */

      setSessionId(session.id);
      setSessionCode(newSessionCode);
      setCreatedAt(isoNow);

      /*
       * IMPORTANT:
       * Set the ref immediately.
       *
       * React state updates are asynchronous, so the QR
       * rotation function should not depend on the new
       * sessionId state being available immediately.
       */
      activeSessionRef.current = session.id;

      /* -------------------------------------------------------
         LOAD STUDENTS
      ------------------------------------------------------- */

      await loadStudents(
        selectedDepartments,
        selectedLevel
      );

      /* -------------------------------------------------------
         GENERATE FIRST QR
      ------------------------------------------------------- */

      generateQR(
        session.id,
        newSessionCode,
        selectedCourse,
        selectedDepartments,
        selectedLevel,
        rotation
      );

      Alert.alert(
        'Attendance Started',
        `${selectedCourse.course_code} attendance is now active for ${selectedLevel}.`
      );
    } catch (error: any) {
      console.error('Error starting attendance:', error);

      Alert.alert(
        'Unable to Start Attendance',
        error?.message ||
          'Something went wrong while starting attendance.'
      );
    } finally {
      setStarting(false);
    }
  };

  /* =========================================================
     LOAD STUDENTS
  ========================================================= */

  const loadStudents = async (
    departmentList: string[],
    level: string
  ) => {
    try {
      setStudentsLoading(true);

      let query = supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          student_id,
          department,
          faculty,
          level
        `
        )
        .eq('role', 'student')
        .eq('level', level);

      /*
       * Multiple departments are allowed.
       */
      if (departmentList.length > 0) {
        query = query.in('department', departmentList);
      }

      const { data, error } = await query.order('full_name', {
        ascending: true,
      });

      if (error) {
        throw error;
      }

      setStudents(data || []);
    } catch (error: any) {
      console.error('Error loading students:', error);

      Alert.alert(
        'Students Not Loaded',
        error?.message ||
          'The attendance session was created, but the students could not be loaded.'
      );
    } finally {
      setStudentsLoading(false);
    }
  };

  /* =========================================================
     GENERATE / ROTATE QR
  ========================================================= */

  const generateQR = (
    attendanceSessionId: string,
    code: string,
    course: Course,
    departmentList: string[],
    level: string,
    rotation: number
  ) => {
    /*
     * Stop any previous timer.
     */
    if (qrTimerRef.current) {
      clearTimeout(qrTimerRef.current);
      qrTimerRef.current = null;
    }

    /*
     * Every QR gets a new timestamp/token.
     */
    const timestamp = Date.now();

    const rotatingToken =
      `${timestamp}-${Math.random()
        .toString(36)
        .substring(2, 10)}`;

    const attendanceData = [
      'CALEB_ATTENDANCE',
      attendanceSessionId,
      code,
      course.course_code,
      level,
      departmentList.join(','),
      rotatingToken,
    ].join('|');

    setQrData(attendanceData);

    setQrCounter((current) => current + 1);

    /*
     * Automatically rotate the QR.
     */
    qrTimerRef.current = setTimeout(() => {
      /*
       * Only rotate if this is still the active session.
       */
      if (activeSessionRef.current !== attendanceSessionId) {
        return;
      }

      generateQR(
        attendanceSessionId,
        code,
        course,
        departmentList,
        level,
        rotation
      );
    }, rotation * 1000);
  };

  /* =========================================================
     CREATE ANOTHER ATTENDANCE
  ========================================================= */

  const createAnotherAttendance = () => {
    /*
     * Stop QR rotation.
     */
    if (qrTimerRef.current) {
      clearTimeout(qrTimerRef.current);
      qrTimerRef.current = null;
    }

    /*
     * Mark previous session as inactive locally.
     */
    activeSessionRef.current = '';

    setQrData('');
    setSessionId('');
    setSessionCode('');
    setCreatedAt('');
    setStudents([]);

    /*
     * Keep departments selected.
     * Clear level and course.
     */
    setSelectedLevel('');
    setSelectedCourseId('');
    setQrCounter(0);
  };

  /* =========================================================
     FORMAT DATE
  ========================================================= */

  const formatCreatedTime = () => {
    if (!createdAt) {
      return '';
    }

    return new Date(createdAt).toLocaleString();
  };

  /* =========================================================
     NORMALIZE TEXT
     
     IMPORTANT FIX:
     course.level and course.department can be null.
     
     This function now accepts:
     string
     null
     undefined
  ========================================================= */

  function normalize(
    value: string | null | undefined
  ): string {
    return (value || '').trim().toLowerCase();
  }

  /* =========================================================
     LOADING SCREEN
  ========================================================= */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#4F46E5"
          />

          <Text style={styles.loadingText}>
            Loading attendance options...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =========================================================
     QR ACTIVE SCREEN
  ========================================================= */

  if (qrData && sessionId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              Attendance Active
            </Text>

            <Text style={styles.subtitle}>
              Students can now scan the rotating QR code.
            </Text>
          </View>

          <View style={styles.qrCard}>
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>
                ATTENDANCE SESSION ACTIVE
              </Text>
            </View>

            <Text style={styles.qrTitle}>
              {selectedCourse?.course_code}
            </Text>

            <Text style={styles.courseName}>
              {selectedCourse?.course_title}
            </Text>

            <View style={styles.classInfoCard}>
              <InfoRow
                label="Department"
                value={selectedDepartments.join(', ')}
              />

              <View style={styles.sessionDivider} />

              <InfoRow
                label="Level"
                value={selectedLevel}
              />

              <View style={styles.sessionDivider} />

              <InfoRow
                label="Students"
                value={`${students.length}`}
              />

              <View style={styles.sessionDivider} />

              <InfoRow
                label="QR Rotation"
                value={`${qrRotationSeconds} seconds`}
              />
            </View>

            <View style={styles.qrContainer}>
              <QRCode
                value={qrData}
                size={240}
                backgroundColor="#FFFFFF"
              />
            </View>

            <Text style={styles.rotationText}>
              QR code rotation #{qrCounter}
            </Text>

            <Text style={styles.instructionTitle}>
              Students: Scan this code
            </Text>

            <Text style={styles.instruction}>
              Open CalebConnect and scan the QR code to
              record attendance.
            </Text>

            <View style={styles.sessionCard}>
              <InfoRow
                label="Session ID"
                value={sessionId}
              />

              <View style={styles.sessionDivider} />

              <InfoRow
                label="Session Code"
                value={sessionCode}
              />

              <View style={styles.sessionDivider} />

              <InfoRow
                label="Started"
                value={formatCreatedTime()}
              />
            </View>
          </View>

          {/* STUDENT LIST */}

          <View style={styles.studentsCard}>
            <Text style={styles.studentsTitle}>
              Students for this class
            </Text>

            <Text style={styles.studentsSubtitle}>
              {selectedLevel} •{' '}
              {selectedDepartments.join(', ')}
            </Text>

            {studentsLoading ? (
              <View style={styles.studentLoading}>
                <ActivityIndicator
                  size="small"
                  color="#4F46E5"
                />

                <Text style={styles.studentLoadingText}>
                  Loading students...
                </Text>
              </View>
            ) : students.length === 0 ? (
              <View style={styles.emptyStudents}>
                <Text style={styles.emptyStudentsTitle}>
                  No students found
                </Text>

                <Text style={styles.emptyStudentsText}>
                  No student profile matches the selected
                  department and level.
                </Text>
              </View>
            ) : (
              students.map((student, index) => (
                <View
                  key={student.id}
                  style={styles.studentRow}
                >
                  <View style={styles.studentNumber}>
                    <Text style={styles.studentNumberText}>
                      {index + 1}
                    </Text>
                  </View>

                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.full_name}
                    </Text>

                    <Text style={styles.studentId}>
                      {student.student_id ||
                        'No Student ID'}
                    </Text>

                    <Text style={styles.studentDepartment}>
                      {student.department ||
                        'No Department'}
                    </Text>
                  </View>

                  <View style={styles.presentBadge}>
                    <Text style={styles.presentText}>
                      PRESENT
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.newButton}
            onPress={createAnotherAttendance}
            activeOpacity={0.8}
          >
            <Text style={styles.newButtonText}>
              Create Attendance for Another Level
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            CalebConnect
          </Text>

          <Text style={styles.footerSubtitle}>
            Your academic experience, connected.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =========================================================
     CREATE ATTENDANCE FORM
  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            Create Attendance
          </Text>

          <Text style={styles.subtitle}>
            Set up attendance for one level at a time.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.formIcon}>
              <Text style={styles.formIconText}>
                📷
              </Text>
            </View>

            <View style={styles.formHeaderText}>
              <Text style={styles.formTitle}>
                New Attendance Session
              </Text>

              <Text style={styles.formSubtitle}>
                Select department(s), one level and course.
              </Text>
            </View>
          </View>

          {/* =================================================
              DEPARTMENTS
          ================================================= */}

          <Text style={styles.sectionTitle}>
            1. Select Department
          </Text>

          <Text style={styles.helperText}>
            You may select multiple departments only when
            this is a joint class.
          </Text>

          <View style={styles.optionsContainer}>
            {departments.map((department) => {
              const selected =
                selectedDepartments.includes(department);

              return (
                <TouchableOpacity
                  key={department}
                  style={[
                    styles.optionButton,
                    selected &&
                      styles.optionButtonSelected,
                  ]}
                  onPress={() =>
                    toggleDepartment(department)
                  }
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected &&
                        styles.checkboxSelected,
                    ]}
                  >
                    {selected && (
                      <Text style={styles.checkmark}>
                        ✓
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.optionText,
                      selected &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {department}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDepartments.length > 1 && (
            <View style={styles.jointClassBox}>
              <Text style={styles.jointClassTitle}>
                JOINT CLASS
              </Text>

              <Text style={styles.jointClassText}>
                {selectedDepartments.join(' + ')}
              </Text>
            </View>
          )}

          {/* =================================================
              LEVEL
          ================================================= */}

          <Text style={styles.sectionTitle}>
            2. Select ONE Level
          </Text>

          <Text style={styles.helperText}>
            Only one level can be selected for an attendance
            session. Different levels cannot be joined together.
          </Text>

          <View style={styles.optionsContainer}>
            {levels.map((level) => {
              const selected =
                normalize(selectedLevel) ===
                normalize(level);

              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelButton,
                    selected &&
                      styles.levelButtonSelected,
                  ]}
                  onPress={() => selectLevel(level)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.radio,
                      selected &&
                        styles.radioSelected,
                    ]}
                  >
                    {selected && (
                      <View style={styles.radioDot} />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.levelText,
                      selected &&
                        styles.levelTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* =================================================
              COURSE
          ================================================= */}

          <Text style={styles.sectionTitle}>
            3. Select Course
          </Text>

          {!selectedLevel ? (
            <View style={styles.disabledBox}>
              <Text style={styles.disabledText}>
                Select a level first to see courses.
              </Text>
            </View>
          ) : availableCourses.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxTitle}>
                No courses found
              </Text>

              <Text style={styles.emptyBoxText}>
                There are no courses assigned to you for
                {` ${selectedLevel}`} and the selected
                department(s).
              </Text>
            </View>
          ) : (
            <View style={styles.courseList}>
              {availableCourses.map((course) => {
                const selected =
                  selectedCourseId === course.id;

                return (
                  <TouchableOpacity
                    key={course.id}
                    style={[
                      styles.courseButton,
                      selected &&
                        styles.courseButtonSelected,
                    ]}
                    onPress={() =>
                      setSelectedCourseId(course.id)
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radio,
                        selected &&
                          styles.radioSelected,
                      ]}
                    >
                      {selected && (
                        <View style={styles.radioDot} />
                      )}
                    </View>

                    <View style={styles.courseInfo}>
                      <Text
                        style={[
                          styles.courseCodeText,
                          selected &&
                            styles.courseCodeTextSelected,
                        ]}
                      >
                        {course.course_code}
                      </Text>

                      <Text style={styles.courseTitleText}>
                        {course.course_title}
                      </Text>

                      <Text style={styles.courseMetaText}>
                        {course.department ||
                          'Department not set'}
                        {course.semester
                          ? ` • ${course.semester}`
                          : ''}
                        {course.credit_unit
                          ? ` • ${course.credit_unit} Unit`
                          : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* =================================================
              QR TIME LIMIT
          ================================================= */}

          <Text style={styles.sectionTitle}>
            4. QR Time Limit
          </Text>

          <View style={styles.numberOptions}>
            {['30', '60', '120'].map((value) => {
              const selected =
                qrTimeLimit === value;

              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.numberButton,
                    selected &&
                      styles.numberButtonSelected,
                  ]}
                  onPress={() =>
                    setQrTimeLimit(value)
                  }
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      selected &&
                        styles.numberButtonTextSelected,
                    ]}
                  >
                    {value}s
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* =================================================
              QR ROTATION
          ================================================= */}

          <Text style={styles.sectionTitle}>
            5. QR Rotation
          </Text>

          <View style={styles.numberOptions}>
            {['5', '10', '15'].map((value) => {
              const selected =
                qrRotationSeconds === value;

              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.numberButton,
                    selected &&
                      styles.numberButtonSelected,
                  ]}
                  onPress={() =>
                    setQrRotationSeconds(value)
                  }
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      selected &&
                        styles.numberButtonTextSelected,
                    ]}
                  >
                    {value}s
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>
              Attendance Summary
            </Text>

            <SummaryRow
              label="Department(s)"
              value={
                selectedDepartments.length
                  ? selectedDepartments.join(', ')
                  : 'Not selected'
              }
            />

            <SummaryRow
              label="Level"
              value={
                selectedLevel || 'Not selected'
              }
            />

            <SummaryRow
              label="Course"
              value={
                selectedCourse
                  ? `${selectedCourse.course_code} — ${selectedCourse.course_title}`
                  : 'Not selected'
              }
            />

            <SummaryRow
              label="QR Time Limit"
              value={`${qrTimeLimit} seconds`}
            />

            <SummaryRow
              label="QR Rotation"
              value={`${qrRotationSeconds} seconds`}
            />
          </View>

          {/* =================================================
              START BUTTON
          ================================================= */}

          <TouchableOpacity
            style={[
              styles.generateButton,
              starting &&
                styles.generateButtonDisabled,
            ]}
            onPress={startAttendance}
            disabled={starting}
            activeOpacity={0.8}
          >
            {starting ? (
              <>
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />

                <Text style={styles.generateButtonText}>
                  Starting Attendance...
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.generateIcon}>
                  ✓
                </Text>

                <Text style={styles.generateButtonText}>
                  START ATTENDANCE
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>
              ℹ
            </Text>

            <Text style={styles.infoText}>
              The attendance list will contain only students
              who belong to the selected department(s) and
              selected level.
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          CalebConnect
        </Text>

        <Text style={styles.footerSubtitle}>
          Your academic experience, connected.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.sessionRow}>
      <Text style={styles.sessionLabel}>
        {label}
      </Text>

      <Text style={styles.sessionValue}>
        {value}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    marginTop: 15,
    fontSize: 15,
    color: '#6B7280',
  },

  header: {
    paddingTop: 35,
    marginBottom: 25,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 5,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
  },

  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  formIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  formIconText: {
    fontSize: 25,
  },

  formHeaderText: {
    flex: 1,
  },

  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  formSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 25,
    marginBottom: 7,
  },

  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    marginBottom: 12,
  },

  optionsContainer: {
    gap: 9,
  },

  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    padding: 14,
  },

  optionButtonSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  checkboxSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  optionTextSelected: {
    color: '#3730A3',
    fontWeight: '800',
  },

  jointClassBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 13,
    padding: 13,
    marginTop: 12,
  },

  jointClassTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.8,
  },

  jointClassText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
    marginTop: 3,
  },

  levelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    padding: 15,
  },

  levelButtonSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  radioSelected: {
    borderColor: '#4F46E5',
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4F46E5',
  },

  levelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },

  levelTextSelected: {
    color: '#3730A3',
    fontWeight: '800',
  },

  disabledBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 13,
    padding: 16,
  },

  disabledText: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  emptyBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 13,
    padding: 16,
  },

  emptyBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },

  emptyBoxText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#B91C1C',
    marginTop: 4,
  },

  courseList: {
    gap: 10,
  },

  courseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
  },

  courseButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },

  courseInfo: {
    flex: 1,
  },

  courseCodeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#374151',
  },

  courseCodeTextSelected: {
    color: '#3730A3',
  },

  courseTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 3,
  },

  courseMetaText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 5,
  },

  numberOptions: {
    flexDirection: 'row',
    gap: 10,
  },

  numberButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },

  numberButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },

  numberButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  numberButtonTextSelected: {
    color: '#3730A3',
    fontWeight: '900',
  },

  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 15,
    padding: 15,
    marginTop: 25,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },

  summaryLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    width: '35%',
  },

  summaryValue: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },

  generateButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
    flexDirection: 'row',
  },

  generateButtonDisabled: {
    opacity: 0.65,
  },

  generateIcon: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginRight: 8,
  },

  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },

  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 13,
    padding: 13,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E0E7FF',
    color: '#4F46E5',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: '800',
    marginRight: 9,
  },

  infoText: {
    flex: 1,
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 17,
  },

  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },

  successBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 15,
  },

  successBadgeText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  qrTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },

  courseName: {
    fontSize: 14,
    color: '#374151',
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 21,
  },

  classInfoCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },

  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  rotationText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 8,
  },

  instructionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },

  instruction: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },

  sessionCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
  },

  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sessionLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
  },

  sessionValue: {
    flex: 1,
    marginLeft: 15,
    fontSize: 11,
    color: '#374151',
    fontWeight: '700',
    textAlign: 'right',
  },

  sessionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 11,
  },

  studentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginTop: 18,
  },

  studentsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },

  studentsSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 12,
  },

  studentLoading: {
    alignItems: 'center',
    paddingVertical: 25,
  },

  studentLoadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },

  emptyStudents: {
    backgroundColor: '#FEF2F2',
    borderRadius: 13,
    padding: 15,
  },

  emptyStudentsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },

  emptyStudentsText: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 4,
    lineHeight: 18,
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  studentNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  studentNumberText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4F46E5',
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },

  studentId: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },

  studentDepartment: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },

  presentBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },

  presentText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#15803D',
  },

  newButton: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },

  newButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  footer: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    marginTop: 35,
  },

  footerSubtitle: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});