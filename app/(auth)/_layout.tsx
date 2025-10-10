// app/(auth)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (session?.token) return <Redirect href="/(private)" />;

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
    </Stack>
  );
}
