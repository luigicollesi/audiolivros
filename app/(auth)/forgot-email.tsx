import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BASE_URL } from '@/constants/API';
import { TextField } from '@/components/shared/TextField';
import { AuthCard } from '@/components/auth/AuthCard';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotEmailScreen() {
  const router = useRouter();
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
      const res = await fetch(`${BASE_URL}/auth/email/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      router.push({
        pathname: '/forgot-code',
        params: { pendingToken: data.token, email: normalizedEmail },
      });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [canSubmit, loading, normalizedEmail, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <AuthCard
          title="Redefinir senha"
          subtitle="Informe seu email para receber um código de verificação."
        >
          <TextField
            placeholder="email@exemplo.com"
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Enviar código</Text>}
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
});
