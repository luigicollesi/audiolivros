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
import { useTranslation } from '@/i18n/LanguageContext';

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
  const { t } = useTranslation();

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
          title={t('auth.forgot.passwordTitle')}
          subtitle={email ? t('auth.reset.subtitleEmail', { email }) : undefined}
        >
          <TextField
            placeholder={t('auth.password.placeholder')}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError(null);
            }}
            rightAccessory={
              <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={{ color: palette.tint, fontWeight: '600' }}>
                  {showPassword ? t('auth.password.hide') : t('auth.password.show')}
                </Text>
              </Pressable>
            }
          />
          <TextField
            placeholder={t('auth.password.confirm')}
            secureTextEntry={!showConfirm}
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              if (error) setError(null);
            }}
            error={
              !passwordsMatch && confirm.length > 0
                ? t('auth.password.mismatch')
                : undefined
            }
            rightAccessory={
              <Pressable onPress={() => setShowConfirm((prev) => !prev)}>
                <Text style={{ color: palette.tint, fontWeight: '600' }}>
                  {showConfirm ? t('auth.password.hide') : t('auth.password.show')}
                </Text>
              </Pressable>
            }
          />
          <Text style={styles.hint}>
            {t('auth.password.hint', { min: MIN_PASSWORD_LEN })}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, (!passwordsMatch || loading) && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={!passwordsMatch || loading}
          >
            {loading ? (
              <ActivityIndicator color={palette.background} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t('auth.password.saveAndContinue')}
              </Text>
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
