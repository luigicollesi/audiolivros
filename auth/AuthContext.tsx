// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type User = { email: string; name: string | null };
type Session = { token: string; user: User; expiresAt?: string | null } | null;

type AuthContextType = {
  session: Session;
  signIn: (s: NonNullable<Session>) => void;
  signOut: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);

  // Boot da sessão (rodar uma única vez)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // ex: ler do AsyncStorage
        // const raw = await AsyncStorage.getItem('session');
        // if (mounted && raw) setSession(JSON.parse(raw));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const value = useMemo(
    () => ({
      session,
      signIn: (s: NonNullable<Session>) => {
        setSession(s);
      },
      signOut: () => {
        setSession(null);
      },
      loading,
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
};
