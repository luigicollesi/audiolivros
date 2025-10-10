// app/_layout.tsx
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/shared/useColorScheme';
import { AuthProvider, useAuth } from '@/auth/AuthContext';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { configureLogger } from '@/utils/logger';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)', // pode manter; Protected decide o acesso
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  useEffect(() => {
    configureLogger({
      AUTH: { levels: { debug: false } },
      BOOKS: { levels: { debug: false } },
      FAVORITES: { levels: { debug: false } },
      SUMMARIES: { levels: { debug: false } },
      AUDIO: { levels: { debug: false } },
    });
  }, []);
  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <Provider store={store}>
      <AuthProvider>
        <SafeAreaProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <GuardedStack />
          </ThemeProvider>
        </SafeAreaProvider>
      </AuthProvider>
    </Provider>
  );
}

function GuardedStack() {
  const { loading, session } = useAuth();
  const authed = !!session?.token;

  // evita recriar objeto a cada render
  const stackOptions = useMemo(() => ({ headerShown: false }), []);

  // enquanto carrega a sessão, não monta o navigator (evita jitter)
  if (loading) return null;

  return (
    <Stack screenOptions={stackOptions}>
      {/* Público só quando não autenticado */}
      <Stack.Protected guard={!authed}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Privado só quando autenticado */}
      <Stack.Protected guard={authed}>
        <Stack.Screen name="(private)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
