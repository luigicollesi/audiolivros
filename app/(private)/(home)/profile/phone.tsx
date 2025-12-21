import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { BASE_URL } from '@/constants/API';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useAuth } from '@/auth/AuthContext';
import { CodeVerificationView } from '@/components/auth/CodeVerificationView';
import ClickPressable from '@/components/shared/ClickPressable';

type PhoneStage = 'form' | 'code';

const CODE_LENGTH = 5;

const sanitizeDigits = (value: string, max: number) =>
  value.replace(/\D/g, '').slice(0, max);

const formatPhoneNumber = (digits: string) => {
  if (!digits) return '';
  const clean = sanitizeDigits(digits, 9);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
};

const parseExistingPhone = (raw: string | null | undefined) => {
  if (!raw) return { ddd: '', number: '' };
  const digits = raw.replace(/\D/g, '');
  if (!digits.startsWith('55') || digits.length < 11) {
    return { ddd: '', number: '' };
  }
  const ddd = digits.slice(2, 4);
  const numberDigits = digits.slice(4, 13);
  return {
    ddd: sanitizeDigits(ddd, 2),
    number: formatPhoneNumber(numberDigits),
  };
};

export default function PhoneUpdateScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette), [palette]);
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';
  const { session, refreshSession } = useAuth();
  const { authedFetch } = useAuthedFetch();

  const initialPhone = useMemo(
    () => parseExistingPhone(session?.user?.phone),
    [session?.user?.phone],
  );

  const [stage, setStage] = useState<PhoneStage>('form');
  const [ddd, setDdd] = useState(initialPhone.ddd);
  const [localNumber, setLocalNumber] = useState(initialPhone.number);
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setDdd(initialPhone.ddd);
    setLocalNumber(initialPhone.number);
  }, [initialPhone.ddd, initialPhone.number]);

  const handleRequestCode = useCallback(async () => {
    const sanitizedDDD = sanitizeDigits(ddd, 2);
    const digits = sanitizeDigits(localNumber, 9);

    if (sanitizedDDD.length !== 2) {
      setFormError('Informe o DDD com 2 dígitos.');
      return;
    }
    if (digits.length !== 9) {
      setFormError('Informe o telefone no formato XXXXX-XXXX.');
      return;
    }
    if (cooldown > 0) {
      setFormError('Aguarde antes de solicitar um novo código.');
      return;
    }

    const fullPhone = `+55${sanitizedDDD}${digits}`;
    setFormError(null);
    setCode('');
    setCodeError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await authedFetch(`${BASE_URL}/account/phone/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Não foi possível solicitar o código.');
      }
      setInfo(
        'Enviamos um código ao telefone informado. Em desenvolvimento, o código é exibido no console do backend.',
      );
      setStage('code');
      setCooldown(45);
    } catch (err: any) {
      setFormError(String(err?.message || err || 'Falha ao solicitar código.'));
    } finally {
      setLoading(false);
    }
  }, [authedFetch, ddd, localNumber, cooldown]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleConfirmCode = useCallback(async () => {
    const sanitized = sanitizeDigits(code, CODE_LENGTH);
    if (sanitized.length !== CODE_LENGTH) {
      setCodeError(`Informe os ${CODE_LENGTH} dígitos do código.`);
      return;
    }

    setCodeError(null);
    setLoading(true);
    try {
      const res = await authedFetch(`${BASE_URL}/account/phone/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sanitized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Código inválido.');
      }
      await refreshSession();
      router.replace({
        pathname: '/(private)/(home)/profile',
        params: { phoneUpdated: '1' },
      });
    } catch (err: any) {
      setCodeError(String(err?.message || err || 'Não foi possível confirmar o código.'));
    } finally {
      setLoading(false);
    }
  }, [authedFetch, code, refreshSession, router]);

  const handleReopenForm = useCallback(() => {
    if (loading) return;
    setStage('form');
    setCode('');
    setCodeError(null);
    setInfo(null);
  }, [loading]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>
              {stage === 'form' ? 'Atualizar telefone' : 'Confirmar código'}
            </Text>

            {stage === 'form' ? (
              <>
                <Text style={styles.description}>
                  Informe o novo telefone com código do país e DDD.
                </Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+55</Text>
                  </View>
                  <TextInput
                    style={[styles.dddInput, styles.textInput]}
                    value={ddd}
                    onChangeText={(value) => {
                      setDdd(sanitizeDigits(value, 2));
                      if (formError) setFormError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="DD"
                    placeholderTextColor={placeholderColor}
                  />
                  <TextInput
                    style={[styles.phoneInput, styles.textInput]}
                    value={localNumber}
                    onChangeText={(value) => {
                      setLocalNumber(formatPhoneNumber(value));
                      if (formError) setFormError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="XXXXX-XXXX"
                    placeholderTextColor={placeholderColor}
                  />
                </View>
                {formError && <Text style={styles.error}>{formError}</Text>}
                {info && <Text style={styles.info}>{info}</Text>}
                <ClickPressable
                  style={[styles.primaryButton, (loading || cooldown > 0) && styles.disabled]}
                  onPress={handleRequestCode}
                  disabled={loading || cooldown > 0}
                >
                  {loading ? (
                    <ActivityIndicator color={palette.background} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Enviar código'}
                    </Text>
                  )}
                </ClickPressable>
              </>
            ) : (
              <>
                <CodeVerificationView
                  code={code}
                  setCode={(value) => {
                    setCode(value);
                    if (codeError) setCodeError(null);
                  }}
                  title="Confirmar código"
                  subtitle="Digite os 5 dígitos enviados ao número informado."
                  loading={loading}
                  error={codeError}
                  codeLength={CODE_LENGTH}
                  onSubmit={handleConfirmCode}
                  submitLabel="Confirmar"
                  onBack={handleReopenForm}
                  backLabel="Editar telefone"
                  secondActionLabel={
                    cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'
                  }
                  onSecondAction={() => {
                    if (!loading) handleRequestCode();
                  }}
                  secondActionDisabled={loading || cooldown > 0}
                />
                {info && <Text style={styles.info}>{info}</Text>}
              </>
            )}
          </View>

          <ClickPressable
            style={styles.linkButton}
            onPress={() => {
              if (!loading) router.back();
            }}
          >
            <Text style={styles.linkText}>Voltar para o perfil</Text>
          </ClickPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: {
      flexGrow: 1,
      padding: 24,
      justifyContent: 'center',
      gap: 16,
      backgroundColor: colors.background,
    },
    card: {
      padding: 22,
      borderRadius: 16,
      gap: 16,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      color: colors.tint,
    },
    description: {
      fontSize: 14,
      textAlign: 'center',
      color: colors.text,
      opacity: 0.75,
    },
    phoneRow: {
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
    countryCodeText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.tint,
    },
    textInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.bookCard,
    },
    dddInput: {
      width: 70,
      textAlign: 'center',
    },
    phoneInput: {
      flex: 1,
    },
    error: {
      color: '#ef4444',
      fontSize: 13,
      textAlign: 'center',
    },
    info: {
      color: colors.tint,
      fontSize: 13,
      textAlign: 'center',
    },
    primaryButton: {
      borderRadius: 12,
      backgroundColor: colors.secondary,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    primaryButtonText: {
      color: colors.background,
      fontWeight: '700',
      fontSize: 16,
    },
    disabled: {
      opacity: 0.6,
    },
    linkButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    linkText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.tint,
    },
  });
