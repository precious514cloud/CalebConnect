import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PROFILE_KEY = '@calebconnect_student_profile';

type StudentProfile = {
  fullName?: string;
  matricNumber?: string;
  department?: string;
  programme?: string;
  departmentId?: string;
  department_id?: string;
  level?: string;
};

type CourseRecord = {
  id: string;
  course_code: string;
  course_title: string;
  department: string;
  department_id?: string | null;
  level: string;
};

type MaterialRecord = {
  id: string;
  course_id: string;
  title: string;
  content?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
  external_url?: string | null;
  is_published?: boolean;
  target_level?: string | number | null;
  material_type?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  created_at?: string;
  uploaded_by?: string;
  [key: string]: unknown;
};

export default function LectureScreen() {
  const params = useLocalSearchParams<{
    index?: string;
    code?: string;
    department?: string;
    level?: string;
  }>();

  const courseCode = String(params.code || params.index || '').trim();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedText, setSelectedText] = useState<MaterialRecord | null>(null);
  const [textModalVisible, setTextModalVisible] = useState(false);

  const loadMaterials = async () => {
    setLoading(true);
    setErrorMessage('');
    setCourse(null);
    setMaterials([]);

    try {
      // 1. The saved student profile is authoritative.
      // Route parameters must not allow a student to switch departments.
      const savedProfile = await AsyncStorage.getItem(PROFILE_KEY);

      if (!savedProfile) {
        setErrorMessage('Student profile not found. Please complete student setup and try again.');
        return;
      }

      const student = JSON.parse(savedProfile) as StudentProfile;
      setProfile(student);

      const departmentName = String(
        student.department || student.programme || ''
      ).trim();

      const studentLevel = String(student.level || '').trim();

      if (!departmentName || !studentLevel) {
        setErrorMessage('Your department or level is missing from your student profile. Please update your student setup.');
        return;
      }

      if (!courseCode) {
        setErrorMessage('No course code was provided. Please return to Courses and open the course again.');
        return;
      }

      // 2. Find the department UUID dynamically.
      // This supports every department in the departments table.
      let departmentId =
        student.departmentId || student.department_id || '';

      if (!departmentId) {
        const { data: departmentData, error: departmentError } = await supabase
          .from('departments')
          .select('id, name')
          .ilike('name', departmentName)
          .limit(1)
          .maybeSingle();

        if (departmentError) {
          console.log('Department lookup error:', departmentError);
        }

        departmentId = departmentData?.id || '';
      }

      // 3. Find the course belonging to this student's department and level.
      // Do not use params.department or params.level for access decisions.
      let courseData: CourseRecord | null = null;
      let courseError: { message: string } | null = null;

      if (departmentId) {
        const result = await supabase
          .from('courses')
          .select('id, course_code, course_title, department, department_id, level')
          .ilike('course_code', courseCode)
          .eq('department_id', departmentId)
          .eq('level', studentLevel)
          .limit(1)
          .maybeSingle();

        courseData = result.data as CourseRecord | null;
        courseError = result.error;
      }

      // Compatibility fallback for older records that may not have a usable
      // department ID saved in the local profile.
      if (!courseData && !courseError) {
        const fallback = await supabase
          .from('courses')
          .select('id, course_code, course_title, department, department_id, level')
          .ilike('course_code', courseCode)
          .ilike('department', departmentName)
          .eq('level', studentLevel)
          .limit(1)
          .maybeSingle();

        courseData = fallback.data as CourseRecord | null;
        courseError = fallback.error;
      }

      if (courseError) {
        console.log('Course lookup error:', courseError);
        setErrorMessage(`Unable to load this course: ${courseError.message}`);
        return;
      }

      if (!courseData) {
        setErrorMessage(
          `Course ${courseCode} was not found for ${departmentName}, Level ${studentLevel}. Check that the course department and level match the student profile.`
        );
        return;
      }

      // Extra guard against displaying another department's course.
      if (
        courseData.department_id &&
        departmentId &&
        courseData.department_id !== departmentId
      ) {
        setErrorMessage('This course does not belong to your registered department.');
        return;
      }

      if (
        courseData.department?.trim().toLowerCase() !==
        departmentName.toLowerCase()
      ) {
        setErrorMessage('The course department does not match your student profile.');
        return;
      }

      if (String(courseData.level).trim() !== studentLevel) {
        setErrorMessage('This course is not assigned to your registered level.');
        return;
      }

      setCourse(courseData);

      // 4. Retrieve materials using select('*') so this screen does not fail
      // because an optional material column is named differently or is absent.
      const { data: materialRows, error: materialError } = await supabase
        .from('course_materials')
        .select('*')
        .eq('course_id', courseData.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (materialError) {
        console.log('Material query error:', materialError);
        setErrorMessage(`The course was found, but its materials could not be loaded: ${materialError.message}`);
        return;
      }

      // Compare levels in JavaScript to handle target_level stored as either
      // a number or a string. Materials without a target level remain visible.
      const publishedMaterials = (materialRows || []) as MaterialRecord[];

      const matchingMaterials = publishedMaterials.filter((material) => {
        if (material.is_published !== true) return false;

        const targetLevel = material.target_level;

        return (
          targetLevel === null ||
          targetLevel === undefined ||
          String(targetLevel).trim() === '' ||
          String(targetLevel).trim() === studentLevel
        );
      });

      setMaterials(matchingMaterials);

      console.log('CalebConnect lecture materials:', {
        courseCode: courseData.course_code,
        department: departmentName,
        level: studentLevel,
        courseId: courseData.id,
        materialsReturnedByDatabase: publishedMaterials.length,
        materialsMatchingStudentLevel: matchingMaterials.length,
      });
    } catch (error) {
      console.log('Unexpected lecture screen error:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while loading lecture materials.'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMaterials();
    }, [courseCode])
  );

  const openMaterial = async (material: MaterialRecord) => {
    try {
      const materialType = String(material.material_type || '').toLowerCase();

      // Open text notes inside the app.
      if (
        materialType === 'text' ||
        (!material.storage_path &&
          !material.file_url &&
          !material.external_url &&
          material.content)
      ) {
        setSelectedText(material);
        setTextModalVisible(true);
        return;
      }

      // Open externally hosted links.
      if (material.external_url) {
        await Linking.openURL(material.external_url);
        return;
      }

      // Open files from the course-materials Supabase Storage bucket.
      if (material.storage_path) {
        const { data, error } = await supabase.storage
          .from('course-materials')
          .createSignedUrl(String(material.storage_path), 3600);

        if (error || !data?.signedUrl) {
          console.log('Signed URL error:', error);
          Alert.alert(
            'Unable to open file',
            'The file could not be opened. Check the storage path and bucket permissions.'
          );
          return;
        }

        await Linking.openURL(data.signedUrl);
        return;
      }

      // Legacy direct file URLs.
      if (material.file_url) {
        await Linking.openURL(material.file_url);
        return;
      }

      // A record without a file URL may still contain text content.
      if (material.content) {
        setSelectedText(material);
        setTextModalVisible(true);
        return;
      }

      Alert.alert(
        'Material has no file',
        'This material record exists, but it has no text content, storage path, file URL, or external link. The lecturer may need to edit the material record.'
      );
    } catch (error) {
      console.log('Open material error:', error);
      Alert.alert('Unable to open material', 'Please try again.');
    }
  };

  const getMaterialType = (material: MaterialRecord) => {
    const type = String(material.material_type || '').toLowerCase();
    const mime = String(material.mime_type || '').toLowerCase();

    if (type === 'link' || material.external_url) return 'External Link';
    if (type === 'pdf' || mime.includes('pdf')) return 'PDF Lecture Note';
    if (type === 'image' || mime.startsWith('image/')) return 'Image';
    if (type === 'text' || material.content) return 'Text Note';
    if (material.storage_path || material.file_url) return 'Lecture File';
    return 'Material';
  };

  const getMaterialIcon = (
    material: MaterialRecord
  ): keyof typeof Ionicons.glyphMap => {
    const type = getMaterialType(material);

    if (type === 'External Link') return 'link-outline';
    if (type === 'Image') return 'image-outline';
    if (type === 'PDF Lecture Note') return 'document-text-outline';
    if (type === 'Text Note') return 'reader-outline';
    return 'document-outline';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading lecture materials...</Text>
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Lecture Notes</Text>
            <Text style={styles.headerSubtitle}>{courseCode}</Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadMaterials}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={21} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="book-outline" size={30} color="#4F46E5" />
          </View>

          <Text style={styles.courseCode}>
            {course?.course_code || courseCode}
          </Text>

          <Text style={styles.courseTitle}>
            {course?.course_title || 'Course Materials'}
          </Text>

          <Text style={styles.description}>
            Published lecture materials for your course.
          </Text>

          <View style={styles.academicInfo}>
            <View style={styles.academicItem}>
              <Text style={styles.academicLabel}>DEPARTMENT</Text>
              <Text style={styles.academicValue}>
                {course?.department || profile?.department || profile?.programme || 'Not available'}
              </Text>
            </View>

            <View style={styles.academicDivider} />

            <View style={styles.academicItem}>
              <Text style={styles.academicLabel}>LEVEL</Text>
              <Text style={styles.academicValue}>
                {profile?.level || course?.level || 'Not available'}
              </Text>
            </View>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={27} color="#DC2626" />
            <Text style={styles.errorTitle}>Unable to load materials</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadMaterials}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Available Notes</Text>
                <Text style={styles.sectionSubtitle}>
                  {materials.length} {materials.length === 1 ? 'material' : 'materials'} available
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countText}>{materials.length}</Text>
              </View>
            </View>

            {materials.length > 0 ? (
              <View style={styles.notesList}>
                {materials.map((material) => {
                  const typeLabel = getMaterialType(material);

                  return (
                    <TouchableOpacity
                      key={material.id}
                      style={styles.noteCard}
                      onPress={() => openMaterial(material)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.materialIcon}>
                        <Ionicons
                          name={getMaterialIcon(material)}
                          size={25}
                          color="#4F46E5"
                        />
                      </View>

                      <View style={styles.noteInfo}>
                        <Text style={styles.noteTitle} numberOfLines={2}>
                          {material.title || 'Untitled material'}
                        </Text>

                        <Text style={styles.noteSubtitle} numberOfLines={1}>
                          {material.file_name || typeLabel}
                        </Text>

                        <View style={styles.noteType}>
                          <Ionicons name="layers-outline" size={13} color="#6B7280" />
                          <Text style={styles.noteTypeText}>
                            {typeLabel}
                            {material.target_level != null
                              ? ` · Level ${material.target_level}`
                              : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.openMaterialBadge}>
                        <Text style={styles.openMaterialText}>Open</Text>
                        <Ionicons name="chevron-forward" size={16} color="#4F46E5" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="document-text-outline" size={30} color="#9CA3AF" />
                </View>

                <Text style={styles.emptyTitle}>No lecture notes yet</Text>

                <Text style={styles.emptyText}>
                  No published materials matched this course and your registered level.
                  If a material exists in Supabase, check its course_id, is_published,
                  and target_level values.
                </Text>

                <TouchableOpacity
                  style={styles.emptyRefreshButton}
                  onPress={loadMaterials}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={19} color="#4F46E5" />
                  <Text style={styles.emptyRefreshText}>Refresh materials</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="cloud-outline" size={21} color="#4F46E5" />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Course materials</Text>
            <Text style={styles.infoText}>
              Your lecturer or authorized course representative can publish notes,
              PDFs, images, and links for this course. Published materials from
              lecturers assigned to your department can appear here.
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>CalebConnect</Text>
        <Text style={styles.footerSubtitle}>
          Your academic experience, connected.
        </Text>
      </ScrollView>

      <Modal
        visible={textModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTextModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.textModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedText?.title || 'Lecture Note'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedText?.target_level != null
                    ? `Level ${selectedText.target_level}`
                    : 'Lecture Note'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setTextModalVisible(false)}
              >
                <Ionicons name="close" size={25} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.textScroll}>
              <Text style={styles.fullNoteText}>
                {selectedText?.content || 'No text content is stored in this material.'}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setTextModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 45 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },

  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
  },
  refreshButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  headerText: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  headerSpacer: { width: 42 },

  heroCard: {
    backgroundColor: '#FFFFFF', borderRadius: 25, padding: 24,
    alignItems: 'center', marginTop: 8, marginBottom: 28,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  courseCode: {
    fontSize: 13, fontWeight: '800', color: '#4F46E5', letterSpacing: 1,
  },
  courseTitle: {
    fontSize: 22, lineHeight: 28, fontWeight: '800',
    color: '#111827', textAlign: 'center', marginTop: 6,
  },
  description: {
    fontSize: 13, lineHeight: 19, color: '#6B7280',
    textAlign: 'center', marginTop: 9,
  },
  academicInfo: {
    flexDirection: 'row', alignItems: 'center', marginTop: 20,
    width: '100%', justifyContent: 'center',
  },
  academicItem: { alignItems: 'center', flex: 1 },
  academicLabel: {
    fontSize: 9, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.7,
  },
  academicValue: {
    fontSize: 12, fontWeight: '700', color: '#374151',
    marginTop: 4, textAlign: 'center',
  },
  academicDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  sectionSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  countBadge: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  countText: { color: '#4F46E5', fontSize: 15, fontWeight: '800' },
  notesList: { marginBottom: 15 },
  noteCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  materialIcon: {
    width: 50, height: 50, borderRadius: 16, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 13,
  },
  noteInfo: { flex: 1, paddingRight: 8 },
  noteTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  noteSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  noteType: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  noteTypeText: { fontSize: 10, color: '#9CA3AF', marginLeft: 4, fontWeight: '600' },
  openMaterialBadge: { flexDirection: 'row', alignItems: 'center' },
  openMaterialText: {
    fontSize: 11, fontWeight: '800', color: '#4F46E5', marginRight: 2,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 25, alignItems: 'center',
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 13,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptyText: {
    fontSize: 12, lineHeight: 19, color: '#9CA3AF',
    textAlign: 'center', marginTop: 6,
  },
  emptyRefreshButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EEF2FF', borderRadius: 13, paddingVertical: 12,
    paddingHorizontal: 18, marginTop: 18,
  },
  emptyRefreshText: { color: '#4F46E5', fontWeight: '800', fontSize: 13 },

  errorCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorTitle: {
    fontSize: 17, fontWeight: '800', color: '#991B1B',
    marginTop: 10, textAlign: 'center',
  },
  errorText: {
    fontSize: 13, lineHeight: 20, color: '#7F1D1D',
    textAlign: 'center', marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4F46E5', borderRadius: 13, paddingVertical: 12,
    paddingHorizontal: 18, marginTop: 18,
  },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 17,
    flexDirection: 'row', marginTop: 13,
  },
  infoIcon: {
    width: 43, height: 43, borderRadius: 14, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  infoText: { fontSize: 11, lineHeight: 17, color: '#6B7280', marginTop: 4 },
  footer: {
    textAlign: 'center', fontSize: 14, fontWeight: '800',
    color: '#4F46E5', marginTop: 35,
  },
  footerSubtitle: {
    textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 4,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  textModal: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, maxHeight: '88%', padding: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  modalHeaderText: { flex: 1, paddingRight: 10 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#111827' },
  modalSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  modalClose: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  textScroll: { marginBottom: 15 },
  fullNoteText: {
    fontSize: 16, lineHeight: 27, color: '#374151', paddingBottom: 20,
  },
  closeButton: {
    backgroundColor: '#111827', borderRadius: 15,
    paddingVertical: 15, alignItems: 'center',
  },
  closeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});