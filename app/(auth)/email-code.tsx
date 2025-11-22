import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/constants/API';
import { CodeVerificationView } from '@/components/auth/CodeVerificationView';
import { authLogger } from '@/utils/logger';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useTranslation } from '@/i18n/LanguageContext';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 45;

export default function EmailCodeScreen() {
  const router = useRouter();
  const { authToken, setAuthToken } = useAuth();
  const params = useLocalSearchParams<{ pendingToken?: string; email?: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { t } = useTranslation();

  const [pendingToken, setPendingToken] = useState<string | null>(() =>
    typeof params.pendingToken === 'string' ? params.pendingToken : null
  );
  const [email] = useState<string | null>(() =>
    typeof params.email === 'string' ? params.email : null
  );
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingToken || !email) {
      router.replace('/(auth)/email');
    }
  }, [pendingToken, email, router]);

  useEffect(() => {
    if (pendingToken) {
      setAuthToken(pendingToken);
    }
  }, [pendingToken, setAuthToken]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const subtitle = useMemo(
    () =>
      email
        ? t('auth.verifyEmail.subtitleWithEmail', { email })
        : t('auth.verifyEmail.subtitleGeneric'),
    [email, t],
  );

  const submit = useCallback(async () => {
    if (!pendingToken || !email || code.length !== CODE_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      authLogger.info('Verificando código de email', { email, pendingToken });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${BASE_URL}/auth/email/verify-code`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.registerToken) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      router.push({
        pathname: '/email-password',
        params: { registerToken: data.registerToken, email },
      });
      authLogger.info('Código de email validado', { email });
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao validar código de email', { email, error: message });
    } finally {
      setLoading(false);
    }
  }, [pendingToken, email, code, router, authToken]);

  const resendCode = useCallback(async () => {
    if (!email || resendCooldown > 0 || resendLoading) return;
    setError(null);
    setResendLoading(true);
    try {
      authLogger.info('Solicitando reenvio de código de email', { email });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${BASE_URL}/auth/email/request-code`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }
      setPendingToken(data.token);
      setAuthToken(data.token);
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      router.setParams?.({ pendingToken: data.token, email });
      authLogger.info('Código de email reenviado', { email });
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao reenviar código de email', { email, error: message });
    } finally {
      setResendLoading(false);
    }
  }, [email, resendCooldown, resendLoading, router, authToken, setAuthToken]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <CodeVerificationView
          code={code}
          setCode={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          title={t('auth.verifyEmail.title')}
          subtitle={subtitle}
          loading={loading}
          error={error}
          codeLength={CODE_LENGTH}
          onSubmit={submit}
          submitLabel={t('auth.common.confirm')}
          onBack={() => router.back()}
          secondActionLabel={
            resendCooldown > 0
              ? t('auth.common.resendIn', { seconds: resendCooldown })
              : t('auth.common.resendCode')
          }
          onSecondAction={resendCode}
          secondActionDisabled={resendCooldown > 0 || resendLoading}
        />
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
  });
