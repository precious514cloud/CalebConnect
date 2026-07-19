import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function TimetableScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📅 Class Timetable</Text>

      <View style={styles.card}>
        <Text style={styles.course}>COS102</Text>
        <Text style={styles.time}>9:00 AM - 11:00 AM</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.course}>GST112</Text>
        <Text style={styles.time}>12:00 PM - 2:00 PM</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.course}>PHY102</Text>
        <Text style={styles.time}>3:00 PM - 5:00 PM</Text>
      </View>
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
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 25,
  },

  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },

  course: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  time: {
    color: "#9E9E9E",
    marginTop: 8,
    fontSize: 15,
  },
});