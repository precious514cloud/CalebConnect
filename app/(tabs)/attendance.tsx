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

type StudentProfile = {
  fullName: string;
  matricNumber: string;
  programme: string;
  level: string;
};

type AttendanceRecord = {
  id: string;
  courseCode: string;
  courseTitle: string;
  date: string;
  time: string;
  venue: string;
  status: 'Present' | 'Absent';
};

type DatabaseProfile = {
  id: string;
  full_name: string;
  student_id: string | null;
  department: string | null;
  level: string | null;
};

export default function AttendanceScreen() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingScanner, setOpeningScanner] = useState(false);

  /*
   * LOAD THE CURRENT STUDENT'S ATTENDANCE
   */
  const loadAttendance = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Load the locally saved student profile.
      const savedProfile = await AsyncStorage.getItem(PROFILE_KEY);

      if (!savedProfile) {
        setAttendance([]);

        Alert.alert(
          'Student Profile Required',
          'Please complete your student profile before viewing attendance.',
          [
            {
              text: 'Set Up Profile',
              onPress: () => router.replace('/student-setup'),
            },
          ]
        );

        return;
      }

      const localProfile: StudentProfile = JSON.parse(savedProfile);

      if (!localProfile.matricNumber?.trim()) {
        setAttendance([]);

        Alert.alert(
          'Incomplete Profile',
          'Your matric number is missing. Please update your student profile.'
        );

        return;
      }

      // 2. Find the student's database profile using their matric number.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department, level')
        .eq('student_id', localProfile.matricNumber.trim())
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      let student: DatabaseProfile | null =
        profileData as DatabaseProfile | null;

      // 3. Fall back to the authenticated user's profile if necessary.
      if (!student) {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (authData.user?.id) {
          const { data: authProfile, error: authProfileError } =
            await supabase
              .from('profiles')
              .select('id, full_name, student_id, department, level')
              .eq('id', authData.user.id)
              .maybeSingle();

          if (authProfileError) {
            throw authProfileError;
          }

          student = authProfile as DatabaseProfile | null;
        }
      }

      if (!student) {
        setAttendance([]);

        Alert.alert(
          'Student Not Found',
          'Your student profile could not be found in the CalebConnect database. Please check your matric number and registration.'
        );

        return;
      }

      // 4. Fetch attendance records belonging ONLY to this student.
      const { data: records, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          session_id,
          status,
          scanned_at,
          attendance_sessions!inner (
            id,
            class_date,
            start_time,
            venue,
            status,
            level,
            courses!inner (
              course_code,
              course_title
            )
          )
        `)
        .eq('student_id', student.id)
        .order('scanned_at', { ascending: false });

      if (attendanceError) {
        throw attendanceError;
      }

      // Keep one attendance entry per session.
      const recordsBySession = new Map<string, AttendanceRecord>();

      (records ?? []).forEach((record: any) => {
        const session = Array.isArray(record.attendance_sessions)
          ? record.attendance_sessions[0]
          : record.attendance_sessions;

        const course = Array.isArray(session?.courses)
          ? session.courses[0]
          : session?.courses;

        if (!session || !record.session_id) {
          return;
        }

        const normalizedStatus: 'Present' | 'Absent' =
          String(record.status || '').toLowerCase() === 'present'
            ? 'Present'
            : 'Absent';

        recordsBySession.set(record.session_id, {
          id: record.id,
          courseCode: course?.course_code || 'Course',
          courseTitle:
            course?.course_title || 'Course title unavailable',
          date: session.class_date || '',
          time: session.start_time || '',
          venue: session.venue || '',
          status: normalizedStatus,
        });
      });

      /*
       * 5. Find sessions assigned to the student's department.
       *
       * The attendance_session_departments table supports joint classes.
       * A student should be considered only for sessions that include
       * their own department and match their level.
       */
      if (student.department?.trim() && student.level?.trim()) {
        const { data: departmentSessions, error: departmentError } =
          await supabase
            .from('attendance_session_departments')
            .select('session_id')
            .eq('department', student.department.trim());

        if (departmentError) {
          throw departmentError;
        }

        const sessionIds = [
          ...new Set(
            (departmentSessions ?? [])
              .map((item: any) => item.session_id)
              .filter((id: string | null) => Boolean(id))
          ),
        ];

        if (sessionIds.length > 0) {
          // Use the device's local calendar date for comparison.
          const currentDate = new Date();
          const today = [
            currentDate.getFullYear(),
            String(currentDate.getMonth() + 1).padStart(2, '0'),
            String(currentDate.getDate()).padStart(2, '0'),
          ].join('-');

          /*
           * 6. Load past sessions for this level that are no longer active.
           *
           * IMPORTANT:
           * This treats past non-active sessions as eligible for absence
           * calculation. If your database uses a status such as
           * "cancelled", cancelled sessions must be excluded separately.
           */
          const { data: expectedSessions, error: sessionsError } =
            await supabase
              .from('attendance_sessions')
              .select(`
                id,
                class_date,
                start_time,
                venue,
                status,
                level,
                courses!inner (
                  course_code,
                  course_title
                )
              `)
              .in('id', sessionIds)
              .eq('level', student.level.trim())
              .lte('class_date', today)
              .neq('status', 'active');

          if (sessionsError) {
            throw sessionsError;
          }

          // 7. If an eligible session has no attendance record, show Absent.
          (expectedSessions ?? []).forEach((session: any) => {
            if (recordsBySession.has(session.id)) {
              return;
            }

            const course = Array.isArray(session.courses)
              ? session.courses[0]
              : session.courses;

            recordsBySession.set(session.id, {
              id: `absent-${session.id}`,
              courseCode: course?.course_code || 'Course',
              courseTitle:
                course?.course_title || 'Course title unavailable',
              date: session.class_date || '',
              time: session.start_time || '',
              venue: session.venue || '',
              status: 'Absent',
            });
          });
        }
      } else {
        console.warn(
          'The student profile is missing a department or level. Missed classes cannot be calculated reliably.'
        );
      }

      // 8. Sort the combined attendance records by date and time.
      const mappedRecords = Array.from(recordsBySession.values()).sort(
        (a, b) => {
          const dateComparison = b.date.localeCompare(a.date);

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return b.time.localeCompare(a.time);
        }
      );

      setAttendance(mappedRecords);
    } catch (error: any) {
      console.error('Load student attendance error:', error);
      setAttendance([]);

      Alert.alert(
        'Unable to Load Attendance',
        error?.message ||
          'We could not retrieve your attendance records. Please check your connection and database permissions, then try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload attendance whenever the student opens this screen.
  useFocusEffect(
    useCallback(() => {
      loadAttendance();
    }, [loadAttendance])
  );

  /*
   * OPEN THE QR SCANNER
   */
  const openScanner = () => {
    if (openingScanner) {
      return;
    }

    setOpeningScanner(true);

    try {
      router.push('/attendance-scanner');
    } catch (error) {
      console.error('Unable to open attendance scanner:', error);
      setOpeningScanner(false);
    }
  };

  /*
   * ATTENDANCE SUMMARY
   */
  const presentCount = attendance.filter(
    (record) => record.status === 'Present'
  ).length;

  const absentCount = attendance.filter(
    (record) => record.status === 'Absent'
  ).length;

  const totalClasses = presentCount + absentCount;

  const attendanceRate =
    totalClasses > 0
      ? Math.round((presentCount / totalClasses) * 100)
      : 0;

  /*
   * LOADING SCREEN
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading attendance...</Text>
      </SafeAreaView>
    );
  }

  /*
   * MAIN ATTENDANCE SCREEN
   */
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.subtitle}>
            Track your lecture attendance
          </Text>
        </View>

        {/* QR SCANNER CARD */}
        <View style={styles.scanCard}>
          <View style={styles.qrBox}>
            <Text style={styles.qrIcon}>▦</Text>
          </View>

          <Text style={styles.scanTitle}>Scan Attendance QR</Text>

          <Text style={styles.scanDescription}>
            Scan the current QR code displayed by your lecturer or
            course representative to record your attendance.
          </Text>

          <TouchableOpacity
            style={[
              styles.scanButton,
              openingScanner && styles.scanButtonDisabled,
            ]}
            onPress={openScanner}
            disabled={openingScanner}
            activeOpacity={0.8}
          >
            {openingScanner ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.scanButtonText}>Scan QR Code</Text>
                <Text style={styles.scanButtonArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadAttendance}
            disabled={loading}
          >
            <Text style={styles.refreshButtonText}>
              Refresh Attendance
            </Text>
          </TouchableOpacity>
        </View>

        {/* ATTENDANCE RECORDS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance Records</Text>

          {attendance.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📋</Text>

              <Text style={styles.emptyTitle}>
                No attendance recorded yet
              </Text>

              <Text style={styles.emptyText}>
                Your personal attendance records will appear here
                when classes are recorded in CalebConnect.
              </Text>
            </View>
          ) : (
            attendance.map((item) => (
              <View style={styles.attendanceCard} key={item.id}>
                <View style={styles.attendanceTopRow}>
                  <View style={styles.courseDetails}>
                    <Text style={styles.courseCode}>
                      {item.courseCode}
                    </Text>

                    <Text style={styles.courseName}>
                      {item.courseTitle}
                    </Text>

                    <Text style={styles.courseInfo}>
                      {item.date}
                      {item.time ? ` • ${item.time}` : ''}
                    </Text>

                    {item.venue ? (
                      <Text style={styles.courseInfo}>
                        {item.venue}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={
                      item.status === 'Present'
                        ? styles.presentBadge
                        : styles.absentBadge
                    }
                  >
                    <Text
                      style={
                        item.status === 'Present'
                          ? styles.presentText
                          : styles.absentText
                      }
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ATTENDANCE SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance Summary</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{presentCount}</Text>
              <Text style={styles.summaryLabel}>Present</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.absentNumber}>{absentCount}</Text>
              <Text style={styles.summaryLabel}>Absent</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>
                {attendanceRate}%
              </Text>
              <Text style={styles.summaryLabel}>Rate</Text>
            </View>
          </View>

          <Text style={styles.summaryNote}>
            Attendance rate is calculated from the present and absent
            sessions currently displayed for your profile.
          </Text>
        </View>

        <Text style={styles.footer}>CalebConnect</Text>

        <Text style={styles.footerSubtext}>
          Your attendance, connected.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * STYLES
 */
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
    backgroundColor: '#f5f7fb',
  },
  contentContainer: {
    paddingBottom: 45,
  },
  header: {
    paddingTop: 25,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 5,
  },
  scanCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  qrBox: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  qrIcon: {
    fontSize: 60,
    color: '#4f46e5',
  },
  scanTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },
  scanDescription: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  scanButton: {
    width: '100%',
    backgroundColor: '#4f46e5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 13,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonDisabled: {
    opacity: 0.7,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  scanButtonArrow: {
    color: '#ffffff',
    fontSize: 20,
    marginLeft: 10,
  },
  refreshButton: {
    marginTop: 14,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 35,
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
  attendanceCard: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 18,
    marginBottom: 10,
  },
  attendanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseDetails: {
    flex: 1,
    paddingRight: 10,
  },
  courseCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
    marginBottom: 3,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  courseInfo: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 5,
    lineHeight: 18,
  },
  presentBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  presentText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  absentBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  absentText: {
    color: '#b91c1c',
    fontSize: 10,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4f46e5',
  },
  absentNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#dc2626',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 5,
  },
  summaryNote: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  footer: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#4f46e5',
    marginTop: 40,
  },
  footerSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
});