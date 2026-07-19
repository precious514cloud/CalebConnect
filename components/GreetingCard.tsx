import { StyleSheet, Text, View } from "react-native";

export default function GreetingCard() {
  const hour = new Date().getHours();

  let greeting = "👋 Welcome";

  if (hour >= 5 && hour < 12) {
    greeting = "🌅 Good Morning";
  } else if (hour >= 12 && hour < 17) {
    greeting = "☀️ Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    greeting = "🌆 Good Evening";
  } else {
    greeting = "🌙 Burning the Midnight Oil?";
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting}</Text>

      <Text style={styles.name}>
        Precious Ayomide 👋
      </Text>

      <Text style={styles.subtitle}>
        Ready to conquer today's classes? 📚✨
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 25,
  },

  greeting: {
    color: "#4DA3FF",
    fontSize: 18,
    marginBottom: 6,
  },

  name: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "700",
  },

  subtitle: {
    color: "#999",
    marginTop: 8,
    fontSize: 16,
  },
});