import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';

import { BASE_URL } from '@/constants/API';
import { TextField } from '@/components/shared/TextField';
import { AuthCard } from '@/components/auth/AuthCard';

const MIN_PASSWORD_LEN = 8;
const createMachineCode = () => `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ resetToken?: string; email?: string }>();

  const [resetToken] = useState<string | null>(() =>
    typeof params.resetToken === 'string' ? params.resetToken : null
  );
  const [email] = useState<string | null>(() =>
    typeof params.email === 'string' ? params.email : null
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resetToken) {
      router.replace('/(auth)/forgot-email');
    }
  }, [resetToken, router]);

  const trimmedPassword = useMemo(() => password.trim(), [password]);
  const trimmedConfirm = useMemo(() => confirm.trim(), [confirm]);
  const passwordsMatch = useMemo(
    () => trimmedPassword.length >= MIN_PASSWORD_LEN && trimmedPassword === trimmedConfirm,
    [trimmedPassword, trimmedConfirm]
  );

  const submit = useCallback(async () => {
    if (!resetToken || !passwordsMatch || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/email/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          password: trimmedPassword,
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
      }

      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [resetToken, passwordsMatch, loading, trimmedPassword, dispatch, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <AuthCard
          title="Defina sua nova senha"
          subtitle={email ? `Email: ${email}` : undefined}
        >
          <TextField
            placeholder="Nova senha"
            secureTextEntry
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError(null);
            }}
          />
          <TextField
            placeholder="Confirme a nova senha"
            secureTextEntry
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              if (error) setError(null);
            }}
            error={!passwordsMatch && confirm.length > 0 ? 'As senhas precisam ser iguais.' : undefined}
          />
          <Text style={styles.hint}>A senha deve ter pelo menos {MIN_PASSWORD_LEN} caracteres.</Text>
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, (!passwordsMatch || loading) && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={!passwordsMatch || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Salvar e continuar</Text>}
          </Pressable>

          <Pressable style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>Voltar</Text>
          </Pressable>
        </AuthCard>
      </View>
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
    backgroundColor: '#f9fafb',
  },
  hint: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  primaryBtn: {
    marginTop: 4,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
  linkText: { color: '#2563eb', fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
});
