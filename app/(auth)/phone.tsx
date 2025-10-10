// app/(auth)/phone.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/constants/API';
import { RootState } from '@/store';
import { authLogger } from '@/utils/logger';

const DEFAULT_LANGUAGE = 'pt-BR';

const sanitizeDigits = (value: string, max: number) =>
  value.replace(/\D/g, '').slice(0, max);

export default function PhoneScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { session } = useAuth();

  const pending = useSelector((s: RootState) => s.auth?.pendingPhone);
  const globalError = useSelector((s: RootState) => s.auth?.error ?? null);

  const [ddd, setDdd] = useState('');
  const [number, setNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    pending ? 'Precisamos confirmar seu telefone para liberar o acesso.' : null
  );

  const language = useMemo(() => {
    const preference =
      typeof session?.user?.language === 'string'
        ? session.user.language.trim()
        : '';
    return preference || DEFAULT_LANGUAGE;
  }, [session?.user?.language]);

  useEffect(() => {
    if (!pending) {
      router.replace('/(auth)/login');
    }
  }, [pending, router]);

  if (!pending) {
    return null;
  }

  const onChangeDDD = useCallback((value: string) => {
    const digits = sanitizeDigits(value, 2);
    setDdd(digits);
  }, []);

  const onChangeNumber = useCallback((value: string) => {
    const digits = sanitizeDigits(value, 9);
    const withHyphen = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setNumber(withHyphen);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!pending?.pendingToken || !pending?.machineCode) {
      setError('Fluxo expirado. Faça login novamente.');
      router.replace('/(auth)/login');
      return;
    }

    const sanitizedDDD = sanitizeDigits(ddd, 2);
    const digits = sanitizeDigits(number, 9);

    if (sanitizedDDD.length !== 2) {
      setError('Informe o DDD com 2 dígitos.');
      return;
    }
    if (digits.length !== 9) {
      setError('Informe o telefone no formato XXXXX-XXXX.');
      return;
    }

    setError(null);
    setInfo(null);
    setSubmitting(true);

    const fullPhone = `+55${sanitizedDDD}${digits}`;

    try {
      authLogger.info('Solicitando código de telefone', {
        phone: fullPhone,
      });
      const res = await fetch(`${BASE_URL}/auth/phone/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken: pending.pendingToken,
          machineCode: pending.machineCode,
          phone: fullPhone,
          language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      dispatch({
        type: 'auth/phoneRequestSuccess',
        payload: { phone: fullPhone, ddd: sanitizedDDD },
      });
      setInfo('Enviamos um código de 5 dígitos para o número informado.');
      authLogger.info('Código de telefone enviado com sucesso', {
        phone: fullPhone,
      });
      router.replace('/(auth)/code');
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao solicitar código de telefone', {
        phone: fullPhone,
        error: message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [pending?.pendingToken, pending?.machineCode, ddd, number, dispatch, router, language]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Confirme seu telefone</Text>
          <Text style={styles.subtitle}>
            Informe seu número com DDD para proteger sua conta.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+55</Text>
          </View>
          <TextInput
            style={[styles.dddInput, styles.textInput]}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="DD"
            value={ddd}
            onChangeText={onChangeDDD}
          />
          <TextInput
            style={[styles.phoneInput, styles.textInput]}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="XXXXX-XXXX"
            value={number}
            onChangeText={onChangeNumber}
          />
        </View>

        {info && <Text style={styles.info}>{info}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {globalError && <Text style={styles.error}>{globalError}</Text>}

        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Enviar código</Text>
          )}
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
    gap: 24 as any,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  header: { gap: 8 as any, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countryCode: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  countryCodeText: { fontSize: 16, fontWeight: '600' },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
  },
  dddInput: { width: 70, textAlign: 'center' },
  phoneInput: { flex: 1 },
  info: { fontSize: 13, textAlign: 'center', color: '#2563eb' },
  error: { fontSize: 13, color: '#ef4444', textAlign: 'center' },
  submitBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
