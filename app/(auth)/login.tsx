// app/(auth)/login.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppleLoginButton, GoogleLoginButton, MicrosoftLoginButton } from '@/components/auth';
import { useAuth } from '@/auth/AuthContext';
import { RootState } from '@/store';
import { BASE_URL } from '@/constants/API';
import { authLogger } from '@/utils/logger';

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

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
      authLogger.info('Sessão provider concluída', {
        email: payload.user.email,
        expiresAt: payload.expiresAt,
      });
      await completeLogin(payload);
    },
    [completeLogin]
  );

  const handleRequiresPhone = useCallback(
    (payload: PendingPhonePayload) => {
      authLogger.info('Login requer verificação de telefone', {
        pendingToken: payload.pendingToken,
      });
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
      authLogger.error('Erro nos providers de login', { message });
      dispatch({ type: 'auth/loginError', payload: message });
    },
    [dispatch]
  );

  const handleLoadingChange = useCallback(
    (isLoading: boolean) => {
      if (isLoading) {
        authLogger.debug('Iniciando autenticação via provider');
        dispatch({ type: 'auth/loginStart' });
      }
    },
    [dispatch]
  );

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmitEmail = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) && password.trim().length >= 8;
  }, [normalizedEmail, password]);

  const submitEmailLogin = useCallback(async () => {
    if (!canSubmitEmail || localLoading) return;
    setLocalError(null);
    setLocalLoading(true);
    dispatch({ type: 'auth/loginStart' });
    try {
      authLogger.info('Tentando login com email/senha', { email: normalizedEmail });
      const res = await fetch(`${BASE_URL}/auth/email/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password: password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      if (data?.requiresPhone && data?.pendingToken) {
        const machineCode = createMachineCode();
        dispatch({
          type: 'auth/loginRequiresPhone',
          payload: {
            pendingToken: data.pendingToken,
            pendingTokenExpiresAt: data.pendingTokenExpiresAt ?? null,
            machineCode,
          },
        });
        router.replace('/(auth)/phone');
        return;
      }

      if (!data?.sessionToken || !data?.user) {
        throw new Error('Resposta inválida do servidor.');
      }

      await completeLogin({
        token: data.sessionToken,
        expiresAt: data.expiresAt ?? null,
        user: data.user,
      });
      authLogger.info('Login com email bem-sucedido', { email: normalizedEmail });
      setEmail('');
      setPassword('');
    } catch (err: any) {
      const msg = String(err?.message || err);
      setLocalError(msg);
      dispatch({ type: 'auth/loginError', payload: msg });
      authLogger.error('Falha no login com email', { email: normalizedEmail, error: msg });
    } finally {
      setLocalLoading(false);
    }
  }, [canSubmitEmail, localLoading, email, password, completeLogin, dispatch, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bem-vindo</Text>
          <Text style={styles.subtitle}>Entre para continuar</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Entrar com email e senha</Text>
            <TextInput
              style={styles.input}
              placeholder="email@exemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (localError) setLocalError(null);
              }}
            />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (localError) setLocalError(null);
            }}
          />
          <Pressable style={styles.linkRight} onPress={() => router.push('/(auth)/forgot-email')}>
            <Text style={styles.linkRightText}>Esqueci minha senha</Text>
          </Pressable>
          {localError && <Text style={styles.error}>{localError}</Text>}
            <Pressable
              style={[styles.primaryBtn, (!canSubmitEmail || localLoading) && styles.primaryBtnDisabled]}
              onPress={submitEmailLogin}
              disabled={!canSubmitEmail || localLoading}
            >
              {localLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Entrar</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => router.push('/(auth)/email')}
            >
              <Text style={styles.secondaryBtnText}>Criar conta com email</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.providers}>
            {Platform.OS === 'ios' && (
              <AppleLoginButton
                onSession={handleSession}
                onRequiresPhone={handleRequiresPhone}
                onError={handleError}
                onLoadingChange={handleLoadingChange}
              />
            )}

            <GoogleLoginButton
              onSession={handleSession}
              onRequiresPhone={handleRequiresPhone}
              onError={handleError}
              onLoadingChange={handleLoadingChange}
            />

            {(Platform.OS === 'ios' || Platform.OS === 'android') && (
              <MicrosoftLoginButton
                onSession={handleSession}
                onRequiresPhone={handleRequiresPhone}
                onError={handleError}
                onLoadingChange={handleLoadingChange}
              />
            )}
          </View>

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
  formCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    gap: 12 as any,
  },
  formTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  linkRight: { alignSelf: 'flex-end' },
  linkRightText: { color: '#2563eb', fontSize: 12, fontWeight: '600' },
  primaryBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondaryBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 16,
  },
  providers: {
    width: '100%',
    gap: 12,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#d1d5db' },
  dividerText: { fontSize: 12, color: '#6b7280' },
  loadingRow: { alignItems: 'center', marginTop: 8 },
  loadingText: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  footer: { width: '100%', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
  error: { color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
