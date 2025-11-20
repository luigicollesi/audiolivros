// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="email" />
      <Stack.Screen name="email-code" />
      <Stack.Screen name="email-password" />
      <Stack.Screen name="forgot-email" />
      <Stack.Screen name="forgot-code" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="code" />
      <Stack.Screen name="terms-accept" />
    </Stack>
  );
}
