// app/(auth)/login.tsx
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useAuth } from '@/auth/AuthContext';
import { RootState } from '@/store';

type SessionPayload = {
  token: string;
  expiresAt?: string | null;
  user: {
    email: string;
    name: string | null;
    phone?: string | null;
    language?: string | null;
    genre?: string | null;
  };
};

type PendingPhonePayload = {
  pendingToken: string;
  pendingTokenExpiresAt?: string | null;
};

const createMachineCode = () =>
  `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function LoginScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { signIn } = useAuth();

  const loading = useSelector((s: RootState) => Boolean(s.auth?.loading));
  const error = useSelector((s: RootState) => s.auth?.error ?? null);
  const pendingPhone = useSelector((s: RootState) => s.auth?.pendingPhone);

  useEffect(() => {
    if (pendingPhone?.pendingToken) {
      router.replace('/(auth)/phone');
    }
  }, [pendingPhone?.pendingToken, router]);

  const completeLogin = useCallback(
    async (payload: SessionPayload) => {
      dispatch({ type: 'auth/loginSuccess', payload });
      await signIn({
        token: payload.token,
        expiresAt: payload.expiresAt,
        user: payload.user,
      });
    },
    [dispatch, signIn]
  );

  const handleSession = useCallback(
    async (payload: SessionPayload) => {
      console.log('[Auth] Sessão completa, entrando no app.');
      await completeLogin(payload);
    },
    [completeLogin]
  );

  const handleRequiresPhone = useCallback(
    (payload: PendingPhonePayload) => {
      const machineCode = createMachineCode();
      dispatch({
        type: 'auth/loginRequiresPhone',
        payload: {
          pendingToken: payload.pendingToken,
          pendingTokenExpiresAt: payload.pendingTokenExpiresAt,
          machineCode,
        },
      });
      router.replace('/(auth)/phone');
    },
    [dispatch, router]
  );

  const handleError = useCallback(
    (message: string) => {
      dispatch({ type: 'auth/loginError', payload: message });
    },
    [dispatch]
  );

  const handleLoadingChange = useCallback(
    (isLoading: boolean) => {
      if (isLoading) {
        dispatch({ type: 'auth/loginStart' });
      }
    },
    [dispatch]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bem-vindo</Text>
          <Text style={styles.subtitle}>Entre para continuar</Text>
        </View>

        <View style={styles.body}>
          <GoogleLoginButton
            onSession={handleSession}
            onRequiresPhone={handleRequiresPhone}
            onError={handleError}
            onLoadingChange={handleLoadingChange}
          />

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Autenticando…</Text>
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ao continuar, você concorda com nossos Termos e Política de Privacidade.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  header: { width: '100%', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  body: { width: '100%', gap: 16 as any, alignItems: 'center' },
  loadingRow: { alignItems: 'center', marginTop: 8 },
  loadingText: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  footer: { width: '100%', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
  error: { color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
