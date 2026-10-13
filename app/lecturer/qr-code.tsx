import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { supabase } from '../../lib/supabase';

const SESSION_KEY =
  '@calebconnect_attendance_session';

const LECTURER_ID_KEY =
  '@calebconnect_lecturer_id';

type AttendanceSession = {
  sessionId: string;
  lecturerId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  topic?: string;
  date: string;
  startTime: string;
  duration: number | string;
  venue?: string;
  level?: string;
  status?: string;
  qrRotationSeconds?: number;
  sessionCode?: string;
};

type SupabaseSessionRow = {
  id: string;
  lecturer_id: string;
  course_id: string;
  session_code: string;
  topic: string | null;
  class_date: string;
  start_time: string | null;
  duration: number | null;
  venue: string | null;
  status: string;
  level: string | null;
  qr_rotation_seconds: number | null;
  created_at?: string;
};

type CourseRow = {
  id: string;
  course_code: string;
  course_title: string;
  department?: string | null;
  level?: string | null;
};

export default function QRCodeScreen() {
  const [session, setSession] =
    useState<AttendanceSession | null>(null);

  const [lecturerId, setLecturerId] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  useEffect(() => {
    loadSession();

    const interval = setInterval(() => {
      loadLatestSessionSilently();
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * LOAD SESSION
   *
   * First try the live Supabase database.
   * If that fails, fall back to AsyncStorage.
   */
  async function loadSession() {
    try {
      setLoading(true);

      const savedLecturerId =
        await AsyncStorage.getItem(
          LECTURER_ID_KEY
        );

      if (!savedLecturerId) {
        setLecturerId('');

        Alert.alert(
          'Lecturer not found',
          'Please return to the lecturer dashboard and sign in again.'
        );

        setSession(null);
        return;
      }

      setLecturerId(savedLecturerId);

      /*
       * FIRST:
       * Get the latest active session belonging
       * to this lecturer directly from Supabase.
       */
      const { data: sessionData, error: sessionError } =
        await supabase
          .from('attendance_sessions')
          .select(
            `
              id,
              lecturer_id,
              course_id,
              session_code,
              topic,
              class_date,
              start_time,
              duration,
              venue,
              status,
              level,
              qr_rotation_seconds,
              created_at
            `
          )
          .eq(
            'lecturer_id',
            savedLecturerId
          )
          .eq(
            'status',
            'active'
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (sessionError) {
        console.error(
          'Error loading attendance session:',
          sessionError
        );

        /*
         * Try local storage if Supabase fails.
         */
        await loadSavedSession(
          savedLecturerId
        );

        return;
      }

      if (!sessionData) {
        /*
         * There is currently no active session.
         * Try local storage as a fallback.
         */
        await loadSavedSession(
          savedLecturerId
        );

        return;
      }

      const typedSession =
        sessionData as SupabaseSessionRow;

      /*
       * Get course information.
       */
      const {
        data: courseData,
        error: courseError,
      } = await supabase
        .from('courses')
        .select(
          `
            id,
            course_code,
            course_title,
            department,
            level
          `
        )
        .eq(
          'id',
          typedSession.course_id
        )
        .maybeSingle();

      if (courseError) {
        console.error(
          'Error loading session course:',
          courseError
        );
      }

      const course =
        courseData as CourseRow | null;

      /*
       * Build the application session object.
       */
      const sessionObject: AttendanceSession = {
        sessionId:
          typedSession.id,

        lecturerId:
          typedSession.lecturer_id,

        courseId:
          typedSession.course_id,

        courseCode:
          course?.course_code ||
          'Course',

        courseTitle:
          course?.course_title ||
          'Attendance Session',

        topic:
          typedSession.topic ||
          '',

        date:
          typedSession.class_date,

        startTime:
          typedSession.start_time
            ? String(
                typedSession.start_time
              ).substring(0, 5)
            : '',

        duration:
          typedSession.duration ??
          60,

        venue:
          typedSession.venue ||
          '',

        level:
          typedSession.level ||
          course?.level ||
          '',

        status:
          typedSession.status,

        qrRotationSeconds:
          typedSession.qr_rotation_seconds ??
          10,

        sessionCode:
          typedSession.session_code,
      };

      /*
       * Save the live session locally too.
       * This gives us a fallback if the user
       * temporarily loses connection.
       */
      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify(
          sessionObject
        )
      );

      setSession(
        sessionObject
      );
    } catch (error) {
      console.error(
        'Load attendance session error:',
        error
      );

      /*
       * Last fallback:
       * load locally saved session.
       */
      const savedLecturerId =
        await AsyncStorage.getItem(
          LECTURER_ID_KEY
        );

      if (savedLecturerId) {
        await loadSavedSession(
          savedLecturerId
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * SILENT REFRESH
   *
   * Keeps the QR page connected to the
   * currently active session.
   */
  async function loadLatestSessionSilently() {
    try {
      const savedLecturerId =
        await AsyncStorage.getItem(
          LECTURER_ID_KEY
        );

      if (!savedLecturerId) {
        return;
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase
        .from('attendance_sessions')
        .select(
          `
            id,
            lecturer_id,
            course_id,
            session_code,
            topic,
            class_date,
            start_time,
            duration,
            venue,
            status,
            level,
            qr_rotation_seconds,
            created_at
          `
        )
        .eq(
          'lecturer_id',
          savedLecturerId
        )
        .eq(
          'status',
          'active'
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (
        sessionError ||
        !sessionData
      ) {
        return;
      }

      const typedSession =
        sessionData as SupabaseSessionRow;

      const {
        data: courseData,
      } = await supabase
        .from('courses')
        .select(
          `
            id,
            course_code,
            course_title,
            department,
            level
          `
        )
        .eq(
          'id',
          typedSession.course_id
        )
        .maybeSingle();

      const course =
        courseData as CourseRow | null;

      const sessionObject: AttendanceSession = {
        sessionId:
          typedSession.id,

        lecturerId:
          typedSession.lecturer_id,

        courseId:
          typedSession.course_id,

        courseCode:
          course?.course_code ||
          'Course',

        courseTitle:
          course?.course_title ||
          'Attendance Session',

        topic:
          typedSession.topic ||
          '',

        date:
          typedSession.class_date,

        startTime:
          typedSession.start_time
            ? String(
                typedSession.start_time
              ).substring(0, 5)
            : '',

        duration:
          typedSession.duration ??
          60,

        venue:
          typedSession.venue ||
          '',

        level:
          typedSession.level ||
          course?.level ||
          '',

        status:
          typedSession.status,

        qrRotationSeconds:
          typedSession.qr_rotation_seconds ??
          10,

        sessionCode:
          typedSession.session_code,
      };

      setSession(
        sessionObject
      );

      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify(
          sessionObject
        )
      );
    } catch (error) {
      console.log(
        'Silent session refresh error:',
        error
      );
    }
  }

  /**
   * LOCAL FALLBACK
   */
  async function loadSavedSession(
    currentLecturerId: string
  ) {
    try {
      const savedSession =
        await AsyncStorage.getItem(
          SESSION_KEY
        );

      if (!savedSession) {
        setSession(null);
        return;
      }

      const parsedSession =
        JSON.parse(
          savedSession
        ) as AttendanceSession;

      /*
       * Never display another lecturer's
       * session.
       */
      if (
        parsedSession.lecturerId !==
        currentLecturerId
      ) {
        console.log(
          'Saved session belongs to another lecturer.'
        );

        setSession(null);
        return;
      }

      setSession(
        parsedSession
      );
    } catch (error) {
      console.log(
        'Load saved session error:',
        error
      );

      setSession(null);
    }
  }

  /**
   * MANUAL REFRESH
   */
  async function refreshSession() {
    try {
      setRefreshing(true);
      await loadSession();
    } finally {
      setRefreshing(false);
    }
  }

  /*
   * QR DATA
   *
   * We are keeping the existing format for now
   * so we do not break the student's scanner.
   *
   * We will make this a rotating secure QR token
   * in the next stage.
   */
  const qrValue =
    session &&
    session.lecturerId &&
    session.sessionId
      ? [
          'CALEB_ATTENDANCE',

          session.lecturerId,

          session.sessionId,

          session.courseCode,

          session.courseTitle,

          session.topic || '',

          session.date,

          session.startTime,

          String(
            session.duration
          ),

          session.venue || '',
        ].join('|')
      : '';

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color="#16A34A"
          />

          <Text
            style={styles.loadingText}
          >
            Loading attendance session...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
      >

        {/* BACK BUTTON */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
          activeOpacity={0.7}
        >
          <Text
            style={styles.backArrow}
          >
            ‹
          </Text>

          <Text
            style={styles.backText}
          >
            Back
          </Text>
        </TouchableOpacity>

        {/* HEADER */}
        <Text style={styles.title}>
          Attendance QR Code
        </Text>

        <Text style={styles.subtitle}>
          Display this QR code for your
          students to scan.
        </Text>

        {/* REFRESH */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={
            refreshSession
          }
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color="#166534"
            />
          ) : (
            <Text
              style={
                styles.refreshButtonText
              }
            >
              ↻ Refresh Session
            </Text>
          )}
        </TouchableOpacity>

        {/* QR CARD */}
        <View style={styles.qrCard}>

          {session &&
          qrValue ? (
            <>
              {/* QR */}
              <View
                style={
                  styles.qrContainer
                }
              >
                <QRCode
                  value={
                    qrValue
                  }
                  size={230}
                  backgroundColor="#FFFFFF"
                  color="#111827"
                />
              </View>

              {/* SESSION CODE */}
              <Text
                style={
                  styles.sessionLabel
                }
              >
                SESSION CODE
              </Text>

              <Text
                style={
                  styles.sessionId
                }
              >
                {session.sessionCode ||
                  session.sessionId}
              </Text>

              {/* COURSE */}
              <View
                style={
                  styles.sessionInfo
                }
              >
                <Text
                  style={
                    styles.courseCode
                  }
                >
                  {session.courseCode}
                </Text>

                <Text
                  style={
                    styles.courseTitle
                  }
                >
                  {session.courseTitle}
                </Text>

                {/* TOPIC */}
                {session.topic ? (
                  <Text
                    style={
                      styles.topic
                    }
                  >
                    {session.topic}
                  </Text>
                ) : null}

                {/* DATE / TIME */}
                <View
                  style={
                    styles.detailsRow
                  }
                >
                  <Text
                    style={
                      styles.detail
                    }
                  >
                    📅 {session.date}
                  </Text>

                  <Text
                    style={
                      styles.detail
                    }
                  >
                    🕐 {session.startTime}
                  </Text>
                </View>

                {/* LEVEL */}
                {session.level ? (
                  <Text
                    style={
                      styles.detail
                    }
                  >
                    🎓 Level {session.level}
                  </Text>
                ) : null}

                {/* VENUE */}
                {session.venue ? (
                  <Text
                    style={
                      styles.detail
                    }
                  >
                    📍 {session.venue}
                  </Text>
                ) : null}

                {/* DURATION */}
                <Text
                  style={
                    styles.duration
                  }
                >
                  Duration:{' '}
                  {session.duration}{' '}
                  minutes
                </Text>

                {/* QR ROTATION */}
                <Text
                  style={
                    styles.rotation
                  }
                >
                  QR rotation:{' '}
                  every{' '}
                  {session.qrRotationSeconds ||
                    10}{' '}
                  seconds
                </Text>
              </View>
            </>
          ) : (
            /* NO SESSION */
            <View
              style={
                styles.noSession
              }
            >
              <Text
                style={
                  styles.noSessionIcon
                }
              >
                ⚠️
              </Text>

              <Text
                style={
                  styles.noSessionTitle
                }
              >
                No Attendance Session
              </Text>

              <Text
                style={
                  styles.noSessionText
                }
              >
                No active attendance session
                was found for your lecturer
                account.
              </Text>

              <TouchableOpacity
                style={
                  styles.createButton
                }
                onPress={() =>
                  router.push(
                    '/lecturer/create-session'
                  )
                }
              >
                <Text
                  style={
                    styles.createButtonText
                  }
                >
                  Create Attendance Session
                </Text>

                <Text
                  style={
                    styles.buttonArrow
                  }
                >
                  →
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        {/* STUDENT NOTICE */}
        <View
          style={styles.notice}
        >
          <Text
            style={
              styles.noticeIcon
            }
          >
            📱
          </Text>

          <View
            style={
              styles.noticeContent
            }
          >
            <Text
              style={
                styles.noticeTitle
              }
            >
              Student Attendance
            </Text>

            <Text
              style={
                styles.noticeText
              }
            >
              Ask your students to open
              CalebConnect and scan this
              QR code to record their
              attendance.
            </Text>
          </View>
        </View>

        {/* SECURITY CARD */}
        <View
          style={
            styles.securityCard
          }
        >
          <Text
            style={
              styles.securityIcon
            }
          >
            🔐
          </Text>

          <View
            style={
              styles.securityContent
            }
          >
            <Text
              style={
                styles.securityTitle
              }
            >
              Lecturer-Linked Session
            </Text>

            <Text
              style={
                styles.securityText
              }
            >
              This QR code is linked to
              lecturer{' '}
              {lecturerId || 'ID'} and
              this specific attendance
              session.
            </Text>
          </View>
        </View>

        {/* FOOTER */}
        <Text
          style={styles.footer}
        >
          CalebConnect
        </Text>

        <Text
          style={
            styles.footerSubtext
          }
        >
          Lecturer Portal
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 28,
  },

  backArrow: {
    fontSize: 34,
    color: '#111827',
    marginRight: 5,
    lineHeight: 34,
  },

  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 14,
  },

  refreshButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  refreshButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },

  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 25,
    alignItems: 'center',
  },

  qrContainer: {
    width: 270,
    height: 270,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sessionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginTop: 22,
    letterSpacing: 1,
  },

  sessionId: {
    fontSize: 23,
    fontWeight: '900',
    color: '#166534',
    marginTop: 5,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  sessionInfo: {
    width: '100%',
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },

  courseCode: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },

  courseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
    textAlign: 'center',
  },

  topic: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 7,
    textAlign: 'center',
  },

  detailsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 15,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  detail: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 8,
    textAlign: 'center',
  },

  duration: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    marginTop: 8,
  },

  rotation: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 7,
  },

  noSession: {
    alignItems: 'center',
    paddingVertical: 25,
  },

  noSessionIcon: {
    fontSize: 45,
  },

  noSessionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
  },

  noSessionText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 7,
  },

  createButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 18,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 9,
  },

  notice: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    marginTop: 18,
  },

  noticeIcon: {
    fontSize: 22,
    marginRight: 11,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },

  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
    marginTop: 4,
  },

  securityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    marginTop: 14,
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
    color: '#111827',
  },

  securityText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
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