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
import { useTranslation } from '@/i18n/LanguageContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotEmailScreen() {
  const router = useRouter();
  const { authToken, setAuthToken } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmit = useMemo(() => EMAIL_REGEX.test(normalizedEmail), [normalizedEmail]);

  const handleChange = useCallback((value: string) => {
    setEmail(value.replace(/\s+/g, ''));
    if (error) setError(null);
  }, [error]);

  const submit = useCallback(async () => {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      authLogger.info('Solicitando código de redefinição de senha', { email: normalizedEmail });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${BASE_URL}/auth/email/reset/request`, {
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
        pathname: '/forgot-code',
        params: { pendingToken: data.token, email: normalizedEmail },
      });
      authLogger.info('Código de redefinição enviado', { email: normalizedEmail });
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao solicitar código de redefinição', {
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
          title={t('auth.forgot.title')}
          subtitle={t('auth.forgot.subtitle')}
        >
          <TextField
            placeholder={t('auth.common.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={handleChange}
            error={error}
          />

          <Pressable
            style={[styles.primaryBtn, (!canSubmit || loading) && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color={palette.background} />
            ) : (
              <Text style={styles.primaryBtnText}>{t('auth.common.sendCode')}</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>{t('auth.common.back')}</Text>
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
    linkBtn: { paddingVertical: 10, alignItems: 'center' },
    linkText: { color: colors.tint, fontWeight: '600' },
  });
