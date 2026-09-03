import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const startScanning = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Caleb Connect needs camera access to scan attendance QR codes.'
        );
        return;
      }
    }

    setScanned(false);
    setScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) {
      return;
    }

    setScanned(true);
    setScanning(false);

    Alert.alert(
      'QR Code Scanned',
      `QR information:\n\n${data}`,
      [{ text: 'OK' }]
    );
  };

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />

        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerTitle}>
            Scan Attendance QR
          </Text>

          <View style={styles.scanFrame} />

          <Text style={styles.scannerInstruction}>
            Point your camera at the QR code displayed by your lecturer.
          </Text>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setScanning(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>

        <Text style={styles.subtitle}>
          Manage your lecture attendance
        </Text>
      </View>

      <View style={styles.scanCard}>
        <View style={styles.qrBox}>
          <Text style={styles.qrIcon}>▦</Text>
        </View>

        <Text style={styles.scanTitle}>
          Scan Attendance QR
        </Text>

        <Text style={styles.scanDescription}>
          Scan the QR code displayed by your lecturer to sign your
          attendance for the current lecture.
        </Text>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={startScanning}
        >
          <Text style={styles.scanButtonText}>
            Scan QR Code
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Today's Attendance
        </Text>

        <View style={styles.attendanceCard}>
          <Text style={styles.courseName}>
            No attendance recorded
          </Text>

          <Text style={styles.courseInfo}>
            Your attendance for today's lectures will appear here.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Attendance Summary
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>0</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>0</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>0%</Text>
            <Text style={styles.summaryLabel}>Rate</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#111827',
  },

  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 5,
  },

  scanCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },

  qrBox: {
    width: 110,
    height: 110,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  qrIcon: {
    fontSize: 65,
    color: '#4f46e5',
  },

  scanTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#111827',
  },

  scanDescription: {
    textAlign: 'center',
    color: '#6b7280',
    lineHeight: 21,
    marginTop: 10,
  },

  scanButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 20,
  },

  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  section: {
    marginTop: 25,
    paddingHorizontal: 20,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },

  attendanceCard: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 15,
  },

  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },

  courseInfo: {
    color: '#9ca3af',
    marginTop: 5,
    lineHeight: 20,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 30,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
  },

  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
  },

  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 5,
  },

  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },

  camera: {
    flex: 1,
  },

  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50,
  },

  scannerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },

  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 20,
  },

  scannerInstruction: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  cancelButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 35,
    borderRadius: 12,
  },

  cancelButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: 'bold',
  },
});