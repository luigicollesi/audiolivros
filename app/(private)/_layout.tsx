// app/(private)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const activeIconColor = scheme === 'dark' ? palette.secondary : palette.tint;

  const renderIcon = (
    name: keyof typeof Ionicons.glyphMap,
    focused: boolean,
    options?: { elevate?: boolean },
  ) => {
    const color = focused ? activeIconColor : palette.tabIconDefault;
    const size = focused ? 26 : 22;
    if (options?.elevate) {
      return (
        <View
          style={[
            styles.centerIconWrapper,
            {
              backgroundColor: focused ? (scheme === 'dark' ? palette.bookCard : palette.bookCard) : palette.bookCard,
              borderColor: palette.detail ?? palette.border,
              transform: [{ translateY: focused ? -12 : -6 }],
            },
          ]}
        >
          <Ionicons name={name} size={size} color={color} />
        </View>
      );
    }

    return (
      <Ionicons
        name={name}
        size={size}
        color={focused ? activeIconColor : palette.tabIconDefault}
        style={{ marginBottom: focused ? 6 : 0 }}
      />
    );
  };

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
          tabBarIcon: ({ focused }) => renderIcon('library-outline', focused),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => renderIcon('search-outline', focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => renderIcon('person-outline', focused),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerIconWrapper: {
    padding: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
