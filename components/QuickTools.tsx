import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function QuickTools() {
  return (
    <View style={styles.container}>

      <View style={styles.row}>

      <Link href="/notes" asChild>
  <Pressable style={styles.card}>
    <Ionicons
      name="book-outline"
      size={34}
      color="white"
    />
    <Text style={styles.text}>Lecture Notes</Text>
  </Pressable>
</Link> 

        <View style={styles.card}>
          <Ionicons
            name="calendar-outline"
            size={34}
            color="white"
          />
          <Text style={styles.text}>Timetable</Text>
        </View>

      </View>

      <View style={styles.row}>

        <View style={styles.card}>
          <Ionicons
            name="calculator-outline"
            size={34}
            color="white"
          />
          <Text style={styles.text}>GPA</Text>
        </View>

        <View style={styles.card}>
          <Ionicons
            name="document-text-outline"
            size={34}
            color="white"
          />
          <Text style={styles.text}>Past Questions</Text>
        </View>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  card: {
    backgroundColor: "#1C1C1E",
    width: "48%",
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
  },

  text: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
});