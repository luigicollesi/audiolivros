// app/(auth)/code.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { BASE_URL } from '@/constants/API';
import { RootState } from '@/store';
import { useAuth } from '@/auth/AuthContext';
import { authLogger } from '@/utils/logger';
import { CodeVerificationView } from '@/components/auth/CodeVerificationView';

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

const CODE_LENGTH = 5;

const sanitizeDigits = (value: string) => value.replace(/\D/g, '');

export default function CodeScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { signIn } = useAuth();
  const pending = useSelector((s: RootState) => s.auth?.pendingPhone);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pending?.pendingToken || !pending?.machineCode) {
      router.replace('/(auth)/login');
    }
  }, [pending?.pendingToken, pending?.machineCode, router]);

  if (!pending?.pendingToken || !pending?.machineCode) {
    return null;
  }

  const completeLogin = useCallback(
    async (payload: SessionPayload) => {
      dispatch({ type: 'auth/loginSuccess', payload });
      await signIn({
        token: payload.token,
        expiresAt: payload.expiresAt,
        user: payload.user,
      });
    },
    [dispatch, signIn],
  );

  const handleSubmit = useCallback(async () => {
    if (!pending?.pendingToken || !pending?.machineCode) {
      setError('Fluxo expirado. Faça login novamente.');
      router.replace('/(auth)/login');
      return;
    }

    const sanitized = sanitizeDigits(code).slice(0, CODE_LENGTH);
    if (sanitized.length !== CODE_LENGTH) {
      setError('Digite os 5 dígitos do código.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      authLogger.info('Validando código de telefone', {
        pendingToken: pending.pendingToken,
      });
      const res = await fetch(`${BASE_URL}/auth/phone/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken: pending.pendingToken,
          machineCode: pending.machineCode,
          code: sanitized,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      const { sessionToken, expiresAt, user } = data as {
        sessionToken: string;
        expiresAt?: string | null;
        user: SessionPayload['user'];
      };
      if (!sessionToken || !user) {
        throw new Error('Resposta inválida do servidor.');
      }

      await completeLogin({
        token: sessionToken,
        expiresAt,
        user,
      });
      authLogger.info('Telefone confirmado, login concluído', {
        email: user.email,
      });
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao validar código de telefone', {
        error: message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [pending?.pendingToken, pending?.machineCode, code, router, completeLogin]);

  const phoneLabel = useMemo(() => {
    if (!pending?.phone) return null;
    const rawDigits = pending.phone.replace(/^\+55/, '');
    const ddd = rawDigits.slice(0, 2);
    const phoneDigits = rawDigits.slice(2);
    const pretty =
      phoneDigits.length === 9
        ? `${phoneDigits.slice(0, 5)}-${phoneDigits.slice(5)}`
        : phoneDigits;
    return `Enviamos para (+55) ${ddd} ${pretty}`;
  }, [pending?.phone]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Digite o código</Text>
        <Text style={styles.subtitle}>
          Insira os 5 dígitos recebidos para concluir sua autenticação.
        </Text>
        {phoneLabel && <Text style={styles.info}>{phoneLabel}</Text>}

        <View style={styles.verificationWrapper}>
          <CodeVerificationView
            code={code}
            setCode={(value) => {
              setCode(sanitizeDigits(value).slice(0, CODE_LENGTH));
              if (error) setError(null);
            }}
            title=""
            subtitle=""
            loading={submitting}
            error={error}
            codeLength={CODE_LENGTH}
            onSubmit={handleSubmit}
            submitLabel="Confirmar"
            onBack={() => {
              if (!submitting) router.replace('/(auth)/phone');
            }}
            backLabel="Corrigir telefone"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      backgroundColor: colors.background,
    },
    title: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.text },
    subtitle: { fontSize: 14, color: colors.text, opacity: 0.7, textAlign: 'center' },
    info: { fontSize: 13, textAlign: 'center', color: colors.tint },
    verificationWrapper: { alignSelf: 'stretch' },
  });
