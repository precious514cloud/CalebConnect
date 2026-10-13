import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import {
  useCallback,
  useMemo,
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

const ATTENDANCE_KEY =
  '@calebconnect_attendance';

const LECTURER_ID_KEY =
  '@calebconnect_lecturer_id';

type AttendanceRecord = {
  id: string;
  sessionId: string;

  // IMPORTANT:
  // This connects the attendance record
  // to the lecturer who created the session.
  lecturerId?: string;

  studentName: string;
  matricNumber: string;
  programme: string;
  level: string;

  courseCode: string;
  courseTitle: string;
  topic: string;

  date: string;
  time: string;
  startTime: string;
  duration: string;
  venue: string;

  status: 'Present' | 'Absent';
  recordedAt: string;
};

const PROGRAMMES = [
  'Computer Science',
  'Software Engineering',
  'Cybersecurity',
];

const LEVELS = [
  '100 Level',
  '200 Level',
];

export default function AttendanceRecordsScreen() {
  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>([]);

  const [lecturerId, setLecturerId] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  /*
   * LOAD ONLY THIS LECTURER'S ATTENDANCE
   */
  const loadRecords = useCallback(
    async () => {
      try {
        setLoading(true);

        /*
         * Get the currently logged-in
         * lecturer ID.
         */
        const savedLecturerId =
          await AsyncStorage.getItem(
            LECTURER_ID_KEY
          );

        if (!savedLecturerId) {
          setLecturerId('');
          setAttendance([]);

          Alert.alert(
            'Lecturer Login Required',
            'Your lecturer ID could not be found. Please log in again.',
            [
              {
                text: 'OK',
                onPress: () =>
                  router.replace(
                    '/lecturer-login'
                  ),
              },
            ]
          );

          return;
        }

        setLecturerId(
          savedLecturerId
        );

        /*
         * Get all attendance records.
         */
        const savedAttendance =
          await AsyncStorage.getItem(
            ATTENDANCE_KEY
          );

        if (!savedAttendance) {
          setAttendance([]);
          return;
        }

        const allRecords:
          AttendanceRecord[] =
          JSON.parse(savedAttendance);

        /*
         * IMPORTANT SECURITY FILTER
         *
         * Only show records belonging
         * to this lecturer.
         *
         * Example:
         *
         * Lecturer 001
         * sees only:
         *
         * lecturerId === LECTURER001
         *
         * Lecturer 002
         * sees only:
         *
         * lecturerId === LECTURER002
         */
        const lecturerRecords =
          allRecords.filter(
            (record) =>
              record.lecturerId ===
              savedLecturerId
          );

        setAttendance(
          lecturerRecords
        );
      } catch (error) {
        console.log(
          'Error loading attendance records:',
          error
        );

        setAttendance([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /*
   * Reload whenever this screen
   * comes into focus.
   *
   * This is important because a student
   * may mark attendance while the
   * lecturer is already using the app.
   */
  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  /*
   * PRESENT COUNT
   */
  const presentCount =
    attendance.filter(
      (item) =>
        item.status === 'Present'
    ).length;

  /*
   * ABSENT COUNT
   */
  const absentCount =
    attendance.filter(
      (item) =>
        item.status === 'Absent'
    ).length;

  /*
   * GROUP STUDENTS BY PROGRAMME
   */
  const groupedByProgramme =
    useMemo(() => {
      const grouped: Record<
        string,
        AttendanceRecord[]
      > = {};

      PROGRAMMES.forEach(
        (programme) => {
          grouped[programme] = [];
        }
      );

      attendance.forEach(
        (record) => {
          if (!grouped[record.programme]) {
            grouped[record.programme] =
              [];
          }

          grouped[
            record.programme
          ].push(record);
        }
      );

      /*
       * Sort:
       *
       * 100 Level
       * 200 Level
       * then student name
       */
      Object.keys(grouped).forEach(
        (programme) => {
          grouped[programme].sort(
            (a, b) => {
              const levelA =
                LEVELS.indexOf(
                  a.level
                );

              const levelB =
                LEVELS.indexOf(
                  b.level
                );

              if (
                levelA !== levelB
              ) {
                return (
                  levelA - levelB
                );
              }

              return a.studentName.localeCompare(
                b.studentName
              );
            }
          );
        }
      );

      return grouped;
    }, [attendance]);

  /*
   * COUNT PRESENT STUDENTS
   * FOR A PROGRAMME
   */
  const programmePresentCount =
    (programme: string) => {
      return attendance.filter(
        (record) =>
          record.programme ===
            programme &&
          record.status ===
            'Present'
      ).length;
    };

  /*
   * TOTAL RECORDS
   * FOR A PROGRAMME
   */
  const programmeTotal =
    (programme: string) => {
      return attendance.filter(
        (record) =>
          record.programme ===
          programme
      ).length;
    };

  /*
   * GET COURSE/SESSION SUMMARY
   *
   * This allows us to display the
   * lecturer's sessions clearly.
   */
  const sessions = useMemo(() => {
    const map =
      new Map<
        string,
        {
          sessionId: string;
          courseCode: string;
          courseTitle: string;
          topic: string;
          date: string;
          startTime: string;
          duration: string;
          venue: string;
          studentCount: number;
        }
      >();

    attendance.forEach(
      (record) => {
        const existing =
          map.get(
            record.sessionId
          );

        if (existing) {
          existing.studentCount += 1;
        } else {
          map.set(
            record.sessionId,
            {
              sessionId:
                record.sessionId,

              courseCode:
                record.courseCode,

              courseTitle:
                record.courseTitle,

              topic:
                record.topic,

              date:
                record.date,

              startTime:
                record.startTime,

              duration:
                record.duration,

              venue:
                record.venue,

              studentCount: 1,
            }
          );
        }
      }
    );

    return Array.from(
      map.values()
    ).reverse();
  }, [attendance]);

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingScreen}
      >
        <ActivityIndicator
          size="large"
          color="#4F46E5"
        />

        <Text
          style={styles.loadingText}
        >
          Loading attendance records...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ========================= */}
        {/* HEADER */}
        {/* ========================= */}

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              router.back()
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color="#111827"
            />
          </TouchableOpacity>

          <View
            style={styles.headerText}
          >
            <Text
              style={styles.headerTitle}
            >
              Attendance Records
            </Text>

            <Text
              style={styles.headerSubtitle}
            >
              Lecturer Class Attendance
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadRecords}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh"
              size={20}
              color="#4F46E5"
            />
          </TouchableOpacity>

        </View>

        {/* ========================= */}
        {/* LECTURER INFORMATION */}
        {/* ========================= */}

        <View
          style={styles.lecturerCard}
        >
          <View
            style={styles.lecturerIcon}
          >
            <Ionicons
              name="person"
              size={21}
              color="#4F46E5"
            />
          </View>

          <View
            style={styles.lecturerInfo}
          >
            <Text
              style={styles.lecturerLabel}
            >
              LOGGED-IN LECTURER
            </Text>

            <Text
              style={styles.lecturerId}
            >
              {lecturerId ||
                'Not available'}
            </Text>
          </View>

          <View
            style={styles.secureBadge}
          >
            <Ionicons
              name="lock-closed"
              size={12}
              color="#16A34A"
            />

            <Text
              style={styles.secureText}
            >
              Private
            </Text>
          </View>
        </View>

        {/* ========================= */}
        {/* SUMMARY */}
        {/* ========================= */}

        <View
          style={styles.summaryCard}
        >

          <View
            style={styles.summaryItem}
          >
            <View
              style={styles.totalIcon}
            >
              <Ionicons
                name="people-outline"
                size={23}
                color="#4F46E5"
              />
            </View>

            <Text
              style={styles.summaryNumber}
            >
              {attendance.length}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Total Scanned
            </Text>
          </View>

          <View
            style={styles.summaryDivider}
          />

          <View
            style={styles.summaryItem}
          >
            <View
              style={styles.presentIcon}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={23}
                color="#16A34A"
              />
            </View>

            <Text
              style={styles.summaryNumber}
            >
              {presentCount}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Present
            </Text>
          </View>

          <View
            style={styles.summaryDivider}
          />

          <View
            style={styles.summaryItem}
          >
            <View
              style={styles.absentIcon}
            >
              <Ionicons
                name="close-circle-outline"
                size={23}
                color="#DC2626"
              />
            </View>

            <Text
              style={styles.summaryNumber}
            >
              {absentCount}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Absent
            </Text>
          </View>

        </View>

        {/* ========================= */}
        {/* LECTURER SESSIONS */}
        {/* ========================= */}

        {sessions.length > 0 && (
          <>
            <Text
              style={styles.overviewTitle}
            >
              My Attendance Sessions
            </Text>

            <View
              style={styles.sessionContainer}
            >
              {sessions.map(
                (session) => (
                  <View
                    key={
                      session.sessionId
                    }
                    style={
                      styles.sessionCard
                    }
                  >
                    <View
                      style={
                        styles.sessionIcon
                      }
                    >
                      <Ionicons
                        name="calendar"
                        size={20}
                        color="#4F46E5"
                      />
                    </View>

                    <View
                      style={
                        styles.sessionInfo
                      }
                    >
                      <Text
                        style={
                          styles.sessionCourse
                        }
                      >
                        {
                          session.courseCode
                        }
                      </Text>

                      <Text
                        style={
                          styles.sessionTitle
                        }
                      >
                        {
                          session.courseTitle
                        }
                      </Text>

                      {session.topic ? (
                        <Text
                          style={
                            styles.sessionTopic
                          }
                        >
                          {
                            session.topic
                          }
                        </Text>
                      ) : null}

                      <Text
                        style={
                          styles.sessionDetails
                        }
                      >
                        {session.date}
                        {' • '}
                        {
                          session.startTime
                        }
                      </Text>

                      {session.venue ? (
                        <Text
                          style={
                            styles.sessionDetails
                          }
                        >
                          {
                            session.venue
                          }
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.sessionCount
                      }
                    >
                      <Text
                        style={
                          styles.sessionCountNumber
                        }
                      >
                        {
                          session.studentCount
                        }
                      </Text>

                      <Text
                        style={
                          styles.sessionCountLabel
                        }
                      >
                        students
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>
          </>
        )}

        {/* ========================= */}
        {/* PROGRAMME OVERVIEW */}
        {/* ========================= */}

        <Text
          style={styles.overviewTitle}
        >
          Programme Overview
        </Text>

        <View
          style={styles.programmeOverview}
        >

          {PROGRAMMES.map(
            (programme) => {
              const total =
                programmeTotal(
                  programme
                );

              const present =
                programmePresentCount(
                  programme
                );

              return (
                <View
                  key={programme}
                  style={
                    styles.overviewRow
                  }
                >

                  <View
                    style={
                      styles.overviewIcon
                    }
                  >
                    <Ionicons
                      name="school-outline"
                      size={20}
                      color="#4F46E5"
                    />
                  </View>

                  <View
                    style={
                      styles.overviewInfo
                    }
                  >
                    <Text
                      style={
                        styles.overviewProgramme
                      }
                    >
                      {programme}
                    </Text>

                    <Text
                      style={
                        styles.overviewCount
                      }
                    >
                      {present} present
                    </Text>
                  </View>

                  <View
                    style={
                      styles.overviewBadge
                    }
                  >
                    <Text
                      style={
                        styles.overviewBadgeText
                      }
                    >
                      {total}
                    </Text>
                  </View>

                </View>
              );
            }
          )}

        </View>

        {/* ========================= */}
        {/* STUDENTS */}
        {/* ========================= */}

        <View
          style={styles.sectionHeader}
        >
          <View>
            <Text
              style={styles.sectionTitle}
            >
              Students by Programme
            </Text>

            <Text
              style={styles.sectionSubtitle}
            >
              Only students who attended
              your sessions are shown.
            </Text>
          </View>

          <View
            style={styles.countBadge}
          >
            <Text
              style={styles.countText}
            >
              {attendance.length}
            </Text>
          </View>
        </View>

        {attendance.length === 0 ? (
          <View
            style={styles.emptyCard}
          >

            <View
              style={styles.emptyIcon}
            >
              <Ionicons
                name="clipboard-outline"
                size={34}
                color="#4F46E5"
              />
            </View>

            <Text
              style={styles.emptyTitle}
            >
              No Attendance Yet
            </Text>

            <Text
              style={styles.emptyText}
            >
              Students who scan an attendance
              QR code generated by you will
              appear here automatically.
            </Text>

          </View>
        ) : (
          PROGRAMMES.map(
            (programme) => {
              const records =
                groupedByProgramme[
                  programme
                ] || [];

              return (
                <View
                  key={programme}
                  style={
                    styles.programmeSection
                  }
                >

                  {/* PROGRAMME HEADER */}

                  <View
                    style={
                      styles.programmeHeader
                    }
                  >

                    <View
                      style={
                        styles.programmeHeaderIcon
                      }
                    >
                      <Ionicons
                        name="school"
                        size={21}
                        color="#4F46E5"
                      />
                    </View>

                    <View
                      style={
                        styles.programmeHeaderInfo
                      }
                    >
                      <Text
                        style={
                          styles.programmeTitle
                        }
                      >
                        {programme}
                      </Text>

                      <Text
                        style={
                          styles.programmeSubtitle
                        }
                      >
                        {programmePresentCount(
                          programme
                        )}{' '}
                        present •{' '}
                        {records.length}{' '}
                        scanned
                      </Text>
                    </View>

                    <View
                      style={
                        styles.programmeBadge
                      }
                    >
                      <Text
                        style={
                          styles.programmeBadgeText
                        }
                      >
                        {records.length}
                      </Text>
                    </View>

                  </View>

                  {records.length ===
                  0 ? (
                    <View
                      style={
                        styles.noProgrammeRecords
                      }
                    >
                      <Text
                        style={
                          styles.noProgrammeText
                        }
                      >
                        No students from this
                        programme have scanned
                        your attendance QR yet.
                      </Text>
                    </View>
                  ) : (
                    records.map(
                      (record, index) => (
                        <View
                          key={record.id}
                          style={
                            styles.studentCard
                          }
                        >

                          {/* NUMBER */}

                          <View
                            style={
                              styles.studentNumber
                            }
                          >
                            <Text
                              style={
                                styles.studentNumberText
                              }
                            >
                              {index + 1}
                            </Text>
                          </View>

                          {/* STUDENT */}

                          <View
                            style={
                              styles.studentInfo
                            }
                          >
                            <Text
                              style={
                                styles.studentName
                              }
                            >
                              {
                                record.studentName
                              }
                            </Text>

                            <Text
                              style={
                                styles.matricNumber
                              }
                            >
                              {
                                record.matricNumber
                              }
                            </Text>

                            <View
                              style={
                                styles.studentMeta
                              }
                            >
                              <View
                                style={
                                  styles.levelBadge
                                }
                              >
                                <Text
                                  style={
                                    styles.levelBadgeText
                                  }
                                >
                                  {
                                    record.level
                                  }
                                </Text>
                              </View>

                              <Text
                                style={
                                  styles.timeText
                                }
                              >
                                <Ionicons
                                  name="time-outline"
                                  size={11}
                                  color="#9CA3AF"
                                />{' '}
                                {
                                  record.time
                                }
                              </Text>
                            </View>
                          </View>

                          {/* STATUS */}

                          <View
                            style={[
                              styles.statusBadge,
                              record.status ===
                              'Present'
                                ? styles.presentBadge
                                : styles.absentBadge,
                            ]}
                          >
                            <Ionicons
                              name={
                                record.status ===
                                'Present'
                                  ? 'checkmark-circle'
                                  : 'close-circle'
                              }
                              size={14}
                              color={
                                record.status ===
                                'Present'
                                  ? '#16A34A'
                                  : '#DC2626'
                              }
                            />

                            <Text
                              style={[
                                styles.statusText,
                                record.status ===
                                'Present'
                                  ? styles.presentText
                                  : styles.absentText,
                              ]}
                            >
                              {
                                record.status
                              }
                            </Text>
                          </View>

                        </View>
                      )
                    )
                  )}

                </View>
              );
            }
          )
        )}

        {/* ========================= */}
        {/* INFORMATION */}
        {/* ========================= */}

        {attendance.length > 0 && (
          <View
            style={styles.courseInfoCard}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color="#4F46E5"
            />

            <View
              style={
                styles.courseInfoContent
              }
            >
              <Text
                style={
                  styles.courseInfoTitle
                }
              >
                Lecturer Attendance Privacy
              </Text>

              <Text
                style={
                  styles.courseInfoText
                }
              >
                These records are filtered using
                your lecturer ID. You only see
                students who attended sessions
                created under your lecturer
                account.
              </Text>
            </View>
          </View>
        )}

        {/* ========================= */}
        {/* FOOTER */}
        {/* ========================= */}

        <Text
          style={styles.footer}
        >
          CalebConnect
        </Text>

        <Text
          style={styles.footerSubtitle}
        >
          Lecturer Attendance Management
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

  loadingScreen: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },

  header: {
    height: 75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerText: {
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  headerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },

  lecturerCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 15,
  },

  lecturerIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  lecturerInfo: {
    flex: 1,
    marginLeft: 11,
  },

  lecturerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 1,
  },

  lecturerId: {
    fontSize: 15,
    fontWeight: '900',
    color: '#3730A3',
    marginTop: 3,
  },

  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  secureText: {
    fontSize: 9,
    color: '#15803D',
    fontWeight: '800',
    marginLeft: 4,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },

  totalIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  presentIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  absentIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  summaryNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  summaryLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
  },

  summaryDivider: {
    width: 1,
    height: 65,
    backgroundColor: '#E5E7EB',
  },

  overviewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  sessionContainer: {
    marginBottom: 25,
  },

  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  sessionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sessionInfo: {
    flex: 1,
    marginLeft: 11,
    paddingRight: 8,
  },

  sessionCourse: {
    fontSize: 13,
    fontWeight: '900',
    color: '#4F46E5',
  },

  sessionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },

  sessionTopic: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
  },

  sessionDetails: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
  },

  sessionCount: {
    minWidth: 50,
    alignItems: 'center',
  },

  sessionCountNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4F46E5',
  },

  sessionCountLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: 2,
  },

  programmeOverview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    marginBottom: 28,
  },

  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  overviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  overviewInfo: {
    flex: 1,
    marginLeft: 11,
  },

  overviewProgramme: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },

  overviewCount: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 3,
  },

  overviewBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  overviewBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  sectionSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },

  countBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  countText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
  },

  programmeSection: {
    marginBottom: 20,
  },

  programmeHeader: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  programmeHeaderIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  programmeHeaderInfo: {
    flex: 1,
    marginLeft: 11,
  },

  programmeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  programmeSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
  },

  programmeBadge: {
    minWidth: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  programmeBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4F46E5',
  },

  studentCard: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  studentNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },

  matricNumber: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: '700',
    marginTop: 2,
  },

  studentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  levelBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  levelBadgeText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '700',
  },

  timeText: {
    fontSize: 9,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  statusBadge: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
  },

  presentBadge: {
    backgroundColor: '#F0FDF4',
  },

  absentBadge: {
    backgroundColor: '#FEF2F2',
  },

  statusText: {
    fontSize: 8,
    fontWeight: '800',
    marginLeft: 3,
  },

  presentText: {
    color: '#16A34A',
  },

  absentText: {
    color: '#DC2626',
  },

  noProgrammeRecords: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  noProgrammeText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },

  courseInfoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
  },

  courseInfoContent: {
    flex: 1,
    marginLeft: 10,
  },

  courseInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3730A3',
  },

  courseInfoText: {
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
    marginTop: 30,
  },

  footerSubtitle: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});