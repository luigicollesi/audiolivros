// src/auth/AuthContext.tsx
import { BASE_URL } from '@/constants/API';
import { authLogger } from '@/utils/logger';
import { useLanguage } from '@/i18n/LanguageContext';
import { normalizeLanguage, DEFAULT_LANGUAGE } from '@/i18n/translations';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type User = {
  email: string;
  name: string | null;
  phone?: string | null;
  language?: string | null;
  genre?: string | null;
};
type Session = { token: string; user: User; expiresAt?: string | null } | null;

type AuthContextType = {
  session: Session;
  signIn: (s: NonNullable<Session>) => void;
  signOut: () => void;
  loading: boolean;
  refreshSession: () => Promise<void>;
  refreshing: boolean;
  favoritesDirty: boolean;
  markFavoritesDirty: () => void;
  acknowledgeFavorites: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_THRESHOLD_MS = 5 * 60_000; // renova ~5 minutos antes de expirar
const MIN_REFRESH_DELAY_MS = 15_000; // evita loops de refresh imediatos
const AUTO_REFRESH_ENABLED = false; // Desabilitado - usando useSmartRefresh nas telas

type TimeSourceConfig = {
  url: string;
  method: 'HEAD' | 'GET';
  timeoutMs: number;
  parseHeaders: (headers: Headers) => string | undefined;
};

const TIME_SOURCES: TimeSourceConfig[] = [
  {
    url: 'https://www.google.com',
    method: 'HEAD',
    timeoutMs: 2000,
    parseHeaders: (headers) => headers.get('date') ?? undefined,
  },
  {
    url: 'https://www.cloudflare.com',
    method: 'HEAD',
    timeoutMs: 2000,
    parseHeaders: (headers) => headers.get('date') ?? undefined,
  },
];

async function fetchFromSource(config: TimeSourceConfig): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(config.url, { method: config.method, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const raw = config.parseHeaders(res.headers);
    if (!raw) throw new Error('Cabeçalho sem data');

    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) throw new Error('Data inválida');

    return ms;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGlobalTimestamp(): Promise<number> {
  let lastError: unknown = null;
  for (const source of TIME_SOURCES) {
    try {
      return await fetchFromSource(source);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha ao obter horário global');
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoritesDirty, setFavoritesDirty] = useState(true);

  const { setLanguage, language: currentLanguage } = useLanguage();

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef(false);
  const globalOffsetRef = useRef<number>(0);
  const sessionRef = useRef<Session>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

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

  const signIn = useCallback((s: NonNullable<Session>) => {
    sessionRef.current = s;
    setSession(s);
    setFavoritesDirty(true);
    const nextLanguage = normalizeLanguage(s.user.language ?? currentLanguage ?? DEFAULT_LANGUAGE);
    setLanguage(nextLanguage);
    authLogger.info('Sessão autenticada', {
      email: s.user.email,
      expiresAt: s.expiresAt,
    });
  }, [currentLanguage, setLanguage]);

  const signOut = useCallback(() => {
    clearRefreshTimer();
    sessionRef.current = null;
    setSession(null);
    setFavoritesDirty(true);
    authLogger.info('Sessão encerrada');
  }, [clearRefreshTimer]);

  const syncGlobalOffset = useCallback(async () => {
    try {
      const globalNow = await fetchGlobalTimestamp();
      globalOffsetRef.current = globalNow - Date.now();
    } catch (err) {
      authLogger.warn('Falha ao sincronizar horário global. Caindo no relógio local.', err);
      globalOffsetRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const nextLanguage = session?.user?.language;
    if (nextLanguage) {
      setLanguage(normalizeLanguage(nextLanguage));
    }
  }, [session?.user?.language, setLanguage]);

  const refreshSession = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.token || refreshingRef.current) {
      if (!current?.token) {
        authLogger.debug('Refresh skipped: no token available');
      } else {
        authLogger.debug('Refresh skipped: already in progress');
      }
      return;
    }

    // Log timing information for debugging
    if (current.expiresAt) {
      const expiresMs = Date.parse(current.expiresAt);
      const timeLeft = expiresMs - Date.now();
      authLogger.info('Starting token refresh', {
        timeLeftMinutes: Math.round(timeLeft / 1000 / 60),
        expiresAt: current.expiresAt,
        caller: new Error().stack?.split('\n')[2]?.trim() // Get caller info
      });
    }

    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${current.token}`,
        },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.sessionToken) {
        throw new Error(data?.message || `Falha no refresh: ${res.status}`);
      }

      setSession((prev) => {
        const prevUser = prev?.user ?? current.user;
        const nextUser = (data.user as User | undefined) ?? prevUser;
        const nextSession: NonNullable<Session> = {
          token: String(data.sessionToken),
          expiresAt: (data.expiresAt as string | undefined) ?? null,
          user: nextUser,
        };
        sessionRef.current = nextSession;
        if (
          prev &&
          prev.token === nextSession.token &&
          prev.expiresAt === nextSession.expiresAt &&
          prev.user === nextUser
        ) {
          return prev;
        }
        return nextSession;
      });
      await syncGlobalOffset();
    } catch (error) {
      authLogger.error('Erro ao renovar token', error);
      signOut();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [signOut, syncGlobalOffset]);

  const markFavoritesDirty = useCallback(() => {
    setFavoritesDirty(true);
  }, []);

  const acknowledgeFavorites = useCallback(() => {
    setFavoritesDirty(false);
  }, []);

  useEffect(() => {
    clearRefreshTimer();
    if (!AUTO_REFRESH_ENABLED) return;
    if (!session?.token || !session?.expiresAt) return;

    let cancelled = false;
    (async () => {
      const expiresMs = Date.parse(session.expiresAt!);
      if (Number.isNaN(expiresMs)) return;

      await syncGlobalOffset();
      if (cancelled) return;

      const serverNow = Date.now() + globalOffsetRef.current;
      const timeLeft = expiresMs - serverNow;

      if (timeLeft <= 0) {
        refreshSession().catch(() => {});
        return;
      }

      const desiredDelay = expiresMs - REFRESH_THRESHOLD_MS - serverNow;
      let delay = desiredDelay;

      if (delay <= 0) {
        const halfTimeLeft = Math.max(0, timeLeft / 2);
        delay = Math.max(MIN_REFRESH_DELAY_MS, halfTimeLeft);
      }

      const maxSafeDelay = Math.max(1_000, timeLeft - 1_000);
      delay = Math.min(delay, maxSafeDelay);

      if (delay <= 0) {
        refreshSession().catch(() => {});
        return;
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshSession().catch(() => {});
      }, delay);
    })().catch((err) => {
      authLogger.warn('Não foi possível agendar refresh automático.', err);
    });

    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
  }, [session?.token, session?.expiresAt, refreshSession, clearRefreshTimer, syncGlobalOffset]);

  const value = useMemo(
    () => ({
      session,
      signIn,
      signOut,
      loading,
      refreshSession,
      refreshing,
      favoritesDirty,
      markFavoritesDirty,
      acknowledgeFavorites,
    }),
    [
      session,
      signIn,
      signOut,
      loading,
      refreshSession,
      refreshing,
      favoritesDirty,
      markFavoritesDirty,
      acknowledgeFavorites,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
};
