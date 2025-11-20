// hooks/useOptimizedBooks.ts
/**
 * Optimized book management hook with intelligent caching and prefetching
 * Integrates seamlessly with existing manual pagination systems
 */
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BookItem, BooksResponse } from '@/components/book/BookGrid';
import { BASE_URL } from '@/constants/API';
import { booksLogger } from '@/utils/logger';
import { useCallback, useMemo, useRef } from 'react';
import { useCachedRequest, useRequestCache } from './useRequestCache';

interface BookQueryParams {
  pageIndex: number;
  pageSize: number;
  languageId: string;
  genreId?: number | null;
  searchText?: string;
}

interface UseOptimizedBooksOptions {
  enabled?: boolean;
  staleTime?: number;
  prefetchDistance?: number;
  isFavorites?: boolean;
}

interface BookPageResult {
  data?: BooksResponse;
  isLoading: boolean;
  error?: string | null;
  refetch: () => Promise<BooksResponse>;
  prefetchAdjacent: (currentPageIndex: number, maxPage?: number) => Promise<void>;
  invalidateCache: () => void;
}

export function useOptimizedBooks(
  params: BookQueryParams,
  options: UseOptimizedBooksOptions = {}
): BookPageResult {
  const { fetchJSON } = useAuthedFetch();
  const cache = useRequestCache();
  const prefetchedRef = useRef(new Set<string>());

  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    prefetchDistance = 1,
    isFavorites = false,
  } = options;

  // Generate unique cache key
  const cacheKey = useMemo(() => {
    if (!enabled) return null;
    
    const { pageIndex, pageSize, languageId, genreId, searchText } = params;
    const parts = [
      isFavorites ? 'favorites' : 'books',
      `page:${pageIndex}`,
      `size:${pageSize}`,
      `lang:${languageId}`,
      genreId ? `genre:${genreId}` : 'all',
      searchText ? `search:${encodeURIComponent(searchText)}` : 'none',
    ];
    return parts.join('|');
  }, [params, enabled, isFavorites]);

  // Function to make the API request
  const fetcherFunction = useCallback(async (): Promise<BooksResponse> => {
    const { pageIndex, pageSize, languageId, genreId, searchText } = params;
    
    const start = pageIndex * pageSize;
    const end = start + (pageSize - 1);

    let url: string;
    const urlParams = new URLSearchParams({
      start: String(start),
      end: String(end),
      languageId,
    });

    if (isFavorites) {
      url = `${BASE_URL}/favorites?${urlParams.toString()}`;
    } else if (searchText) {
      urlParams.set('text', searchText);
      url = `${BASE_URL}/books/search?${urlParams.toString()}`;
    } else if (genreId != null) {
      urlParams.set('genreId', String(genreId));
      url = `${BASE_URL}/books/genre?${urlParams.toString()}`;
    } else {
      url = `${BASE_URL}/books?${urlParams.toString()}`;
    }

    booksLogger.info('Loading optimized page', {
      pageIndex,
      start,
      end,
      searchText: searchText || null,
      genreId: genreId ?? null,
      languageId,
      isFavorites,
    });

    const data = await fetchJSON<BooksResponse>(url);
    
    // Normalize data
    const normalizedItems = (data.items ?? []).map((item: any): BookItem => ({
      ...item,
      author: typeof item.author === 'string' && item.author.trim()
        ? item.author
        : 'Autor desconhecido',
      listeningProgressPercent:
        typeof item.listeningProgressPercent === 'number'
          ? item.listeningProgressPercent
          : null,
    }));

    return {
      ...data,
      items: normalizedItems,
      total: typeof data.total === 'number' ? data.total : normalizedItems.length,
    };
  }, [params, fetchJSON, isFavorites]);

  // Stable options to prevent re-renders
  const stableOptions = useMemo(() => ({
    staleTime,
    retry: 2,
    retryDelay: 1000,
    dedupe: true,
  }), [staleTime]);

  // Main cache hook
  const { data, isLoading, error, refetch } = useCachedRequest(
    cacheKey,
    enabled ? fetcherFunction : null,
    stableOptions
  );

  // Function to prefetch adjacent pages
  const prefetchAdjacent = useCallback(async (currentPageIndex: number, maxPage?: number) => {
    if (!enabled) return;

    // Only prefetch if we have data and know the total
    if (!data || typeof data.total !== 'number') {
      booksLogger.debug('Skipping prefetch - no data or total unknown', { currentPageIndex });
      return;
    }

    const maxPageIndex = maxPage ?? Math.ceil(data.total / params.pageSize) - 1;

    // Don't prefetch if there's only one page
    if (maxPageIndex === 0) {
      booksLogger.debug('Skipping prefetch - only one page available', { total: data.total });
      return;
    }

    // Prefetch next and previous pages
    for (let i = 1; i <= prefetchDistance; i++) {
      const nextPage = currentPageIndex + i;
      const prevPage = currentPageIndex - i;

      // Prefetch next page only if there are enough items
      if (nextPage <= maxPageIndex && data.total > nextPage * params.pageSize) {
        const nextParams = { ...params, pageIndex: nextPage };
        const nextKey = [
          isFavorites ? 'favorites' : 'books',
          `page:${nextPage}`,
          `size:${params.pageSize}`,
          `lang:${params.languageId}`,
          params.genreId ? `genre:${params.genreId}` : 'all',
          params.searchText ? `search:${encodeURIComponent(params.searchText)}` : 'none',
        ].join('|');

        if (!prefetchedRef.current.has(nextKey)) {
          prefetchedRef.current.add(nextKey);
          
          const nextFetcher = async () => {
            const start = nextPage * params.pageSize;
            const end = start + (params.pageSize - 1);
            
            let url: string;
            const urlParams = new URLSearchParams({
              start: String(start),
              end: String(end),
              languageId: params.languageId,
            });

            if (isFavorites) {
              url = `${BASE_URL}/favorites?${urlParams.toString()}`;
            } else if (params.searchText) {
              urlParams.set('text', params.searchText);
              url = `${BASE_URL}/books/search?${urlParams.toString()}`;
            } else if (params.genreId != null) {
              urlParams.set('genreId', String(params.genreId));
              url = `${BASE_URL}/books/genre?${urlParams.toString()}`;
            } else {
              url = `${BASE_URL}/books?${urlParams.toString()}`;
            }

            const data = await fetchJSON<BooksResponse>(url);
            return {
              ...data,
              items: (data.items ?? []).map((item: any) => ({
                ...item,
                author: typeof item.author === 'string' && item.author.trim()
                  ? item.author
                  : 'Autor desconhecido',
                listeningProgressPercent:
                  typeof item.listeningProgressPercent === 'number'
                    ? item.listeningProgressPercent
                    : null,
              })),
              total: typeof data.total === 'number' ? data.total : data.items?.length || 0,
            };
          };

          cache.prefetch(nextKey, nextFetcher);
        }
      }

      // Prefetch previous page
      if (prevPage >= 0) {
        const prevKey = [
          isFavorites ? 'favorites' : 'books',
          `page:${prevPage}`,
          `size:${params.pageSize}`,
          `lang:${params.languageId}`,
          params.genreId ? `genre:${params.genreId}` : 'all',
          params.searchText ? `search:${encodeURIComponent(params.searchText)}` : 'none',
        ].join('|');

        if (!prefetchedRef.current.has(prevKey)) {
          prefetchedRef.current.add(prevKey);
          
          const prevFetcher = async () => {
            const start = prevPage * params.pageSize;
            const end = start + (params.pageSize - 1);
            
            let url: string;
            const urlParams = new URLSearchParams({
              start: String(start),
              end: String(end),
              languageId: params.languageId,
            });

            if (isFavorites) {
              url = `${BASE_URL}/favorites?${urlParams.toString()}`;
            } else if (params.searchText) {
              urlParams.set('text', params.searchText);
              url = `${BASE_URL}/books/search?${urlParams.toString()}`;
            } else if (params.genreId != null) {
              urlParams.set('genreId', String(params.genreId));
              url = `${BASE_URL}/books/genre?${urlParams.toString()}`;
            } else {
              url = `${BASE_URL}/books?${urlParams.toString()}`;
            }

            const data = await fetchJSON<BooksResponse>(url);
            return {
              ...data,
              items: (data.items ?? []).map((item: any) => ({
                ...item,
                author: typeof item.author === 'string' && item.author.trim()
                  ? item.author
                  : 'Autor desconhecido',
                listeningProgressPercent:
                  typeof item.listeningProgressPercent === 'number'
                    ? item.listeningProgressPercent
                    : null,
              })),
              total: typeof data.total === 'number' ? data.total : data.items?.length || 0,
            };
          };

          cache.prefetch(prevKey, prevFetcher);
        }
      }
    }
  }, [enabled, data, params, prefetchDistance, fetchJSON, cache, isFavorites]);

  // Function to invalidate cache when filters change
  const invalidateCache = useCallback(() => {
    const pattern = isFavorites ? 'favorites' : 'books';
    cache.invalidate(pattern);
    prefetchedRef.current.clear();
  }, [cache, isFavorites]);

  return {
    data,
    isLoading,
    error,
    refetch,
    prefetchAdjacent,
    invalidateCache,
  };
}
