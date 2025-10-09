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
  user: { email: string; name: string | null };
};

type Props = {
  /** Callback disparado quando a API do seu back retorna o token de sessão */
  onSession?: (payload: SessionPayload) => void | Promise<void>; 
  /** Callback de erro para você exibir no UI/Redux se quiser */
  onError?: (message: string) => void;
  /** Desabilita o botão quando necessário */
  disabled?: boolean;
  /** Caminho do endpoint (se quiser customizar) */
  apiPath?: string; // default: "/auth/google/id-token"
  /** Rótulo do botão */
  label?: string;
};

export default function GoogleLoginButton({
  onSession,
  onError,
  disabled,
  apiPath = '/auth/google/id-token',
  label = 'Continuar com Google (Simulado)',
}: Props) {
  const [loading, setLoading] = useState(false);

  const handlePress = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      console.log('Iniciando simulação de login com Google...');
      // Fluxo ideal: app POSTa id_token para o back
      const res = await fetch(`${BASE_URL}${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: SIMULATED_ID_TOKEN,
          device: { platform: Platform.OS, app_version: '1.0.0' },
        }),
      });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.message || `Falha: ${res.status} ${res.statusText ?? ''}`);
    }

    // => seu back retorna exatamente estes campos:
    const { sessionToken, user } = json as {
      sessionToken: string;
      user: { email: string; name: string | null};
    };

    if (!sessionToken) throw new Error('Resposta não contém sessionToken.');


      onSession?.({ token: sessionToken, user: user });
    } catch (err: any) {
      onError?.(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [loading, disabled, apiPath, onSession, onError]);

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
