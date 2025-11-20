import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/constants/API';
import { TextField } from '@/components/shared/TextField';
import { AuthCard } from '@/components/auth/AuthCard';
import { authLogger } from '@/utils/logger';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailRegistrationScreen() {
  const router = useRouter();
  const { authToken, setAuthToken } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmit = useMemo(() => EMAIL_REGEX.test(normalizedEmail), [normalizedEmail]);

  const handleChangeEmail = useCallback((value: string) => {
    setEmail(value.replace(/\s+/g, ''));
    if (error) setError(null);
  }, [error]);

  const submit = useCallback(async () => {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      authLogger.info('Solicitando código de cadastro por email', { email: normalizedEmail });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${BASE_URL}/auth/email/request-code`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      setAuthToken(data.token);
      router.push({
        pathname: '/email-code',
        params: {
          pendingToken: data.token,
          email: normalizedEmail,
        },
      });
      authLogger.info('Código de cadastro enviado', { email: normalizedEmail });
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao solicitar código de cadastro', {
        email: normalizedEmail,
        error: message,
      });
    } finally {
      setLoading(false);
    }
  }, [authToken, canSubmit, loading, normalizedEmail, router, setAuthToken]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <AuthCard
          title="Criar conta"
          subtitle="Informe um email válido para receber o código de verificação."
        >
          <TextField
            placeholder="email@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            value={email}
            onChangeText={handleChangeEmail}
            error={error ?? undefined}
          />

          <Pressable
            style={[styles.primaryBtn, (!canSubmit || loading) && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color={palette.background} />
            ) : (
              <Text style={styles.primaryBtnText}>Enviar código</Text>
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
    secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
    secondaryBtnText: { color: colors.tint, fontWeight: '600' },
  });
