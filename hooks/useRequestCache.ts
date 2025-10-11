// hooks/useRequestCache.ts
/**
 * Hook profissional de cache baseado em padrões da indústria
 * Inspirado em React Query, SWR e Apollo Client
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
  isLoading: boolean;
  error: string | null;
}

interface CacheOptions {
  staleTime?: number; // Tempo que os dados são considerados frescos (ms)
  cacheTime?: number; // Tempo que os dados ficam no cache (ms)
  retry?: number;     // Número de tentativas em caso de erro
  retryDelay?: number; // Delay entre tentativas (ms)
  dedupe?: boolean;   // Deduplica requisições simultâneas
}

const DEFAULT_OPTIONS: Required<CacheOptions> = {
  staleTime: 5 * 60 * 1000,    // 5 minutos
  cacheTime: 10 * 60 * 1000,   // 10 minutos
  retry: 2,
  retryDelay: 1000,
  dedupe: true,
};

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private timeouts = new Map<string, any>();

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Verifica cache existente
    const cached = this.cache.get(key);
    const now = Date.now();

    // Se tem dados frescos, retorna imediatamente
    if (cached && !cached.isLoading && !cached.error) {
      const age = now - cached.timestamp;
      if (age < opts.staleTime) {
        return cached.data;
      }
    }

    // Deduplica requisições simultâneas
    if (opts.dedupe && this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Cria nova requisição
    const request = this.executeRequest(key, fetcher, opts);
    
    if (opts.dedupe) {
      this.pendingRequests.set(key, request);
    }

    return request;
  }

  private async executeRequest<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: Required<CacheOptions>
  ): Promise<T> {
    // Marca como loading
    const existing = this.cache.get(key);
    this.cache.set(key, {
      data: existing?.data,
      timestamp: existing?.timestamp || Date.now(),
      staleTime: options.staleTime,
      isLoading: true,
      error: null,
    });

    let lastError: Error | null = null;

    // Tenta com retry
    for (let attempt = 0; attempt <= options.retry; attempt++) {
      try {
        const data = await fetcher();
        
        // Salva no cache
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          staleTime: options.staleTime,
          isLoading: false,
          error: null,
        });

        // Agenda limpeza
        this.scheduleCleanup(key, options.cacheTime);
        
        // Remove da lista de pendentes
        this.pendingRequests.delete(key);
        
        return data;
      } catch (error) {
        lastError = error as Error;
        
        // Se não é a última tentativa, aguarda retry delay
        if (attempt < options.retry) {
          await new Promise(resolve => 
            setTimeout(resolve, options.retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }

    // Salva erro no cache
    this.cache.set(key, {
      data: existing?.data,
      timestamp: existing?.timestamp || Date.now(),
      staleTime: options.staleTime,
      isLoading: false,
      error: lastError?.message || 'Unknown error',
    });

    this.pendingRequests.delete(key);
    throw lastError;
  }

  private scheduleCleanup(key: string, cacheTime: number) {
    // Limpa timeout anterior se existir
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Agenda nova limpeza
    const timeout = setTimeout(() => {
      this.cache.delete(key);
      this.timeouts.delete(key);
    }, cacheTime);

    this.timeouts.set(key, timeout);
  }

  getCached<T>(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key);
  }

  invalidate(keyPattern?: string): void {
    if (!keyPattern) {
      this.cache.clear();
      this.pendingRequests.clear();
      this.timeouts.forEach(timeout => clearTimeout(timeout));
      this.timeouts.clear();
      return;
    }

    // Invalida chaves que correspondem ao padrão
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.pendingRequests.delete(key);
      const timeout = this.timeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(key);
      }
    });
  }

  prefetch<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): void {
    // Só faz prefetch se não tem dados ou estão stale
    const cached = this.getCached(key);
    if (cached && !cached.error && !cached.isLoading) {
      const age = Date.now() - cached.timestamp;
      const staleTime = options?.staleTime || DEFAULT_OPTIONS.staleTime;
      if (age < staleTime) {
        return; // Dados ainda frescos
      }
    }

    // Executa prefetch silenciosamente
    this.get(key, fetcher, { ...options, retry: 1 }).catch(() => {
      // Ignora erros no prefetch
    });
  }
}

// Instância global do cache
const globalCache = new RequestCache();

export function useRequestCache() {
  return globalCache;
}

export function useCachedRequest<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  options?: CacheOptions
) {
  const cache = useRequestCache();
  const [state, setState] = useState<{
    data: T | undefined;
    isLoading: boolean;
    error: string | null;
  }>({ data: undefined, isLoading: false, error: null });

  const stableKey = useMemo(() => key, [key]);
  const stableFetcher = useCallback(fetcher || (() => Promise.resolve(undefined as any)), [fetcher]);
  const stableOptions = useMemo(() => options || {}, [options?.staleTime, options?.retry, options?.retryDelay, options?.dedupe]);

  useEffect(() => {
    if (!stableKey || !fetcher) {
      setState({ data: undefined, isLoading: false, error: null });
      return;
    }

    // Verifica cache primeiro
    const cached = cache.getCached<T>(stableKey);
    if (cached) {
      setState({
        data: cached.data,
        isLoading: cached.isLoading,
        error: cached.error,
      });

      // Se tem dados frescos, não precisa fazer request
      const age = Date.now() - cached.timestamp;
      if (age < cached.staleTime && !cached.error && !cached.isLoading) {
        return;
      }
    } else {
      setState({ data: undefined, isLoading: true, error: null });
    }

    // Executa request
    cache.get(stableKey, stableFetcher, stableOptions)
      .then((data) => {
        setState({ data, isLoading: false, error: null });
      })
      .catch((error) => {
        setState(prev => ({ 
          data: prev.data, // Mantém dados anteriores em caso de erro
          isLoading: false, 
          error: error.message 
        }));
      });
  }, [stableKey, stableFetcher, cache, stableOptions]);

  const refetch = useCallback(() => {
    if (!stableKey || !fetcher) return Promise.resolve();

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    return cache.get(stableKey, stableFetcher, { ...stableOptions, staleTime: 0 })
      .then((data) => {
        setState({ data, isLoading: false, error: null });
        return data;
      })
      .catch((error) => {
        setState(prev => ({ 
          data: prev.data,
          isLoading: false, 
          error: error.message 
        }));
        throw error;
      });
  }, [stableKey, stableFetcher, cache, stableOptions]);

  const prefetch = useCallback((prefetchKey: string, prefetchFetcher: () => Promise<any>) => {
    cache.prefetch(prefetchKey, prefetchFetcher, stableOptions);
  }, [cache, stableOptions]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
    prefetch,
  };
}
