import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { supabase } from '../../lib/supabase';

const LECTURER_ID_KEY =
  '@calebconnect_lecturer_id';

type SessionRow = {
  id: string;
  lecturer_id: string;
  course_id: string;
  session_code: string;
  topic: string | null;
  class_date: string;
  start_time: string | null;
  duration: number;
  venue: string | null;
  status: string;
  level: string | null;
  qr_rotation_seconds: number | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  session_id: string;
  student_id: string;
  status: string;
  scanned_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  student_id: string | null;
  staff_id: string | null;
  department: string | null;
  faculty: string | null;
  level: string | null;
};

type CourseRow = {
  id: string;
  [key: string]: any;
};

type StudentAttendance = AttendanceRow & {
  profile?: ProfileRow;
};

type SessionWithAttendance = SessionRow & {
  students: StudentAttendance[];
  courseName: string;
};

type LevelSummary = {
  level: string;
  sessions: number;
  students: number;
  departments: number;
};

function normaliseLevel(level: string | null | undefined) {
  const value = String(level ?? '').trim();

  if (!value) {
    return 'Unknown Level';
  }

  return value.toUpperCase().startsWith('LEVEL')
    ? value
    : `Level ${value}`;
}

function getLevelNumber(level: string | null | undefined) {
  const value = String(level ?? '');

  const match = value.match(/\d+/);

  if (!match) {
    return 999;
  }

  return Number(match[0]);
}

function formatDate(dateString: string) {
  if (!dateString) {
    return 'Date not available';
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(timeString: string | null) {
  if (!timeString) {
    return 'Time not available';
  }

  const parts = timeString.split(':');

  if (parts.length < 2) {
    return timeString;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return timeString;
  }

  const date = new Date();

  date.setHours(hours);
  date.setMinutes(minutes);
  date.setSeconds(0);

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getCourseName(course?: CourseRow) {
  if (!course) {
    return 'Course';
  }

  const code =
    course.course_code ??
    course.courseCode ??
    course.code ??
    course.course ??
    '';

  const title =
    course.course_title ??
    course.courseTitle ??
    course.title ??
    course.name ??
    course.course_name ??
    '';

  const cleanCode = String(code).trim();
  const cleanTitle = String(title).trim();

  if (cleanCode && cleanTitle) {
    return `${cleanCode} — ${cleanTitle}`;
  }

  if (cleanCode) {
    return cleanCode;
  }

  if (cleanTitle) {
    return cleanTitle;
  }

  return 'Course';
}

function getDepartmentName(
  profile?: ProfileRow
) {
  const department = String(
    profile?.department ?? ''
  ).trim();

  return department || 'Department Not Assigned';
}

function sortStudents(
  students: StudentAttendance[]
) {
  return [...students].sort((a, b) => {
    const departmentA =
      getDepartmentName(a.profile).toLowerCase();

    const departmentB =
      getDepartmentName(b.profile).toLowerCase();

    if (departmentA !== departmentB) {
      return departmentA.localeCompare(
        departmentB
      );
    }

    const nameA =
      a.profile?.full_name?.toLowerCase() ?? '';

    const nameB =
      b.profile?.full_name?.toLowerCase() ?? '';

    return nameA.localeCompare(nameB);
  });
}

export default function LecturerRecordsScreen() {
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [sessions, setSessions] =
    useState<SessionWithAttendance[]>([]);

  const [selectedLevel, setSelectedLevel] =
    useState<string | null>(null);

  const [selectedDepartment, setSelectedDepartment] =
    useState<string>('ALL');

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadAttendanceRecords =
    useCallback(async () => {
      try {
        setErrorMessage(null);

        const lecturerId =
          await AsyncStorage.getItem(
            LECTURER_ID_KEY
          );

        if (!lecturerId) {
          setErrorMessage(
            'Your lecturer session could not be found. Please log in again.'
          );

          setSessions([]);

          return;
        }

        // ------------------------------------------------
        // 1. GET THIS LECTURER'S ATTENDANCE SESSIONS
        // ------------------------------------------------

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
            lecturerId
          )
          .order(
            'class_date',
            {
              ascending: false,
            }
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (sessionError) {
          console.log(
            'Attendance sessions error:',
            sessionError
          );

          throw new Error(
            sessionError.message
          );
        }

        const rawSessions =
          (sessionData ??
            []) as SessionRow[];

        if (rawSessions.length === 0) {
          setSessions([]);

          return;
        }

        // ------------------------------------------------
        // 2. GET ATTENDANCE RECORDS FOR THESE SESSIONS
        // ------------------------------------------------

        const sessionIds =
          rawSessions.map(
            (session) => session.id
          );

        const {
          data: attendanceData,
          error: attendanceError,
        } = await supabase
          .from('attendance_records')
          .select(
            `
              id,
              session_id,
              student_id,
              status,
              scanned_at
            `
          )
          .in(
            'session_id',
            sessionIds
          )
          .order(
            'scanned_at',
            {
              ascending: false,
            }
          );

        if (attendanceError) {
          console.log(
            'Attendance records error:',
            attendanceError
          );

          throw new Error(
            attendanceError.message
          );
        }

        const rawAttendance =
          (attendanceData ??
            []) as AttendanceRow[];

        // ------------------------------------------------
        // 3. GET THE STUDENT PROFILES
        // ------------------------------------------------

        const studentIds = Array.from(
          new Set(
            rawAttendance.map(
              (record) =>
                record.student_id
            )
          )
        );

        let profiles: ProfileRow[] = [];

        if (studentIds.length > 0) {
          const {
            data: profileData,
            error: profileError,
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
                department,
                faculty,
                level
              `
            )
            .in(
              'id',
              studentIds
            );

          if (profileError) {
            console.log(
              'Student profile error:',
              profileError
            );

            throw new Error(
              profileError.message
            );
          }

          profiles =
            (profileData ??
              []) as ProfileRow[];
        }

        const profileMap =
          new Map<string, ProfileRow>();

        profiles.forEach((profile) => {
          profileMap.set(
            profile.id,
            profile
          );
        });

        // ------------------------------------------------
        // 4. GET COURSE INFORMATION
        //
        // We deliberately use select('*') here because
        // the exact course column names can vary in the
        // existing CalebConnect courses table.
        // ------------------------------------------------

        const courseIds = Array.from(
          new Set(
            rawSessions.map(
              (session) =>
                session.course_id
            )
          )
        );

        let courses: CourseRow[] = [];

        if (courseIds.length > 0) {
          const {
            data: courseData,
            error: courseError,
          } = await supabase
            .from('courses')
            .select('*')
            .in(
              'id',
              courseIds
            );

          if (courseError) {
            console.log(
              'Course information error:',
              courseError
            );

            // Course information is helpful but
            // should never prevent attendance records
            // from loading.
            courses = [];
          } else {
            courses =
              (courseData ??
                []) as CourseRow[];
          }
        }

        const courseMap =
          new Map<string, CourseRow>();

        courses.forEach((course) => {
          courseMap.set(
            String(course.id),
            course
          );
        });

        // ------------------------------------------------
        // 5. BUILD THE FINAL SESSION LIST
        // ------------------------------------------------

        const attendanceBySession =
          new Map<
            string,
            StudentAttendance[]
          >();

        rawAttendance.forEach(
          (attendance) => {
            const list =
              attendanceBySession.get(
                attendance.session_id
              ) ?? [];

            list.push({
              ...attendance,
              profile:
                profileMap.get(
                  attendance.student_id
                ),
            });

            attendanceBySession.set(
              attendance.session_id,
              list
            );
          }
        );

        const finalSessions: SessionWithAttendance[] =
          rawSessions.map((session) => ({
            ...session,

            students: sortStudents(
              attendanceBySession.get(
                session.id
              ) ?? []
            ),

            courseName: getCourseName(
              courseMap.get(
                session.course_id
              )
            ),
          }));

        setSessions(finalSessions);
      } catch (error) {
        console.log(
          'Lecturer records load error:',
          error
        );

        setSessions([]);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load attendance records.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      loadAttendanceRecords();
    }, [loadAttendanceRecords])
  );

  const refreshRecords = async () => {
    setRefreshing(true);
    await loadAttendanceRecords();
  };

  // ------------------------------------------------
  // LEVEL SUMMARY
  // ------------------------------------------------

  const levelSummaries: LevelSummary[] =
    Object.values(
      sessions.reduce(
        (
          accumulator,
          session
        ) => {
          const level =
            normaliseLevel(
              session.level
            );

          if (
            !accumulator[level]
          ) {
            accumulator[level] = {
              level,
              sessions: 0,
              students: 0,
              departments: 0,
            };
          }

          accumulator[level].sessions += 1;

          accumulator[level].students +=
            session.students.length;

          const departments =
            new Set(
              session.students
                .map((student) =>
                  getDepartmentName(
                    student.profile
                  )
                )
                .filter(
                  (department) =>
                    department !==
                    'Department Not Assigned'
                )
            );

          accumulator[level].departments +=
            departments.size;

          return accumulator;
        },
        {} as Record<
          string,
          LevelSummary
        >
      )
    ).sort(
      (a, b) =>
        getLevelNumber(a.level) -
        getLevelNumber(b.level)
    );

  // ------------------------------------------------
  // SELECTED LEVEL DATA
  // ------------------------------------------------

  const selectedLevelSessions =
    sessions.filter(
      (session) =>
        normaliseLevel(
          session.level
        ) === selectedLevel
    );

  const availableDepartments =
    Array.from(
      new Set(
        selectedLevelSessions
          .flatMap(
            (session) =>
              session.students.map(
                (student) =>
                  getDepartmentName(
                    student.profile
                  )
              )
          )
          .filter(
            (department) =>
              department !==
              'Department Not Assigned'
          )
      )
    ).sort();

  const filteredSessions =
    selectedLevelSessions.map(
      (session) => {
        if (
          selectedDepartment === 'ALL'
        ) {
          return session;
        }

        return {
          ...session,
          students:
            session.students.filter(
              (student) =>
                getDepartmentName(
                  student.profile
                ) ===
                selectedDepartment
            ),
        };
      }
    );

  const totalPresent =
    filteredSessions.reduce(
      (total, session) =>
        total +
        session.students.length,
      0
    );

  const totalSessions =
    filteredSessions.length;

  // ------------------------------------------------
  // INITIAL LEVEL SCREEN
  // ------------------------------------------------

  if (!selectedLevel) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <ScrollView
          contentContainerStyle={
            styles.container
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={
                refreshRecords
              }
            />
          }
          showsVerticalScrollIndicator={
            false
          }
        >
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

          <View
            style={styles.headerRow}
          >
            <View
              style={styles.headerTextArea}
            >
              <Text
                style={styles.title}
              >
                Attendance Records
              </Text>

              <Text
                style={styles.subtitle}
              >
                Select a level to view
                attendance for your
                classes.
              </Text>
            </View>

            <View
              style={styles.headerIcon}
            >
              <Text
                style={styles.headerIconText}
              >
                📊
              </Text>
            </View>
          </View>

          {loading ? (
            <View
              style={styles.loadingCard}
            >
              <ActivityIndicator
                size="large"
                color="#16A34A"
              />

              <Text
                style={styles.loadingText}
              >
                Loading attendance...
              </Text>
            </View>
          ) : errorMessage ? (
            <View
              style={styles.errorCard}
            >
              <Text
                style={styles.errorIcon}
              >
                ⚠️
              </Text>

              <Text
                style={styles.errorTitle}
              >
                Unable to Load Records
              </Text>

              <Text
                style={styles.errorText}
              >
                {errorMessage}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={
                  loadAttendanceRecords
                }
              >
                <Text
                  style={
                    styles.retryButtonText
                  }
                >
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          ) : levelSummaries.length ===
            0 ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={styles.emptyIcon}
              >
                📋
              </Text>

              <Text
                style={styles.emptyTitle}
              >
                No Attendance Records Yet
              </Text>

              <Text
                style={styles.emptyText}
              >
                Once students attend one
                of your sessions, the
                records will appear here,
                organized by level.
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={styles.sectionTitle}
              >
                Select Level
              </Text>

              {levelSummaries.map(
                (summary) => (
                  <TouchableOpacity
                    key={summary.level}
                    style={
                      styles.levelCard
                    }
                    onPress={() => {
                      setSelectedLevel(
                        summary.level
                      );

                      setSelectedDepartment(
                        'ALL'
                      );
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={
                        styles.levelIcon
                      }
                    >
                      <Text
                        style={
                          styles.levelIconText
                        }
                      >
                        🎓
                      </Text>
                    </View>

                    <View
                      style={
                        styles.levelContent
                      }
                    >
                      <Text
                        style={
                          styles.levelTitle
                        }
                      >
                        {summary.level}
                      </Text>

                      <View
                        style={
                          styles.levelStatsRow
                        }
                      >
                        <Text
                          style={
                            styles.levelStat
                          }
                        >
                          {summary.sessions}{' '}
                          {summary.sessions ===
                          1
                            ? 'session'
                            : 'sessions'}
                        </Text>

                        <Text
                          style={
                            styles.dot
                          }
                        >
                          •
                        </Text>

                        <Text
                          style={
                            styles.levelStat
                          }
                        >
                          {
                            summary.students
                          }{' '}
                          attendance
                          {summary.students ===
                          1
                            ? ''
                            : 's'}
                        </Text>

                        <Text
                          style={
                            styles.dot
                          }
                        >
                          •
                        </Text>

                        <Text
                          style={
                            styles.levelStat
                          }
                        >
                          {
                            summary.departments
                          }{' '}
                          {summary.departments ===
                          1
                            ? 'department'
                            : 'departments'}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.levelArrow
                      }
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------
  // SELECTED LEVEL SCREEN
  // ------------------------------------------------

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              refreshRecords
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedLevel(null);
            setSelectedDepartment(
              'ALL'
            );
          }}
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
            All Levels
          </Text>
        </TouchableOpacity>

        <View
          style={styles.levelHeader}
        >
          <View>
            <Text
              style={styles.levelHeaderTitle}
            >
              {selectedLevel}
            </Text>

            <Text
              style={
                styles.levelHeaderSubtitle
              }
            >
              Attendance records
            </Text>
          </View>

          <View
            style={styles.bigLevelIcon}
          >
            <Text
              style={
                styles.bigLevelIconText
              }
            >
              🎓
            </Text>
          </View>
        </View>

        <View
          style={styles.summaryRow}
        >
          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryNumber}
            >
              {totalSessions}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Sessions
            </Text>
          </View>

          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryNumber}
            >
              {totalPresent}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Present
            </Text>
          </View>

          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryNumber}
            >
              {availableDepartments.length}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Departments
            </Text>
          </View>
        </View>

        {availableDepartments.length >
          0 && (
          <>
            <Text
              style={styles.sectionTitle}
            >
              Department
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.departmentFilterContainer
              }
            >
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  selectedDepartment ===
                    'ALL' &&
                    styles.filterButtonActive,
                ]}
                onPress={() =>
                  setSelectedDepartment(
                    'ALL'
                  )
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedDepartment ===
                      'ALL' &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  All Departments
                </Text>
              </TouchableOpacity>

              {availableDepartments.map(
                (department) => (
                  <TouchableOpacity
                    key={department}
                    style={[
                      styles.filterButton,
                      selectedDepartment ===
                        department &&
                        styles.filterButtonActive,
                    ]}
                    onPress={() =>
                      setSelectedDepartment(
                        department
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        selectedDepartment ===
                          department &&
                          styles.filterButtonTextActive,
                      ]}
                    >
                      {department}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </>
        )}

        <Text
          style={styles.sectionTitle}
        >
          {selectedDepartment ===
          'ALL'
            ? `${selectedLevel} Attendance`
            : `${selectedDepartment} — ${selectedLevel}`}
        </Text>

        {filteredSessions.length ===
        0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={styles.emptyIcon}
            >
              📋
            </Text>

            <Text
              style={styles.emptyTitle}
            >
              No Attendance Yet
            </Text>

            <Text
              style={styles.emptyText}
            >
              No attendance has been
              recorded for this selection.
            </Text>
          </View>
        ) : (
          filteredSessions.map(
            (session) => {
              const students =
                sortStudents(
                  session.students
                );

              const departmentGroups =
                students.reduce(
                  (
                    groups,
                    student
                  ) => {
                    const department =
                      getDepartmentName(
                        student.profile
                      );

                    if (
                      !groups[
                        department
                      ]
                    ) {
                      groups[
                        department
                      ] = [];
                    }

                    groups[
                      department
                    ].push(student);

                    return groups;
                  },
                  {} as Record<
                    string,
                    StudentAttendance[]
                  >
                );

              const departmentNames =
                Object.keys(
                  departmentGroups
                ).sort();

              return (
                <View
                  key={session.id}
                  style={
                    styles.sessionCard
                  }
                >
                  <View
                    style={
                      styles.sessionHeader
                    }
                  >
                    <View
                      style={
                        styles.sessionTitleArea
                      }
                    >
                      <Text
                        style={
                          styles.sessionCourse
                        }
                      >
                        {
                          session.courseName
                        }
                      </Text>

                      <Text
                        style={
                          styles.sessionTopic
                        }
                      >
                        {session.topic ||
                          'No topic provided'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.presentBadge
                      }
                    >
                      <Text
                        style={
                          styles.presentBadgeText
                        }
                      >
                        {students.length}{' '}
                        PRESENT
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.sessionInfoRow
                    }
                  >
                    <Text
                      style={
                        styles.sessionInfo
                      }
                    >
                      📅{' '}
                      {formatDate(
                        session.class_date
                      )}
                    </Text>

                    <Text
                      style={
                        styles.sessionInfo
                      }
                    >
                      🕐{' '}
                      {formatTime(
                        session.start_time
                      )}
                    </Text>
                  </View>

                  {session.venue ? (
                    <Text
                      style={
                        styles.venueText
                      }
                    >
                      📍 {session.venue}
                    </Text>
                  ) : null}

                  <View
                    style={
                      styles.sessionDivider
                    }
                  />

                  {departmentNames.length ===
                  0 ? (
                    <View
                      style={
                        styles.noStudentBox
                      }
                    >
                      <Text
                        style={
                          styles.noStudentText
                        }
                      >
                        No student records
                        for this session.
                      </Text>
                    </View>
                  ) : (
                    departmentNames.map(
                      (
                        department
                      ) => {
                        const departmentStudents =
                          departmentGroups[
                            department
                          ];

                        return (
                          <View
                            key={`${session.id}-${department}`}
                            style={
                              styles.departmentGroup
                            }
                          >
                            <View
                              style={
                                styles.departmentGroupHeader
                              }
                            >
                              <Text
                                style={
                                  styles.departmentGroupTitle
                                }
                              >
                                {department}
                              </Text>

                              <View
                                style={
                                  styles.departmentCount
                                }
                              >
                                <Text
                                  style={
                                    styles.departmentCountText
                                  }
                                >
                                  {
                                    departmentStudents.length
                                  }{' '}
                                  present
                                </Text>
                              </View>
                            </View>

                            {departmentStudents.map(
                              (
                                student,
                                index
                              ) => (
                                <View
                                  key={
                                    student.id
                                  }
                                  style={[
                                    styles.studentRow,
                                    index <
                                      departmentStudents.length -
                                        1 &&
                                      styles.studentRowBorder,
                                  ]}
                                >
                                  <View
                                    style={
                                      styles.studentAvatar
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.studentAvatarText
                                      }
                                    >
                                      {(
                                        student
                                          .profile
                                          ?.full_name ||
                                        '?'
                                      )
                                        .charAt(
                                          0
                                        )
                                        .toUpperCase()}
                                    </Text>
                                  </View>

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
                                      {student
                                        .profile
                                        ?.full_name ||
                                        'Student'}
                                    </Text>

                                    <Text
                                      style={
                                        styles.studentMatric
                                      }
                                    >
                                      {student
                                        .profile
                                        ?.student_id ||
                                        'Matric number not available'}
                                    </Text>

                                    <Text
                                      style={
                                        styles.studentScanTime
                                      }
                                    >
                                      Scanned{' '}
                                      {new Date(
                                        student.scanned_at
                                      ).toLocaleTimeString(
                                        'en-US',
                                        {
                                          hour: 'numeric',
                                          minute:
                                            '2-digit',
                                        }
                                      )}
                                    </Text>
                                  </View>

                                  <View
                                    style={
                                      styles.statusBadge
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.statusBadgeText
                                      }
                                    >
                                      {String(
                                        student.status
                                      ).toUpperCase()}
                                    </Text>
                                  </View>
                                </View>
                              )
                            )}
                          </View>
                        );
                      }
                    )
                  )}
                </View>
              );
            }
          )
        )}

        <View
          style={styles.bottomSpace}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  container: {
    padding: 20,
    paddingBottom: 45,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
  },

  backArrow: {
    fontSize: 32,
    color: '#111827',
    marginRight: 5,
    lineHeight: 32,
  },

  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  headerTextArea: {
    flex: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginTop: 7,
    paddingRight: 10,
  },

  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIconText: {
    fontSize: 29,
  },

  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 40,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },

  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 25,
    alignItems: 'center',
  },

  errorIcon: {
    fontSize: 40,
    marginBottom: 10,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },

  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },

  retryButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 25,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },

  levelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 17,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  levelIcon: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  levelIconText: {
    fontSize: 27,
  },

  levelContent: {
    flex: 1,
  },

  levelTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111827',
  },

  levelStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 5,
  },

  levelStat: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
  },

  dot: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 5,
  },

  levelArrow: {
    fontSize: 31,
    color: '#9CA3AF',
    marginLeft: 5,
  },

  levelHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  levelHeaderTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },

  levelHeaderSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '600',
  },

  bigLevelIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigLevelIconText: {
    fontSize: 29,
  },

  summaryRow: {
    flexDirection: 'row',
    marginBottom: 25,
    gap: 9,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    paddingVertical: 15,
    alignItems: 'center',
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },

  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 3,
  },

  departmentFilterContainer: {
    paddingBottom: 18,
    paddingRight: 10,
  },

  filterButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  filterButtonActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },

  filterButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },

  filterButtonTextActive: {
    color: '#FFFFFF',
  },

  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 17,
    marginBottom: 15,
  },

  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  sessionTitleArea: {
    flex: 1,
    paddingRight: 10,
  },

  sessionCourse: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 22,
  },

  sessionTopic: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },

  presentBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  presentBadgeText: {
    color: '#166534',
    fontSize: 9,
    fontWeight: '900',
  },

  sessionInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 13,
  },

  sessionInfo: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginRight: 14,
  },

  venueText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 7,
  },

  sessionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 15,
  },

  departmentGroup: {
    marginBottom: 15,
  },

  departmentGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 7,
  },

  departmentGroupTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#1F2937',
  },

  departmentCount: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginLeft: 8,
  },

  departmentCountText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0369A1',
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  studentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  studentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  studentAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4F46E5',
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },

  studentMatric: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
    fontWeight: '700',
  },

  studentScanTime: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 3,
  },

  statusBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginLeft: 7,
  },

  statusBadgeText: {
    color: '#166534',
    fontSize: 8,
    fontWeight: '900',
  },

  noStudentBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 15,
  },

  noStudentText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },

  bottomSpace: {
    height: 20,
  },
});