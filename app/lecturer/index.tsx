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

const ROLE_KEY = '@calebconnect_user_role';

export default function LecturerDashboard() {
  const [checkingAccess, setCheckingAccess] =
    useState(true);

  useEffect(() => {
    checkLecturerAccess();
  }, []);

  const checkLecturerAccess = async () => {
    try {
      const role =
        await AsyncStorage.getItem(ROLE_KEY);

      if (role !== 'lecturer') {
        router.replace('/lecturer-login');
        return;
      }
    } catch (error) {
      console.log(
        'Lecturer access check error:',
        error
      );

      router.replace('/lecturer-login');
    } finally {
      setCheckingAccess(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(ROLE_KEY);

      router.replace('/lecturer-login');
    } catch (error) {
      console.log(
        'Lecturer logout error:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to log out. Please try again.'
      );
    }
  };

  if (checkingAccess) {
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

          <Text style={styles.loadingText}>
            Checking lecturer access...
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
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text
              style={styles.smallTitle}
            >
              CALEBCONNECT
            </Text>

            <Text style={styles.title}>
              Lecturer Dashboard
            </Text>

            <Text
              style={styles.subtitle}
            >
              Welcome to CalebConnect
              Lecturer Mode.
            </Text>
          </View>

          <View
            style={styles.iconCircle}
          >
            <Text style={styles.icon}>
              👨‍🏫
            </Text>
          </View>
        </View>

        {/* ACCESS GRANTED */}

        <View
          style={styles.accessCard}
        >
          <View
            style={styles.checkCircle}
          >
            <Text style={styles.check}>
              ✓
            </Text>
          </View>

          <View
            style={styles.accessContent}
          >
            <Text
              style={styles.accessTitle}
            >
              Access Granted
            </Text>

            <Text
              style={styles.accessText}
            >
              You are signed in as an
              authorised CalebConnect
              lecturer.
            </Text>
          </View>
        </View>

        {/* LECTURER TOOLS */}

        <Text
          style={styles.sectionTitle}
        >
          Lecturer Tools
        </Text>

        <View
          style={styles.toolsGrid}
        >
          {/* CREATE SESSION */}

          <TouchableOpacity
            style={styles.toolCard}
            activeOpacity={0.8}
            onPress={() =>
              router.push(
                '/lecturer/create-session'
              )
            }
          >
            <View
              style={styles.toolIcon}
            >
              <Text
                style={styles.toolEmoji}
              >
                📅
              </Text>
            </View>

            <Text
              style={styles.toolTitle}
            >
              Create Session
            </Text>

            <Text
              style={styles.toolText}
            >
              Create a new attendance
              session.
            </Text>
          </TouchableOpacity>

          {/* QR CODE */}

          <TouchableOpacity
            style={styles.toolCard}
            activeOpacity={0.8}
            onPress={() =>
              router.push(
                '/lecturer/qr-code'
              )
            }
          >
            <View
              style={styles.toolIcon}
            >
              <Text
                style={styles.toolEmoji}
              >
                ▦
              </Text>
            </View>

            <Text
              style={styles.toolTitle}
            >
              QR Code
            </Text>

            <Text
              style={styles.toolText}
            >
              Generate attendance QR
              codes.
            </Text>
          </TouchableOpacity>

          {/* ATTENDANCE RECORDS */}

          <TouchableOpacity
            style={styles.toolCard}
            activeOpacity={0.8}
            onPress={() =>
              router.push(
                '/lecturer/records'
              )
            }
          >
            <View
              style={styles.toolIcon}
            >
              <Text
                style={styles.toolEmoji}
              >
                📊
              </Text>
            </View>

            <Text
              style={styles.toolTitle}
            >
              Attendance Records
            </Text>

            <Text
              style={styles.toolText}
            >
              View student attendance
              records.
            </Text>
          </TouchableOpacity>

          {/* COURSES */}

          <TouchableOpacity
            style={styles.toolCard}
            activeOpacity={0.8}
            onPress={() =>
              router.push(
                '/lecturer/courses'
              )
            }
          >
            <View
              style={styles.toolIcon}
            >
              <Text
                style={styles.toolEmoji}
              >
                📚
              </Text>
            </View>

            <Text
              style={styles.toolTitle}
            >
              My Courses
            </Text>

            <Text
              style={styles.toolText}
            >
              Manage your assigned
              courses.
            </Text>
          </TouchableOpacity>

          {/* COURSE REP MANAGEMENT */}

          <TouchableOpacity
            style={[
              styles.toolCard,
              styles.courseRepCard,
            ]}
            activeOpacity={0.8}
            onPress={() =>
              router.push(
                '/lecturer/course-reps'
              )
            }
          >
            <View
              style={[
                styles.toolIcon,
                styles.courseRepIcon,
              ]}
            >
              <Text
                style={styles.toolEmoji}
              >
                👥
              </Text>
            </View>

            <Text
              style={styles.toolTitle}
            >
              Course Rep Management
            </Text>

            <Text
              style={styles.toolText}
            >
              Assign and manage Course
              Reps and Assistants.
            </Text>
          </TouchableOpacity>
        </View>

        {/* INFORMATION */}

        <View
          style={styles.infoCard}
        >
          <Text
            style={styles.infoTitle}
          >
            Lecturer Portal
          </Text>

          <Text
            style={styles.infoText}
          >
            From this portal, authorised
            lecturers can create attendance
            sessions, generate QR codes,
            view attendance records, manage
            their courses and manage Course
            Reps and Assistants for their
            assigned departments.
          </Text>
        </View>

        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={logout}
        >
          <Text
            style={styles.logoutText}
          >
            Log Out
          </Text>
        </TouchableOpacity>

        {/* FOOTER */}

        <Text style={styles.footer}>
          CalebConnect
        </Text>

        <Text
          style={styles.footerSubtext}
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
    paddingHorizontal: 20,
    paddingTop: 25,
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

  header: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },

  smallTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 1.5,
    marginBottom: 5,
  },

  title: {
    fontSize: 29,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 7,
  },

  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  icon: {
    fontSize: 35,
  },

  accessCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },

  checkCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  check: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
  },

  accessContent: {
    flex: 1,
  },

  accessTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#166534',
  },

  accessText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 15,
  },

  toolsGrid: {
    gap: 14,
  },

  toolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  courseRepCard: {
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },

  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
  },

  courseRepIcon: {
    backgroundColor: '#EEF2FF',
  },

  toolEmoji: {
    fontSize: 25,
  },

  toolTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  toolText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    marginTop: 5,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
  },

  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },

  logoutButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
  },

  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  footer: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: '#4F46E5',
    marginTop: 35,
  },

  footerSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});