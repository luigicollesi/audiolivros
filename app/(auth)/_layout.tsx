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
      {/* outras telas públicas */}
    </Stack>
  );
}
