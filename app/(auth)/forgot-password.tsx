import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';

import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/constants/API';
import { TextField } from '@/components/shared/TextField';
import { AuthCard } from '@/components/auth/AuthCard';
import { authLogger } from '@/utils/logger';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

const MIN_PASSWORD_LEN = 8;
const createMachineCode = () => `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { authToken, setAuthToken } = useAuth();
  const params = useLocalSearchParams<{ resetToken?: string; email?: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette), [palette]);

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
      authLogger.info('Salvando nova senha', { email, resetToken });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${BASE_URL}/auth/email/reset/confirm`, {
        method: 'POST',
        headers,
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
        setAuthToken(data.pendingToken);
        dispatch({
          type: 'auth/loginRequiresPhone',
          payload: {
            pendingToken: data.pendingToken,
            pendingTokenExpiresAt: data.pendingTokenExpiresAt ?? null,
            machineCode,
          },
        });
        authLogger.info('Senha redefinida, aguardando telefone', { email });
      }

      if (!data?.requiresPhone) {
        setAuthToken(null);
      }

      router.replace('/(auth)/login');
      authLogger.info('Senha redefinida com sucesso', { email });
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao redefinir senha', { email, error: message });
    } finally {
      setLoading(false);
    }
  }, [
    resetToken,
    passwordsMatch,
    loading,
    trimmedPassword,
    dispatch,
    router,
    authToken,
    setAuthToken,
  ]);

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
            {loading ? (
              <ActivityIndicator color={palette.background} />
            ) : (
              <Text style={styles.primaryBtnText}>Salvar e continuar</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>Voltar</Text>
          </Pressable>
        </AuthCard>
      </View>
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
      backgroundColor: colors.background,
    },
    hint: { fontSize: 12, color: colors.text, opacity: 0.7, textAlign: 'center' },
    primaryBtn: {
      marginTop: 4,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: colors.background, fontWeight: '700', fontSize: 16 },
    linkBtn: { paddingVertical: 10, alignItems: 'center' },
    linkText: { color: colors.tint, fontWeight: '600' },
    error: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  });
