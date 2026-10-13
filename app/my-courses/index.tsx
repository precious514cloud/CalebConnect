import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    getCourses,
    type AcademicProfile,
    type Course,
} from '@/constants/academic-data';

const PROFILE_KEY = '@calebconnect_student_profile';

export default function MyCoursesScreen() {
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentCourses();
  }, []);

  const loadStudentCourses = async () => {
    try {
      const savedProfile =
        await AsyncStorage.getItem(PROFILE_KEY);

      if (!savedProfile) {
        setLoading(false);
        return;
      }

      const studentProfile: AcademicProfile =
        JSON.parse(savedProfile);

      setProfile(studentProfile);

      const studentCourses = getCourses(
        studentProfile.programme,
        studentProfile.level
      );

      setCourses(studentCourses);
    } catch (error) {
      console.log(
        'Error loading student courses:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const openCourse = (course: Course) => {
    router.push({
      pathname: '/course/[code]',
      params: {
        code: course.code,
        programme: profile?.programme || '',
        level: profile?.level || '',
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading your courses...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyScreen}>
          <Text style={styles.emptyIcon}>
            🎓
          </Text>

          <Text style={styles.emptyTitle}>
            Student Profile Not Found
          </Text>

          <Text style={styles.emptyText}>
            Please complete your student profile
            before viewing your courses.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              router.push('/student-setup')
            }
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              Set Up Profile
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>
              ‹
            </Text>
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              My Courses
            </Text>

            <Text style={styles.headerSubtitle}>
              {profile.level}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* PROGRAMME CARD */}

        <View style={styles.programmeCard}>
          <View style={styles.programmeIcon}>
            <Text style={styles.programmeIconText}>
              🎓
            </Text>
          </View>

          <View style={styles.programmeInfo}>
            <Text style={styles.programmeLabel}>
              PROGRAMME
            </Text>

            <Text style={styles.programmeName}>
              {profile.programme}
            </Text>

            <Text style={styles.programmeLevel}>
              {profile.level}
            </Text>
          </View>
        </View>

        {/* COURSE COUNT */}

        <View style={styles.courseHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              Your Courses
            </Text>

            <Text style={styles.sectionSubtitle}>
              {courses.length}{' '}
              {courses.length === 1
                ? 'course'
                : 'courses'}{' '}
              registered
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {courses.length}
            </Text>
          </View>
        </View>

        {/* COURSE LIST */}

        <View style={styles.courseList}>
          {courses.map((course, index) => (
            <TouchableOpacity
              key={`${course.code}-${index}`}
              style={styles.courseCard}
              onPress={() => openCourse(course)}
              activeOpacity={0.75}
            >
              <View style={styles.courseNumber}>
                <Text style={styles.courseNumberText}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
              </View>

              <View style={styles.courseDetails}>
                <Text style={styles.courseCode}>
                  {course.code}
                </Text>

                <Text style={styles.courseTitle}>
                  {course.title}
                </Text>

                <View style={styles.courseBottom}>
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitText}>
                      {course.unit}{' '}
                      {course.unit === 1
                        ? 'Unit'
                        : 'Units'}
                    </Text>
                  </View>

                  <Text style={styles.courseAction}>
                    Open course
                  </Text>
                </View>
              </View>

              <Text style={styles.chevron}>
                ›
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* INFORMATION */}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Your academic courses
          </Text>

          <Text style={styles.infoText}>
            These courses are based on the programme
            and level selected in your student profile.
            CalebConnect will use this information to
            personalize your lectures, attendance,
            timetable, results and other academic
            features.
          </Text>
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
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backArrow: {
    fontSize: 32,
    lineHeight: 34,
    color: '#111827',
    fontWeight: '300',
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
    marginTop: 2,
  },

  headerSpacer: {
    width: 42,
  },

  programmeCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  programmeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  programmeIconText: {
    fontSize: 25,
  },

  programmeInfo: {
    flex: 1,
  },

  programmeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 4,
  },

  programmeName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  programmeLevel: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },

  courseHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },

  sectionSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
  },

  countBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  countText: {
    color: '#4F46E5',
    fontSize: 15,
    fontWeight: '800',
  },

  courseList: {
    marginBottom: 16,
  },

  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  courseNumber: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  courseNumberText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '800',
  },

  courseDetails: {
    flex: 1,
  },

  courseCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },

  courseTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 3,
  },

  courseBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  unitBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  unitText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },

  courseAction: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 9,
  },

  chevron: {
    fontSize: 27,
    fontWeight: '300',
    color: '#9CA3AF',
    marginLeft: 7,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 8,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  infoText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 7,
  },

  emptyScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 35,
  },

  emptyIcon: {
    fontSize: 45,
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },

  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 25,
    paddingVertical: 14,
    borderRadius: 13,
    marginTop: 22,
  },

  primaryButtonText: {
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