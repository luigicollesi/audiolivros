import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BASE_URL } from '@/constants/API';
import { authLogger } from '@/utils/logger';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { getTimezoneInfo } from '@/utils/timezone';

export type SessionPayload = {
  id?: string;
  token: string;
  expiresAt?: string | null;
  user: {
    id?: string;
    keys?: number;
    days?: number;
    email: string;
    name: string | null;
    phone?: string | null;
    language?: string | null;
    genre?: string | null;
    booksRead?: number;
    libraryCount?: number;
    favoritesCount?: number;
    finishedCount?: number;
  };
};

export type PendingPhonePayload = {
  pendingToken: string;
  pendingTokenExpiresAt?: string | null;
};

export type PendingTermsPayload = {
  pendingToken: string;
  termsPendingTokenExpiresAt?: string | null;
};

export type MockProvider = 'google' | 'apple' | 'microsoft';

export type ProviderCallbacks = {
  onSession?: (payload: SessionPayload) => void | Promise<void>;
  onRequiresPhone?: (payload: PendingPhonePayload) => void | Promise<void>;
  onRequiresTerms?: (payload: PendingTermsPayload) => void | Promise<void>;
  onError?: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export type ProviderButtonBaseProps = ProviderCallbacks & {
  label?: string;
  disabled?: boolean;
  apiPath?: string;
};

type ProviderStaticConfig = {
  provider: MockProvider;
  defaultLabel: string;
  idToken: string;
  sampleName: string;
  sampleEmail: string;
};

export function createMockProviderButton(config: ProviderStaticConfig) {
  function ProviderButton({
    label,
    disabled,
    apiPath = '/auth/id-token',
    onSession,
    onRequiresPhone,
    onRequiresTerms,
    onError,
    onLoadingChange,
  }: ProviderButtonBaseProps) {
    const [loading, setLoading] = useState(false);
    const scheme = useColorScheme() ?? 'light';
    const palette = Colors[scheme];
    const buttonLabel = label ?? config.defaultLabel;
    const buttonTextColor = palette.text;
    const buttonBackground = Colors.dark.secondary;

    const handlePress = useCallback(async () => {
      if (loading || disabled) return;
      setLoading(true);
      onLoadingChange?.(true);
      try {
        authLogger.info('Iniciando login via provider', {
          provider: config.provider,
        });
        const tz = getTimezoneInfo();
        const res = await fetch(`${BASE_URL}${apiPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-timezone': tz.timezone,
            'x-tz-offset': String(tz.offsetMinutes),
          },
          body: JSON.stringify({
            provider: config.provider,
            id_token: config.idToken,
            name: config.sampleName,
            email: config.sampleEmail,
            timezone: tz.timezone,
            timezoneOffset: tz.offsetMinutes,
            device: {
              platform: Platform.OS,
              app_version: '1.0.0',
              model:
                typeof Platform.constants === 'object' &&
                Platform.constants &&
                'model' in Platform.constants
                  ? 
                    (Platform.constants as any).model
                  : Platform.OS,
            },
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.message || `Falha: ${res.status} ${res.statusText ?? ''}`);
        }

        if (json?.requiresPhone) {
          const pendingToken = String(json?.pendingToken || '');
          if (!pendingToken) throw new Error('Resposta não contém pendingToken.');
          await onRequiresPhone?.({
            pendingToken,
            pendingTokenExpiresAt: json?.pendingTokenExpiresAt ?? null,
          });
          authLogger.info('Provider login requer verificação de telefone', {
            provider: config.provider,
          });
          return;
        }

        if (json?.requiresTermsAcceptance) {
          const pendingToken = String(json?.termsPendingToken || '');
          if (!pendingToken) {
            throw new Error('Resposta não contém termsPendingToken.');
          }
          await onRequiresTerms?.({
            pendingToken,
            termsPendingTokenExpiresAt: json?.termsPendingTokenExpiresAt ?? null,
          });
          authLogger.info('Provider login requer aceite de termos', {
            provider: config.provider,
          });
          return;
        }

        const { sessionToken, expiresAt, user } = json as {
          sessionToken: string;
          expiresAt?: string | null;
          user: SessionPayload['user'];
        };

        if (!sessionToken) throw new Error('Resposta não contém sessionToken.');

        await onSession?.({ token: sessionToken, expiresAt, user });
        authLogger.info('Login via provider bem-sucedido', {
          provider: config.provider,
          email: user?.email,
        });
      } catch (err: any) {
        const message = String(err?.message || err);
        authLogger.error('Erro no login via provider', {
          provider: config.provider,
          error: message,
        });
        onError?.(message);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    }, [
      apiPath,
      disabled,
      loading,
      onError,
      onLoadingChange,
      onRequiresPhone,
      onRequiresTerms,
      onSession,
    ]);

    return (
      <Pressable
        style={[
          styles.btn,
          {
            backgroundColor: buttonBackground,
            borderColor: palette.detail,
          },
          (disabled || loading) && styles.btnDisabled,
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: buttonTextColor }]}>{buttonLabel}</Text>
          {loading && <ActivityIndicator color={buttonTextColor} />}
        </View>
      </Pressable>
    );
  }

  ProviderButton.displayName = `${config.provider[0].toUpperCase()}${config.provider.slice(
    1
  )}LoginButton`;

  return ProviderButton;
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', marginRight: 8 },
});
