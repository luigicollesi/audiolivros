// app/(auth)/phone.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/constants/API';
import { RootState } from '@/store';
import { authLogger } from '@/utils/logger';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useTranslation } from '@/i18n/LanguageContext';
import { normalizeLanguage } from '@/i18n/translations';

const sanitizeDigits = (value: string, max: number) =>
  value.replace(/\D/g, '').slice(0, max);

export default function PhoneScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { session, authToken, setAuthToken } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';
  const { language: baseLanguage, t } = useTranslation();

  const pending = useSelector((s: RootState) => s.auth?.pendingPhone);
  const globalError = useSelector((s: RootState) => s.auth?.error ?? null);

  const [ddd, setDdd] = useState('');
  const [number, setNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoState, setInfoState] = useState<'pending' | 'sent' | null>(pending ? 'pending' : null);

  const language = useMemo(() => {
    const preference =
      typeof session?.user?.language === 'string'
        ? session.user.language.trim()
        : '';
    return normalizeLanguage(preference || baseLanguage);
  }, [session?.user?.language, baseLanguage]);

  useEffect(() => {
    if (!pending) {
      router.replace('/(auth)/login');
    }
  }, [pending, router]);

  useEffect(() => {
    if (pending?.pendingToken) {
      setAuthToken(pending.pendingToken);
    }
  }, [pending?.pendingToken, setAuthToken]);

  if (!pending) {
    return null;
  }

  const onChangeDDD = useCallback((value: string) => {
    const digits = sanitizeDigits(value, 2);
    setDdd(digits);
  }, []);

  const onChangeNumber = useCallback((value: string) => {
    const digits = sanitizeDigits(value, 9);
    const withHyphen = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setNumber(withHyphen);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!pending?.pendingToken || !pending?.machineCode) {
      setError(t('phone.expired'));
      router.replace('/(auth)/login');
      return;
    }

    const sanitizedDDD = sanitizeDigits(ddd, 2);
    const digits = sanitizeDigits(number, 9);

    if (sanitizedDDD.length !== 2) {
      setError(t('phone.invalidDDD'));
      return;
    }
    if (digits.length !== 9) {
      setError(t('phone.invalidPhone'));
      return;
    }

    setError(null);
    setInfoState(null);
    setSubmitting(true);

    const fullPhone = `+55${sanitizedDDD}${digits}`;

    try {
      authLogger.info('Solicitando código de telefone', {
        phone: fullPhone,
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${BASE_URL}/auth/phone/request-code`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pendingToken: pending.pendingToken,
          machineCode: pending.machineCode,
          phone: fullPhone,
          language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Falha: ${res.status}`);
      }

      dispatch({
        type: 'auth/phoneRequestSuccess',
        payload: { phone: fullPhone, ddd: sanitizedDDD },
      });
      setInfoState('sent');
      authLogger.info('Código de telefone enviado com sucesso', {
        phone: fullPhone,
      });
      router.replace('/(auth)/code');
    } catch (err: any) {
      const message = String(err?.message || err);
      setError(message);
      authLogger.error('Falha ao solicitar código de telefone', {
        phone: fullPhone,
        error: message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    pending?.pendingToken,
    pending?.machineCode,
    ddd,
    number,
    dispatch,
    router,
    language,
    authToken,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('phone.title')}</Text>
          <Text style={styles.subtitle}>{t('phone.subtitle')}</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+55</Text>
          </View>
          <TextInput
            style={[styles.dddInput, styles.textInput]}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={t('phone.ddPlaceholder')}
            placeholderTextColor={placeholderColor}
            value={ddd}
            onChangeText={onChangeDDD}
          />
          <TextInput
            style={[styles.phoneInput, styles.textInput]}
            keyboardType="number-pad"
            maxLength={10}
            placeholder={t('phone.numberPlaceholder')}
            placeholderTextColor={placeholderColor}
            value={number}
            onChangeText={onChangeNumber}
          />
        </View>

        {infoState && (
          <Text style={styles.info}>
            {infoState === 'pending' ? t('phone.infoPending') : t('phone.sentInfo')}
          </Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        {globalError && <Text style={styles.error}>{globalError}</Text>}

        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={palette.background} />
          ) : (
            <Text style={styles.submitBtnText}>{t('phone.submit')}</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
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
      gap: 24,
      alignItems: 'stretch',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    header: { gap: 8, alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.tint },
    subtitle: { fontSize: 14, color: colors.text, opacity: 0.7, textAlign: 'center' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    countryCode: {
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    countryCodeText: { fontSize: 16, fontWeight: '600', color: colors.tint },
    textInput: {
      borderWidth: 1,
      borderColor: colors.detail,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.bookCard,
    },
    dddInput: { width: 70, textAlign: 'center' },
    phoneInput: { flex: 1 },
    info: { fontSize: 13, textAlign: 'center', color: colors.tint },
    error: { fontSize: 13, color: '#ef4444', textAlign: 'center' },
    submitBtn: {
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    submitBtnDisabled: { opacity: 0.7 },
    submitBtnText: { color: colors.background, fontSize: 18, fontWeight: '700' },
  });
