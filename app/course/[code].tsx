import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CourseScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    programme?: string;
    level?: string;
  }>();

  const courseCode = params.code || 'COURSE';

  const courseNames: Record<string, string> = {
    CSC101: 'Introduction to Computer Science',
    MTH101: 'Elementary Mathematics',
    PHY101: 'General Physics',
    GST101: 'Use of English',

    COS102: 'Problem Solving',
    CSC172: 'Data Mining & Warehousing',
    CSC176: 'Introduction to Web Design',
    CSC178: 'Basic Electronics',

    SEN101: 'Introduction to Software Engineering',
    SEN201: 'Software Engineering Principles',
    SEN202: 'Object-Oriented Programming',
    SEN203: 'Data Structures',
    SEN204: 'Database Systems',

    CYB101: 'Introduction to Cybersecurity',
    CYB201: 'Cybersecurity Fundamentals',
    CYB202: 'Network Security',
    CYB203: 'Operating Systems Security',
    CYB204: 'Introduction to Cryptography',
  };

  const courseUnits: Record<string, number> = {
    CSC101: 3,
    MTH101: 3,
    PHY101: 3,
    GST101: 2,

    COS102: 3,
    CSC172: 3,
    CSC176: 3,
    CSC178: 3,

    SEN101: 3,
    SEN201: 3,
    SEN202: 3,
    SEN203: 3,
    SEN204: 3,

    CYB101: 3,
    CYB201: 3,
    CYB202: 3,
    CYB203: 3,
    CYB204: 3,
  };

  const courseName =
    courseNames[courseCode] || 'Course Information';

  const units = courseUnits[courseCode] || 3;

  const openLectureNotes = () => {
    router.push({
      pathname: '/course/lecture/[index]',
      params: {
        index: courseCode,
        code: courseCode,
      },
    });
  };

  const openAttendance = () => {
    router.push('/attendance');
  };

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
            <Ionicons
              name="chevron-back"
              size={24}
              color="#111827"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Course
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* COURSE HERO */}

        <View style={styles.heroCard}>
          <View style={styles.courseIcon}>
            <Ionicons
              name="book"
              size={30}
              color="#4F46E5"
            />
          </View>

          <Text style={styles.courseCode}>
            {courseCode}
          </Text>

          <Text style={styles.courseName}>
            {courseName}
          </Text>

          <View style={styles.courseMeta}>
            <View style={styles.metaItem}>
              <Ionicons
                name="school-outline"
                size={17}
                color="#6B7280"
              />

              <Text style={styles.metaText}>
                {params.level || 'Level'}
              </Text>
            </View>

            <View style={styles.metaDivider} />

            <View style={styles.metaItem}>
              <Ionicons
                name="ribbon-outline"
                size={17}
                color="#6B7280"
              />

              <Text style={styles.metaText}>
                {units} Credit {units === 1 ? 'Unit' : 'Units'}
              </Text>
            </View>
          </View>
        </View>

        {/* COURSE TOOLS */}

        <Text style={styles.sectionTitle}>
          Course
        </Text>

        <View style={styles.grid}>
          {/* LECTURE NOTES */}

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.75}
            onPress={openLectureNotes}
          >
            <View
              style={[
                styles.featureIcon,
                styles.blueIcon,
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={24}
                color="#4F46E5"
              />
            </View>

            <Text style={styles.featureTitle}>
              Lecture Notes
            </Text>

            <Text style={styles.featureSubtitle}>
              Read course materials
            </Text>
          </TouchableOpacity>

          {/* PAST QUESTIONS */}

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.featureIcon,
                styles.orangeIcon,
              ]}
            >
              <Ionicons
                name="help-circle-outline"
                size={24}
                color="#EA580C"
              />
            </View>

            <Text style={styles.featureTitle}>
              Past Questions
            </Text>

            <Text style={styles.featureSubtitle}>
              Practice for exams
            </Text>
          </TouchableOpacity>

          {/* ATTENDANCE */}

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.75}
            onPress={openAttendance}
          >
            <View
              style={[
                styles.featureIcon,
                styles.greenIcon,
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color="#16A34A"
              />
            </View>

            <Text style={styles.featureTitle}>
              Attendance
            </Text>

            <Text style={styles.featureSubtitle}>
              View your attendance
            </Text>
          </TouchableOpacity>

          {/* RESULTS */}

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.featureIcon,
                styles.purpleIcon,
              ]}
            >
              <Ionicons
                name="stats-chart-outline"
                size={24}
                color="#9333EA"
              />
            </View>

            <Text style={styles.featureTitle}>
              Course Result
            </Text>

            <Text style={styles.featureSubtitle}>
              Track your performance
            </Text>
          </TouchableOpacity>
        </View>

        {/* COURSE INFORMATION */}

        <Text style={styles.sectionTitle}>
          Course Information
        </Text>

        <View style={styles.infoCard}>
          <InfoRow
            icon="book-outline"
            label="Course Code"
            value={courseCode}
          />

          <View style={styles.divider} />

          <InfoRow
            icon="document-text-outline"
            label="Course Title"
            value={courseName}
          />

          <View style={styles.divider} />

          <InfoRow
            icon="ribbon-outline"
            label="Credit Units"
            value={`${units} ${units === 1 ? 'Unit' : 'Units'}`}
          />

          <View style={styles.divider} />

          <InfoRow
            icon="school-outline"
            label="Programme"
            value={params.programme || 'Not available'}
          />

          <View style={styles.divider} />

          <InfoRow
            icon="layers-outline"
            label="Level"
            value={params.level || 'Not available'}
          />
        </View>

        {/* LECTURER */}

        <Text style={styles.sectionTitle}>
          Lecturer
        </Text>

        <View style={styles.lecturerCard}>
          <View style={styles.lecturerAvatar}>
            <Ionicons
              name="person"
              size={25}
              color="#4F46E5"
            />
          </View>

          <View style={styles.lecturerInfo}>
            <Text style={styles.lecturerName}>
              Lecturer information
            </Text>

            <Text style={styles.lecturerSubtitle}>
              Lecturer details will appear here.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#9CA3AF"
          />
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

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function InfoRow({
  icon,
  label,
  value,
}: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIcon}>
        <Ionicons
          name={icon}
          size={19}
          color="#4F46E5"
        />
      </View>

      <View style={styles.infoRowText}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

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

  header: {
    height: 62,
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

  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  headerSpacer: {
    width: 42,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  courseIcon: {
    width: 65,
    height: 65,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  courseCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 1,
  },

  courseName: {
    fontSize: 23,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 29,
    marginTop: 6,
  },

  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metaText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 5,
    fontWeight: '600',
  },

  metaDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 27,
  },

  featureCard: {
    width: '48%',
    minHeight: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
  },

  featureIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
  },

  blueIcon: {
    backgroundColor: '#EEF2FF',
  },

  orangeIcon: {
    backgroundColor: '#FFF7ED',
  },

  greenIcon: {
    backgroundColor: '#F0FDF4',
  },

  purpleIcon: {
    backgroundColor: '#FAF5FF',
  },

  featureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  featureSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    padding: 18,
    marginBottom: 27,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  infoRowText: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0F1F4',
    marginVertical: 14,
  },

  lecturerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },

  lecturerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  lecturerInfo: {
    flex: 1,
  },

  lecturerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  lecturerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
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