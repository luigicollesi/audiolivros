import { Stack } from 'expo-router';

export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="phone"
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="delete"
        options={{
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
