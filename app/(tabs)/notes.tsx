import { Link } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";

export default function NotesScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
  <ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={{
    padding: 20,
    paddingBottom: 120,
  }}
  showsVerticalScrollIndicator={true}
>

      <Text style={styles.title}>📚 Lecture Notes</Text>
      <Text style={styles.subtitle}>
        Second Semester Courses
      </Text>

      <Link
  href={{
    pathname: "/course/[code]",
    params: { code: "COS102" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>COS102</Text>
    <Text style={styles.course}>Problem Solving</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "CUL-CSC172" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>CUL-CSC172</Text>
    <Text style={styles.course}>Data Mining & Warehousing</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "CUL-CSC176" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>CUL-CSC176</Text>
    <Text style={styles.course}>Introduction to Web Design</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "CUL-CSC178" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>CUL-CSC178</Text>
    <Text style={styles.course}>Basic Electronics</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "GST104" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>GST104</Text>
    <Text style={styles.course}>Tech Plus I</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "GST112" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>GST112</Text>
    <Text style={styles.course}>Nigerian Peoples and Culture</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "MTH102" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>MTH102</Text>
    <Text style={styles.course}>Elementary Mathematics II</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "PHY102" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>PHY102</Text>
    <Text style={styles.course}>General Physics II</Text>
  </Pressable>
</Link>

<Link
  href={{
    pathname: "/course/[code]",
    params: { code: "PHY108" },
  }}
  asChild
>
  <Pressable style={styles.card}>
    <Text style={styles.code}>PHY108</Text>
    <Text style={styles.course}>General Practical Physics II</Text>
  </Pressable>
</Link>

</ScrollView>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },

  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 15,
  },

  subtitle: {
    color: "#888",
    fontSize: 16,
    marginBottom: 25,
  },

  card: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 18,
    marginBottom: 15,
  },

  code: {
    color: "#4DA3FF",
    fontSize: 18,
    fontWeight: "700",
  },

  course: {
    color: "#fff",
    marginTop: 6,
    fontSize: 16,
  },
});