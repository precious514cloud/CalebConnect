import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function WelcomeScreen() {
  // STUDENT ENTRY
  const continueToStudent = () => {
    router.push('/student-login');
  };

  // LECTURER ENTRY
  const continueToLecturer = () => {
    router.push('/lecturer');
  };

  // COURSE REP ENTRY
  const continueToCourseRep = () => {
    router.push('/course-rep-login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* LOGO */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>C</Text>
          </View>

          <Text style={styles.brandName}>Caleb Connect</Text>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome 👋</Text>

          <Text style={styles.welcomeSubtitle}>
            Your smarter academic companion.
          </Text>

          <Text style={styles.description}>
            Caleb Connect brings your courses, attendance,
            timetable, lecture notes and academic tools
            together in one place.
          </Text>
        </View>

        {/* FEATURES */}
        <View style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>📚</Text>
            </View>

            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Your Courses</Text>
              <Text style={styles.featureDescription}>
                Access information based on your department
                and level.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>📱</Text>
            </View>

            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Smart Attendance</Text>
              <Text style={styles.featureDescription}>
                Scan attendance QR codes and keep track of
                your lectures.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>🎓</Text>
            </View>

            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Built for Students</Text>
              <Text style={styles.featureDescription}>
                Designed to make your university experience
                easier and more organized.
              </Text>
            </View>
          </View>
        </View>

        {/* STUDENT BUTTON */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={continueToStudent}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.continueText}>Get Started</Text>
            <Text style={styles.arrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* LECTURER ACCESS */}
        <TouchableOpacity
          style={styles.lecturerButton}
          onPress={continueToLecturer}
          activeOpacity={0.8}
        >
          <View style={styles.lecturerIcon}>
            <Ionicons
              name="person-outline"
              size={21}
              color="#16A34A"
            />
          </View>

          <View style={styles.lecturerContent}>
            <Text style={styles.lecturerTitle}>
              Lecturer Access
            </Text>
            <Text style={styles.lecturerSubtitle}>
              For lecturers and course administrators
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#9CA3AF"
          />
        </TouchableOpacity>

        {/* COURSE REP ACCESS */}
        <TouchableOpacity
          style={styles.courseRepButton}
          onPress={continueToCourseRep}
          activeOpacity={0.8}
        >
          <View style={styles.courseRepIcon}>
            <Ionicons
              name="people-outline"
              size={22}
              color="#7C3AED"
            />
          </View>

          <View style={styles.courseRepContent}>
            <Text style={styles.courseRepTitle}>
              Course Rep Access
            </Text>
            <Text style={styles.courseRepSubtitle}>
              Manage academic updates for your department
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#9CA3AF"
          />
        </TouchableOpacity>

        {/* FOOTER */}
        <Text style={styles.footer}>
          Let's build your personalized Caleb Connect
          experience.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },

  /* LOGO */
  logoSection: {
    alignItems: 'center',
    marginBottom: 45,
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },

  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  /* WELCOME */
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 30,
  },

  welcomeTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  welcomeSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 8,
    textAlign: 'center',
  },

  description: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
  },

  /* FEATURES */
  featuresCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 25,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  featureEmoji: {
    fontSize: 24,
  },

  featureTextContainer: {
    flex: 1,
  },

  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },

  /* STUDENT BUTTON */
  continueButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 23,
    marginLeft: 10,
  },

  /* LECTURER BUTTON */
  lecturerButton: {
    backgroundColor: '#FFFFFF',
    minHeight: 68,
    borderRadius: 18,
    marginTop: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  lecturerIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  lecturerContent: {
    flex: 1,
    marginLeft: 12,
  },

  lecturerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  lecturerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },

  /* COURSE REP BUTTON */
  courseRepButton: {
    backgroundColor: '#FFFFFF',
    minHeight: 68,
    borderRadius: 18,
    marginTop: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  courseRepIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  courseRepContent: {
    flex: 1,
    marginLeft: 12,
  },

  courseRepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  courseRepSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },

  /* FOOTER */
  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
  },
});