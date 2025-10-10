// src/auth/useAuthedFetch.ts
import { useCallback } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { authLogger } from '@/utils/logger';

type FetchJSONOptions = RequestInit & { expect?: 'json' | 'text' | 'void' };

export function useAuthedFetch() {
  const { session, signOut } = useAuth();
  const token = session?.token;

  const authedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      if (token) {
        const bearer = `Bearer ${String(token).trim()}`;
        headers.set('authorization', bearer);
        authLogger.debug('Requisição autenticada', { url: String(input) });
      }

      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        authLogger.warn('Token inválido ou expirado detectado', { url: String(input) });
        signOut();
      }
      return res;
    },
    [token, signOut]
  );

  const fetchJSON = useCallback(
    async <T = unknown>(input: RequestInfo | URL, opts?: FetchJSONOptions): Promise<T> => {
      const res = await authedFetch(input, opts);
      if (!res.ok) {
        const msg = await safeError(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const expect = opts?.expect ?? 'json';
      if (expect === 'json') return (await res.json()) as T;
      if (expect === 'text') return (await res.text()) as unknown as T;
      return undefined as unknown as T;
    },
    [authedFetch]
  );

  return { authedFetch, fetchJSON };
}

async function safeError(res: Response) {
  try { const data = await res.json(); return data?.message || data?.error || ''; }
  catch { try { return await res.text(); } catch { return ''; } }
}
