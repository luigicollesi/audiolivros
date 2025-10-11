// hooks/useCachedFetch.ts
/**
 * Drop-in replacement for existing fetch patterns with intelligent caching
 * Maintains the same interface while adding caching and deduplication
 */
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BooksResponse } from '@/components/book/BookGrid';
import { useCallback, useRef } from 'react';
import { useRequestCache } from './useRequestCache';

interface CachedFetchOptions {
  staleTime?: number;
  enabled?: boolean;
  cachePattern?: string; // For cache invalidation (e.g., 'books', 'favorites')
}

/**
 * Enhanced fetch hook that provides caching and deduplication
 * while maintaining compatibility with existing fetchPage patterns
 */
export function useCachedFetch(options: CachedFetchOptions = {}) {
  const { fetchJSON } = useAuthedFetch();
  const cache = useRequestCache();
  const pendingRef = useRef(new Map<string, Promise<any>>());

  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    enabled = true,
    cachePattern = 'books',
  } = options;

  const cachedFetch = useCallback(async <T = BooksResponse>(
    url: string,
    force = false
  ): Promise<T> => {
    if (!enabled) {
      return fetchJSON<T>(url);
    }

    // Create cache key from URL
    const cacheKey = `${cachePattern}:${btoa(url).replace(/[^a-zA-Z0-9]/g, '')}`;

    // Check for existing pending request
    const existingRequest = pendingRef.current.get(cacheKey);
    if (existingRequest && !force) {
      return existingRequest;
    }

    // Create fetch promise
    const fetchPromise = (async (): Promise<T> => {
      try {
        // Check cache first (unless forcing)
        if (!force) {
          const cached = cache.getCached<T>(cacheKey);
          if (cached?.data && !cached.error) {
            const age = Date.now() - cached.timestamp;
            if (age < cached.staleTime) {
              return cached.data;
            }
          }
        }

        // Fetch fresh data and let the cache handle storage
        const data = await cache.get(cacheKey, () => fetchJSON<T>(url), {
          staleTime,
          retry: 1,
          retryDelay: 1000,
          dedupe: true,
          cacheTime: staleTime * 2,
        });

        return data;
      } finally {
        pendingRef.current.delete(cacheKey);
      }
    })();

    // Store pending request
    pendingRef.current.set(cacheKey, fetchPromise);
    
    return fetchPromise;
  }, [fetchJSON, cache, enabled, staleTime, cachePattern]);

  const invalidateCache = useCallback((pattern?: string) => {
    cache.invalidate(pattern || cachePattern);
    pendingRef.current.clear();
  }, [cache, cachePattern]);

  const prefetchUrl = useCallback((url: string) => {
    // Fire and forget prefetch
    cachedFetch(url).catch(() => {
      // Silently handle prefetch errors
    });
  }, [cachedFetch]);

  return {
    cachedFetch,
    invalidateCache,
    prefetchUrl,
  };
}
