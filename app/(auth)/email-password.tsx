import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';

import { BASE_URL } from '@/constants/API';
import { TextField } from '@/components/shared/TextField';
import { AuthCard } from '@/components/auth/AuthCard';

const MIN_PASSWORD_LEN = 8;

const createMachineCode = () =>
  `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function EmailPasswordScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { registerToken, email } = useLocalSearchParams<{ registerToken?: string; email?: string }>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedRegisterToken = useMemo(
    () => (typeof registerToken === 'string' ? registerToken : null),
    [registerToken]
  );
  const normalizedEmail = useMemo(
    () => (typeof email === 'string' ? email : null),
    [email]
  );
  const trimmedPassword = useMemo(() => password.trim(), [password]);
  const trimmedConfirm = useMemo(() => confirm.trim(), [confirm]);
  const passwordsMatch = useMemo(
    () => trimmedPassword.length >= MIN_PASSWORD_LEN && trimmedPassword === trimmedConfirm,
    [trimmedPassword, trimmedConfirm]
  );

  useEffect(() => {
    if (!normalizedRegisterToken) {
      router.replace('/(auth)/email');
    }
  }, [normalizedRegisterToken, router]);

  const submit = useCallback(async () => {
    if (!normalizedRegisterToken) return;
    if (!passwordsMatch || loading) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/email/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerToken: normalizedRegisterToken,
          password: trimmedPassword,
          name: name.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.pendingToken) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      const machineCode = createMachineCode();
      dispatch({
        type: 'auth/loginRequiresPhone',
        payload: {
          pendingToken: data.pendingToken,
          pendingTokenExpiresAt: data.pendingTokenExpiresAt ?? null,
          machineCode,
        },
      });
      router.replace({
        pathname: '/phone',
      });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [normalizedRegisterToken, passwordsMatch, loading, trimmedPassword, name, dispatch, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <AuthCard
          title="Defina sua senha"
          subtitle={normalizedEmail ? `Email: ${normalizedEmail}` : undefined}
        >
          <TextField
            placeholder="Nome (opcional)"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(null);
            }}
          />
          <TextField
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError(null);
            }}
          />
          <TextField
            placeholder="Confirme a senha"
            secureTextEntry
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              if (error) setError(null);
            }}
            error={!passwordsMatch && confirm.length > 0 ? 'As senhas precisam ser iguais.' : undefined}
          />

          <Text style={styles.hint}>A senha deve ter pelo menos {MIN_PASSWORD_LEN} caracteres.</Text>
          {!passwordsMatch && confirm.length > 0 && (
            <Text style={styles.error}>As senhas precisam ser iguais.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, (!passwordsMatch || loading) && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={!passwordsMatch || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Continuar</Text>
            )}
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Voltar</Text>
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
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { color: '#2563eb', fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
});
