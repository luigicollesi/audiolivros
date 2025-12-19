import { useCallback, useMemo } from 'react';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useCachedRequest } from '@/hooks/useRequestCache';
import { BASE_URL } from '@/constants/API';
import { GENRES, translateGenreLabel } from '@/constants/Genres';
import type { LanguageCode } from '@/i18n/types';
import type { BookItem, BooksResponse } from '@/components/book/BookGrid';
import type { GenreOption } from '@/components/book/GenreModal';

export const ROW_LIMIT = 12;
export const LOOP_MULTIPLIER = 8;

export type RowRequest =
  | { kind: 'favorites'; limit: number }
  | { kind: 'latest'; limit: number }
  | { kind: 'search'; limit: number; searchText: string }
  | { kind: 'genre'; limit: number; genreId: number };

export type RowConfig = {
  id: string;
  title: string;
  request: RowRequest;
  emptyLabel?: string;
};

export type RowHookState = {
  books: BookItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<any>;
  meta?: Record<string, unknown>;
};

type InsightBookSummary = {
  bookId?: string;
  title?: string;
  author?: string;
  year?: number;
  cover_url?: string;
  progressPercent?: number | null;
  listeningProgressPercent?: number | null;
  locked?: boolean | string | number | null;
};

type InsightListResponse<T> = {
  items?: T[];
  baseBookTitle?: string | null;
};

type InsightFetcherResult = {
  books: BookItem[];
  meta?: Record<string, unknown>;
};

const sessionGenreSequences = new Map<string, number[]>();
const INSIGHT_FALLBACK_TITLE = 'Título indisponível';
const INSIGHT_FALLBACK_AUTHOR = 'Autor desconhecido';

export function useHomeRowBooks(
  config: RowConfig,
  languageId: string,
  enabled: boolean,
): RowHookState {
  const { fetchJSON } = useAuthedFetch();
  const cacheKey = useMemo(
    () => (enabled ? buildCacheKey(config, languageId) : null),
    [config, languageId, enabled],
  );
  const fetcher = useCallback(
    () => fetchRowData(fetchJSON, config.request, languageId),
    [fetchJSON, config, languageId],
  );
  const { data, isLoading, error, refetch } = useCachedRequest(
    cacheKey,
    enabled ? fetcher : null,
    {
      staleTime: 2 * 60 * 1000,
      retry: 1,
      retryDelay: 1000,
    },
  );

  return {
    books: data?.items ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}

export function useTopReadShelf(languageId: string, enabled: boolean): RowHookState {
  const { fetchJSON } = useAuthedFetch();
  const fetcher = useCallback(async () => {
    const url = `${BASE_URL}/audio-insights/top-books?languageId=${languageId}`;
    const response = await fetchJSON<InsightListResponse<InsightBookSummary>>(url);
    return {
      books: (response.items ?? []).map((item) => mapInsightBook(item)),
    };
  }, [fetchJSON, languageId]);

  return useInsightRequest(
    enabled ? `insight-top|lang:${languageId}` : null,
    enabled ? fetcher : null,
    enabled,
  );
}

export function useListeningShelf(languageId: string, enabled: boolean): RowHookState {
  const { fetchJSON } = useAuthedFetch();
  const fetcher = useCallback(async () => {
    const url = `${BASE_URL}/audio-insights/listening?languageId=${languageId}`;
    const response = await fetchJSON<InsightListResponse<InsightBookSummary>>(url);
    return {
      books: (response.items ?? []).map((item) => mapInsightBook(item)),
    };
  }, [fetchJSON, languageId]);

  return useInsightRequest(
    enabled ? `insight-listening|lang:${languageId}` : null,
    enabled ? fetcher : null,
    enabled,
  );
}

export function useFinishedShelf(languageId: string, enabled: boolean): RowHookState {
  const { fetchJSON } = useAuthedFetch();
  const fetcher = useCallback(async () => {
    const url = `${BASE_URL}/audio-insights/rewatch?languageId=${languageId}`;
    const response = await fetchJSON<InsightListResponse<InsightBookSummary>>(url);
    return {
      books: (response.items ?? []).map((item) => mapInsightBook(item)),
    };
  }, [fetchJSON, languageId]);

  return useInsightRequest(
    enabled ? `insight-finished|lang:${languageId}` : null,
    enabled ? fetcher : null,
    enabled,
  );
}

export function useRecommendationShelf(languageId: string, enabled: boolean): RowHookState {
  const { fetchJSON } = useAuthedFetch();
  const fetcher = useCallback(async () => {
    const url = `${BASE_URL}/audio-insights/recommendations?languageId=${languageId}`;
    const response = await fetchJSON<InsightListResponse<InsightBookSummary>>(url);
    return {
      books: (response.items ?? []).map((item) => mapInsightBook(item)),
      meta: {
        baseBookTitle: response.baseBookTitle ?? null,
      },
    };
  }, [fetchJSON, languageId]);

  return useInsightRequest(
    enabled ? `insight-recommendations|lang:${languageId}` : null,
    enabled ? fetcher : null,
    enabled,
  );
}

export function buildRowConfigs(params: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  searchText: string;
  selectedGenre: GenreOption | null;
  favoriteGenreId: number | null;
  randomOrder: number[];
  languageId: LanguageCode;
}): RowConfig[] {
  const { t, searchText, selectedGenre, favoriteGenreId, randomOrder, languageId } =
    params;
  const configs: RowConfig[] = [
    {
      id: 'row-library',
      title: t('home.rows.library'),
      request: { kind: 'favorites', limit: ROW_LIMIT },
      emptyLabel: t('home.rows.libraryEmpty'),
    },
  ];

  if (searchText) {
    configs.push({
      id: `row-search-${searchText.toLowerCase()}`,
      title: t('home.rows.search', { text: searchText }),
      request: { kind: 'search', limit: ROW_LIMIT, searchText },
      emptyLabel: t('home.rows.searchEmpty'),
    });
  } else {
    configs.push({
      id: 'row-new',
      title: t('home.rows.new'),
      request: { kind: 'latest', limit: ROW_LIMIT },
      emptyLabel: t('home.rows.emptyDefault'),
    });
  }

  const selectedGenreId = selectedGenre?.id ?? null;
  const used = new Set<number>();
  if (favoriteGenreId) used.add(favoriteGenreId);
  if (selectedGenreId) used.add(selectedGenreId);

  const pool = (randomOrder.length ? randomOrder : GENRES.map((g) => g.id)).filter(
    (id) => !used.has(id),
  );
  let cursor = 0;
  const pullRandom = (): number => {
    if (pool.length === 0) {
      return GENRES[0].id;
    }
    const genreId = pool[cursor % pool.length];
    cursor = (cursor + 1) % pool.length;
    return genreId;
  };

  const recommendedGenreId = favoriteGenreId ?? pullRandom();
  configs.push({
    id: favoriteGenreId
      ? `row-recommended-${recommendedGenreId}`
      : `row-random-${recommendedGenreId}-rec`,
    title: favoriteGenreId
      ? t('home.rows.recommended')
      : t('home.rows.genrePrefix', { name: getGenreName(recommendedGenreId, languageId) }),
    request: { kind: 'genre', limit: ROW_LIMIT, genreId: recommendedGenreId },
    emptyLabel: t('home.rows.randomEmpty'),
  });

  const selectedRowGenreId = selectedGenreId ?? pullRandom();
  configs.push({
    id: selectedGenreId
      ? `row-selected-${selectedGenreId}`
      : `row-random-${selectedRowGenreId}-slot4`,
    title: selectedGenreId
      ? t('home.rows.genrePrefix', { name: selectedGenre?.name ?? getGenreName(selectedRowGenreId, languageId) })
      : t('home.rows.genrePrefix', { name: getGenreName(selectedRowGenreId, languageId) }),
    request: { kind: 'genre', limit: ROW_LIMIT, genreId: selectedRowGenreId },
    emptyLabel: t('home.rows.randomEmpty'),
  });

  while (configs.length < 6) {
    const genreId = pullRandom();
    configs.push({
      id: `row-random-${genreId}-slot${configs.length}`,
      title: t('home.rows.genrePrefix', { name: getGenreName(genreId, languageId) }),
      request: { kind: 'genre', limit: ROW_LIMIT, genreId },
      emptyLabel: t('home.rows.randomEmpty'),
    });
  }

  return configs;
}

export function getSessionGenreSequence(userKey: string) {
  let existing = sessionGenreSequences.get(userKey);
  if (!existing) {
    const ids = GENRES.map((genre) => genre.id);
    shuffleArray(ids);
    sessionGenreSequences.set(userKey, ids);
    existing = ids;
  }
  return existing;
}

export function normalizeBooksResponse(data: BooksResponse): BooksResponse {
  const normalizedItems = (data.items ?? []).map((item) => ({
    ...item,
    author:
      typeof item.author === 'string' && item.author.trim()
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
}

function buildCacheKey(config: RowConfig, languageId: string) {
  const { request } = config;
  const base = [
    'home-row',
    config.id,
    `lang:${languageId}`,
    `kind:${request.kind}`,
    `limit:${request.limit}`,
  ];
  if (request.kind === 'genre') {
    base.push(`genre:${request.genreId}`);
  }
  if (request.kind === 'search') {
    base.push(`search:${encodeURIComponent(request.searchText.trim().toLowerCase())}`);
  }
  return base.join('|');
}

async function fetchRowData(
  fetchJSON: <T = unknown>(input: RequestInfo | URL, opts?: RequestInit) => Promise<T>,
  request: RowRequest,
  languageId: string,
) {
  const url = buildRowUrl(request, languageId);
  const data = await fetchJSON<BooksResponse>(url);
  return normalizeBooksResponse(data);
}

function buildRowUrl(request: RowRequest, languageId: string) {
  const start = 0;
  const end = Math.max(0, request.limit - 1);
  const params = new URLSearchParams({
    start: String(start),
    end: String(end),
    languageId,
  });
  switch (request.kind) {
    case 'favorites':
      return `${BASE_URL}/favorites?${params.toString()}`;
    case 'search':
      params.set('text', request.searchText);
      return `${BASE_URL}/books/search?${params.toString()}`;
    case 'genre':
      params.set('genreId', String(request.genreId));
      return `${BASE_URL}/books/genre?${params.toString()}`;
    case 'latest':
    default:
      return `${BASE_URL}/books?${params.toString()}`;
  }
}

function useInsightRequest(
  cacheKey: string | null,
  fetcher: (() => Promise<InsightFetcherResult>) | null,
  enabled: boolean,
): RowHookState {
  const { data, isLoading, error, refetch } = useCachedRequest(
    cacheKey,
    enabled ? fetcher : null,
    {
      staleTime: 2 * 60 * 1000,
      retry: 1,
      retryDelay: 1000,
    },
  );

  return {
    books: data?.books ?? [],
    loading: enabled ? isLoading : false,
    error,
    refetch,
    meta: data?.meta,
  };
}

function mapInsightBook(summary?: InsightBookSummary): BookItem {
  if (!summary) {
    return {
      title: INSIGHT_FALLBACK_TITLE,
      author: INSIGHT_FALLBACK_AUTHOR,
      year: 0,
      cover_url: '',
      listeningProgressPercent: null,
      locked: false,
    };
  }

  const author = summary.author?.trim() || INSIGHT_FALLBACK_AUTHOR;
  const title = summary.title?.trim() || INSIGHT_FALLBACK_TITLE;
  const year =
    typeof summary.year === 'number' && Number.isFinite(summary.year)
      ? summary.year
      : 0;
  const progress =
    typeof summary.progressPercent === 'number'
      ? summary.progressPercent
      : typeof summary.listeningProgressPercent === 'number'
      ? summary.listeningProgressPercent
      : null;

  return {
    title,
    author,
    year,
    cover_url: summary.cover_url ?? '',
    listeningProgressPercent: progress,
    locked:
      summary.locked === true ||
      summary.locked === 'true' ||
      summary.locked === 1,
  };
}

function shuffleArray(values: number[]) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

function getGenreName(genreId: number, languageId: LanguageCode) {
  const base = GENRES.find((genre) => genre.id === genreId);
  if (!base) return `Gênero ${genreId}`;
  const translated = translateGenreLabel(
    { id: base.id, slug: base.slug, name: base.name },
    languageId,
  );
  return translated || base.name;
}
