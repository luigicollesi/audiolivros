import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { BASE_URL } from '@/constants/API';
import { RootState } from '@/store';
import { useAuth } from '@/auth/AuthContext';
import { authLogger } from '@/utils/logger';

const COUNTDOWN_SECONDS = 5;

const createMachineCode = () =>
  `terms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function TermsAcceptanceScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ token?: string | string[]; expiresAt?: string | string[] }>();
  const routeToken =
    typeof routeParams.token === 'string'
      ? routeParams.token
      : Array.isArray(routeParams.token)
        ? routeParams.token[0]
        : undefined;
  const routeExpires =
    typeof routeParams.expiresAt === 'string'
      ? routeParams.expiresAt
      : Array.isArray(routeParams.expiresAt)
        ? routeParams.expiresAt[0]
        : undefined;
  const { signIn, authToken, setAuthToken } = useAuth();
  const pendingTerms = useSelector((s: RootState) => s.auth?.pendingTerms);
  const pendingToken = pendingTerms?.pendingToken ?? routeToken ?? '';
  const expiresAtRaw = pendingTerms?.termsPendingTokenExpiresAt ?? routeExpires ?? null;

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  useEffect(() => {
    if (!pendingToken) {
      router.replace('/(auth)/login');
    }
  }, [pendingToken, router]);

  useEffect(() => {
    if (pendingToken) {
      setAuthToken(pendingToken);
    }
  }, [pendingToken, setAuthToken]);

  useEffect(() => {
    setCountdown(COUNTDOWN_SECONDS);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingToken]);

  const expiresAtLabel = useMemo(() => {
    if (!expiresAtRaw) return null;
    const date = new Date(expiresAtRaw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [expiresAtRaw]);

  const canAccept = Boolean(pendingToken) && countdown === 0 && !submitting;

  const handleAccept = useCallback(async () => {
    if (!pendingToken || submitting) return;
    setSubmitting(true);
    setError(null);
    dispatch({ type: 'auth/loginStart' });
    try {
      const res = await fetch(`${BASE_URL}/auth/terms/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ pendingToken }),
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
        dispatch({ type: 'auth/clearPendingTerms' });
        router.replace('/(auth)/phone');
        return;
      }

      if (data?.sessionToken && data?.user) {
        const payload = {
          token: data.sessionToken as string,
          expiresAt: data.expiresAt ?? null,
          user: data.user,
        };
        dispatch({ type: 'auth/loginSuccess', payload });
        await signIn(payload);
        setAuthToken(payload.token);
        authLogger.info('Termos aceitos com sucesso', { email: data?.user?.email });
        router.replace('/(private)');
        return;
      }

      throw new Error('Resposta inesperada ao aceitar os termos.');
    } catch (err: any) {
      const msg = String(err?.message || err);
      setError(msg);
      dispatch({ type: 'auth/loginError', payload: msg });
      authLogger.error('Falha ao aceitar termos', { error: msg });
    } finally {
      setSubmitting(false);
    }
  }, [pendingToken, router, signIn, submitting, dispatch, authToken, setAuthToken]);

  const handleCancel = useCallback(() => {
    dispatch({ type: 'auth/clearPendingTerms' });
    setAuthToken(null);
    router.replace('/(auth)/login');
  }, [dispatch, router, setAuthToken]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: palette.tint }]}>Termos de Uso</Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          Antes de continuar, confirme que está de acordo com os termos de uso e a política de privacidade do Audiolivros.
          Eles descrevem como seus dados são utilizados, quais são as regras de uso do conteúdo e as responsabilidades de cada parte.
        </Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          Ao aceitar, você autoriza o processamento dos dados necessários para funcionamento do aplicativo e declara que usará o conteúdo apenas para fins pessoais, respeitando os direitos dos autores.
        </Text>
        {expiresAtLabel && (
          <Text style={[styles.expiration, { color: palette.text }]}>
            O aceite expira em: {expiresAtLabel}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!pendingToken && (
          <Text style={styles.warning}>
            Não encontramos seu token de aceite. Volte ao login para gerar um novo.
          </Text>
        )}
        <Pressable
          onPress={handleAccept}
          disabled={!canAccept}
          style={[
            styles.acceptButton,
            { backgroundColor: palette.tint },
            !canAccept && styles.acceptButtonDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptButtonText}>
              {countdown > 0 ? `Aceitar em ${countdown}s` : 'Aceito'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={handleCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  expiration: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  footer: {
    padding: 24,
    gap: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
  },
  warning: {
    fontSize: 13,
    opacity: 0.8,
  },
  acceptButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9ca3af',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
