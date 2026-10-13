import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const LECTURER_ID_KEY = '@calebconnect_lecturer_id';

const FALLBACK_LEVELS = ['100', '200', '300', '400'];

const MAX_SEARCH_RESULTS = 30;

type Department = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  level: string | null;
};

type Assignment = {
  id: string;
  student_id: string;
  department_id: string;
  level: string;
  position: 'course_rep' | 'assistant';
  assigned_by: string;
  assigned_at: string;
  is_active: boolean;
};

type AssignmentWithStudent = Assignment & {
  student: Student | null;
};

export default function LecturerCourseRepsScreen() {
  const [lecturerId, setLecturerId] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<string[]>(FALLBACK_LEVELS);

  const [selectedDepartmentId, setSelectedDepartmentId] =
    useState<string>('');

  const [selectedLevel, setSelectedLevel] = useState('100');

  const [assignments, setAssignments] = useState<
    AssignmentWithStudent[]
  >([]);

  const [students, setStudents] = useState<Student[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [studentModalVisible, setStudentModalVisible] =
    useState(false);

  const [selectedPosition, setSelectedPosition] = useState<
    'course_rep' | 'assistant' | null
  >(null);

  const [saving, setSaving] = useState(false);

  // NEW: student search
  const [studentSearch, setStudentSearch] = useState('');

  const selectedDepartment = departments.find(
    (department) => department.id === selectedDepartmentId,
  );

  const courseRep = assignments.find(
    (assignment) => assignment.position === 'course_rep',
  );

  const assistant = assignments.find(
    (assignment) => assignment.position === 'assistant',
  );

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (
      lecturerId &&
      selectedDepartmentId &&
      selectedLevel
    ) {
      loadAssignments();
    }
  }, [
    lecturerId,
    selectedDepartmentId,
    selectedLevel,
  ]);

  /*
   * SEARCH STUDENTS
   *
   * This does NOT download all students.
   *
   * The search is performed directly in Supabase,
   * filtered by:
   * - student role
   * - selected department
   * - selected level
   * - student name OR matric number
   *
   * Only 30 matching students are returned.
   */
  useEffect(() => {
    if (
      !studentModalVisible ||
      !selectedPosition ||
      !selectedDepartmentId ||
      !selectedDepartment ||
      !selectedLevel
    ) {
      return;
    }

    const searchTerm = studentSearch.trim();

    // Do not search until the lecturer has typed at least 2 characters.
    if (searchTerm.length < 2) {
      setStudents([]);
      setStudentsLoading(false);
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      try {
        setStudentsLoading(true);

        /*
         * Prevent PostgREST OR syntax characters from
         * interfering with the search expression.
         */
        const safeSearchTerm = searchTerm
          .replace(/[%_\\]/g, '')
          .replace(/,/g, ' ')
          .trim();

        if (!safeSearchTerm) {
          if (active) {
            setStudents([]);
            setStudentsLoading(false);
          }
          return;
        }

        const {
          data,
          error,
        } = await supabase
          .from('profiles')
          .select(
            'id, full_name, student_id, department, level',
          )
          .eq('role', 'student')
          .eq(
            'department',
            selectedDepartment.name,
          )
          .eq('level', selectedLevel)
          .or(
            `full_name.ilike.%${safeSearchTerm}%,student_id.ilike.%${safeSearchTerm}%`,
          )
          .order('full_name', {
            ascending: true,
          })
          .limit(MAX_SEARCH_RESULTS);

        if (error) {
          console.error(
            'Student search error:',
            error,
          );

          if (active) {
            Alert.alert(
              'Unable to search students',
              error.message,
            );
          }

          return;
        }

        if (!active) return;

        const currentRepStudentId =
          courseRep?.student_id;

        const currentAssistantStudentId =
          assistant?.student_id;

        const filteredStudents =
          ((data || []) as Student[]).filter(
            (student) => {
              /*
               * Do not show the current Course Rep
               * when assigning Course Rep.
               */
              if (
                selectedPosition ===
                  'course_rep' &&
                student.id ===
                  currentRepStudentId
              ) {
                return false;
              }

              /*
               * Do not show the current Assistant
               * when assigning Assistant.
               */
              if (
                selectedPosition ===
                  'assistant' &&
                student.id ===
                  currentAssistantStudentId
              ) {
                return false;
              }

              return true;
            },
          );

        setStudents(filteredStudents);
      } catch (error) {
        console.error(
          'Student search exception:',
          error,
        );

        if (active) {
          Alert.alert(
            'Search error',
            'Something went wrong while searching for students.',
          );
        }
      } finally {
        if (active) {
          setStudentsLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    studentSearch,
    studentModalVisible,
    selectedPosition,
    selectedDepartmentId,
    selectedLevel,
    selectedDepartment?.name,
    courseRep?.student_id,
    assistant?.student_id,
  ]);

  const loadPage = async () => {
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
        Alert.alert(
          'Lecturer not found',
          'Please log in to the lecturer portal again.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace('/lecturer'),
            },
          ],
        );

        return;
      }

      setLecturerId(currentLecturerId);

      await Promise.all([
        loadLecturerDepartments(currentLecturerId),
        loadLevels(),
      ]);
    } catch (error) {
      console.error(
        'Course Rep page error:',
        error,
      );

      Alert.alert(
        'Error',
        'Unable to load Course Rep Management.',
      );
    } finally {
      setLoading(false);
    }
  };

  const loadLecturerDepartments = async (
    currentLecturerId: string,
  ) => {
    const {
      data: lecturerDepartmentRows,
      error: lecturerDepartmentError,
    } = await supabase
      .from('lecturer_departments')
      .select('department_id')
      .eq('lecturer_id', currentLecturerId);

    if (lecturerDepartmentError) {
      console.error(
        'Lecturer departments error:',
        lecturerDepartmentError,
      );

      throw lecturerDepartmentError;
    }

    const departmentIds =
      (lecturerDepartmentRows || [])
        .map((row) => row.department_id)
        .filter(Boolean);

    if (departmentIds.length === 0) {
      setDepartments([]);
      setSelectedDepartmentId('');
      return;
    }

    const {
      data: departmentRows,
      error: departmentError,
    } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', departmentIds)
      .order('name', {
        ascending: true,
      });

    if (departmentError) {
      console.error(
        'Departments error:',
        departmentError,
      );

      throw departmentError;
    }

    const cleanDepartments =
      (departmentRows || []) as Department[];

    setDepartments(cleanDepartments);

    if (cleanDepartments.length > 0) {
      setSelectedDepartmentId(
        (currentSelectedId) =>
          currentSelectedId ||
          cleanDepartments[0].id,
      );
    }
  };

  const loadLevels = async () => {
    const {
      data,
      error,
    } = await supabase
      .from('levels')
      .select('name')
      .order('name', {
        ascending: true,
      });

    if (error) {
      console.warn(
        'Levels table could not be loaded:',
        error.message,
      );

      setLevels(FALLBACK_LEVELS);
      return;
    }

    const databaseLevels = (data || [])
      .map((item) => String(item.name))
      .filter(Boolean);

    if (databaseLevels.length > 0) {
      setLevels(databaseLevels);

      setSelectedLevel((currentLevel) => {
        if (databaseLevels.includes(currentLevel)) {
          return currentLevel;
        }

        return databaseLevels[0];
      });
    } else {
      setLevels(FALLBACK_LEVELS);
    }
  };

  const loadAssignments = async () => {
    if (!selectedDepartmentId || !selectedLevel) {
      setAssignments([]);
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from('course_rep_assignments')
        .select(
          `
          id,
          student_id,
          department_id,
          level,
          position,
          assigned_by,
          assigned_at,
          is_active
        `,
        )
        .eq(
          'department_id',
          selectedDepartmentId,
        )
        .eq('level', selectedLevel)
        .eq('is_active', true)
        .order('assigned_at', {
          ascending: true,
        });

      if (error) {
        console.error(
          'Assignments error:',
          error,
        );

        throw error;
      }

      const assignmentRows =
        (data || []) as Assignment[];

      if (assignmentRows.length === 0) {
        setAssignments([]);
        return;
      }

      const studentIds =
        assignmentRows.map(
          (assignment) => assignment.student_id,
        );

      const {
        data: studentRows,
        error: studentError,
      } = await supabase
        .from('profiles')
        .select(
          'id, full_name, student_id, department, level',
        )
        .in('id', studentIds);

      if (studentError) {
        console.error(
          'Assignment student lookup error:',
          studentError,
        );

        throw studentError;
      }

      const studentMap = new Map<string, Student>();

      (studentRows || []).forEach((student) => {
        studentMap.set(
          student.id,
          student as Student,
        );
      });

      const combined =
        assignmentRows.map((assignment) => ({
          ...assignment,
          student:
            studentMap.get(
              assignment.student_id,
            ) || null,
        }));

      setAssignments(combined);
    } catch (error) {
      console.error(
        'loadAssignments error:',
        error,
      );

      Alert.alert(
        'Unable to load assignments',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    }
  };

  /*
   * OPEN STUDENT SEARCH
   */
  const openStudentPicker = (
    position: 'course_rep' | 'assistant',
  ) => {
    setSelectedPosition(position);
    setStudentSearch('');
    setStudents([]);
    setStudentModalVisible(true);
  };

  const assignStudent = async (
    student: Student,
  ) => {
    if (
      !lecturerId ||
      !selectedDepartmentId ||
      !selectedLevel ||
      !selectedPosition
    ) {
      return;
    }

    try {
      setSaving(true);

      const {
        error,
      } = await supabase
        .from('course_rep_assignments')
        .insert({
          student_id: student.id,
          department_id:
            selectedDepartmentId,
          level: selectedLevel,
          position: selectedPosition,
          assigned_by: lecturerId,
          is_active: true,
        });

      if (error) {
        console.error(
          'Assignment insert error:',
          error,
        );

        if (error.code === '23505') {
          Alert.alert(
            'Position already assigned',
            `There is already an active ${
              selectedPosition ===
              'course_rep'
                ? 'Course Rep'
                : 'Assistant'
            } for this department and level.`,
          );
        } else {
          Alert.alert(
            'Unable to assign student',
            error.message,
          );
        }

        return;
      }

      setStudentModalVisible(false);
      setSelectedPosition(null);
      setStudentSearch('');
      setStudents([]);

      await loadAssignments();

      Alert.alert(
        'Assignment successful',
        `${student.full_name || 'Student'} is now the ${
          selectedPosition ===
          'course_rep'
            ? 'Course Rep'
            : 'Assistant'
        } for ${
          selectedDepartment?.name ||
          'the department'
        } — Level ${selectedLevel}.`,
      );
    } catch (error) {
      console.error(
        'assignStudent error:',
        error,
      );

      Alert.alert(
        'Error',
        'Something went wrong while assigning the student.',
      );
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = (
    assignment: AssignmentWithStudent,
  ) => {
    const positionName =
      assignment.position ===
      'course_rep'
        ? 'Course Rep'
        : 'Assistant';

    const studentName =
      assignment.student?.full_name ||
      'this student';

    Alert.alert(
      `Remove ${positionName}`,
      `Are you sure you want to remove ${studentName} as ${positionName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await performRemoveAssignment(
              assignment,
            );
          },
        },
      ],
    );
  };

  const performRemoveAssignment =
    async (
      assignment: AssignmentWithStudent,
    ) => {
      try {
        setSaving(true);

        const {
          error,
        } = await supabase
          .from('course_rep_assignments')
          .update({
            is_active: false,
            removed_by: lecturerId,
            removed_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', assignment.id)
          .eq('is_active', true);

        if (error) {
          console.error(
            'Remove assignment error:',
            error,
          );

          Alert.alert(
            'Unable to remove assignment',
            error.message,
          );

          return;
        }

        await loadAssignments();

        Alert.alert(
          'Assignment removed',
          'The position is now available for another student.',
        );
      } catch (error) {
        console.error(
          'performRemoveAssignment error:',
          error,
        );

        Alert.alert(
          'Error',
          'Something went wrong while removing the assignment.',
        );
      } finally {
        setSaving(false);
      }
    };

  const onRefresh = useCallback(
    async () => {
      try {
        setRefreshing(true);
        await loadAssignments();
      } finally {
        setRefreshing(false);
      }
    },
    [
      selectedDepartmentId,
      selectedLevel,
    ],
  );

  const closeStudentModal = () => {
    if (saving) return;

    setStudentModalVisible(false);
    setSelectedPosition(null);
    setStudentSearch('');
    setStudents([]);
  };

  const renderStudent = ({
    item,
  }: {
    item: Student;
  }) => (
    <TouchableOpacity
      style={styles.studentRow}
      disabled={saving}
      onPress={() =>
        assignStudent(item)
      }
      activeOpacity={0.75}
    >
      <View style={styles.studentAvatar}>
        <Text style={styles.studentAvatarText}>
          {(item.full_name || 'S')
            .charAt(0)
            .toUpperCase()}
        </Text>
      </View>

      <View style={styles.studentInfo}>
        <Text
          style={styles.studentName}
          numberOfLines={1}
        >
          {item.full_name ||
            'Unnamed Student'}
        </Text>

        <Text style={styles.studentMatric}>
          {item.student_id ||
            'No matric number'}
        </Text>

        <Text style={styles.studentMeta}>
          {item.department || 'Department'} •
          Level {item.level || '—'}
        </Text>
      </View>

      <Ionicons
        name="add-circle-outline"
        size={26}
        color="#4F46E5"
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#4F46E5"
        />

        <Text style={styles.loadingText}>
          Loading Course Rep Management...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.contentContainer
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#111827"
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              LECTURER PORTAL
            </Text>

            <Text style={styles.title}>
              Course Rep Management
            </Text>

            <Text style={styles.subtitle}>
              Manage Course Reps and Assistants
              for your departments.
            </Text>
          </View>
        </View>

        {departments.length === 0 ? (
          <View style={styles.emptyDepartmentCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="business-outline"
                size={32}
                color="#4F46E5"
              />
            </View>

            <Text
              style={styles.emptyDepartmentTitle}
            >
              No Department Assigned
            </Text>

            <Text
              style={styles.emptyDepartmentText}
            >
              You do not currently have a
              department connection in
              CalebConnect.
            </Text>
          </View>
        ) : (
          <>
            {/* DEPARTMENT */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                SELECT DEPARTMENT
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.chipContainer
                }
              >
                {departments.map(
                  (department) => {
                    const active =
                      department.id ===
                      selectedDepartmentId;

                    return (
                      <TouchableOpacity
                        key={
                          department.id
                        }
                        style={[
                          styles.departmentChip,
                          active &&
                            styles.departmentChipActive,
                        ]}
                        onPress={() => {
                          setSelectedDepartmentId(
                            department.id,
                          );

                          setStudentModalVisible(
                            false,
                          );
                          setSelectedPosition(
                            null,
                          );
                          setStudentSearch('');
                          setStudents([]);
                        }}
                      >
                        <Ionicons
                          name="business-outline"
                          size={16}
                          color={
                            active
                              ? '#FFFFFF'
                              : '#4F46E5'
                          }
                        />

                        <Text
                          style={[
                            styles.departmentChipText,
                            active &&
                              styles.departmentChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {department.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </ScrollView>
            </View>

            {/* LEVEL */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                SELECT LEVEL
              </Text>

              <View style={styles.levelRow}>
                {levels.map((level) => {
                  const active =
                    level === selectedLevel;

                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelButton,
                        active &&
                          styles.levelButtonActive,
                      ]}
                      onPress={() => {
                        setSelectedLevel(
                          level,
                        );

                        setStudentModalVisible(
                          false,
                        );
                        setSelectedPosition(
                          null,
                        );
                        setStudentSearch('');
                        setStudents([]);
                      }}
                    >
                      <Text
                        style={[
                          styles.levelButtonText,
                          active &&
                            styles.levelButtonTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* CURRENT ASSIGNMENTS */}
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryEyebrow}>
                  CURRENT CLASS LEADERS
                </Text>

                <Text
                  style={styles.summaryTitle}
                >
                  {selectedDepartment?.name ||
                    'Department'}
                </Text>

                <Text
                  style={styles.summarySubtitle}
                >
                  Level {selectedLevel}
                </Text>
              </View>

              <View style={styles.summaryIcon}>
                <Ionicons
                  name="people-outline"
                  size={25}
                  color="#4F46E5"
                />
              </View>
            </View>

            {/* COURSE REP */}
            <PositionCard
              title="Course Rep"
              icon="ribbon-outline"
              assignment={courseRep}
              onAssign={() =>
                openStudentPicker(
                  'course_rep',
                )
              }
              onRemove={() =>
                courseRep &&
                removeAssignment(
                  courseRep,
                )
              }
              disabled={saving}
            />

            {/* ASSISTANT */}
            <PositionCard
              title="Assistant"
              icon="person-add-outline"
              assignment={assistant}
              onAssign={() =>
                openStudentPicker(
                  'assistant',
                )
              }
              onRemove={() =>
                assistant &&
                removeAssignment(
                  assistant,
                )
              }
              disabled={saving}
            />

            {/* INFORMATION */}
            <View style={styles.infoCard}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#4F46E5"
              />

              <View style={styles.infoContent}>
                <Text
                  style={styles.infoTitle}
                >
                  Department-based management
                </Text>

                <Text
                  style={styles.infoText}
                >
                  Any lecturer assigned to this
                  department can see and manage
                  the same Course Rep and
                  Assistant assignments.
                </Text>

                <Text
                  style={styles.infoText}
                >
                  Assignments are preserved in
                  the database when removed, so
                  assignment history is not lost.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* STUDENT SEARCH / PICKER */}
      <Modal
        visible={studentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeStudentModal}
      >
        <SafeAreaView
          style={styles.modalSafeArea}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text
                style={styles.modalEyebrow}
              >
                ASSIGN STUDENT
              </Text>

              <Text
                style={styles.modalTitle}
              >
                {selectedPosition ===
                'course_rep'
                  ? 'Course Rep'
                  : 'Assistant'}
              </Text>

              <Text
                style={styles.modalSubtitle}
              >
                {selectedDepartment?.name ||
                  'Department'}{' '}
                • Level {selectedLevel}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              disabled={saving}
              onPress={closeStudentModal}
            >
              <Ionicons
                name="close"
                size={24}
                color="#111827"
              />
            </TouchableOpacity>
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={21}
                color="#6B7280"
              />

              <TextInput
                value={studentSearch}
                onChangeText={setStudentSearch}
                placeholder="Search student name or matric number"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />

              {studentSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setStudentSearch('');
                    setStudents([]);
                  }}
                  disabled={saving}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.searchHint}>
              Type at least 2 characters to search
              by name or matric number.
            </Text>
          </View>

          {studentsLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator
                size="large"
                color="#4F46E5"
              />

              <Text
                style={styles.modalLoadingText}
              >
                Searching students...
              </Text>
            </View>
          ) : studentSearch.trim().length < 2 ? (
            <View style={styles.searchEmpty}>
              <View
                style={styles.searchEmptyIcon}
              >
                <Ionicons
                  name="search-outline"
                  size={32}
                  color="#4F46E5"
                />
              </View>

              <Text
                style={styles.searchEmptyTitle}
              >
                Find a student
              </Text>

              <Text
                style={styles.searchEmptyText}
              >
                Search using the student's name
                or matric number. Only students
                in {selectedDepartment?.name ||
                  'this department'} at Level{' '}
                {selectedLevel} will appear.
              </Text>
            </View>
          ) : students.length === 0 ? (
            <View style={styles.noStudents}>
              <View
                style={styles.noStudentsIcon}
              >
                <Ionicons
                  name="person-outline"
                  size={32}
                  color="#4F46E5"
                />
              </View>

              <Text
                style={styles.noStudentsTitle}
              >
                No student found
              </Text>

              <Text
                style={styles.noStudentsText}
              >
                No eligible student matched
                "{studentSearch.trim()}" in this
                department and level.
              </Text>
            </View>
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) =>
                item.id
              }
              renderItem={renderStudent}
              contentContainerStyle={
                styles.studentList
              }
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={styles.resultsText}>
                  {students.length}
                  {students.length ===
                  MAX_SEARCH_RESULTS
                    ? '+'
                    : ''}{' '}
                  matching student
                  {students.length === 1
                    ? ''
                    : 's'}
                </Text>
              }
            />
          )}

          {saving && (
            <View
              style={styles.savingOverlay}
            >
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
              />

              <Text
                style={styles.savingText}
              >
                Saving assignment...
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

type PositionCardProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  assignment?: AssignmentWithStudent;
  onAssign: () => void;
  onRemove: () => void;
  disabled: boolean;
};

function PositionCard({
  title,
  icon,
  assignment,
  onAssign,
  onRemove,
  disabled,
}: PositionCardProps) {
  return (
    <View style={styles.positionCard}>
      <View style={styles.positionHeader}>
        <View style={styles.positionIcon}>
          <Ionicons
            name={icon}
            size={22}
            color="#4F46E5"
          />
        </View>

        <View style={styles.positionTitleArea}>
          <Text
            style={styles.positionTitle}
          >
            {title}
          </Text>

          <Text
            style={styles.positionSubtitle}
          >
            {assignment
              ? 'Currently assigned'
              : 'Position available'}
          </Text>
        </View>

        {assignment && (
          <View style={styles.activeBadge}>
            <View
              style={styles.activeDot}
            />

            <Text
              style={styles.activeBadgeText}
            >
              ACTIVE
            </Text>
          </View>
        )}
      </View>

      {assignment ? (
        <View style={styles.assignedStudent}>
          <View style={styles.largeAvatar}>
            <Text
              style={styles.largeAvatarText}
            >
              {(assignment.student
                ?.full_name ||
                'S')
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View
            style={styles.assignedStudentInfo}
          >
            <Text
              style={styles.assignedStudentName}
              numberOfLines={1}
            >
              {assignment.student
                ?.full_name ||
                'Unknown Student'}
            </Text>

            <Text
              style={styles.assignedStudentMatric}
            >
              {assignment.student
                ?.student_id ||
                'No matric number'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            disabled={disabled}
            onPress={onRemove}
          >
            <Ionicons
              name="person-remove-outline"
              size={19}
              color="#B91C1C"
            />

            <Text
              style={styles.removeButtonText}
            >
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.assignButton}
          disabled={disabled}
          onPress={onAssign}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person-add-outline"
            size={20}
            color="#FFFFFF"
          />

          <Text
            style={styles.assignButtonText}
          >
            Assign {title}
          </Text>
        </TouchableOpacity>
      )}
    </View>
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
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 14,
    color: '#6B7280',
    fontSize: 14,
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 20,
    paddingBottom: 45,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
    marginTop: 2,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#4F46E5',
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },

  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginTop: 5,
  },

  section: {
    marginBottom: 19,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  chipContainer: {
    gap: 9,
    paddingRight: 10,
  },

  departmentChip: {
    minHeight: 43,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  departmentChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },

  departmentChipText: {
    marginLeft: 7,
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 180,
  },

  departmentChipTextActive: {
    color: '#FFFFFF',
  },

  levelRow: {
    flexDirection: 'row',
    gap: 9,
  },

  levelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  levelButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  levelButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
  },

  levelButtonTextActive: {
    color: '#FFFFFF',
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  summaryEyebrow: {
    color: '#A5B4FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 5,
  },

  summarySubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 3,
  },

  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  positionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  positionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  positionTitleArea: {
    flex: 1,
    marginLeft: 12,
  },

  positionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  positionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 5,
  },

  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },

  assignedStudent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  largeAvatar: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  largeAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },

  assignedStudentInfo: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  assignedStudentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  assignedStudentMatric: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  removeButton: {
    minHeight: 38,
    borderRadius: 11,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  removeButtonText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },

  assignButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 17,
  },

  assignButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    marginTop: 4,
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3730A3',
  },

  infoText: {
    fontSize: 12,
    color: '#4F46E5',
    lineHeight: 18,
    marginTop: 5,
  },

  emptyDepartmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  emptyDepartmentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  emptyDepartmentText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 17,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  modalTitleContainer: {
    flex: 1,
  },

  modalEyebrow: {
    color: '#4F46E5',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },

  modalTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },

  modalSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 3,
  },

  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  /*
   * SEARCH AREA
   */
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  searchBox: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 9,
    color: '#111827',
    fontSize: 14,
  },

  searchHint: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 7,
    marginLeft: 2,
  },

  resultsText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalLoadingText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 12,
  },

  studentList: {
    padding: 15,
    paddingBottom: 35,
  },

  studentRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  studentAvatarText: {
    color: '#4F46E5',
    fontSize: 17,
    fontWeight: '800',
  },

  studentInfo: {
    flex: 1,
    marginLeft: 11,
    marginRight: 10,
  },

  studentName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },

  studentMatric: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },

  studentMeta: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
  },

  /*
   * INITIAL SEARCH STATE
   */
  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  searchEmptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchEmptyTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 15,
  },

  searchEmptyText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 7,
  },

  noStudents: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  noStudentsIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  noStudentsTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 15,
  },

  noStudentsText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 7,
  },

  savingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  savingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
});