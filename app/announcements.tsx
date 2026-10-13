import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const ANNOUNCEMENTS_KEY = '@calebconnect_announcements';

type Announcement = {
  id: string;
  courseCode: string;
  message: string;
  date: string;
  time: string;
};

const courses = [
  'CSC101',
  'MTH101',
  'PHY101',
  'GST101',
  'COS102',
  'CSC172',
  'CSC176',
  'CSC178',
  'SEN101',
  'SEN201',
  'SEN202',
  'SEN203',
  'SEN204',
  'CYB101',
  'CYB201',
  'CYB202',
  'CYB203',
  'CYB204',
];

export default function AnnouncementsScreen() {
  const [courseCode, setCourseCode] = useState('');
  const [message, setMessage] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCourses, setShowCourses] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const saved = await AsyncStorage.getItem(
        ANNOUNCEMENTS_KEY
      );

      if (saved) {
        setAnnouncements(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading announcements:', error);
    }
  };

  const postAnnouncement = async () => {
    const cleanCourse = courseCode.trim().toUpperCase();
    const cleanMessage = message.trim();

    if (!cleanCourse) {
      Alert.alert(
        'Course Required',
        'Please select a course.'
      );
      return;
    }

    if (!cleanMessage) {
      Alert.alert(
        'Message Required',
        'Please enter your announcement.'
      );
      return;
    }

    const now = new Date();

    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      courseCode: cleanCourse,
      message: cleanMessage,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updated = [
      newAnnouncement,
      ...announcements,
    ];

    try {
      await AsyncStorage.setItem(
        ANNOUNCEMENTS_KEY,
        JSON.stringify(updated)
      );

      setAnnouncements(updated);
      setMessage('');
      setCourseCode('');
      setShowCourses(false);

      Alert.alert(
        'Announcement Posted',
        'Your announcement has been saved successfully.'
      );
    } catch (error) {
      console.log(
        'Error saving announcement:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to save the announcement.'
      );
    }
  };

  const deleteAnnouncement = (
    id: string
  ) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated =
              announcements.filter(
                (item) => item.id !== id
              );

            try {
              await AsyncStorage.setItem(
                ANNOUNCEMENTS_KEY,
                JSON.stringify(updated)
              );

              setAnnouncements(updated);
            } catch (error) {
              console.log(
                'Error deleting announcement:',
                error
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                Announcements
              </Text>

              <Text style={styles.headerSubtitle}>
                Share important information
              </Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          {/* CREATE */}

          <Text style={styles.sectionTitle}>
            New Announcement
          </Text>

          <View style={styles.createCard}>
            <Text style={styles.label}>
              Course
            </Text>

            <TouchableOpacity
              style={styles.courseSelector}
              onPress={() =>
                setShowCourses(!showCourses)
              }
              activeOpacity={0.8}
            >
              <View style={styles.courseSelectorLeft}>
                <View style={styles.courseIcon}>
                  <Ionicons
                    name="book-outline"
                    size={20}
                    color="#4F46E5"
                  />
                </View>

                <Text
                  style={[
                    styles.courseSelectorText,
                    !courseCode &&
                      styles.placeholder,
                  ]}
                >
                  {courseCode ||
                    'Select a course'}
                </Text>
              </View>

              <Ionicons
                name={
                  showCourses
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>

            {showCourses && (
              <View style={styles.courseList}>
                {courses.map((course) => (
                  <Pressable
                    key={course}
                    style={styles.courseOption}
                    onPress={() => {
                      setCourseCode(course);
                      setShowCourses(false);
                    }}
                  >
                    <Text
                      style={
                        styles.courseOptionText
                      }
                    >
                      {course}
                    </Text>

                    {course === courseCode && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color="#4F46E5"
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>
              Announcement
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder="Type your announcement here..."
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.helperText}>
              Example: "CSC101 class has been moved
              to ICT Hall 2."
            </Text>

            <TouchableOpacity
              style={styles.postButton}
              onPress={postAnnouncement}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send"
                size={19}
                color="#FFFFFF"
              />

              <Text style={styles.postButtonText}>
                Post Announcement
              </Text>
            </TouchableOpacity>
          </View>

          {/* HISTORY */}

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>
              Recent Announcements
            </Text>

            {announcements.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {announcements.length}
                </Text>
              </View>
            )}
          </View>

          {announcements.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="megaphone-outline"
                  size={30}
                  color="#4F46E5"
                />
              </View>

              <Text style={styles.emptyTitle}>
                No announcements yet
              </Text>

              <Text style={styles.emptyText}>
                Announcements you post will appear
                here.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {announcements.map(
                (announcement) => (
                  <View
                    key={announcement.id}
                    style={styles.announcementCard}
                  >
                    <View
                      style={
                        styles.announcementTop
                      }
                    >
                      <View
                        style={
                          styles.announcementIcon
                        }
                      >
                        <Ionicons
                          name="megaphone"
                          size={20}
                          color="#4F46E5"
                        />
                      </View>

                      <View
                        style={
                          styles.announcementHeaderInfo
                        }
                      >
                        <Text
                          style={
                            styles.announcementCourse
                          }
                        >
                          {announcement.courseCode}
                        </Text>

                        <Text
                          style={
                            styles.announcementDate
                          }
                        >
                          {announcement.date} •{' '}
                          {announcement.time}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() =>
                          deleteAnnouncement(
                            announcement.id
                          )
                        }
                        style={
                          styles.deleteButton
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={19}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>

                    <Text
                      style={
                        styles.announcementMessage
                      }
                    >
                      {announcement.message}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          {/* FOOTER */}

          <Text style={styles.footer}>
            CalebConnect
          </Text>

          <Text style={styles.footerSubtitle}>
            Keep your students informed.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  keyboard: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },

  header: {
    height: 80,
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

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 13,
  },

  createCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 28,
  },

  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
  },

  courseSelector: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
  },

  courseSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  courseIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  courseSelectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  placeholder: {
    color: '#9CA3AF',
    fontWeight: '500',
  },

  courseList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    marginTop: 7,
    overflow: 'hidden',
  },

  courseOption: {
    minHeight: 48,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },

  courseOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  messageInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },

  helperText: {
    fontSize: 10,
    lineHeight: 16,
    color: '#9CA3AF',
    marginTop: 7,
  },

  postButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },

  postButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  countBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
  },

  countText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },

  list: {
    marginBottom: 20,
  },

  announcementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    marginBottom: 11,
  },

  announcementTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  announcementIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  announcementHeaderInfo: {
    flex: 1,
  },

  announcementCourse: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },

  announcementDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
  },

  deleteButton: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  announcementMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
    marginTop: 14,
  },

  footer: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    marginTop: 25,
  },

  footerSubtitle: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});