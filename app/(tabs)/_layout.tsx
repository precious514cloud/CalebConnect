import { Tabs } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const activeColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="house.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          title: 'Lecture Notes',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="book.closed.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="calendar"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="checkmark.circle.fill"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}