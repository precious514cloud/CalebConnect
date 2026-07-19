import { useLocalSearchParams } from "expo-router";
import { Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function LectureScreen() {
  const { index } = useLocalSearchParams();

  const openPdf = async () => {
    // Temporary test link
    // We will replace this with the local PDF connection next
    await Linking.openURL("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📖 {index}</Text>

      <View style={styles.card}>
        <Text style={styles.content}>
          Your lecture PDF is ready.
        </Text>

        <Pressable style={styles.button} onPress={openPdf}>
          <Text style={styles.buttonText}>📄 Open Lecture Notes</Text>
        </Pressable>
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
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 18,
  },

  content: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 20,
  },

  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});