import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BASE_URL } from '@/constants/API';
import { CodeVerificationView } from '@/components/auth/CodeVerificationView';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 45;

export default function ForgotCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pendingToken?: string; email?: string }>();

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
      router.replace('/(auth)/forgot-email');
    }
  }, [pendingToken, email, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const submit = useCallback(async () => {
    if (!pendingToken || !email || code.length !== CODE_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/email/reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.resetToken) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      router.push({
        pathname: '/forgot-password',
        params: { resetToken: data.resetToken, email },
      });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [pendingToken, email, code, router]);

  const resendCode = useCallback(async () => {
    if (!email || resendCooldown > 0 || resendLoading) return;
    setError(null);
    setResendLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/email/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }
      setPendingToken(data.token);
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      router.setParams?.({ pendingToken: data.token, email });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setResendLoading(false);
    }
  }, [email, resendCooldown, resendLoading, router]);

  const subtitle = useMemo(() => (
    email ? `Digite o código enviado para\n${email}` : 'Digite o código enviado ao seu email.'
  ), [email]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <CodeVerificationView
          code={code}
          setCode={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          title="Verifique seu email"
          subtitle={subtitle}
          loading={loading}
          error={error}
          codeLength={CODE_LENGTH}
          onSubmit={submit}
          submitLabel="Confirmar"
          onBack={() => router.back()}
          secondActionLabel={resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : 'Reenviar código'}
          onSecondAction={resendCode}
          secondActionDisabled={resendCooldown > 0 || resendLoading}
        />
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
});
