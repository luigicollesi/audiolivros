// app/(private)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useSoundFx } from '@/features/sound/SoundProvider';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { skipNextClick } = useSoundFx();
  const insets = useSafeAreaInsets();
  const tabPadding = Math.max(insets.bottom - 8, 0);

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
          paddingBottom: tabPadding,
          paddingTop: 8,
          overflow: 'visible',
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
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPressIn={(e) => {
                skipNextClick();
                props.onPressIn?.(e);
              }}
            >
              {props.children}
            </Pressable>
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
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPressIn={(e) => {
                skipNextClick();
                props.onPressIn?.(e);
              }}
            >
              {props.children}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          //tabBarStyle: { display: 'none' },
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="person-outline"
              size={focused ? 26 : 22}
              color={focused ? (scheme === 'dark' ? palette.secondary : palette.tint) : palette.tabIconDefault}
              style={{ marginBottom: focused ? 6 : 0 }}
            />
          ),
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPressIn={(e) => {
                skipNextClick();
                props.onPressIn?.(e);
              }}
            >
              {props.children}
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
