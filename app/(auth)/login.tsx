// app/(auth)/login.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppleLoginButton, GoogleLoginButton, MicrosoftLoginButton } from '@/components/auth';
import { PendingTermsPayload } from '@/components/auth/ProviderLoginButton';
import { useAuth } from '@/auth/AuthContext';
import { RootState } from '@/store';
import { BASE_URL } from '@/constants/API';
import { authLogger } from '@/utils/logger';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatLanguageLabel } from '@/i18n/translations';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

type SessionPayload = {
  token: string;
  expiresAt?: string | null;
  user: {
    email: string;
    name: string | null;
    phone?: string | null;
    language?: string | null;
    genre?: string | null;
  };
};

type PendingPhonePayload = {
  pendingToken: string;
  pendingTokenExpiresAt?: string | null;
};

const createMachineCode = () =>
  `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function LoginScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { signIn, authToken, setAuthToken } = useAuth();
  const { language, setLanguage, availableLanguages, t } = useTranslation();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';
  const [languagePopoverVisible, setLanguagePopoverVisible] = useState(false);

  const loading = useSelector((s: RootState) => Boolean(s.auth?.loading));
  const error = useSelector((s: RootState) => s.auth?.error ?? null);
  const pendingPhone = useSelector((s: RootState) => s.auth?.pendingPhone);
  const pendingTerms = useSelector((s: RootState) => s.auth?.pendingTerms);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (pendingPhone?.pendingToken) {
      setAuthToken(pendingPhone.pendingToken);
      router.replace('/(auth)/phone');
    }
  }, [pendingPhone?.pendingToken, router, setAuthToken]);

  const goToTerms = useCallback(
    (token: string, expiresAt?: string | null) => {
      const expiresParam = expiresAt ?? '';
      InteractionManager.runAfterInteractions(() => {
        router.replace(
          `/(auth)/terms-accept?token=${encodeURIComponent(token)}&expiresAt=${encodeURIComponent(
            expiresParam,
          )}`,
        );
      });
    },
    [router],
  );

  useEffect(() => {
    if (pendingTerms?.pendingToken) {
      setAuthToken(pendingTerms.pendingToken);
      goToTerms(pendingTerms.pendingToken, pendingTerms.termsPendingTokenExpiresAt ?? '');
    }
  }, [pendingTerms?.pendingToken, pendingTerms?.termsPendingTokenExpiresAt, goToTerms, setAuthToken]);

  const completeLogin = useCallback(
    async (payload: SessionPayload) => {
      dispatch({ type: 'auth/loginSuccess', payload });
      await signIn({
        token: payload.token,
        expiresAt: payload.expiresAt,
        user: payload.user,
      });
    },
    [dispatch, signIn]
  );

  const handleSession = useCallback(
    async (payload: SessionPayload) => {
      authLogger.info('Sessão provider concluída', {
        email: payload.user.email,
        expiresAt: payload.expiresAt,
      });
      await completeLogin(payload);
    },
    [completeLogin]
  );

  const handleRequiresPhone = useCallback(
    (payload: PendingPhonePayload) => {
      authLogger.info('Login requer verificação de telefone', {
        pendingToken: payload.pendingToken,
      });
      const machineCode = createMachineCode();
      setAuthToken(payload.pendingToken);
      dispatch({
        type: 'auth/loginRequiresPhone',
        payload: {
          pendingToken: payload.pendingToken,
          pendingTokenExpiresAt: payload.pendingTokenExpiresAt,
          machineCode,
        },
      });
      router.replace('/(auth)/phone');
    },
    [dispatch, router, setAuthToken]
  );

  const handleRequiresTerms = useCallback(
    (payload: PendingTermsPayload) => {
      authLogger.info('Login requer aceite de termos', {
        pendingToken: payload.pendingToken,
      });
      setAuthToken(payload.pendingToken);
      dispatch({
        type: 'auth/loginRequiresTerms',
        payload: {
          pendingToken: payload.pendingToken,
          termsPendingTokenExpiresAt: payload.termsPendingTokenExpiresAt ?? null,
        },
      });
      goToTerms(payload.pendingToken, payload.termsPendingTokenExpiresAt ?? '');
    },
    [dispatch, goToTerms, setAuthToken]
  );

  const handleError = useCallback(
    (message: string) => {
      authLogger.error('Erro nos providers de login', { message });
      dispatch({ type: 'auth/loginError', payload: message });
    },
    [dispatch]
  );

  const handleLoadingChange = useCallback(
    (isLoading: boolean) => {
      if (isLoading) {
        authLogger.debug('Iniciando autenticação via provider');
        dispatch({ type: 'auth/loginStart' });
      }
    },
    [dispatch]
  );

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmitEmail = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) && password.trim().length >= 8;
  }, [normalizedEmail, password]);

  const submitEmailLogin = useCallback(async () => {
    if (!canSubmitEmail || localLoading) return;
    setLocalError(null);
    setLocalLoading(true);
    dispatch({ type: 'auth/loginStart' });
    try {
      authLogger.info('Tentando login com email/senha', { email: normalizedEmail });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(`${BASE_URL}/auth/email/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: normalizedEmail,
          password: password,
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
        router.replace('/(auth)/phone');
        return;
      }

      if (data?.requiresTermsAcceptance && data?.termsPendingToken) {
        setAuthToken(data.termsPendingToken);
        dispatch({
          type: 'auth/loginRequiresTerms',
          payload: {
            pendingToken: data.termsPendingToken,
            termsPendingTokenExpiresAt: data.termsPendingTokenExpiresAt ?? null,
          },
        });
        goToTerms(data.termsPendingToken, data.termsPendingTokenExpiresAt ?? '');
        return;
      }

      if (!data?.sessionToken || !data?.user) {
        throw new Error('Resposta inválida do servidor.');
      }

      await completeLogin({
        token: data.sessionToken,
        expiresAt: data.expiresAt ?? null,
        user: data.user,
      });
      authLogger.info('Login com email bem-sucedido', { email: normalizedEmail });
      setEmail('');
      setPassword('');
    } catch (err: any) {
      const msg = String(err?.message || err);
      setLocalError(msg);
      dispatch({ type: 'auth/loginError', payload: msg });
      authLogger.error('Falha no login com email', { email: normalizedEmail, error: msg });
    } finally {
      setLocalLoading(false);
    }
  }, [
    canSubmitEmail,
    localLoading,
    email,
    password,
    completeLogin,
    dispatch,
    goToTerms,
    authToken,
    setAuthToken,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.languageButton}
            onPress={() => setLanguagePopoverVisible((prev) => !prev)}
            hitSlop={8}
          >
            <Text style={styles.languageButtonText}>{t('login.languageButton')} · {formatLanguageLabel(language)}</Text>
          </Pressable>
          {languagePopoverVisible && (
            <>
              <Pressable
                style={styles.languageOverlay}
                onPress={() => setLanguagePopoverVisible(false)}
              />
              <View style={styles.languagePopover}>
                {availableLanguages.map((code) => {
                  const selected = code === language;
                  return (
                    <Pressable
                      key={code}
                      style={[styles.languageOption, selected && styles.languageOptionSelected]}
                      onPress={() => {
                        setLanguage(code);
                        setLanguagePopoverVisible(false);
                      }}
                    >
                      <Text style={[styles.languageOptionText, selected && styles.languageOptionTextSelected]}>
                        {formatLanguageLabel(code)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('login.emailHeading')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={placeholderColor}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (localError) setLocalError(null);
              }}
            />
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={placeholderColor}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (localError) setLocalError(null);
                }}
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={8}
              >
                <Text style={styles.passwordToggleText}>
                  {showPassword ? t('auth.password.hide') : t('auth.password.show')}
                </Text>
              </Pressable>
            </View>
          <Pressable style={styles.linkRight} onPress={() => router.push('/(auth)/forgot-email')}>
            <Text style={styles.linkRightText}>{t('login.forgotPassword')}</Text>
          </Pressable>
          {localError && <Text style={styles.error}>{localError}</Text>}
            <Pressable
              style={[styles.primaryBtn, (!canSubmitEmail || localLoading) && styles.primaryBtnDisabled]}
              onPress={submitEmailLogin}
              disabled={!canSubmitEmail || localLoading}
            >
              {localLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>{t('login.submit')}</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => router.push('/(auth)/email')}
            >
              <Text style={styles.secondaryBtnText}>{t('login.createAccount')}</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('login.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.providers}>
            {Platform.OS === 'ios' && (
              <AppleLoginButton
                label={t('login.provider.apple')}
                onSession={handleSession}
                onRequiresPhone={handleRequiresPhone}
                onRequiresTerms={handleRequiresTerms}
                onError={handleError}
                onLoadingChange={handleLoadingChange}
              />
            )}

            <GoogleLoginButton
              label={t('login.provider.google')}
              onSession={handleSession}
              onRequiresPhone={handleRequiresPhone}
              onRequiresTerms={handleRequiresTerms}
              onError={handleError}
              onLoadingChange={handleLoadingChange}
            />

            {(Platform.OS === 'ios' || Platform.OS === 'android') && (
              <MicrosoftLoginButton
                label={t('login.provider.microsoft')}
                onSession={handleSession}
                onRequiresPhone={handleRequiresPhone}
                onRequiresTerms={handleRequiresTerms}
                onError={handleError}
                onLoadingChange={handleLoadingChange}
              />
            )}
          </View>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={palette.tint} />
              <Text style={styles.loadingText}>{t('login.authenticating')}</Text>
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('login.footerPrefix')}{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/terms')}>
              {t('login.footerTerms')}
            </Text>{' '}
            {t('login.footerAnd')}{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/terms#privacy')}>
              {t('login.footerPrivacy')}
            </Text>
            .
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    header: { width: '100%', alignItems: 'center', marginBottom: 16, gap: 8, position: 'relative', paddingTop: 32 },
    languageButton: {
      position: 'absolute',
      right: 0,
      top: 0,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    languageButtonText: {
      fontSize: 12,
      color: colors.tint,
      fontWeight: '600',
    },
    languagePopover: {
      position: 'absolute',
      right: 0,
      top: 38,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: isDark ? 'rgba(6,20,42,0.95)' : 'rgba(255,255,255,0.97)',
      paddingVertical: 4,
      width: 200,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      zIndex: 99,
    },
    languageOverlay: {
      position: 'absolute',
      top: -2000,
      left: -2000,
      right: -2000,
      bottom: -2000,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    languageOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    languageOptionSelected: {
      backgroundColor: isDark ? 'rgba(192,168,122,0.2)' : 'rgba(31,78,121,0.12)',
    },
    languageOptionText: {
      fontSize: 14,
      color: colors.text,
    },
    languageOptionTextSelected: {
      fontWeight: '600',
      color: colors.tint,
    },
    title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
    subtitle: { fontSize: 14, color: colors.text, opacity: 0.7, textAlign: 'center' },
    body: { width: '100%', gap: 16, alignItems: 'center' },
    formCard: {
      width: '100%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      backgroundColor: colors.bookCard,
    },
    formTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.detail,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.bookCard,
    },
    passwordWrapper: {
      position: 'relative',
      justifyContent: 'center',
    },
    passwordInput: {
      paddingRight: 84,
    },
    passwordToggle: {
      position: 'absolute',
      right: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    passwordToggleText: {
      color: colors.tint,
      fontWeight: '600',
    },
    linkRight: { alignSelf: 'flex-end' },
    linkRightText: { color: colors.tint, fontSize: 12, fontWeight: '600' },
    primaryBtn: {
      marginTop: 4,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
    secondaryBtn: {
      marginTop: 4,
      paddingVertical: 10,
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: 13,
      color: colors.tint,
      fontWeight: '600',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      paddingHorizontal: 16,
    },
    providers: {
      width: '100%',
      gap: 12,
    },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.detail },
    dividerText: { fontSize: 12, color: colors.text, opacity: 0.6 },
    loadingRow: { alignItems: 'center', marginTop: 8 },
    loadingText: { marginTop: 6, fontSize: 12, color: colors.text, opacity: 0.7 },
    footer: { width: '100%', alignItems: 'center', marginTop: 24 },
    footerText: { fontSize: 12, color: colors.text, opacity: 0.6, textAlign: 'center' },
    footerLink: { color: colors.tint, fontWeight: '600' },
    error: { color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 8 },
  });
