import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function CourseScreen() {
  const { code } = useLocalSearchParams();

  const courses: Record<string, { title: string; units: string }> = {
    COS102: {
      title: "Problem Solving",
      units: "3 Units",
    },
    "CUL-CSC172": {
      title: "Data Mining & Warehousing",
      units: "3 Units",
    },
    "CUL-CSC176": {
      title: "Introduction to Web Design",
      units: "2 Units",
    },
    "CUL-CSC178": {
      title: "Basic Electronics",
      units: "2 Units",
    },
    GST104: {
      title: "Tech Plus I",
      units: "2 Units",
    },
    GST112: {
      title: "Nigerian Peoples and Culture",
      units: "2 Units",
    },
    MTH102: {
      title: "Elementary Mathematics II",
      units: "2 Units",
    },
    PHY102: {
      title: "General Physics II",
      units: "2 Units",
    },
    PHY108: {
      title: "General Practical Physics II",
      units: "1 Unit",
    },
  };

  const lectures: Record<string, string[]> = {
    COS102: [
      "Introduction to Problem Solving",
      "Algorithms",
      "Flowcharts",
    ],

    "CUL-CSC172": [
      "Introduction to Data Mining",
      "Data Warehousing",
      "Data Mining Techniques",
    ],

    "CUL-CSC176": [
      "Introduction to Web Design",
      "HTML Basics",
      "CSS Basics",
    ],

    "CUL-CSC178": [
      "Introduction to Electronics",
      "Electronic Components",
      "Basic Circuits",
    ],

    GST104: [
      "Communication Skills",
      "Listening Skills",
      "Writing Skills",
    ],

    GST112: [
      "Meaning of Culture",
      "Nigerian Ethnic Groups",
      "National Values",
    ],

    MTH102: [
      "Matrices",
      "Determinants",
      "Complex Numbers",
    ],

    PHY102: [
      "Electric Fields",
      "Capacitance",
      "Current Electricity",
    ],

    PHY108: [
      "Practical 1",
      "Practical 2",
      "Practical 3",
    ],
  };

  const course =
    courses[code as string] || {
      title: "Unknown Course",
      units: "",
    };

  const currentLectures =
    lectures[code as string] || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <Text style={styles.code}>{code}</Text>

        <Text style={styles.title}>
          {course.title}
        </Text>

        <Text style={styles.subtitle}>
          {course.units}
        </Text>

        {currentLectures.map((lectureTitle, index) => (
          <Link
            key={index}
            href={{
              pathname: "/course/lecture/[index]",
              params: {
                index: String(index + 1),
                code,
              },
            }}
            asChild
          >
            <Pressable style={styles.card}>
              <Text style={styles.item}>
                📖 Lecture {index + 1}
              </Text>

              <Text style={styles.small}>
                {lectureTitle}
              </Text>
            </Pressable>
          </Link>
        ))}

        <View style={styles.card}>
          <Text style={styles.item}>📝 Assignments</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.item}>📂 Resources</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.item}>📢 Announcements</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.item}>
            🎥 Recorded Classes (Coming Soon)
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  code: {
    color: "#4DA3FF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 20,
    marginHorizontal: 20,
  },

  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 10,
    marginHorizontal: 20,
  },

  subtitle: {
    color: "#888",
    fontSize: 16,
    marginBottom: 25,
    marginHorizontal: 20,
  },

  card: {
    backgroundColor: "#1C1C1E",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 18,
  },

  item: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  small: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 8,
  },
});