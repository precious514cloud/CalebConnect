import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PROFILE_KEY = '@calebconnect_student_profile';
const ATTENDANCE_KEY = '@calebconnect_attendance';

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

export default function AttendanceScannerScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (scanned || processing) {
      return;
    }

    setScanned(true);
    setProcessing(true);

    try {
      /*
       * CalebConnect Attendance QR format:
       *
       * CALEB_ATTENDANCE|COURSE_CODE|COURSE_NAME
       */

      const parts = data.split('|');

      if (
        parts.length < 3 ||
        parts[0] !== 'CALEB_ATTENDANCE'
      ) {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid CalebConnect attendance code.',
          [
            {
              text: 'Scan Again',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ]
        );

        return;
      }

      const courseCode = parts[1].trim();

      const courseTitle = parts
        .slice(2)
        .join('|')
        .trim();

      if (!courseCode || !courseTitle) {
        Alert.alert(
          'Invalid Attendance QR',
          'The attendance information in this QR code is incomplete.',
          [
            {
              text: 'Scan Again',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ]
        );

        return;
      }

      /*
       * Check student profile
       */

      const savedProfile =
        await AsyncStorage.getItem(PROFILE_KEY);

      if (!savedProfile) {
        Alert.alert(
          'Student Profile Required',
          'Please complete your student profile before marking attendance.',
          [
            {
              text: 'Set Up Profile',
              onPress: () => {
                router.push('/student-setup');
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ]
        );

        return;
      }

      const profile: StudentProfile =
        JSON.parse(savedProfile);

      /*
       * Load previous attendance
       */

      const savedAttendance =
        await AsyncStorage.getItem(ATTENDANCE_KEY);

      let attendance: AttendanceRecord[] = [];

      if (savedAttendance) {
        try {
          attendance = JSON.parse(savedAttendance);
        } catch {
          attendance = [];
        }
      }

      /*
       * Get current date and time
       */

      const now = new Date();

      const date = now.toLocaleDateString(
        'en-NG',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      );

      const time = now.toLocaleTimeString(
        'en-NG',
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      );

      /*
       * Prevent duplicate attendance
       * for the same course on the same day.
       */

      const alreadyMarked =
        attendance.some(
          (record) =>
            record.courseCode === courseCode &&
            record.date === date
        );

      if (alreadyMarked) {
        Alert.alert(
          'Attendance Already Recorded',
          `Your attendance for ${courseCode} has already been recorded today.`,
          [
            {
              text: 'Go to Attendance',
              onPress: () => {
                router.replace(
                  '/(tabs)/attendance'
                );
              },
            },
            {
              text: 'Stay Here',
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ]
        );

        return;
      }

      /*
       * Create attendance record
       */

      const newRecord: AttendanceRecord = {
        id: `${Date.now()}-${courseCode}`,
        courseCode,
        courseTitle,
        date,
        time,
        venue: 'Venue not provided',
        status: 'Present',
      };

      const updatedAttendance = [
        newRecord,
        ...attendance,
      ];

      /*
       * Save attendance locally.
       */

      await AsyncStorage.setItem(
        ATTENDANCE_KEY,
        JSON.stringify(updatedAttendance)
      );

      /*
       * Attendance successfully recorded.
       */

      Alert.alert(
        'Attendance Recorded ✓',
        `Your attendance has been successfully recorded.\n\nCourse: ${courseCode}\n${courseTitle}\n\nStudent: ${profile.fullName}`,
        [
          {
            text: 'View Attendance',
            onPress: () => {
              /*
               * IMPORTANT:
               * Go back to the Attendance tab,
               * NOT back to the scanner.
               */
              router.replace(
                '/(tabs)/attendance'
              );
            },
          },
        ]
      );
    } catch (error) {
      console.log(
        'Attendance scanning error:',
        error
      );

      Alert.alert(
        'Something Went Wrong',
        'We could not record your attendance. Please try again.',
        [
          {
            text: 'Scan Again',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
        ]
      );
    }
  };

  /*
   * CAMERA PERMISSION LOADING
   */

  if (!permission) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <Text style={styles.loadingText}>
          Checking camera permission...
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * CAMERA PERMISSION NOT GRANTED
   */

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={styles.permissionContainer}
      >
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>
            📷
          </Text>

          <Text style={styles.permissionTitle}>
            Camera Permission Required
          </Text>

          <Text style={styles.permissionText}>
            CalebConnect needs access to your
            camera to scan attendance QR codes.
          </Text>

          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text
              style={
                styles.permissionButtonText
              }
            >
              Allow Camera Access
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text
              style={styles.cancelButtonText}
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * WORKING QR SCANNER
   */

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={
            scanned
              ? undefined
              : handleBarcodeScanned
          }
        />

        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Scan Attendance
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* SCANNER FRAME */}

        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame}>
            <View
              style={styles.cornerTopLeft}
            />

            <View
              style={styles.cornerTopRight}
            />

            <View
              style={styles.cornerBottomLeft}
            />

            <View
              style={styles.cornerBottomRight}
            />
          </View>

          <Text
            style={styles.instructionTitle}
          >
            {processing
              ? 'Processing Attendance...'
              : 'Scan Attendance QR Code'}
          </Text>

          <Text
            style={styles.instructionText}
          >
            {processing
              ? 'Please wait'
              : 'Position the QR code inside the box'}
          </Text>
        </View>

        {/* BOTTOM PANEL */}

        <View style={styles.bottomPanel}>
          {processing ? (
            <>
              <Text style={styles.bottomIcon}>
                ⏳
              </Text>

              <Text style={styles.bottomTitle}>
                Recording Attendance
              </Text>

              <Text style={styles.bottomText}>
                Please wait while CalebConnect
                records your attendance.
              </Text>
            </>
          ) : scanned ? (
            <>
              <Text style={styles.successIcon}>
                ✓
              </Text>

              <Text style={styles.bottomTitle}>
                QR Code Scanned
              </Text>

              <Text style={styles.bottomText}>
                Your attendance information has
                been processed.
              </Text>

              <Pressable
                style={
                  styles.scanAgainButton
                }
                onPress={() => {
                  setScanned(false);
                  setProcessing(false);
                }}
              >
                <Text
                  style={styles.scanAgainText}
                >
                  Scan Again
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.bottomIcon}>
                📱
              </Text>

              <Text style={styles.bottomTitle}>
                Attendance Scanner
              </Text>

              <Text style={styles.bottomText}>
                Scan the QR code provided by your
                lecturer or course representative
                to record your attendance.
              </Text>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },

  camera: {
    flex: 1,
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 75,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor:
      'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '300',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  headerSpacer: {
    width: 44,
  },

  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scannerFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },

  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 45,
    height: 45,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 8,
  },

  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 45,
    height: 45,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 8,
  },

  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 45,
    height: 45,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
  },

  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 45,
    height: 45,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 8,
  },

  instructionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 25,
    textAlign: 'center',
  },

  instructionText: {
    color: '#E5E7EB',
    fontSize: 13,
    marginTop: 7,
    textAlign: 'center',
  },

  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      'rgba(0,0,0,0.78)',
    paddingHorizontal: 25,
    paddingTop: 22,
    paddingBottom: 30,
    alignItems: 'center',
  },

  bottomIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  successIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#16A34A',
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 45,
    marginBottom: 8,
  },

  bottomTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  bottomText: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 330,
  },

  scanAgainButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 15,
  },

  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },

  permissionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 25,
    alignItems: 'center',
  },

  permissionIcon: {
    fontSize: 50,
    marginBottom: 15,
  },

  permissionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  permissionText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
  },

  permissionButton: {
    width: '100%',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 22,
  },

  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  cancelButton: {
    paddingVertical: 13,
    marginTop: 5,
  },

  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
});