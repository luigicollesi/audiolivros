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
import { useTranslation } from '@/i18n/LanguageContext';
import { getTimezoneInfo } from '@/utils/timezone';

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
  const { t } = useTranslation();

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
      const tz = getTimezoneInfo();
      const res = await fetch(`${BASE_URL}/auth/terms/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          'x-timezone': tz.timezone,
          'x-tz-offset': String(tz.offsetMinutes),
        },
        body: JSON.stringify({
          pendingToken,
          timezone: tz.timezone,
          timezoneOffset: tz.offsetMinutes,
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
        <Text style={[styles.title, { color: palette.tint }]}>{t('auth.terms.title')}</Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          {t('auth.terms.paragraph1')}
        </Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          {t('auth.terms.paragraph2')}
        </Text>
        {expiresAtLabel && (
          <Text style={[styles.expiration, { color: palette.text }]}>
            {t('auth.terms.expiresAt', { label: expiresAtLabel })}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!pendingToken && (
          <Text style={styles.warning}>
            {t('auth.terms.missingToken')}
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
              {countdown > 0
                ? t('auth.terms.acceptIn', { seconds: countdown })
                : t('auth.terms.accept')}
            </Text>
            )}
        </Pressable>

        <Pressable onPress={handleCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{t('auth.terms.cancel')}</Text>
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
