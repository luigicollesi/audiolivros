// app/(private)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: palette.detail ?? palette.border,
          height: 74,
          paddingHorizontal: 24,
        },
        tabBarItemStyle: { paddingVertical: 6 },
      }}
    >
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="library-outline"
              size={focused ? 26 : 22}
              color={focused ? (scheme === 'dark' ? palette.secondary : palette.tint) : palette.tabIconDefault}
              style={{ marginBottom: focused ? 6 : 0 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="search-outline"
              size={focused ? 26 : 22}
              color={focused ? (scheme === 'dark' ? palette.secondary : palette.tint) : palette.tabIconDefault}
              style={{ marginBottom: focused ? 6 : 0 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="person-outline"
              size={focused ? 26 : 22}
              color={focused ? (scheme === 'dark' ? palette.secondary : palette.tint) : palette.tabIconDefault}
              style={{ marginBottom: focused ? 6 : 0 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
