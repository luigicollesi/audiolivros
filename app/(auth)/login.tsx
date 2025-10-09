// app/(auth)/login.tsx
import React from 'react';
import { SafeAreaView, View, Text, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useAuth } from '@/auth/AuthContext';

type RootState = {
  auth?: { loading?: boolean; error?: string | null };
};

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { signIn } = useAuth(); // <-- pega do contexto
  const loading = useSelector((s: RootState) => Boolean(s.auth?.loading));
  const error   = useSelector((s: RootState) => s.auth?.error ?? null);

  const handleSession = async (payload: { token: string; user: { email: string; name: string | null} }) => {
    // 1) atualiza Redux se quiser métricas/UI
    dispatch({ type: 'auth/loginSuccess', payload });

    // 2) efetivamente loga no app via Context
    console.log('Fazendo signIn no AuthContext...');
    await signIn({ token: payload.token, user: payload.user });

    // 3) opcional: navegar para a Home
    // router.replace('/(app)/home');
  };

  const handleError = (message: string) => {
    dispatch({ type: 'auth/loginError', payload: message });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '100%', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '800' }}>Bem-vindo</Text>
          <Text style={{ fontSize: 14, opacity: 0.7, textAlign: 'center' }}>
            Entre para continuar
          </Text>
        </View>

        <View style={{ width: '100%', gap: 12 as any }}>
          <GoogleLoginButton onSession={handleSession} onError={handleError} />
          {loading && (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>Autenticando…</Text>
            </View>
          )}

          {!!error && (
            <Text style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              {error}
            </Text>
          )}
        </View>

        <View style={{ width: '100%', alignItems: 'center', marginTop: 24 }}>
          <Text style={{ fontSize: 12, opacity: 0.6, textAlign: 'center' }}>
            Ao continuar, você concorda com nossos Termos e Política de Privacidade.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
