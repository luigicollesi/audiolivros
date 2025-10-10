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

export type SessionPayload = {
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

export type PendingPhonePayload = {
  pendingToken: string;
  pendingTokenExpiresAt?: string | null;
};

export type MockProvider = 'google' | 'apple' | 'microsoft';

export type ProviderCallbacks = {
  onSession?: (payload: SessionPayload) => void | Promise<void>;
  onRequiresPhone?: (payload: PendingPhonePayload) => void | Promise<void>;
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
    onError,
    onLoadingChange,
  }: ProviderButtonBaseProps) {
    const [loading, setLoading] = useState(false);
    const buttonLabel = label ?? config.defaultLabel;

    const handlePress = useCallback(async () => {
      if (loading || disabled) return;
      setLoading(true);
      onLoadingChange?.(true);
      try {
        console.log(`Iniciando simulação de login com provider ${config.provider}`);
        const res = await fetch(`${BASE_URL}${apiPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: config.provider,
            id_token: config.idToken,
            name: config.sampleName,
            email: config.sampleEmail,
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
          return;
        }

        const { sessionToken, expiresAt, user } = json as {
          sessionToken: string;
          expiresAt?: string | null;
          user: SessionPayload['user'];
        };

        if (!sessionToken) throw new Error('Resposta não contém sessionToken.');

        await onSession?.({ token: sessionToken, expiresAt, user });
      } catch (err: any) {
        onError?.(String(err?.message || err));
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
      onSession,
    ]);

    return (
      <Pressable
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
      >
        <View style={styles.row}>
          <Text style={styles.label}>{buttonLabel}</Text>
          {loading && <ActivityIndicator />}
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
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', marginRight: 8 },
});
