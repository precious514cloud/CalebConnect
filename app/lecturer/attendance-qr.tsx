import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type SessionData = {
  id: string;
  lecturer_id: string;
  course_id: string;
  session_code: string;
  topic: string | null;
  class_date: string;
  start_time: string | null;
  duration: number;
  qr_time_limit: number | null;
  qr_rotation_seconds: number | null;
  venue: string | null;
  status: string;
  level: string | null;
  created_at: string;
  updated_at: string;
};

type CourseData = {
  id: string;
  course_code: string;
  course_title: string;
  department: string;
  department_id: string | null;
  faculty: string | null;
  level: string;
  semester: string | null;
  credit_unit: number | null;
};

const formatTimer = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
};

export default function AttendanceQRScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string;
    sessionCode?: string;
    sessionStartedAt?: string;
  }>();

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  const routeSessionCode = Array.isArray(params.sessionCode)
    ? params.sessionCode[0]
    : params.sessionCode;

  const routeSessionStartedAt = Array.isArray(
    params.sessionStartedAt
  )
    ? params.sessionStartedAt[0]
    : params.sessionStartedAt;

  const [session, setSession] = useState<SessionData | null>(null);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  const [sessionRemaining, setSessionRemaining] = useState(0);
  const [rotationRemaining, setRotationRemaining] = useState(0);

  // QR version always starts at 1.
  const [rotationNumber, setRotationNumber] = useState(1);
  const [qrIssuedAt, setQrIssuedAt] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Prevent the session duration from resetting on re-renders.
  const sessionTimerStartedRef = useRef(false);

  // Prevent automatic closing from being triggered more than once.
  const automaticCloseStartedRef = useRef(false);

  const closeSessionAutomatically = useCallback(async () => {
    if (!sessionId || automaticCloseStartedRef.current) {
      return;
    }

    automaticCloseStartedRef.current = true;

    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId);

      if (error) {
        console.error('Automatic session close error:', error);
        automaticCloseStartedRef.current = false;
        return;
      }

      setSession((current) =>
        current
          ? {
              ...current,
              status: 'closed',
            }
          : current
      );
    } catch (error) {
      console.error('Automatic session close exception:', error);
      automaticCloseStartedRef.current = false;
    }
  }, [sessionId]);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      Alert.alert(
        'Session Error',
        'No attendance session was supplied.'
      );
      return;
    }

    try {
      setLoading(true);

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('Load attendance session error:', sessionError);

        Alert.alert(
          'Session Error',
          sessionError.message ||
            'Unable to load the attendance session.'
        );
        return;
      }

      if (!sessionData) {
        Alert.alert(
          'Session Error',
          'Attendance session could not be found.'
        );
        return;
      }

      const typedSession = sessionData as SessionData;

      setSession(typedSession);

      const {
        data: courseData,
        error: courseError,
      } = await supabase
        .from('courses')
        .select(`
          id,
          course_code,
          course_title,
          department,
          department_id,
          faculty,
          level,
          semester,
          credit_unit
        `)
        .eq('id', typedSession.course_id)
        .single();

      if (courseError) {
        console.error('Load attendance course error:', courseError);
      }

      if (courseData) {
        setCourse(courseData as CourseData);
      }

      const totalSessionSeconds = Math.max(
        1,
        Number(
          typedSession.qr_time_limit ??
            Number(typedSession.duration) * 60
        )
      );

      /*
       * Start the session timer at the exact duration entered.
       * For example, 10 minutes starts at 10:00.
       *
       * The timer is initialized only once so that re-renders
       * do not reset the countdown.
       */
      if (!sessionTimerStartedRef.current) {
        sessionTimerStartedRef.current = true;

        setSessionRemaining(totalSessionSeconds);

        if (typedSession.status === 'closed') {
          setSessionExpired(true);
          automaticCloseStartedRef.current = true;
        } else {
          setSessionExpired(false);
        }
      }

      // QR rotation starts at Version 1.
      const rotationLength = Math.max(
        1,
        Number(typedSession.qr_rotation_seconds ?? 30)
      );

      setRotationNumber(1);
      setRotationRemaining(rotationLength);
      setQrIssuedAt(Date.now());

      if (routeSessionStartedAt) {
        console.log('Session started at:', routeSessionStartedAt);
      }
    } catch (error) {
      console.error('loadSession exception:', error);

      Alert.alert(
        'Error',
        'Something went wrong while loading the attendance session.'
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId, routeSessionStartedAt]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  /**
   * SESSION COUNTDOWN
   *
   * This countdown now decreases directly:
   * 10:00 -> 09:59 -> 09:58 -> 09:57 ...
   *
   * It no longer relies on created_at or timestamp calculations.
   */
  useEffect(() => {
    if (
      !session ||
      sessionExpired ||
      session.status === 'closed' ||
      sessionRemaining <= 0
    ) {
      return;
    }

    const timer = setInterval(() => {
      setSessionRemaining((current) => {
        if (current <= 1) {
          setSessionExpired(true);
          void closeSessionAutomatically();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [
    session,
    sessionExpired,
    sessionRemaining <= 0,
    closeSessionAutomatically,
  ]);

  /**
   * QR ROTATION COUNTDOWN
   *
   * QR Version 1 starts immediately.
   * When the rotation timer reaches zero, the QR advances
   * to Version 2, then Version 3, and so on.
   */
  useEffect(() => {
    if (!session || sessionExpired || session.status === 'closed') {
      return;
    }

    const rotationLength = Math.max(
      1,
      Number(session.qr_rotation_seconds ?? 30)
    );

    const timer = setInterval(() => {
      setRotationRemaining((current) => {
        if (current <= 1) {
          setRotationNumber((number) => number + 1);
          setQrIssuedAt(Date.now());

          return rotationLength;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [session, sessionExpired]);

  const handleEndSession = () => {
    if (!sessionId || ending || sessionExpired) {
      return;
    }

    Alert.alert(
      'End Attendance Session',
      'Are you sure you want to end this attendance session? Students will no longer be able to mark attendance.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: endSession,
        },
      ]
    );
  };

  const endSession = async () => {
    if (!sessionId) {
      return;
    }

    try {
      setEnding(true);

      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId);

      if (error) {
        console.error('End session error:', error);

        Alert.alert(
          'Unable to End Session',
          error.message ||
            'The attendance session could not be ended.'
        );
        return;
      }

      setSession((current) =>
        current
          ? {
              ...current,
              status: 'closed',
            }
          : current
      );

      setSessionExpired(true);
      setSessionRemaining(0);
      automaticCloseStartedRef.current = true;

      Alert.alert(
        'Attendance Ended',
        'The attendance session has been closed.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('endSession exception:', error);

      Alert.alert(
        'Error',
        'Something went wrong while ending attendance.'
      );
    } finally {
      setEnding(false);
    }
  };

  const handleViewRecords = () => {
    router.push({
      pathname: '/lecturer/records',
    });
  };

  /**
   * QR PAYLOAD
   *
   * The QR stays stable during each rotation interval.
   */
  const qrValue = useMemo(() => {
    if (!session || !qrIssuedAt) {
      return '';
    }

    const rotationSeconds = Math.max(
      1,
      Number(session.qr_rotation_seconds ?? 30)
    );

    const expiresAt = qrIssuedAt + rotationSeconds * 1000;

    return [
      'CALEB_ATTENDANCE',
      session.lecturer_id,
      session.id,
      course?.course_code || 'COURSE',
      course?.course_title || '',
      session.topic || '',
      session.class_date,
      session.start_time || '',
      String(session.duration),
      session.venue || '',
      session.level || '',
      String(rotationNumber),
      String(rotationSeconds),
      String(qrIssuedAt),
      String(expiresAt),
    ].join('|');
  }, [session, course, rotationNumber, qrIssuedAt]);

  const sessionTimerText = formatTimer(sessionRemaining);
  const rotationTimerText = formatTimer(rotationRemaining);

  const sessionIsClosed =
    session?.status === 'closed' || sessionExpired;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            Preparing live attendance...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={55}
            color="#DC2626"
          />

          <Text style={styles.errorTitle}>
            Attendance Session Not Found
          </Text>

          <TouchableOpacity
            style={styles.backToAttendanceButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToAttendanceText}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#111827"
            />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              Live Attendance
            </Text>

            <Text style={styles.headerSubtitle}>
              Students scan this QR code
            </Text>
          </View>
        </View>

        {/* COURSE CARD */}
        <View style={styles.courseCard}>
          <View style={styles.courseIcon}>
            <Ionicons
              name="book"
              size={22}
              color="#2563EB"
            />
          </View>

          <View style={styles.courseInfo}>
            <Text style={styles.courseCode}>
              {course?.course_code || 'Course'}
            </Text>

            <Text style={styles.courseTitle} numberOfLines={2}>
              {course?.course_title || 'Attendance Session'}
            </Text>

            <Text style={styles.courseTopic}>
              {session.topic || 'Class session'}
            </Text>
          </View>
        </View>

        {/* STATUS */}
        <View
          style={[
            styles.statusBadge,
            sessionIsClosed && styles.statusBadgeClosed,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              sessionIsClosed && styles.statusDotClosed,
            ]}
          />

          <Text
            style={[
              styles.statusText,
              sessionIsClosed && styles.statusTextClosed,
            ]}
          >
            {sessionIsClosed ? 'SESSION CLOSED' : 'SESSION ACTIVE'}
          </Text>
        </View>

        {/* QR CODE */}
        <View style={styles.qrCard}>
          <Text style={styles.qrInstruction}>
            Scan this QR code to mark attendance
          </Text>

          <View
            style={[
              styles.qrContainer,
              sessionIsClosed && styles.qrContainerClosed,
            ]}
          >
            {qrValue ? (
              <QRCode
                value={qrValue}
                size={245}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            ) : (
              <ActivityIndicator
                size="large"
                color="#2563EB"
              />
            )}

            {sessionIsClosed && (
              <View style={styles.qrClosedOverlay}>
                <Ionicons
                  name="lock-closed"
                  size={42}
                  color="#FFFFFF"
                />

                <Text style={styles.qrClosedText}>
                  CLOSED
                </Text>
              </View>
            )}
          </View>

          {/* QR VERSION */}
          <View style={styles.qrVersionRow}>
            <View>
              <Text style={styles.qrVersionLabel}>
                QR Version
              </Text>

              <Text style={styles.qrVersionValue}>
                {rotationNumber}
              </Text>
            </View>

            <View style={styles.qrRotationTimerBox}>
              <Ionicons
                name="refresh"
                size={17}
                color="#2563EB"
              />

              <Text style={styles.qrRotationTimer}>
                {rotationTimerText}
              </Text>

              <Text style={styles.qrRotationLabel}>
                until next QR
              </Text>
            </View>
          </View>
        </View>

        {/* SESSION COUNTDOWN */}
        <View
          style={[
            styles.sessionTimerCard,
            sessionRemaining <= 60 &&
              !sessionIsClosed &&
              styles.sessionTimerWarning,
            sessionIsClosed && styles.sessionTimerClosed,
          ]}
        >
          <View style={styles.sessionTimerIcon}>
            <Ionicons
              name="timer-outline"
              size={25}
              color={sessionIsClosed ? '#DC2626' : '#2563EB'}
            />
          </View>

          <View style={styles.sessionTimerContent}>
            <Text style={styles.sessionTimerLabel}>
              {sessionIsClosed
                ? 'Attendance Time'
                : 'Attendance Time Remaining'}
            </Text>

            <Text style={styles.sessionTimerValue}>
              {sessionTimerText}
            </Text>
          </View>
        </View>

        {/* SESSION DETAILS */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>
            Session Details
          </Text>

          <View style={styles.detailRow}>
            <Ionicons
              name="key-outline"
              size={19}
              color="#64748B"
            />

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Session Code
              </Text>

              <Text style={styles.detailValue}>
                {routeSessionCode || session.session_code}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="calendar-outline"
              size={19}
              color="#64748B"
            />

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Date
              </Text>

              <Text style={styles.detailValue}>
                {session.class_date}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="time-outline"
              size={19}
              color="#64748B"
            />

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Start Time
              </Text>

              <Text style={styles.detailValue}>
                {session.start_time || 'Not specified'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="location-outline"
              size={19}
              color="#64748B"
            />

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Venue
              </Text>

              <Text style={styles.detailValue}>
                {session.venue || 'Not specified'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="layers-outline"
              size={19}
              color="#64748B"
            />

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Level
              </Text>

              <Text style={styles.detailValue}>
                {session.level
                  ? `Level ${session.level}`
                  : 'Not specified'}
              </Text>
            </View>
          </View>
        </View>

        {/* VIEW RECORDS */}
        <TouchableOpacity
          style={styles.recordsButton}
          onPress={handleViewRecords}
        >
          <Ionicons
            name="people-outline"
            size={22}
            color="#2563EB"
          />

          <Text style={styles.recordsButtonText}>
            View Attendance Records
          </Text>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#2563EB"
          />
        </TouchableOpacity>

        {/* END SESSION */}
        <TouchableOpacity
          style={[
            styles.endButton,
            (ending || sessionIsClosed) &&
              styles.endButtonDisabled,
          ]}
          onPress={handleEndSession}
          disabled={ending || sessionIsClosed}
        >
          {ending ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Ionicons
              name="stop-circle-outline"
              size={23}
              color="#FFFFFF"
            />
          )}

          <Text style={styles.endButtonText}>
            {ending
              ? 'Ending Session...'
              : sessionIsClosed
              ? 'Attendance Session Closed'
              : 'End Attendance Session'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  scrollContent: {
    padding: 18,
    paddingBottom: 35,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },

  errorTitle: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  backToAttendanceButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backToAttendanceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },

  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },

  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  courseIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  courseInfo: {
    flex: 1,
  },

  courseCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },

  courseTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },

  courseTopic: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },

  statusBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 14,
    marginBottom: 14,
  },

  statusBadgeClosed: {
    backgroundColor: '#FEE2E2',
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 7,
  },

  statusDotClosed: {
    backgroundColor: '#DC2626',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },

  statusTextClosed: {
    color: '#B91C1C',
  },

  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },

  qrInstruction: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },

  qrContainer: {
    width: 275,
    height: 275,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  qrContainerClosed: {
    opacity: 0.3,
  },

  qrClosedOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.78)',
    width: 275,
    height: 275,
    borderRadius: 12,
  },

  qrClosedText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 7,
  },

  qrVersionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  qrVersionLabel: {
    fontSize: 11,
    color: '#64748B',
  },

  qrVersionValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 1,
  },

  qrRotationTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  qrRotationTimer: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2563EB',
    marginLeft: 5,
  },

  qrRotationLabel: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 5,
  },

  sessionTimerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 17,
    padding: 15,
    marginTop: 15,
  },

  sessionTimerWarning: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },

  sessionTimerClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },

  sessionTimerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  sessionTimerContent: {
    flex: 1,
  },

  sessionTimerLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  sessionTimerValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111827',
    marginTop: 1,
    letterSpacing: 1,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginTop: 15,
  },

  detailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  detailContent: {
    marginLeft: 12,
    flex: 1,
  },

  detailLabel: {
    fontSize: 11,
    color: '#64748B',
  },

  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    marginTop: 2,
  },

  recordsButton: {
    minHeight: 55,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    marginTop: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  recordsButtonText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '800',
    color: '#2563EB',
  },

  endButton: {
    minHeight: 56,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    marginTop: 11,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  endButtonDisabled: {
    backgroundColor: '#94A3B8',
  },

  endButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  bottomSpace: {
    height: 20,
  },
});