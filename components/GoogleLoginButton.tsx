// components/GoogleLoginButton.tsx
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BASE_URL } from '@/constants/API';
// ID Token SIMULADO (placeholders). Seu backend deve aceitar em modo "mock".
const SIMULATED_ID_TOKEN = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJZT1VSR19HT09HTEVfQ0xJRU5UX0lEIiwic3ViIjoic2ltLXVzZXItMTIzIiwiZW1haWwiOiJsdWlnaUBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiTHVpZ2kgZGUgTWVuZXplcyBDb2xsZXNpIiwiaWF0IjoxNzI0MjI0MDAwLCJleHAiOjE3MjQyMjc2MDB9.SElHTkxZLVNJTlVBTEVEMA'; // apenas um "JWT-like" sem assinatura real


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

type Props = {
  /** Callback disparado quando a API do seu back retorna o token de sessão */
  onSession?: (payload: SessionPayload) => void | Promise<void>;
  /** Callback disparado quando o backend exige o cadastro de telefone */
  onRequiresPhone?: (payload: PendingPhonePayload) => void | Promise<void>;
  /** Callback de erro para você exibir no UI/Redux se quiser */
  onError?: (message: string) => void;
  /** Notifica alterações de carregamento (útil para Redux/UI externo) */
  onLoadingChange?: (loading: boolean) => void;
  /** Desabilita o botão quando necessário */
  disabled?: boolean;
  /** Caminho do endpoint (se quiser customizar) */
  apiPath?: string; // default: "/auth/id-token"
  /** Nome do provider (ex: "google") enviado para API */
  provider?: string;
  /** Rótulo do botão */
  label?: string;
};

export default function GoogleLoginButton({
  onSession,
  onRequiresPhone,
  onError,
  onLoadingChange,
  disabled,
  apiPath = '/auth/id-token',
  provider = 'google',
  label = 'Continuar com Google (Simulado)',
}: Props) {
  const [loading, setLoading] = useState(false);

  const handlePress = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    onLoadingChange?.(true);
    try {
      console.log('Iniciando simulação de login com Google...');
      // Fluxo ideal: app POSTa id_token para o back
      const res = await fetch(`${BASE_URL}${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          id_token: SIMULATED_ID_TOKEN,
          // inclui campos simulados para evitar erros do backend mock
          name: 'Luigi Simulado',
          email: 'luigi@example.com',
          device: {
            platform: Platform.OS,
            app_version: '1.0.0',
            model: Platform.constants?.model ?? Platform.OS,
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

      // => seu back retorna exatamente estes campos:
      const { sessionToken, expiresAt, user } = json as {
        sessionToken: string;
        expiresAt?: string | null;
        user: {
          email: string;
          name: string | null;
          phone?: string | null;
          language?: string | null;
          genre?: string | null;
        };
      };

      if (!sessionToken) throw new Error('Resposta não contém sessionToken.');

      onSession?.({ token: sessionToken, expiresAt, user });
    } catch (err: any) {
      onError?.(String(err?.message || err));
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [loading, disabled, apiPath, provider, onSession, onRequiresPhone, onError, onLoadingChange]);

  return (
    <Pressable
      style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {loading && <ActivityIndicator />}
      </View>
    </Pressable>
  );
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
