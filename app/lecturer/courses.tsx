import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const LECTURER_ID_KEY = '@calebconnect_lecturer_id';
const LECTURER_PROFILE_KEY = '@calebconnect_lecturer_profile';
const LECTURER_DEPARTMENTS_KEY = '@calebconnect_lecturer_departments';

const SEMESTERS = ['First Semester', 'Second Semester'];
const FALLBACK_LEVELS = ['100', '200', '300', '400'];

type LecturerProfile = {
  id?: string;
  fullName?: string;
  email?: string;
  department?: string;
  programme?: string;
  faculty?: string;
};

type Department = {
  id: string;
  name: string;
  faculty: string | null;
};

type Course = {
  id: string;
  lecturer_id: string;
  course_code: string;
  course_title: string;
  department: string;
  department_id: string | null;
  faculty: string | null;
  level: string;
  semester: string | null;
  credit_unit: number | null;
  created_at?: string;
  updated_at?: string;
};

export default function LecturerCoursesScreen() {
  const [lecturerId, setLecturerId] = useState('');
  const [lecturerProfile, setLecturerProfile] =
    useState<LecturerProfile | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeDepartmentId, setActiveDepartmentId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [levels, setLevels] = useState<string[]>(FALLBACK_LEVELS);
  const [courses, setCourses] = useState<Course[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [error, setError] = useState('');

  const [addCourseVisible, setAddCourseVisible] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(SEMESTERS[0]);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [creditUnit, setCreditUnit] = useState('3');

  const activeDepartment = departments.find(
    department => department.id === activeDepartmentId,
  );

  const loadLecturerInformation = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const { data: authData } = await supabase.auth.getUser();

      const [
        storedLecturerId,
        storedProfile,
        storedDepartments,
      ] = await Promise.all([
        AsyncStorage.getItem(LECTURER_ID_KEY),
        AsyncStorage.getItem(LECTURER_PROFILE_KEY),
        AsyncStorage.getItem(LECTURER_DEPARTMENTS_KEY),
      ]);

      let parsedProfile: LecturerProfile | null = null;

      if (storedProfile) {
        try {
          parsedProfile = JSON.parse(storedProfile);
        } catch {
          parsedProfile = null;
        }
      }

      const userId =
        authData.user?.id ||
        storedLecturerId ||
        parsedProfile?.id ||
        '';

      if (!userId) {
        setError(
          'Your lecturer account could not be identified. Please sign in again.',
        );
        setDepartments([]);
        setCourses([]);
        return;
      }

      setLecturerId(userId);
      setLecturerProfile(parsedProfile);

      // Keep the lecturer ID consistent with the authenticated user.
      await AsyncStorage.setItem(LECTURER_ID_KEY, userId);

      const { data: lecturerDepartmentRows, error: lecturerDepartmentError } =
        await supabase
          .from('lecturer_departments')
          .select('department_id')
          .eq('lecturer_id', userId);

      if (lecturerDepartmentError) {
        throw lecturerDepartmentError;
      }

      const departmentIds = Array.from(
        new Set(
          (lecturerDepartmentRows || [])
            .map(row => row.department_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let availableDepartments: Department[] = [];

      if (departmentIds.length > 0) {
        const { data: departmentRows, error: departmentError } =
          await supabase
            .from('departments')
            .select('id, name, faculty')
            .in('id', departmentIds)
            .order('name', { ascending: true });

        if (departmentError) {
          throw departmentError;
        }

        availableDepartments = (departmentRows || []) as Department[];
      }

      // If the lecturer-department relationship table has no entries,
      // use only a matching department from the database as a fallback.
      if (availableDepartments.length === 0) {
        let cachedDepartments: any[] = [];

        if (storedDepartments) {
          try {
            const parsed = JSON.parse(storedDepartments);
            cachedDepartments = Array.isArray(parsed) ? parsed : [];
          } catch {
            cachedDepartments = [];
          }
        }

        const possibleNames = [
          parsedProfile?.department,
          parsedProfile?.programme,
          ...cachedDepartments.map(item =>
            typeof item === 'string' ? item : item?.name,
          ),
        ].filter(Boolean);

        if (possibleNames.length > 0) {
          const { data: departmentRows, error: departmentError } =
            await supabase
              .from('departments')
              .select('id, name, faculty')
              .order('name', { ascending: true });

          if (departmentError) {
            throw departmentError;
          }

          const normalizedNames = possibleNames.map(name =>
            String(name).trim().toLowerCase(),
          );

          availableDepartments = ((departmentRows || []) as Department[]).filter(
            department =>
              normalizedNames.includes(department.name.trim().toLowerCase()),
          );
        }
      }

      setDepartments(availableDepartments);

      await AsyncStorage.setItem(
        LECTURER_DEPARTMENTS_KEY,
        JSON.stringify(availableDepartments),
      );

      if (availableDepartments.length === 0) {
        setActiveDepartmentId('');
        setSelectedDepartmentId('');
        setCourses([]);
        setError(
          'No departments are assigned to this lecturer account. Please check the lecturer department assignments.',
        );
        return;
      }

      const profileDepartmentName = (
        parsedProfile?.department ||
        parsedProfile?.programme ||
        ''
      )
        .trim()
        .toLowerCase();

      const preferredDepartment = availableDepartments.find(
        department =>
          department.name.trim().toLowerCase() === profileDepartmentName,
      );

      setActiveDepartmentId(current => {
        if (
          current &&
          availableDepartments.some(department => department.id === current)
        ) {
          return current;
        }

        return preferredDepartment?.id || availableDepartments[0].id;
      });

      setSelectedDepartmentId(current => {
        if (
          current &&
          availableDepartments.some(department => department.id === current)
        ) {
          return current;
        }

        return preferredDepartment?.id || availableDepartments[0].id;
      });
    } catch (err: any) {
      console.error('Error loading lecturer information:', err);
      setError(err?.message || 'Unable to load lecturer information.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLevels = useCallback(async () => {
    try {
      const { data, error: levelsError } = await supabase
        .from('levels')
        .select('name')
        .order('name', { ascending: true });

      if (levelsError) {
        console.warn('Unable to load levels from database:', levelsError.message);
        setLevels(FALLBACK_LEVELS);
        return;
      }

      const databaseLevels = (data || [])
        .map(item => String(item.name))
        .filter(Boolean);

      setLevels(databaseLevels.length > 0 ? databaseLevels : FALLBACK_LEVELS);
    } catch (err) {
      console.warn('Using default levels:', err);
      setLevels(FALLBACK_LEVELS);
    }
  }, []);

  const loadCourses = useCallback(
    async (level: string, departmentId: string) => {
      if (!lecturerId || !departmentId || !level) {
        setCourses([]);
        return;
      }

      // Confirm that the selected department belongs to this lecturer.
      const isAssignedDepartment = departments.some(
        department => department.id === departmentId,
      );

      if (!isAssignedDepartment) {
        setCourses([]);
        setError('Please select one of your assigned departments.');
        return;
      }

      try {
        setLoadingCourses(true);
        setError('');

        // IMPORTANT:
        // Do not filter by lecturer_id here.
        // This retrieves courses from every lecturer in the selected
        // department, limited to the selected academic level.
        const { data, error: coursesError } = await supabase
          .from('courses')
          .select(
            `
              id,
              lecturer_id,
              course_code,
              course_title,
              department,
              department_id,
              faculty,
              level,
              semester,
              credit_unit,
              created_at,
              updated_at
            `,
          )
          .eq('department_id', departmentId)
          .eq('level', level)
          .order('course_code', { ascending: true });

        if (coursesError) {
          throw coursesError;
        }

        setCourses((data || []) as Course[]);
      } catch (err: any) {
        console.error('Error loading department courses:', err);
        setCourses([]);
        setError(
          err?.message ||
            'Unable to load courses. Please check your connection and permissions.',
        );
      } finally {
        setLoadingCourses(false);
      }
    },
    [lecturerId, departments],
  );

  useEffect(() => {
    loadLecturerInformation();
    loadLevels();
  }, [loadLecturerInformation, loadLevels]);

  useEffect(() => {
    if (lecturerId && activeDepartmentId && selectedLevel) {
      loadCourses(selectedLevel, activeDepartmentId);
    } else {
      setCourses([]);
    }
  }, [lecturerId, activeDepartmentId, selectedLevel, loadCourses]);

  useFocusEffect(
    useCallback(() => {
      if (lecturerId && activeDepartmentId && selectedLevel) {
        loadCourses(selectedLevel, activeDepartmentId);
      }
    }, [lecturerId, activeDepartmentId, selectedLevel, loadCourses]),
  );

  const chooseDepartment = (departmentId: string) => {
    setActiveDepartmentId(departmentId);
    setSelectedLevel(null);
    setCourses([]);

    // Use this department as the default when the lecturer opens Add Course.
    setSelectedDepartmentId(departmentId);
  };

  const openAddCourse = () => {
    if (departments.length === 0) {
      Alert.alert(
        'No department assigned',
        'Your lecturer account must be assigned to a department before you can add a course.',
      );
      return;
    }

    setSelectedDepartmentId(activeDepartmentId || departments[0].id);
    setSelectedSemester(SEMESTERS[0]);
    setCourseCode('');
    setCourseTitle('');
    setCreditUnit('3');
    setAddCourseVisible(true);
  };

  const createCourse = async () => {
    const cleanCode = courseCode.trim().toUpperCase();
    const cleanTitle = courseTitle.trim();
    const parsedCreditUnit = Number(creditUnit);

    if (!lecturerId) {
      Alert.alert(
        'Lecturer not identified',
        'Please sign in again before adding a course.',
      );
      return;
    }

    if (!cleanCode || !cleanTitle) {
      Alert.alert('Missing information', 'Enter the course code and course title.');
      return;
    }

    if (!selectedLevel) {
      Alert.alert('Select a level', 'Choose the level before adding a course.');
      return;
    }

    const targetDepartment = departments.find(
      department => department.id === selectedDepartmentId,
    );

    if (!targetDepartment) {
      Alert.alert(
        'Invalid department',
        'Select a department assigned to your lecturer account.',
      );
      return;
    }

    if (
      !Number.isFinite(parsedCreditUnit) ||
      parsedCreditUnit < 1 ||
      parsedCreditUnit > 10
    ) {
      Alert.alert(
        'Invalid credit unit',
        'Enter a credit unit between 1 and 10.',
      );
      return;
    }

    try {
      setSavingCourse(true);

      const { data, error: insertError } = await supabase
        .from('courses')
        .insert({
          lecturer_id: lecturerId,
          course_code: cleanCode,
          course_title: cleanTitle,
          department: targetDepartment.name,
          department_id: targetDepartment.id,
          faculty:
            targetDepartment.faculty ||
            lecturerProfile?.faculty ||
            '',
          level: selectedLevel,
          semester: selectedSemester,
          credit_unit: parsedCreditUnit,
        })
        .select(
          `
            id,
            lecturer_id,
            course_code,
            course_title,
            department,
            department_id,
            faculty,
            level,
            semester,
            credit_unit,
            created_at,
            updated_at
          `,
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      setAddCourseVisible(false);

      // Switch to the department where the course was created so the
      // lecturer can immediately see the newly added course.
      setActiveDepartmentId(targetDepartment.id);
      setSelectedDepartmentId(targetDepartment.id);

      Alert.alert('Success', `${cleanCode} has been added successfully.`);

      if (data && selectedLevel === data.level) {
        await loadCourses(data.level, targetDepartment.id);
      }
    } catch (err: any) {
      console.error('Error creating course:', err);
      Alert.alert(
        'Unable to add course',
        err?.message ||
          'The course could not be saved. Please check your connection and try again.',
      );
    } finally {
      setSavingCourse(false);
    }
  };

  const openCourse = (course: Course) => {
    router.push(`/lecturer/course/${course.id}` as any);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading lecturer courses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Manage Courses</Text>
          <Text style={styles.headerSubtitle}>
            View and manage department courses
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadLecturerInformation}
        >
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            Hello{lecturerProfile?.fullName
              ? `, ${lecturerProfile.fullName.split(' ')[0]}`
              : ''}
          </Text>
          <Text style={styles.welcomeDescription}>
            Select a department and level to see all courses available in that
            department, including courses created by other lecturers.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Departments</Text>
          <Text style={styles.sectionHint}>Tap to switch department</Text>
        </View>

        {departments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No departments found</Text>
            <Text style={styles.emptyDescription}>
              Your account has no department assignment. Ask your administrator
              to assign your department before continuing.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.departmentList}
          >
            {departments.map(department => {
              const selected = activeDepartmentId === department.id;

              return (
                <TouchableOpacity
                  key={department.id}
                  style={[
                    styles.departmentChip,
                    selected && styles.departmentChipSelected,
                  ]}
                  onPress={() => chooseDepartment(department.id)}
                >
                  <Text
                    style={[
                      styles.departmentChipText,
                      selected && styles.departmentChipTextSelected,
                    ]}
                  >
                    {department.name}
                  </Text>
                  {selected && <Text style={styles.selectedMark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {activeDepartment && (
          <View style={styles.activeDepartmentCard}>
            <View style={styles.activeDepartmentIcon}>
              <Text style={styles.activeDepartmentIconText}>D</Text>
            </View>
            <View style={styles.activeDepartmentInfo}>
              <Text style={styles.activeDepartmentLabel}>Selected department</Text>
              <Text style={styles.activeDepartmentName}>
                {activeDepartment.name}
              </Text>
              {!!activeDepartment.faculty && (
                <Text style={styles.activeDepartmentFaculty}>
                  {activeDepartment.faculty}
                </Text>
              )}
            </View>
          </View>
        )}

        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedLevel && activeDepartmentId) {
                  loadCourses(selectedLevel, activeDepartmentId);
                } else {
                  loadLecturerInformation();
                }
              }}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Academic Level</Text>
        </View>

        <View style={styles.levelGrid}>
          {levels.map(level => {
            const selected = selectedLevel === level;

            return (
              <TouchableOpacity
                key={level}
                style={[styles.levelCard, selected && styles.levelCardSelected]}
                onPress={() => {
                  setSelectedLevel(level);
                  setCourses([]);
                }}
              >
                <View
                  style={[
                    styles.levelIcon,
                    selected && styles.levelIconSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.levelIconText,
                      selected && styles.levelIconTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.levelTitle,
                    selected && styles.levelTitleSelected,
                  ]}
                >
                  {level} Level
                </Text>
                <Text style={styles.levelSubtitle}>Academic courses</Text>
                {selected && (
                  <View style={styles.levelSelectedBadge}>
                    <Text style={styles.levelSelectedBadgeText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedLevel && (
          <>
            <View style={styles.courseSectionHeader}>
              <View style={styles.courseHeadingText}>
                <Text style={styles.sectionTitle}>
                  {selectedLevel} Level Courses
                </Text>
                <Text style={styles.courseDepartmentSubtitle}>
                  {activeDepartment?.name || 'Select a department'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addButton}
                onPress={openAddCourse}
              >
                <Text style={styles.addButtonText}>+ Add Course</Text>
              </TouchableOpacity>
            </View>

            {loadingCourses ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Loading courses...</Text>
              </View>
            ) : courses.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Text style={styles.emptyIconText}>📚</Text>
                </View>
                <Text style={styles.emptyTitle}>No courses found</Text>
                <Text style={styles.emptyDescription}>
                  There are no courses for {activeDepartment?.name || 'this department'}{' '}
                  at {selectedLevel} level yet. Courses added by any lecturer to
                  this department will appear here.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddButton}
                  onPress={openAddCourse}
                >
                  <Text style={styles.emptyAddButtonText}>+ Add First Course</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.courseList}>
                <View style={styles.courseCountRow}>
                  <Text style={styles.courseCountText}>
                    {courses.length} course{courses.length === 1 ? '' : 's'} found
                  </Text>
                </View>

                {courses.map(course => (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.courseCard}
                    onPress={() => openCourse(course)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.courseCodeBadge}>
                      <Text style={styles.courseCodeBadgeText}>
                        {course.course_code}
                      </Text>
                    </View>

                    <View style={styles.courseInfo}>
                      <Text style={styles.courseTitle}>
                        {course.course_title}
                      </Text>
                      <Text style={styles.courseCode}>
                        {course.course_code}
                      </Text>
                      <View style={styles.courseMetaRow}>
                        {!!course.semester && (
                          <Text style={styles.courseMeta}>
                            {course.semester}
                          </Text>
                        )}
                        {course.credit_unit != null && (
                          <Text style={styles.courseMeta}>
                            {course.credit_unit} credit unit
                            {course.credit_unit === 1 ? '' : 's'}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.courseDepartment}>
                        {course.department}
                      </Text>
                    </View>

                    <Text style={styles.courseArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={addCourseVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddCourseVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Course</Text>
                <Text style={styles.modalSubtitle}>
                  Add a course to a department you teach
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setAddCourseVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Department *</Text>
              <View style={styles.modalDepartmentList}>
                {departments.map(department => {
                  const selected = selectedDepartmentId === department.id;

                  return (
                    <TouchableOpacity
                      key={department.id}
                      style={[
                        styles.modalDepartmentChip,
                        selected && styles.modalDepartmentChipSelected,
                      ]}
                      onPress={() => setSelectedDepartmentId(department.id)}
                    >
                      <Text
                        style={[
                          styles.modalDepartmentText,
                          selected && styles.modalDepartmentTextSelected,
                        ]}
                      >
                        {department.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Academic Level</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>
                  {selectedLevel ? `${selectedLevel} Level` : 'Select a level first'}
                </Text>
              </View>

              <Text style={styles.inputLabel}>Course Code *</Text>
              <TextInput
                style={styles.textInput}
                value={courseCode}
                onChangeText={setCourseCode}
                placeholder="e.g. CSC 101"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                maxLength={30}
              />

              <Text style={styles.inputLabel}>Course Title *</Text>
              <TextInput
                style={styles.textInput}
                value={courseTitle}
                onChangeText={setCourseTitle}
                placeholder="Enter course title"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                maxLength={150}
              />

              <Text style={styles.inputLabel}>Semester *</Text>
              <View style={styles.optionRow}>
                {SEMESTERS.map(semester => {
                  const selected = selectedSemester === semester;

                  return (
                    <TouchableOpacity
                      key={semester}
                      style={[
                        styles.optionButton,
                        selected && styles.optionButtonSelected,
                      ]}
                      onPress={() => setSelectedSemester(semester)}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          selected && styles.optionButtonTextSelected,
                        ]}
                      >
                        {semester}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Credit Unit *</Text>
              <TextInput
                style={styles.textInput}
                value={creditUnit}
                onChangeText={setCreditUnit}
                placeholder="3"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={2}
              />

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  savingCourse && styles.saveButtonDisabled,
                ]}
                onPress={createCourse}
                disabled={savingCourse}
              >
                {savingCourse ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Course</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setAddCourseVisible(false)}
                disabled={savingCourse}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FB',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF5',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 30,
    lineHeight: 34,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#172554',
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 25,
    color: '#334155',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
  },
  welcomeCard: {
    backgroundColor: '#1D4ED8',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeDescription: {
    color: '#DBEAFE',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172554',
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  departmentList: {
    gap: 9,
    paddingBottom: 14,
  },
  departmentChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  departmentChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  departmentChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  departmentChipTextSelected: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  selectedMark: {
    color: '#1D4ED8',
    fontWeight: '900',
  },
  activeDepartmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeDepartmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeDepartmentIconText: {
    color: '#1D4ED8',
    fontSize: 20,
    fontWeight: '900',
  },
  activeDepartmentInfo: {
    flex: 1,
  },
  activeDepartmentLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 3,
  },
  activeDepartmentName: {
    color: '#172554',
    fontWeight: '800',
    fontSize: 15,
  },
  activeDepartmentFaculty: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  levelCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 17,
    padding: 14,
    minHeight: 142,
  },
  levelCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  levelIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  levelIconSelected: {
    backgroundColor: '#2563EB',
  },
  levelIconText: {
    color: '#334155',
    fontWeight: '900',
    fontSize: 14,
  },
  levelIconTextSelected: {
    color: '#FFFFFF',
  },
  levelTitle: {
    color: '#172554',
    fontSize: 15,
    fontWeight: '800',
  },
  levelTitleSelected: {
    color: '#1D4ED8',
  },
  levelSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  levelSelectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  levelSelectedBadgeText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
  },
  courseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  courseHeadingText: {
    flex: 1,
  },
  courseDepartmentSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    marginBottom: 20,
  },
  courseList: {
    gap: 10,
  },
  courseCountRow: {
    marginBottom: 2,
  },
  courseCountText: {
    color: '#64748B',
    fontSize: 12,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseCodeBadge: {
    width: 58,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginRight: 12,
  },
  courseCodeBadgeText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    color: '#172554',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  courseCode: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  courseMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  courseMeta: {
    color: '#475569',
    backgroundColor: '#F1F5F9',
    fontSize: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },
  courseDepartment: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 7,
  },
  courseArrow: {
    color: '#94A3B8',
    fontSize: 28,
    marginLeft: 7,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 23,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIconText: {
    fontSize: 25,
  },
  emptyTitle: {
    color: '#172554',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyAddButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 17,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    marginBottom: 18,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
  },
  retryText: {
    color: '#1D4ED8',
    fontWeight: '800',
    marginTop: 8,
  },
  bottomSpace: {
    height: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 21,
    paddingTop: 23,
    paddingBottom: Platform.OS === 'ios' ? 30 : 22,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#172554',
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#475569',
    fontSize: 25,
    lineHeight: 28,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 14,
  },
  modalDepartmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalDepartmentChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modalDepartmentChipSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  modalDepartmentText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  modalDepartmentTextSelected: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  readOnlyField: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  readOnlyText: {
    color: '#475569',
    fontSize: 14,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#172554',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  optionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 7,
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  optionButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionButtonTextSelected: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
});