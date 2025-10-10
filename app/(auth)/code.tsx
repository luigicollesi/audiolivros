// app/(auth)/code.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { BASE_URL } from '@/constants/API';
import { RootState } from '@/store';
import { useAuth } from '@/auth/AuthContext';
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

const CODE_LENGTH = 5;

const sanitizeDigits = (value: string) => value.replace(/\D/g, '');

export default function CodeScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { signIn } = useAuth();

  const pending = useSelector((s: RootState) => s.auth?.pendingPhone);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!pending?.pendingToken || !pending?.machineCode) {
      router.replace('/(auth)/login');
    }
  }, [pending?.pendingToken, pending?.machineCode, router]);

  if (!pending?.pendingToken || !pending?.machineCode) {
    return null;
  }

  const digits = useMemo(() => {
    const arr = new Array(CODE_LENGTH).fill('');
    const safe = sanitizeDigits(code).slice(0, CODE_LENGTH);
    for (let i = 0; i < safe.length; i += 1) {
      arr[i] = safe[i];
    }
    return arr;
  }, [code]);

  const onChangeText = useCallback((value: string) => {
    const sanitized = sanitizeDigits(value).slice(0, CODE_LENGTH);
    setCode(sanitized);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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

  const handleSubmit = useCallback(async () => {
    if (!pending?.pendingToken || !pending?.machineCode) {
      setError('Fluxo expirado. Faça login novamente.');
      router.replace('/(auth)/login');
      return;
    }

    if (code.length !== CODE_LENGTH) {
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
          code,
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

        <Pressable style={styles.codeBoxes} onPress={focusInput}>
          {digits.map((digit, idx) => (
            <View key={idx} style={styles.codeBox}>
              <Text style={styles.codeDigit}>{digit}</Text>
            </View>
          ))}
        </Pressable>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="number-pad"
          value={code}
          onChangeText={onChangeText}
          maxLength={CODE_LENGTH}
          autoFocus
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || code.length !== CODE_LENGTH}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Enviar</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.editPhoneBtn}
          onPress={() => router.replace('/(auth)/phone')}
          disabled={submitting}
        >
          <Text style={styles.editPhoneText}>Corrigir telefone</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20 as any,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  info: { fontSize: 13, textAlign: 'center', color: '#2563eb' },
  codeBoxes: { flexDirection: 'row', gap: 12, marginTop: 12 },
  codeBox: {
    width: 54,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  codeDigit: { fontSize: 24, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  error: { fontSize: 13, color: '#ef4444', textAlign: 'center' },
  submitBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  editPhoneBtn: { marginTop: 8, padding: 8 },
  editPhoneText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
});
