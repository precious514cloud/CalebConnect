import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

const PROFILE_KEY = '@calebconnect_student_profile';

const LEVELS = ['100', '200', '300', '400'] as const;

type Level = (typeof LEVELS)[number];

type StudentProfile = {
  fullName: string;
  matricNumber: string;
  department?: string;
  programme?: string;
  level?: string;
};

type SupabaseCourse = {
  id: string;
  course_code: string;
  course_title: string;
  department: string;
  level: string;
  semester?: string | null;
  credit_unit?: number | null;
};

type DisplayCourse = {
  id: string;
  code: string;
  title: string;
  unit: number;
  semester?: string | null;
};

export default function CoursesScreen() {
  const [profile, setProfile] =
    useState<StudentProfile | null>(null);

  const [selectedLevel, setSelectedLevel] =
    useState<Level | null>(null);

  const [courses, setCourses] =
    useState<DisplayCourse[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadingCourses, setLoadingCourses] =
    useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const savedProfile =
        await AsyncStorage.getItem(PROFILE_KEY);

      if (!savedProfile) {
        setProfile(null);
        setCourses([]);
        return;
      }

      const parsedProfile =
        JSON.parse(savedProfile) as StudentProfile;

      setProfile(parsedProfile);
    } catch (error) {
      console.log(
        'Error loading student profile:',
        error
      );

      setProfile(null);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCoursesForLevel = async (
    level: Level,
    department: string
  ) => {
    try {
      setLoadingCourses(true);

      setCourses([]);

      /*
       * Courses are now loaded dynamically from Supabase.
       *
       * The two important filters are:
       *
       * 1. department = student's department
       * 2. level = level selected by the student
       *
       * This prevents courses from another department
       * from appearing here.
       */

      const { data, error } = await supabase
        .from('courses')
        .select(
          `
            id,
            course_code,
            course_title,
            department,
            level,
            semester,
            credit_unit
          `
        )
        .ilike('department', department.trim())
        .eq('level', level)
        .order('course_code', {
          ascending: true,
        });

      if (error) {
        console.log(
          'Error loading courses:',
          error
        );

        setCourses([]);
        return;
      }

      const safeData = Array.isArray(data)
        ? (data as SupabaseCourse[])
        : [];

      const formattedCourses: DisplayCourse[] =
        safeData.map((course) => ({
          id: course.id,
          code: course.course_code,
          title: course.course_title,
          unit: Number(course.credit_unit) || 0,
          semester: course.semester,
        }));

      setCourses(formattedCourses);
    } catch (error) {
      console.log(
        'Unexpected course loading error:',
        error
      );

      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleLevelPress = async (
    level: Level
  ) => {
    if (!profile) {
      return;
    }

    const department =
      profile.department ||
      profile.programme ||
      '';

    if (!department) {
      return;
    }

    setSelectedLevel(level);

    await loadCoursesForLevel(
      level,
      department
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#4F46E5"
        />

        <Text style={styles.loadingText}>
          Loading your courses...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="person-outline"
              size={34}
              color="#4F46E5"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Student Profile Required
          </Text>

          <Text style={styles.emptyText}>
            Please complete your student profile
            before viewing your courses.
          </Text>

          <TouchableOpacity
            style={styles.setupButton}
            onPress={() =>
              router.push('/student-setup')
            }
            activeOpacity={0.8}
          >
            <Text style={styles.setupButtonText}>
              Set Up Profile
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const department =
    profile.department ||
    profile.programme ||
    'Department Not Selected';

  const firstName =
    profile.fullName
      ?.trim()
      .split(' ')[0] || 'Student';

  const totalUnits = courses.reduce(
    (total, course) =>
      total + (Number(course.unit) || 0),
    0
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              Hello, {firstName} 👋
            </Text>

            <Text style={styles.title}>
              My Courses
            </Text>

            <Text style={styles.subtitle}>
              Select a level to view courses
            </Text>
          </View>

          <View style={styles.schoolCircle}>
            <Ionicons
              name="school-outline"
              size={27}
              color="#4F46E5"
            />
          </View>
        </View>

        {/* DEPARTMENT */}

        <View style={styles.departmentCard}>
          <View style={styles.departmentIcon}>
            <Ionicons
              name="business-outline"
              size={26}
              color="#4F46E5"
            />
          </View>

          <View style={styles.departmentInfo}>
            <Text style={styles.departmentLabel}>
              YOUR DEPARTMENT
            </Text>

            <Text style={styles.departmentName}>
              {department}
            </Text>

            <Text style={styles.departmentDescription}>
              Courses available for your department
            </Text>
          </View>
        </View>

        {/* LEVEL SELECTION */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Select Level
          </Text>

          <Text style={styles.sectionHint}>
            100 — 400
          </Text>
        </View>

        <View style={styles.levelGrid}>
          {LEVELS.map((level) => {
            const isSelected =
              selectedLevel === level;

            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.levelCard,
                  isSelected &&
                    styles.levelCardSelected,
                ]}
                onPress={() =>
                  handleLevelPress(level)
                }
                activeOpacity={0.78}
              >
                <View
                  style={[
                    styles.levelIcon,
                    isSelected &&
                      styles.levelIconSelected,
                  ]}
                >
                  <Ionicons
                    name="school-outline"
                    size={24}
                    color={
                      isSelected
                        ? '#FFFFFF'
                        : '#4F46E5'
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.levelNumber,
                    isSelected &&
                      styles.levelNumberSelected,
                  ]}
                >
                  {level}
                </Text>

                <Text
                  style={[
                    styles.levelLabel,
                    isSelected &&
                      styles.levelLabelSelected,
                  ]}
                >
                  Level
                </Text>

                <View
                  style={[
                    styles.levelArrow,
                    isSelected &&
                      styles.levelArrowSelected,
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={
                      isSelected
                        ? '#FFFFFF'
                        : '#9CA3AF'
                    }
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* NO LEVEL SELECTED */}

        {!selectedLevel && (
          <View style={styles.selectLevelCard}>
            <View style={styles.selectLevelIcon}>
              <Ionicons
                name="book-outline"
                size={34}
                color="#9CA3AF"
              />
            </View>

            <Text style={styles.selectLevelTitle}>
              Choose Your Level
            </Text>

            <Text style={styles.selectLevelText}>
              Select 100, 200, 300 or 400 Level
              above to view the courses available
              for {department}.
            </Text>
          </View>
        )}

        {/* SELECTED LEVEL */}

        {selectedLevel && (
          <>
            <View style={styles.selectedLevelHeader}>
              <View>
                <Text style={styles.selectedLevelSmall}>
                  {department.toUpperCase()}
                </Text>

                <Text style={styles.selectedLevelTitle}>
                  {selectedLevel} Level Courses
                </Text>
              </View>

              <View style={styles.courseCountBadge}>
                <Text style={styles.courseCountNumber}>
                  {courses.length}
                </Text>

                <Text style={styles.courseCountLabel}>
                  {courses.length === 1
                    ? 'Course'
                    : 'Courses'}
                </Text>
              </View>
            </View>

            {loadingCourses ? (
              <View style={styles.loadingCoursesCard}>
                <ActivityIndicator
                  size="small"
                  color="#4F46E5"
                />

                <Text
                  style={
                    styles.loadingCoursesText
                  }
                >
                  Loading {selectedLevel} Level
                  courses...
                </Text>
              </View>
            ) : courses.length === 0 ? (
              <View style={styles.noCoursesCard}>
                <View style={styles.noCoursesIcon}>
                  <Ionicons
                    name="book-outline"
                    size={35}
                    color="#9CA3AF"
                  />
                </View>

                <Text style={styles.noCoursesTitle}>
                  No Courses Available Yet
                </Text>

                <Text style={styles.noCoursesText}>
                  No courses have been added for{' '}
                  {department} — {selectedLevel}{' '}
                  Level yet.
                </Text>

                <Text
                  style={styles.noCoursesSubtext}
                >
                  When a lecturer adds a course for
                  your department and this level, it
                  will appear here automatically.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.unitsSummary}>
                  <View
                    style={styles.unitsSummaryIcon}
                  >
                    <Ionicons
                      name="calculator-outline"
                      size={20}
                      color="#4F46E5"
                    />
                  </View>

                  <View
                    style={styles.unitsSummaryText}
                  >
                    <Text
                      style={styles.unitsSummaryTitle}
                    >
                      Total Credit Units
                    </Text>

                    <Text
                      style={styles.unitsSummarySubtitle}
                    >
                      {courses.length}{' '}
                      {courses.length === 1
                        ? 'course'
                        : 'courses'}{' '}
                      for {selectedLevel} Level
                    </Text>
                  </View>

                  <Text
                    style={styles.unitsSummaryNumber}
                  >
                    {totalUnits}
                  </Text>
                </View>

                <View
                  style={styles.coursesList}
                >
                  {courses.map(
                    (course, index) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        index={index}
                        department={
                          department
                        }
                        level={
                          selectedLevel
                        }
                      />
                    )
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* INFORMATION */}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#4F46E5"
            />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Department-based courses
            </Text>

            <Text style={styles.infoText}>
              You can view courses from 100 to 400
              Level, but only courses belonging to
              your department are displayed.
            </Text>
          </View>
        </View>

        {/* FOOTER */}

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

type CourseCardProps = {
  course: DisplayCourse;
  index: number;
  department: string;
  level: string;
};

function CourseCard({
  course,
  index,
  department,
  level,
}: CourseCardProps) {
  const openCourse = () => {
    router.push({
      pathname: '/course/[code]',
      params: {
        code: course.code,
        department,
        level,
      },
    });
  };

  return (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={openCourse}
      activeOpacity={0.75}
    >
      <View style={styles.numberCircle}>
        <Text style={styles.numberText}>
          {index + 1}
        </Text>
      </View>

      <View style={styles.courseDetails}>
        <Text style={styles.courseCode}>
          {course.code}
        </Text>

        <Text style={styles.courseTitle}>
          {course.title}
        </Text>

        <Text style={styles.courseUnits}>
          {course.unit}{' '}
          {course.unit === 1
            ? 'Credit Unit'
            : 'Credit Units'}
        </Text>

        {course.semester && (
          <Text style={styles.courseSemester}>
            {course.semester}
          </Text>
        )}
      </View>

      <View style={styles.courseArrow}>
        <Ionicons
          name="chevron-forward"
          size={20}
          color="#9CA3AF"
        />
      </View>
    </TouchableOpacity>
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
    paddingTop: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  headerText: {
    flex: 1,
    paddingRight: 15,
  },

  greeting: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 5,
  },

  schoolCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  departmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  departmentIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  departmentInfo: {
    flex: 1,
  },

  departmentLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  departmentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  departmentDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },

  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },

  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  levelCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    minHeight: 142,
    position: 'relative',
  },

  levelCardSelected: {
    backgroundColor: '#4F46E5',
  },

  levelIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  levelIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  levelNumber: {
    fontSize: 23,
    fontWeight: '800',
    color: '#111827',
  },

  levelNumberSelected: {
    color: '#FFFFFF',
  },

  levelLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
    fontWeight: '600',
  },

  levelLabelSelected: {
    color: '#E0E7FF',
  },

  levelArrow: {
    position: 'absolute',
    right: 13,
    bottom: 13,
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  levelArrowSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  selectLevelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },

  selectLevelIcon: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  selectLevelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
  },

  selectLevelText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },

  selectedLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 14,
  },

  selectedLevelSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },

  selectedLevelTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    marginTop: 3,
  },

  courseCountBadge: {
    minWidth: 58,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
  },

  courseCountNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4F46E5',
  },

  courseCountLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6366F1',
    marginTop: 1,
  },

  loadingCoursesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
  },

  loadingCoursesText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },

  unitsSummary: {
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  unitsSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  unitsSummaryText: {
    flex: 1,
  },

  unitsSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3730A3',
  },

  unitsSummarySubtitle: {
    fontSize: 10,
    color: '#6366F1',
    marginTop: 2,
  },

  unitsSummaryNumber: {
    fontSize: 23,
    fontWeight: '800',
    color: '#4F46E5',
  },

  coursesList: {
    marginBottom: 5,
  },

  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },

  numberCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  numberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },

  courseDetails: {
    flex: 1,
    paddingRight: 8,
  },

  courseCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },

  courseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
    marginTop: 3,
  },

  courseUnits: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },

  courseSemester: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },

  courseArrow: {
    width: 30,
    alignItems: 'flex-end',
  },

  noCoursesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },

  noCoursesIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
  },

  noCoursesTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
  },

  noCoursesText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
  },

  noCoursesSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 10,
  },

  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    marginTop: 17,
  },

  infoIcon: {
    marginRight: 12,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3730A3',
  },

  infoText: {
    fontSize: 12,
    color: '#6366F1',
    lineHeight: 18,
    marginTop: 4,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },

  setupButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 13,
    marginTop: 22,
  },

  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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