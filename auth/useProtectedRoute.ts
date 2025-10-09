// src/auth/useProtectedRoute.ts
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSegments, useRootNavigationState, usePathname } from 'expo-router';
import { useAuth } from './AuthContext';

export const useProtectedRoute = () => {
  const { session, loading } = useAuth();
  const authed = Boolean(session?.token);

  const segments = useSegments();
  const top = useMemo(() => segments?.[0] as string | undefined, [segments]);
  const inAuth = top === '(auth)';
  const inPrivate = top === '(private)';

  const router = useRouter();
  const nav = useRootNavigationState();
  const pathname = usePathname(); // ajuda a checar se já estamos no destino

  // Calcula destino desejado
  const target = useMemo(() => {
    if (loading || !nav?.key) return null; // ainda não pode decidir
    if (!authed && inPrivate) return '/(auth)/login';
    if (authed && inAuth) return '/(private)';
    return null;
  }, [loading, nav?.key, authed, inPrivate, inAuth]);

  // Evita re-disparar o mesmo replace
  const lastTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!target) return;

    // Se já estamos no destino, não faz nada
    if (pathname === target) return;

    // Se o último target já foi esse, não repete
    if (lastTargetRef.current === target) return;

    lastTargetRef.current = target;
    router.replace(target);

    // Após um curto período, libera para um novo target (se houver)
    const t = setTimeout(() => { lastTargetRef.current = null; }, 4000);
    return () => clearTimeout(t);
  }, [target, router, pathname]);
};
