import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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

const CODE_LENGTH = 6;
const RESEND_INTERVAL = 45;

export default function DeleteAccountScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { authedFetch } = useAuthedFetch();
  const { signOut } = useAuth();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const requestCode = useCallback(async () => {
    if (requesting || cooldown > 0) return;
    setRequesting(true);
    try {
      const res = await authedFetch(`${BASE_URL}/account/delete/request`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Não foi possível solicitar o código.');
      }
      setInfo(
        'Enviamos um código de confirmação por email. Em desenvolvimento, o código é exibido no console do backend.',
      );
      setCooldown(RESEND_INTERVAL);
    } catch (err: any) {
      setCodeError(String(err?.message || err || 'Falha ao solicitar código.'));
    } finally {
      setRequesting(false);
    }
  }, [authedFetch, requesting, cooldown]);

  useEffect(() => {
    void requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleConfirm = useCallback(async () => {
    const sanitized = code.replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (sanitized.length !== CODE_LENGTH) {
      setCodeError(`Informe os ${CODE_LENGTH} dígitos do código.`);
      return;
    }
    setLoading(true);
    setCodeError(null);
    try {
      const res = await authedFetch(`${BASE_URL}/account/delete/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sanitized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Código inválido.');
      }
      Alert.alert('Conta excluída', 'Sua conta foi removida. Até breve!');
      signOut();
    } catch (err: any) {
      setCodeError(String(err?.message || err || 'Falha ao confirmar exclusão.'));
    } finally {
      setLoading(false);
    }
  }, [authedFetch, code, signOut]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Excluir conta</Text>
            <Text style={styles.description}>
              Esta ação é irreversível. Confirme digitando o código enviado para seu email.
            </Text>

            <CodeVerificationView
              code={code}
              setCode={(value) => {
                setCode(value);
                if (codeError) setCodeError(null);
              }}
              title=""
              subtitle=""
              loading={loading}
              error={codeError}
              codeLength={CODE_LENGTH}
              onSubmit={handleConfirm}
              submitLabel="Confirmar exclusão"
              onBack={() => {
                if (!loading && !requesting) router.back();
              }}
              backLabel="Voltar"
              secondActionLabel={
                cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'
              }
              onSecondAction={() => {
                if (!loading) void requestCode();
              }}
              secondActionDisabled={loading || requesting || cooldown > 0}
            />

            {info && <Text style={styles.info}>{info}</Text>}

            {loading && (
              <View style={styles.loaderRow}>
                <ActivityIndicator color={palette.tint} />
                <Text style={styles.loaderText}>Confirmando...</Text>
              </View>
            )}
          </View>

          <Pressable
            style={styles.linkButton}
            onPress={() => {
              if (!loading && !requesting) router.back();
            }}
          >
            <Text style={styles.linkText}>Voltar para o perfil</Text>
          </Pressable>
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
      borderColor: colors.tabIconDefault,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      color: colors.text,
    },
    description: {
      fontSize: 14,
      textAlign: 'center',
      color: colors.text,
      opacity: 0.75,
    },
    info: {
      color: colors.tint,
      fontSize: 13,
      textAlign: 'center',
    },
    loaderRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    loaderText: {
      fontSize: 13,
      color: colors.text,
      opacity: 0.7,
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
