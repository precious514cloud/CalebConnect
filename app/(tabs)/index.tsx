import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import GreetingCard from "../../components/GreetingCard";
import QuickTools from "../../components/QuickTools";
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <GreetingCard />

      <View style={styles.card}>
        <Text style={styles.title}>Caleb Connect</Text>

        <Text style={styles.subtitle}>
        Study Smarter. Stay Connected
        </Text>
      </View>
      <QuickTools />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 24,
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#1C1C1E",
    padding: 30,
    borderRadius: 30,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },

  subtitle: {
    color: "#bbb",
    fontSize: 16,
    marginTop: 12,
  },
});