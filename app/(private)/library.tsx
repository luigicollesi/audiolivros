import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BookItem, BooksResponse, GridCards } from '@/components/book/BookGrid';
import { Text, View } from '@/components/shared/Themed';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { BASE_URL } from '@/constants/API';
import Colors from '@/constants/Colors';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { favoritesLogger } from '@/utils/logger';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Platform,
  RefreshControl,
  StyleSheet,
} from 'react-native';

const PAGE_SIZE = 10;

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeInsets();
  const { fetchJSON } = useAuthedFetch();
  const {
    session,
    favoritesDirty,
    acknowledgeFavorites,
    markFavoritesDirty,
  } = useAuth();
  const { scheduleRefresh } = useSmartRefresh();
  const { cachedFetch, invalidateCache } = useCachedFetch({
    cachePattern: 'favorites',
    staleTime: 2 * 60 * 1000, // 2 minutes for favorites (shorter since they change more)
  });
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, BookItem[]>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const [, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const flatRef = useRef<FlatList<number>>(null);
  const initializedRef = useRef(false);
  const prefetchedPagesRef = useRef<Set<number>>(new Set());

  const languagePreference = session?.user?.language;
  const languageId = useMemo(() => {
    const normalized =
      typeof languagePreference === 'string' ? languagePreference.trim() : '';
    return normalized || 'pt-BR';
  }, [languagePreference]);

  const maxPageIndex = useMemo(() => {
    if (total == null) return 0;
    return Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  }, [total]);

  const availablePages = useMemo<number[]>(() => {
    if (total == null) return [0];
    return Array.from({ length: maxPageIndex + 1 }, (_, i) => i);
  }, [total, maxPageIndex]);

  const multiPage = useMemo(() => {
    if (total == null) return undefined;
    return total > PAGE_SIZE;
  }, [total]);

  const fetchPage = useCallback(
    async (pageIndex: number, force = false) => {
      if (pageIndex < 0) return;
      if (force) {
        prefetchedPagesRef.current.delete(pageIndex);
      }
      if (!force && pages[pageIndex]) return;
      if (loadingPages.has(pageIndex)) return;

      setLoadingPages((prev) => new Set(prev).add(pageIndex));
      setError(null);

      const start = pageIndex * PAGE_SIZE;
      const end = start + (PAGE_SIZE - 1);
      const params = new URLSearchParams({
        start: String(start),
        end: String(end),
        languageId,
      });
      const url = `${BASE_URL}/favorites?${params.toString()}`;

      try {
        favoritesLogger.info('Carregando favoritos (cached)', {
          pageIndex,
          start,
          end,
          languageId,
        });
        const data = await cachedFetch<BooksResponse>(url, force);
        const normalizedItems = (data.items ?? []).map((item) => ({
          ...item,
          author:
            typeof item.author === 'string' && item.author.trim()
              ? item.author
              : 'Autor desconhecido',
        }));

        if (typeof data.total === 'number') {
          setTotal(data.total);
        } else {
          setTotal((old) => old ?? normalizedItems.length);
        }

        setPages((prev) => {
          prefetchedPagesRef.current.add(pageIndex);
          return { ...prev, [pageIndex]: normalizedItems };
        });
        favoritesLogger.debug('Favoritos carregados', {
          pageIndex,
          itemCount: normalizedItems.length,
          total: typeof data.total === 'number' ? data.total : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Falha ao carregar favoritos: ${message}`);
        favoritesLogger.debug('Erro ao buscar favoritos', {
          pageIndex,
          error: message,
        });
      } finally {
        setLoadingPages((prev) => {
          const next = new Set(prev);
          next.delete(pageIndex);
          return next;
        });
      }
    },
    [pages, loadingPages, cachedFetch, languageId],
  );

  const prefetchNext = useCallback(
    (pageIndex: number) => {
      const nextIndex = pageIndex + 1;
      if (nextIndex < 0) return;
      if (total != null && nextIndex > maxPageIndex) return;
      if (prefetchedPagesRef.current.has(nextIndex)) return;
      fetchPage(nextIndex).catch(() => {});
    },
    [fetchPage, total, maxPageIndex],
  );

  useEffect(() => {
    // Invalidate cache when language changes
    invalidateCache();
    
    setPages({});
    setTotal(null);
    setCurrentPageIndex(0);
    initializedRef.current = false;
    prefetchedPagesRef.current = new Set();
    flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    favoritesLogger.debug('Recarregando favoritos por idioma', { languageId });
    fetchPage(0, true).then(() => {
      prefetchNext(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageId, invalidateCache]);

  useEffect(() => {
    if (!favoritesDirty) return;
    acknowledgeFavorites();
    
    // Invalidate cache when favorites change
    invalidateCache();
    
    favoritesLogger.debug('Flag de favoritos alterada, atualizando lista');
    setPages({});
    setTotal(null);
    setCurrentPageIndex(0);
    initializedRef.current = false;
    prefetchedPagesRef.current = new Set();
    flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    fetchPage(0, true)
      .then(() => {
        prefetchNext(0);
      })
      .catch(() => {
        // caso falhe, marca novamente para tentar em outra navegação
        markFavoritesDirty();
        favoritesLogger.warn('Falha ao atualizar favoritos após mudança de estado, flag mantida');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesDirty, acknowledgeFavorites, fetchPage, prefetchNext, markFavoritesDirty, invalidateCache]);

  useFocusEffect(
    useCallback(() => {
      // Smart session refresh - prevents duplicates
      const cleanup = scheduleRefresh();
      
      if (!initializedRef.current) {
        initializedRef.current = true;
        if (!pages[0]) {
          fetchPage(0, true).then(() => {
            prefetchNext(0);
          });
        } else {
          prefetchNext(currentPageIndex);
        }
      } else {
        prefetchNext(currentPageIndex);
      }

      return cleanup;
    }, [scheduleRefresh, fetchPage, prefetchNext, pages, currentPageIndex]),
  );

  const onMomentumEnd = useCallback(
    (ev: any) => {
      const x: number = ev.nativeEvent.contentOffset?.x ?? 0;
      const pageIndex = Math.round(x / screenWidth);
      if (pageIndex !== currentPageIndex) {
        setCurrentPageIndex(pageIndex);
      }
      fetchPage(pageIndex).then(() => prefetchNext(pageIndex));
    },
    [screenWidth, fetchPage, prefetchNext, currentPageIndex],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      favoritesLogger.debug('Atualizando favoritos via pull-to-refresh');
      await fetchPage(currentPageIndex, true);
      prefetchNext(currentPageIndex);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, prefetchNext, currentPageIndex]);

  const handlePressBook = useCallback(
    (b: BookItem) => {
      favoritesLogger.debug('Abrindo detalhe de favorito', {
        title: b.title,
        author: b.author,
      });
      router.push({
        pathname: '/book',
        params: {
          title: b.title,
          author: b.author,
          year: String(b.year),
          cover_url: b.cover_url,
          language: languageId,
        },
      });
    },
    [router, languageId],
  );

  const renderPage = useCallback(
    ({ item: pageIndex }: ListRenderItemInfo<number>) => {
      const items = pages[pageIndex];
      const isLoading = loadingPages.has(pageIndex) && !items;

      return (
        <View style={[styles.page, { width: screenWidth }]}> 
          {isLoading && (
            <View style={styles.pageLoading}>
              <ActivityIndicator />
              <Text>Carregando favoritos...</Text>
            </View>
          )}
          {!!items && items.length === 0 && (
            <View style={styles.pageLoading}>
              <Text>Nenhum favorito nesta página.</Text>
            </View>
          )}
          {!!items && items.length > 0 && (
            <GridCards books={items} onPressBook={(b) => handlePressBook(b)} />
          )}
        </View>
      );
    },
    [pages, loadingPages, screenWidth, handlePressBook],
  );

  const emptyState = loadingPages.size === 0 && total === 0;
  const singlePageItems = pages[0] ?? (emptyState ? [] : undefined);

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 6, backgroundColor: palette.background }]}
    > 
      <View style={styles.header}>
        <Text style={styles.title}>Favoritos</Text>
        <Text style={styles.pageCount}>
          {maxPageIndex > 0 ? `${currentPageIndex + 1} / ${maxPageIndex + 1}` : ''}
        </Text>
      </View>

      {emptyState ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhum livro nos favoritos ainda.</Text>
        </View>
      ) : multiPage ? (
        <FlatList
          ref={flatRef}
          data={availablePages}
          keyExtractor={(i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={renderPage}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          directionalLockEnabled
          snapToInterval={screenWidth}
          disableIntervalMomentum
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
          nestedScrollEnabled
        />
      ) : singlePageItems ? (
        <View style={styles.singlePageWrapper}>
          <GridCards books={singlePageItems} onPressBook={(b) => handlePressBook(b)} />
        </View>
      ) : (
        <View style={styles.pageLoading}>
          <ActivityIndicator color={palette.tint} />
          <Text>Carregando favoritos...</Text>
        </View>
      )}

      <View
        style={[styles.footer, { borderTopColor: palette.tabIconDefault, paddingBottom: insets.bottom }]}
      >
        <Text style={[styles.footerText, { color: palette.text }]}>
          {total == null ? '...' : `${total} livros favoritados`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  pageCount: {
    fontSize: 16,
    opacity: 0.7,
  },
  page: { flex: 1 },
  pageLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  footerText: { fontSize: 12, opacity: 0.7 },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: { fontSize: 16, opacity: 0.7, textAlign: 'center' },
  singlePageWrapper: { flex: 1, width: '100%' },
});
