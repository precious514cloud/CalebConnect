import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../../lib/supabase';

const LECTURER_ID_KEY = '@calebconnect_lecturer_id';
const STORAGE_BUCKET = 'course-materials';

type Course = {
  id: string;
  lecturer_id: string;
  course_code: string;
  course_title: string;
  department: string | null;
  faculty: string | null;
  level: string | null;
  semester: string | null;
  credit_unit: number | null;
  venue: string | null;
};

type Material = {
  id: string;
  course_id: string;
  uploaded_by: string;
  title: string;
  content: string | null;
  target_level: string | null;
  material_type: string;
  file_name: string | null;
  mime_type: string | null;
  file_url: string | null;
  storage_path: string | null;
  external_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type MaterialType = 'text' | 'pdf' | 'image' | 'link';

const MATERIAL_TYPES: {
  value: MaterialType;
  label: string;
  description: string;
}[] = [
  {
    value: 'text',
    label: 'Text Note',
    description: 'Write a note directly in Caleb Connect.',
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Upload a PDF document.',
  },
  {
    value: 'image',
    label: 'Image',
    description: 'Upload an image.',
  },
  {
    value: 'link',
    label: 'Link',
    description: 'Add an external learning resource.',
  },
];

function sortLevels(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function getExtension(fileName: string) {
  const parts = fileName.split('.');

  if (parts.length < 2) {
    return '';
  }

  return parts[parts.length - 1]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getMaterialIcon(type: string) {
  if (type === 'pdf') return 'PDF';
  if (type === 'image') return 'IMG';
  if (type === 'link') return '↗';

  return 'N';
}

export default function LecturerCourseDetailsScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const courseId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [lecturerId, setLecturerId] = useState('');

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [materialTypeOpen, setMaterialTypeOpen] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedType, setSelectedType] =
    useState<MaterialType>('text');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const [selectedFile, setSelectedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [noteViewerVisible, setNoteViewerVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Material | null>(null);

  const selectedTypeInfo = useMemo(
    () =>
      MATERIAL_TYPES.find(
        (item) => item.value === selectedType
      ),
    [selectedType]
  );

  useEffect(() => {
    loadPage();
  }, [courseId]);

  async function loadPage() {
    if (!courseId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const savedLecturerId =
        await AsyncStorage.getItem(LECTURER_ID_KEY);

      const currentLecturerId =
        user?.id || savedLecturerId || '';

      if (!currentLecturerId) {
        throw new Error(
          'Lecturer account could not be identified.'
        );
      }

      setLecturerId(currentLecturerId);

      await Promise.all([
        loadCourse(),
        loadLevels(),
        loadMaterials(currentLecturerId),
      ]);
    } catch (error) {
      console.error('Load course error:', error);

      Alert.alert(
        'Unable to load course',
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCourse() {
    if (!courseId) return;

    const { data, error } = await supabase
      .from('courses')
      .select(
        `
        id,
        lecturer_id,
        course_code,
        course_title,
        department,
        faculty,
        level,
        semester,
        credit_unit,
        venue
      `
      )
      .eq('id', courseId)
      .single();

    if (error) {
      throw error;
    }

    setCourse(data as Course);
  }

  async function loadLevels() {
    const { data, error } = await supabase
      .from('levels')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Load levels error:', error);

      setLevels(['100', '200', '300', '400']);
      return;
    }

    const names = Array.from(
      new Set(
        (data || [])
          .map((item) =>
            typeof item.name === 'string'
              ? item.name.trim()
              : ''
          )
          .filter(Boolean)
      )
    ).sort(sortLevels);

    setLevels(names);
  }

  async function loadMaterials(ownerId?: string) {
    if (!courseId) return;

    const currentOwnerId = ownerId || lecturerId;

    let query = supabase
      .from('course_materials')
      .select(
        `
        id,
        course_id,
        uploaded_by,
        title,
        content,
        target_level,
        material_type,
        file_name,
        mime_type,
        file_url,
        storage_path,
        external_url,
        is_published,
        created_at,
        updated_at
      `
      )
      .eq('course_id', courseId)
      .order('created_at', {
        ascending: false,
      });

    if (currentOwnerId) {
      query = query.eq(
        'uploaded_by',
        currentOwnerId
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    setMaterials((data || []) as Material[]);
  }

  async function refreshMaterials() {
    try {
      setRefreshing(true);
      await loadMaterials(lecturerId);
    } catch (error) {
      Alert.alert(
        'Unable to refresh',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setRefreshing(false);
    }
  }

  function openAddMaterial() {
    setTitle('');
    setContent('');
    setExternalUrl('');
    setSelectedFile(null);
    setSelectedType('text');
    setMaterialTypeOpen(false);
    setLevelModalVisible(false);

    setSelectedLevel(
      course?.level || levels[0] || ''
    );

    setAddModalVisible(true);
  }

  function closeAddMaterial() {
    if (saving) return;

    setMaterialTypeOpen(false);
    setLevelModalVisible(false);
    setAddModalVisible(false);
  }

  async function chooseFile() {
    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type:
            selectedType === 'pdf'
              ? 'application/pdf'
              : 'image/*',
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (
        result.canceled ||
        !result.assets ||
        result.assets.length === 0
      ) {
        return;
      }

      const file = result.assets[0];

      if (
        selectedType === 'pdf' &&
        file.mimeType &&
        file.mimeType !== 'application/pdf'
      ) {
        Alert.alert(
          'Invalid file',
          'Please select a PDF document.'
        );
        return;
      }

      if (
        selectedType === 'image' &&
        file.mimeType &&
        !file.mimeType.startsWith('image/')
      ) {
        Alert.alert(
          'Invalid file',
          'Please select an image.'
        );
        return;
      }

      setSelectedFile(file);
    } catch (error) {
      console.error('File picker error:', error);

      Alert.alert(
        'File selection error',
        'Unable to select this file.'
      );
    }
  }

  function isValidUrl(value: string) {
    try {
      const url = new URL(value.trim());

      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:'
      );
    } catch {
      return false;
    }
  }

  async function uploadFile(
    file: DocumentPicker.DocumentPickerAsset
  ) {
    if (!courseId || !lecturerId) {
      throw new Error(
        'Course or lecturer information is missing.'
      );
    }

    const extension = getExtension(file.name);

    const fallback =
      selectedType === 'pdf'
        ? 'pdf'
        : 'jpg';

    const safeExtension =
      extension || fallback;

    const safeName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        )
        .replace(/\s+/g, '_');

    const uniqueName =
      `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}_${safeName}`;

    const storagePath =
      `${lecturerId}/${courseId}/${uniqueName}`;

    const response = await fetch(file.uri);

    if (!response.ok) {
      throw new Error(
        'Unable to read the selected file.'
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const contentType =
      file.mimeType ||
      (selectedType === 'pdf'
        ? 'application/pdf'
        : safeExtension === 'png'
        ? 'image/png'
        : 'image/jpeg');

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(
        storagePath,
        arrayBuffer,
        {
          contentType,
          upsert: false,
        }
      );

    if (error) {
      throw error;
    }

    return {
      storagePath,
      fileName: file.name,
      mimeType: contentType,
    };
  }

  async function createMaterial() {
    if (!courseId || !lecturerId) {
      Alert.alert(
        'Missing information',
        'Course or lecturer information is missing.'
      );
      return;
    }

    if (!selectedLevel) {
      Alert.alert(
        'Select target level',
        'Please choose the level for this material.'
      );
      return;
    }

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert(
        'Title required',
        'Please enter a title.'
      );
      return;
    }

    if (
      selectedType === 'text' &&
      !content.trim()
    ) {
      Alert.alert(
        'Note content required',
        'Please write the note content.'
      );
      return;
    }

    if (
      selectedType === 'link' &&
      !isValidUrl(externalUrl)
    ) {
      Alert.alert(
        'Invalid link',
        'Please enter a valid HTTP or HTTPS link.'
      );
      return;
    }

    if (
      (selectedType === 'pdf' ||
        selectedType === 'image') &&
      !selectedFile
    ) {
      Alert.alert(
        'Select a file',
        `Please select the ${
          selectedType === 'pdf'
            ? 'PDF'
            : 'image'
        } you want to upload.`
      );
      return;
    }

    try {
      setSaving(true);

      let fileData:
        | {
            storagePath: string;
            fileName: string;
            mimeType: string;
          }
        | null = null;

      if (
        selectedFile &&
        (selectedType === 'pdf' ||
          selectedType === 'image')
      ) {
        fileData =
          await uploadFile(selectedFile);
      }

      const payload = {
        course_id: courseId,
        uploaded_by: lecturerId,
        title: cleanTitle,
        content:
          selectedType === 'text'
            ? content.trim()
            : null,
        target_level: selectedLevel,
        material_type: selectedType,
        file_name:
          fileData?.fileName || null,
        mime_type:
          fileData?.mimeType || null,
        file_url: null,
        storage_path:
          fileData?.storagePath || null,
        external_url:
          selectedType === 'link'
            ? externalUrl.trim()
            : null,
        is_published: true,
      };

      const { data, error } = await supabase
        .from('course_materials')
        .insert(payload)
        .select(
          `
          id,
          course_id,
          uploaded_by,
          title,
          content,
          target_level,
          material_type,
          file_name,
          mime_type,
          file_url,
          storage_path,
          external_url,
          is_published,
          created_at,
          updated_at
        `
        )
        .single();

      if (error) {
        if (fileData?.storagePath) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([
              fileData.storagePath,
            ]);
        }

        throw error;
      }

      setMaterials((current) => [
        data as Material,
        ...current,
      ]);

      setAddModalVisible(false);

      Alert.alert(
        'Material Published',
        `${cleanTitle} has been added for ${selectedLevel} level.`
      );
    } catch (error) {
      console.error(
        'Create material error:',
        error
      );

      Alert.alert(
        'Could not save material',
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function openStoredFile(
    material: Material
  ) {
    if (!material.storage_path) {
      Alert.alert(
        'File unavailable',
        'This material does not have a stored file.'
      );
      return;
    }

    try {
      setOpeningId(material.id);

      const { data, error } =
        await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(
            material.storage_path,
            600
          );

      if (error) {
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error(
          'No file URL was returned.'
        );
      }

      await Linking.openURL(
        data.signedUrl
      );
    } catch (error) {
      Alert.alert(
        'Could not open file',
        error instanceof Error
          ? error.message
          : 'Unable to open the file.'
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function openExternalLink(
    material: Material
  ) {
    if (!material.external_url) {
      Alert.alert(
        'Link unavailable',
        'This material does not have a link.'
      );
      return;
    }

    try {
      setOpeningId(material.id);
      await Linking.openURL(
        material.external_url
      );
    } catch (error) {
      Alert.alert(
        'Could not open link',
        error instanceof Error
          ? error.message
          : 'Unable to open the link.'
      );
    } finally {
      setOpeningId(null);
    }
  }

  function openMaterial(material: Material) {
    if (
      material.material_type ===
      'text'
    ) {
      setSelectedNote(material);
      setNoteViewerVisible(true);
      return;
    }

    if (
      material.material_type ===
        'pdf' ||
      material.material_type ===
        'image'
    ) {
      openStoredFile(material);
      return;
    }

    if (
      material.material_type ===
      'link'
    ) {
      openExternalLink(material);
    }
  }

  function confirmDeleteMaterial(
    material: Material
  ) {
    Alert.alert(
      'Delete Material',
      `Delete "${material.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMaterial(material),
        },
      ]
    );
  }

  async function deleteMaterial(
    material: Material
  ) {
    try {
      setDeletingId(material.id);

      if (material.storage_path) {
        const { error } =
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([
              material.storage_path,
            ]);

        if (error) {
          console.error(
            'Storage delete error:',
            error
          );
        }
      }

      const { error } =
        await supabase
          .from('course_materials')
          .delete()
          .eq('id', material.id)
          .eq(
            'uploaded_by',
            lecturerId
          );

      if (error) {
        throw error;
      }

      setMaterials((current) =>
        current.filter(
          (item) =>
            item.id !== material.id
        )
      );

      Alert.alert(
        'Material Deleted',
        'The material has been removed.'
      );
    } catch (error) {
      Alert.alert(
        'Could not delete material',
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  function confirmDeleteCourse() {
    if (!course) {
      return;
    }

    Alert.alert(
      'Delete Entire Course',
      `Are you sure you want to delete ${course.course_code} - ${course.course_title}? This will also delete all notes and uploaded materials attached to this course. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Course',
          style: 'destructive',
          onPress: deleteCourse,
        },
      ]
    );
  }

  async function deleteCourse() {
    /*
     * IMPORTANT FIX:
     * Save the course in a local constant before
     * any await operations. This prevents TypeScript
     * from complaining that "course" may be null.
     */
    const courseToDelete = course;

    if (!courseToDelete) {
      Alert.alert(
        'Course not found',
        'This course could not be identified.'
      );
      return;
    }

    if (!courseId) {
      Alert.alert(
        'Course not found',
        'The course ID is missing.'
      );
      return;
    }

    if (!lecturerId) {
      Alert.alert(
        'Lecturer not found',
        'Your lecturer account could not be identified.'
      );
      return;
    }

    try {
      setDeletingId(
        'COURSE_DELETE'
      );

      /*
       * First find all materials belonging
       * to this course.
       */
      const {
        data: courseMaterials,
        error: materialsError,
      } = await supabase
        .from('course_materials')
        .select(
          'id, storage_path, uploaded_by'
        )
        .eq(
          'course_id',
          courseId
        )
        .eq(
          'uploaded_by',
          lecturerId
        );

      if (materialsError) {
        throw materialsError;
      }

      /*
       * Remove uploaded files from Storage.
       */
      const storagePaths =
        (courseMaterials || [])
          .map(
            (item) =>
              item.storage_path
          )
          .filter(
            (
              path
            ): path is string =>
              typeof path ===
                'string' &&
              path.trim().length > 0
          );

      if (storagePaths.length > 0) {
        const {
          error: storageError,
        } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(storagePaths);

        if (storageError) {
          throw storageError;
        }
      }

      /*
       * Remove all materials belonging
       * to the course.
       */
      const {
        error:
          materialDeleteError,
      } = await supabase
        .from('course_materials')
        .delete()
        .eq(
          'course_id',
          courseId
        )
        .eq(
          'uploaded_by',
          lecturerId
        );

      if (materialDeleteError) {
        throw materialDeleteError;
      }

      /*
       * Finally remove the actual course.
       */
      const {
        error:
          courseDeleteError,
      } = await supabase
        .from('courses')
        .delete()
        .eq(
          'id',
          courseId
        )
        .eq(
          'lecturer_id',
          lecturerId
        );

      if (courseDeleteError) {
        throw courseDeleteError;
      }

      Alert.alert(
        'Course Deleted',
        `${courseToDelete.course_code} has been deleted successfully.`,
        [
          {
            text: 'OK',
            onPress: () =>
              router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        'Delete course error:',
        error
      );

      Alert.alert(
        'Could not delete course',
        error instanceof Error
          ? error.message
          : 'Something went wrong while deleting the course.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Loading course materials...
        </Text>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={styles.errorContainer}
        >
          <Text
            style={styles.errorTitle}
          >
            Course not found
          </Text>

          <Text
            style={styles.errorText}
          >
            This course could not be
            found.
          </Text>

          <TouchableOpacity
            style={
              styles.backMainButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backMainButtonText
              }
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ‹
            </Text>
          </TouchableOpacity>

          <View
            style={styles.headerText}
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Notes & Materials
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              {course.course_code}
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.refreshButton
            }
            onPress={
              refreshMaterials
            }
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
              />
            ) : (
              <Text
                style={
                  styles.refreshText
                }
              >
                ↻
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View
          style={styles.courseCard}
        >
          <View
            style={styles.courseBadge}
          >
            <Text
              style={
                styles.courseBadgeText
              }
            >
              {course.course_code}
            </Text>
          </View>

          <Text
            style={styles.courseTitle}
          >
            {course.course_title}
          </Text>

          <Text
            style={
              styles.courseDepartment
            }
          >
            {course.department ||
              'Department not set'}
          </Text>

          <View
            style={
              styles.courseMetaRow
            }
          >
            <View
              style={styles.metaBox}
            >
              <Text
                style={
                  styles.metaLabel
                }
              >
                LEVEL
              </Text>

              <Text
                style={
                  styles.metaValue
                }
              >
                {course.level || '—'}
              </Text>
            </View>

            <View
              style={styles.metaBox}
            >
              <Text
                style={
                  styles.metaLabel
                }
              >
                SEMESTER
              </Text>

              <Text
                style={
                  styles.metaValue
                }
              >
                {course.semester ||
                  '—'}
              </Text>
            </View>

            <View
              style={styles.metaBox}
            >
              <Text
                style={
                  styles.metaLabel
                }
              >
                UNITS
              </Text>

              <Text
                style={
                  styles.metaValue
                }
              >
                {course.credit_unit ??
                  '—'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={
            styles.addMaterialButton
          }
          onPress={
            openAddMaterial
          }
        >
          <Text
            style={
              styles.addMaterialIcon
            }
          >
            +
          </Text>

          <View>
            <Text
              style={
                styles.addMaterialTitle
              }
            >
              Add Notes & Materials
            </Text>

            <Text
              style={
                styles.addMaterialSubtitle
              }
            >
              Text, PDF, image or link
            </Text>
          </View>
        </TouchableOpacity>

        <View
          style={
            styles.materialHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Materials
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              {materials.length}{' '}
              {materials.length === 1
                ? 'material'
                : 'materials'}
            </Text>
          </View>
        </View>

        {materials.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <View
              style={styles.emptyIcon}
            >
              <Text
                style={
                  styles.emptyIconText
                }
              >
                N
              </Text>
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No materials yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Add your first note,
              PDF, image or learning
              link for this course.
            </Text>

            <TouchableOpacity
              style={
                styles.emptyButton
              }
              onPress={
                openAddMaterial
              }
            >
              <Text
                style={
                  styles.emptyButtonText
                }
              >
                Add Material
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          materials.map(
            (material) => (
              <View
                key={material.id}
                style={
                  styles.materialCard
                }
              >
                <View
                  style={
                    styles.materialTopRow
                  }
                >
                  <View
                    style={
                      styles.materialIcon
                    }
                  >
                    <Text
                      style={
                        styles.materialIconText
                      }
                    >
                      {getMaterialIcon(
                        material.material_type
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.materialMain
                    }
                  >
                    <Text
                      style={
                        styles.materialTitle
                      }
                    >
                      {material.title}
                    </Text>

                    <Text
                      style={
                        styles.materialType
                      }
                    >
                      {material.material_type.toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={
                      styles.deleteMaterialButton
                    }
                    onPress={() =>
                      confirmDeleteMaterial(
                        material
                      )
                    }
                    disabled={
                      deletingId ===
                        material.id ||
                      deletingId ===
                        'COURSE_DELETE'
                    }
                  >
                    {deletingId ===
                    material.id ? (
                      <ActivityIndicator
                        size="small"
                      />
                    ) : (
                      <Text
                        style={
                          styles.deleteText
                        }
                      >
                        Delete
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

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
                    Target Level:{' '}
                    {material.target_level ||
                      'All'}
                  </Text>
                </View>

                {material.content ? (
                  <View
                    style={
                      styles.contentPreview
                    }
                  >
                    <Text
                      style={
                        styles.materialContent
                      }
                      numberOfLines={4}
                    >
                      {material.content}
                    </Text>

                    <TouchableOpacity
                      style={
                        styles.openButton
                      }
                      onPress={() =>
                        openMaterial(
                          material
                        )
                      }
                    >
                      <Text
                        style={
                          styles.openButtonText
                        }
                      >
                        Read Note ›
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {material.file_name ? (
                  <TouchableOpacity
                    style={
                      styles.fileInfo
                    }
                    onPress={() =>
                      openMaterial(
                        material
                      )
                    }
                    disabled={
                      openingId ===
                      material.id
                    }
                  >
                    <Text
                      style={
                        styles.fileInfoIcon
                      }
                    >
                      {material.material_type ===
                      'pdf'
                        ? 'PDF'
                        : 'IMG'}
                    </Text>

                    <View
                      style={
                        styles.fileInfoContainer
                      }
                    >
                      <Text
                        style={
                          styles.fileInfoText
                        }
                        numberOfLines={2}
                      >
                        {material.file_name}
                      </Text>

                      <Text
                        style={
                          styles.tapToOpen
                        }
                      >
                        {openingId ===
                        material.id
                          ? 'Opening...'
                          : 'Tap to open'}
                      </Text>
                    </View>

                    {openingId ===
                    material.id ? (
                      <ActivityIndicator
                        size="small"
                      />
                    ) : (
                      <Text
                        style={
                          styles.fileArrow
                        }
                      >
                        ›
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}

                {material.external_url ? (
                  <TouchableOpacity
                    style={
                      styles.fileInfo
                    }
                    onPress={() =>
                      openMaterial(
                        material
                      )
                    }
                  >
                    <Text
                      style={
                        styles.fileInfoIcon
                      }
                    >
                      🔗
                    </Text>

                    <View
                      style={
                        styles.fileInfoContainer
                      }
                    >
                      <Text
                        style={
                          styles.fileInfoText
                        }
                        numberOfLines={2}
                      >
                        {material.external_url}
                      </Text>

                      <Text
                        style={
                          styles.tapToOpen
                        }
                      >
                        Tap to open link
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.fileArrow
                      }
                    >
                      ↗
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <View
                  style={
                    styles.materialBottom
                  }
                >
                  <Text
                    style={
                      styles.publishedText
                    }
                  >
                    {material.is_published
                      ? 'Published'
                      : 'Draft'}
                  </Text>

                  <Text
                    style={
                      styles.dateText
                    }
                  >
                    {new Date(
                      material.created_at
                    ).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )
          )
        )}

        <View
          style={styles.infoCard}
        >
          <Text
            style={styles.infoTitle}
          >
            Level-based materials
          </Text>

          <Text
            style={styles.infoText}
          >
            Select the target level when
            publishing a material. The
            material remains connected to
            this course and department.
          </Text>
        </View>

        <View
          style={styles.dangerZone}
        >
          <Text
            style={
              styles.dangerZoneTitle
            }
          >
            Course Management
          </Text>

          <Text
            style={
              styles.dangerZoneText
            }
          >
            Deleting this course will also
            remove all notes and uploaded
            materials belonging to this
            course.
          </Text>

          <TouchableOpacity
            style={
              styles.deleteCourseButton
            }
            onPress={
              confirmDeleteCourse
            }
            disabled={
              deletingId ===
              'COURSE_DELETE'
            }
            activeOpacity={0.8}
          >
            {deletingId ===
            'COURSE_DELETE' ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.deleteCourseButtonText
                }
              >
                Delete Entire Course
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={
          closeAddMaterial
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalCard}
          >
            <View
              style={styles.modalHeader}
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Add Material
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  {course.course_code}
                </Text>
              </View>

              <TouchableOpacity
                onPress={
                  closeAddMaterial
                }
                disabled={saving}
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={
                styles.modalContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text
                style={
                  styles.inputLabel
                }
              >
                Target Level
              </Text>

              <TouchableOpacity
                style={
                  styles.selector
                }
                onPress={() =>
                  setLevelModalVisible(
                    true
                  )
                }
              >
                <View
                  style={
                    styles.selectorTextContainer
                  }
                >
                  <Text
                    style={
                      styles.selectorText
                    }
                  >
                    {selectedLevel
                      ? `${selectedLevel} Level`
                      : 'Select target level'}
                  </Text>

                  <Text
                    style={
                      styles.selectorHint
                    }
                  >
                    Choose the level that
                    should receive this material
                  </Text>
                </View>

                <Text
                  style={
                    styles.selectorArrow
                  }
                >
                  ›
                </Text>
              </TouchableOpacity>

              <Text
                style={
                  styles.inputLabel
                }
              >
                Material Type
              </Text>

              <TouchableOpacity
                style={
                  styles.selector
                }
                onPress={() =>
                  setMaterialTypeOpen(
                    !materialTypeOpen
                  )
                }
              >
                <View
                  style={
                    styles.selectorTextContainer
                  }
                >
                  <Text
                    style={
                      styles.selectorText
                    }
                  >
                    {selectedTypeInfo?.label ||
                      'Text Note'}
                  </Text>

                  <Text
                    style={
                      styles.selectorHint
                    }
                  >
                    {selectedTypeInfo?.description}
                  </Text>
                </View>

                <Text
                  style={
                    styles.selectorArrow
                  }
                >
                  {materialTypeOpen
                    ? '⌃'
                    : '›'}
                </Text>
              </TouchableOpacity>

              {materialTypeOpen ? (
                <View
                  style={
                    styles.typePicker
                  }
                >
                  {MATERIAL_TYPES.map(
                    (item) => (
                      <TouchableOpacity
                        key={
                          item.value
                        }
                        style={[
                          styles.typeOption,
                          selectedType ===
                            item.value &&
                            styles.selectedTypeOption,
                        ]}
                        onPress={() => {
                          setSelectedType(
                            item.value
                          );
                          setSelectedFile(
                            null
                          );
                          setMaterialTypeOpen(
                            false
                          );
                        }}
                      >
                        <View
                          style={
                            styles.typeIcon
                          }
                        >
                          <Text
                            style={
                              styles.typeIconText
                            }
                          >
                            {getMaterialIcon(
                              item.value
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.typeTextContainer
                          }
                        >
                          <Text
                            style={
                              styles.typeTitle
                            }
                          >
                            {item.label}
                          </Text>

                          <Text
                            style={
                              styles.typeDescription
                            }
                          >
                            {
                              item.description
                            }
                          </Text>
                        </View>

                        {selectedType ===
                        item.value ? (
                          <Text
                            style={
                              styles.optionCheck
                            }
                          >
                            ✓
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    )
                  )}
                </View>
              ) : null}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Title
              </Text>

              <TextInput
                value={title}
                onChangeText={
                  setTitle
                }
                placeholder="Enter material title"
                placeholderTextColor="#9CA3AF"
                style={
                  styles.input
                }
              />

              {selectedType ===
              'text' ? (
                <>
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Note Content
                  </Text>

                  <TextInput
                    value={content}
                    onChangeText={
                      setContent
                    }
                    placeholder="Write your note here..."
                    placeholderTextColor="#9CA3AF"
                    style={
                      styles.textArea
                    }
                    multiline
                    textAlignVertical="top"
                  />
                </>
              ) : null}

              {selectedType ===
              'link' ? (
                <>
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Link URL
                  </Text>

                  <TextInput
                    value={externalUrl}
                    onChangeText={
                      setExternalUrl
                    }
                    placeholder="https://example.com/resource"
                    placeholderTextColor="#9CA3AF"
                    style={
                      styles.input
                    }
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </>
              ) : null}

              {selectedType ===
                'pdf' ||
              selectedType ===
                'image' ? (
                <>
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    File
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.filePicker
                    }
                    onPress={
                      chooseFile
                    }
                  >
                    <Text
                      style={
                        styles.filePickerIcon
                      }
                    >
                      {selectedType ===
                      'pdf'
                        ? 'PDF'
                        : 'IMG'}
                    </Text>

                    <View
                      style={
                        styles.filePickerTextContainer
                      }
                    >
                      <Text
                        style={
                          styles.filePickerTitle
                        }
                        numberOfLines={1}
                      >
                        {selectedFile?.name ||
                          `Choose ${
                            selectedType ===
                            'pdf'
                              ? 'PDF'
                              : 'image'
                          }`}
                      </Text>

                      <Text
                        style={
                          styles.filePickerSubtitle
                        }
                      >
                        Tap to select a file
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.filePickerArrow
                      }
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <View
                style={
                  styles.publishInfo
                }
              >
                <Text
                  style={
                    styles.publishInfoTitle
                  }
                >
                  Publishing
                </Text>

                <Text
                  style={
                    styles.publishInfoText
                  }
                >
                  This material will be
                  published immediately for
                  the selected level.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  saving &&
                    styles.disabledButton,
                ]}
                onPress={
                  createMaterial
                }
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.saveButtonText
                    }
                  >
                    Publish Material
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={
                  closeAddMaterial
                }
                disabled={saving}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={levelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setLevelModalVisible(
            false
          )
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.smallModalCard}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                Select Target Level
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setLevelModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={
                styles.optionList
              }
            >
              {levels.length === 0 ? (
                <Text
                  style={
                    styles.noOptionsText
                  }
                >
                  No levels found.
                </Text>
              ) : (
                levels.map(
                  (level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.option,
                        selectedLevel ===
                          level &&
                          styles.selectedOption,
                      ]}
                      onPress={() => {
                        setSelectedLevel(
                          level
                        );
                        setLevelModalVisible(
                          false
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedLevel ===
                            level &&
                            styles.selectedOptionText,
                        ]}
                      >
                        {level} Level
                      </Text>

                      {selectedLevel ===
                      level ? (
                        <Text
                          style={
                            styles.optionCheck
                          }
                        >
                          ✓
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  )
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={noteViewerVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setNoteViewerVisible(
            false
          )
        }
      >
        <View
          style={
            styles.noteViewerOverlay
          }
        >
          <View
            style={
              styles.noteViewerCard
            }
          >
            <View
              style={
                styles.noteViewerHeader
              }
            >
              <View
                style={
                  styles.noteViewerHeaderText
                }
              >
                <Text
                  style={
                    styles.noteViewerTitle
                  }
                >
                  {selectedNote?.title ||
                    'Note'}
                </Text>

                <Text
                  style={
                    styles.noteViewerSubtitle
                  }
                >
                  {course.course_code} •
                  Target Level{' '}
                  {selectedNote?.target_level ||
                    'All'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setNoteViewerVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={
                styles.noteViewerContent
              }
            >
              <Text
                style={
                  styles.fullNoteText
                }
              >
                {selectedNote?.content ||
                  ''}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={
                styles.noteViewerCloseButton
              }
              onPress={() =>
                setNoteViewerVisible(
                  false
                )
              }
            >
              <Text
                style={
                  styles.noteViewerCloseText
                }
              >
                Close Note
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },

  content: {
    padding: 18,
    paddingBottom: 45,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F8',
  },

  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 13,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  backButtonText: {
    fontSize: 34,
    color: '#111827',
    marginTop: -4,
  },

  headerText: {
    flex: 1,
    paddingHorizontal: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  refreshText: {
    fontSize: 25,
    color: '#111827',
  },

  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },

  courseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF4FB',
  },

  courseBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1F4F82',
  },

  courseTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '900',
    color: '#111827',
    marginTop: 13,
  },

  courseDepartment: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 5,
  },

  courseMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
  },

  metaBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 11,
    padding: 10,
  },

  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
  },

  metaValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginTop: 4,
  },

  addMaterialButton: {
    minHeight: 67,
    borderRadius: 16,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    marginBottom: 20,
  },

  addMaterialIcon: {
    fontSize: 30,
    color: '#FFFFFF',
    marginRight: 13,
  },

  addMaterialTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  addMaterialSubtitle: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 3,
  },

  materialHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },

  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },

  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },

  materialTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  materialIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  materialIconText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111827',
  },

  materialMain: {
    flex: 1,
  },

  materialTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  materialType: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginTop: 3,
  },

  deleteMaterialButton: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },

  deleteText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B91C1C',
  },

  levelBadge: {
    alignSelf: 'flex-start',
    marginTop: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },

  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },

  contentPreview: {
    marginTop: 11,
    backgroundColor: '#F9FAFB',
    borderRadius: 11,
    padding: 11,
  },

  materialContent: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },

  openButton: {
    marginTop: 9,
    alignSelf: 'flex-start',
  },

  openButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F4F82',
  },

  fileInfo: {
    marginTop: 11,
    minHeight: 57,
    borderRadius: 11,
    backgroundColor: '#F9FAFB',
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  fileInfoIcon: {
    width: 39,
    height: 39,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: '#111827',
    marginRight: 10,
    paddingTop: 12,
  },

  fileInfoContainer: {
    flex: 1,
  },

  fileInfoText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },

  tapToOpen: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 3,
  },

  fileArrow: {
    fontSize: 24,
    color: '#111827',
    marginLeft: 8,
  },

  materialBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#F1F1F1',
  },

  publishedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },

  dateText: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyIconText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 7,
  },

  emptyButton: {
    minHeight: 45,
    paddingHorizontal: 18,
    borderRadius: 11,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 5,
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
    marginTop: 5,
  },

  dangerZone: {
    marginTop: 24,
    marginBottom: 30,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  dangerZoneTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },

  dangerZoneText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#7F1D1D',
  },

  deleteCourseButton: {
    minHeight: 52,
    marginTop: 15,
    borderRadius: 13,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteCourseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '94%',
    paddingTop: 20,
  },

  smallModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '72%',
    paddingTop: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },

  closeText: {
    fontSize: 28,
    color: '#6B7280',
    paddingHorizontal: 5,
  },

  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 15,
    marginBottom: 7,
  },

  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
  },

  textArea: {
    minHeight: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    lineHeight: 21,
    color: '#111827',
  },

  selector: {
    minHeight: 53,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectorTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  selectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  selectorHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
  },

  selectorArrow: {
    fontSize: 25,
    color: '#6B7280',
  },

  typePicker: {
    marginTop: 8,
  },

  typeOption: {
    minHeight: 70,
    borderRadius: 13,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  selectedTypeOption: {
    backgroundColor: '#F3F4F6',
    borderColor: '#111827',
  },

  typeIcon: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  typeIconText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111827',
  },

  typeTextContainer: {
    flex: 1,
  },

  typeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  typeDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
    marginTop: 3,
  },

  optionList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  option: {
    minHeight: 53,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  selectedOption: {
    backgroundColor: '#F3F4F6',
    borderColor: '#111827',
  },

  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  selectedOptionText: {
    fontWeight: '800',
    color: '#111827',
  },

  optionCheck: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },

  noOptionsText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    paddingVertical: 25,
  },

  filePicker: {
    minHeight: 67,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  filePickerIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: '#111827',
    marginRight: 11,
    paddingTop: 15,
  },

  filePickerTextContainer: {
    flex: 1,
  },

  filePickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  filePickerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
  },

  filePickerArrow: {
    fontSize: 24,
    color: '#6B7280',
  },

  publishInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 13,
    marginTop: 17,
  },

  publishInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },

  publishInfoText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#6B7280',
    marginTop: 4,
  },

  saveButton: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  cancelButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },

  noteViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },

  noteViewerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
    paddingTop: 20,
  },

  noteViewerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  noteViewerHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  noteViewerTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: '#111827',
  },

  noteViewerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
  },

  noteViewerContent: {
    padding: 20,
    paddingBottom: 30,
  },

  fullNoteText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#374151',
  },

  noteViewerCloseButton: {
    minHeight: 52,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 13,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteViewerCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  errorTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },

  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 7,
  },

  backMainButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  backMainButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});