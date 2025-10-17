import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BookItem, GridCards } from '@/components/book/BookGrid';
import { Text, View } from '@/components/shared/Themed';
import { useColorScheme } from '@/components/shared/useColorScheme';
import Colors from '@/constants/Colors';
import { useOptimizedBooks } from '@/hooks/useOptimizedBooks';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { favoritesLogger } from '@/utils/logger';
import { useTranslation } from '@/i18n/LanguageContext';
import { normalizeLanguage } from '@/i18n/translations';
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
  } = useAuth();
  const { scheduleRefresh } = useSmartRefresh();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { language: baseLanguage, t } = useTranslation();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const flatRef = useRef<FlatList<number>>(null);
  const initializedRef = useRef(false);

  const languagePreference = session?.user?.language ?? baseLanguage;
  const languageId = useMemo(() => normalizeLanguage(languagePreference), [languagePreference]);

  // Stable parameters and options for favorites
  const favoritesQueryParams = useMemo(() => ({
    pageIndex: currentPageIndex,
    pageSize: PAGE_SIZE,
    languageId,
    genreId: null,
    searchText: undefined,
  }), [currentPageIndex, languageId]);

  const favoritesQueryOptions = useMemo(() => ({
    enabled: true,
    staleTime: 60 * 1000, // 1 minute for favorites - reactive updates handle changes
    prefetchDistance: 1,
    isFavorites: true,
  }), []);

  // Use optimized books hook for favorites
  const {
    data: currentPageData,
    isLoading: pageLoading,
    error: pageError,
    refetch: refetchCurrentPage,
    prefetchAdjacent,
    invalidateCache: invalidateFavoritesCache,
  } = useOptimizedBooks(favoritesQueryParams, favoritesQueryOptions);

  // Derived values from optimized data
  const total = currentPageData?.total ?? null;
  const currentPageItems = currentPageData?.items ?? [];
  const isLoading = pageLoading;
  const error = pageError;

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

  // Helper to trigger prefetch of adjacent pages
  const triggerPrefetch = useCallback(
    (pageIndex: number) => {
      prefetchAdjacent(pageIndex, maxPageIndex).catch(() => {
        favoritesLogger.warn('Failed to prefetch adjacent pages', { pageIndex });
      });
    },
    [prefetchAdjacent, maxPageIndex]
  );



  // Reset pagination when user or language changes
  const userEmail = session?.user?.email;
  const sessionToken = session?.token;
  useEffect(() => {
    if (!userEmail || !sessionToken) {
      // User logged out, clear everything
      favoritesLogger.info('User logged out, clearing favorites data');
      invalidateFavoritesCache();
      return;
    }
    
    // Only reset if this is not the initial load
    if (initializedRef.current) {
      favoritesLogger.info('User or language changed, resetting favorites pagination', { 
        userEmail, 
        languageId 
      });
      
      invalidateFavoritesCache();
      setCurrentPageIndex(0);
      initializedRef.current = false;
      flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    }
  }, [userEmail, sessionToken, languageId, invalidateFavoritesCache]);

  // Handle favorites dirty flag - this handles individual favorite/unfavorite actions
  useEffect(() => {
    if (!favoritesDirty) return;
    
    favoritesLogger.info('Favorites dirty flag detected, refreshing data');
    acknowledgeFavorites();
    
    // Invalidate cache to ensure fresh data on next request
    invalidateFavoritesCache();
    
    // Force refresh the current page data to reflect changes
    refetchCurrentPage().then((newData) => {
      favoritesLogger.debug('Favorites data refreshed after dirty flag', {
        newTotal: newData?.total,
        currentPage: currentPageIndex,
      });
      
      // If we're on a page that no longer has data, go back to first page
      if (newData && typeof newData.total === 'number') {
        const maxPage = Math.max(0, Math.ceil(newData.total / PAGE_SIZE) - 1);
        if (currentPageIndex > maxPage) {
          setCurrentPageIndex(0);
          flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
          favoritesLogger.debug('Reset to first page - current page out of bounds', {
            currentPage: currentPageIndex,
            maxPage,
            newTotal: newData.total,
          });
        }
      }
    }).catch((error) => {
      favoritesLogger.error('Failed to refresh favorites after dirty flag', { error });
    });
  }, [favoritesDirty, acknowledgeFavorites, refetchCurrentPage, invalidateFavoritesCache, currentPageIndex]);

  // Only trigger prefetch after data is loaded and we're on page 0
  useEffect(() => {
    if (currentPageData && typeof currentPageData.total === 'number' && currentPageIndex === 0 && !isLoading) {
      // Only prefetch if there are more pages available
      if (currentPageData.total > PAGE_SIZE) {
        favoritesLogger.debug('Data loaded for favorites page 0, triggering prefetch', { 
          total: currentPageData.total,
          hasMorePages: currentPageData.total > PAGE_SIZE 
        });
        triggerPrefetch(currentPageIndex);
      }
    }
  }, [currentPageData, currentPageIndex, isLoading, triggerPrefetch]);

  useFocusEffect(
    useCallback(() => {
      // Smart session refresh - prevents duplicates
      const cleanup = scheduleRefresh();
      
      favoritesLogger.debug('Library screen focused', {
        initialized: initializedRef.current,
        favoritesDirty,
        hasData: !!currentPageData,
        total: currentPageData?.total,
        currentPage: currentPageIndex,
      });
      
      if (!initializedRef.current) {
        initializedRef.current = true;
        // Don't prefetch on first load - wait for data to arrive
        favoritesLogger.debug('Initial focus on favorites - waiting for data before prefetch');
      } else {
        // Only prefetch on subsequent focus if we have data
        // Don't automatically refresh - let the reactive effects handle updates
        if (currentPageData && typeof currentPageData.total === 'number') {
          triggerPrefetch(currentPageIndex);
        }
      }

      return cleanup;
    }, [scheduleRefresh, triggerPrefetch, currentPageIndex, currentPageData]),
  );

  const onMomentumEnd = useCallback(
    (ev: any) => {
      const x: number = ev.nativeEvent.contentOffset?.x ?? 0;
      const pageIndex = Math.round(x / screenWidth);
      if (pageIndex !== currentPageIndex) {
        setCurrentPageIndex(pageIndex);
        // Trigger prefetch for new page
        triggerPrefetch(pageIndex);
      }
    },
    [screenWidth, currentPageIndex, triggerPrefetch],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      favoritesLogger.debug('Refreshing favorites via pull-to-refresh');
      await refetchCurrentPage();
      // Prefetch will be triggered by the useEffect above after data loads
    } finally {
      setRefreshing(false);
    }
  }, [refetchCurrentPage]);

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
      // For optimized version, we only render the current page
      const isCurrentPage = pageIndex === currentPageIndex;
      const items = isCurrentPage ? currentPageItems : [];
      const isLoadingPage = isCurrentPage && isLoading;

      return (
        <View style={[styles.page, { width: screenWidth }]}> 
          {isLoadingPage && (
            <View style={styles.pageLoading}>
              <ActivityIndicator />
              <Text>{t('library.loading')}</Text>
            </View>
          )}
          {!isLoadingPage && items.length === 0 && (
            <View style={styles.pageLoading}>
              <Text>{t('library.emptyPage')}</Text>
            </View>
          )}
          {!isLoadingPage && items.length > 0 && (
            <GridCards books={items} onPressBook={(b) => handlePressBook(b)} />
          )}
        </View>
      );
    },
    [currentPageIndex, currentPageItems, isLoading, screenWidth, handlePressBook],
  );

  const emptyState = !isLoading && total === 0;
  const singlePageItems = currentPageItems;

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 6, backgroundColor: palette.background }]}
    > 
      <View style={styles.header}>
        <Text style={styles.title}>{t('library.heading')}</Text>
        <Text style={styles.pageCount}>
          {maxPageIndex > 0 ? `${currentPageIndex + 1} / ${maxPageIndex + 1}` : ''}
        </Text>
      </View>

      {emptyState ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('library.none')}</Text>
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
          <Text>{t('library.loading')}</Text>
        </View>
      )}

      <View
        style={[styles.footer, { borderTopColor: palette.tabIconDefault, paddingBottom: insets.bottom }]}
      >
        <Text style={[styles.footerText, { color: palette.text }]}>
          {total == null
            ? '...'
            : t(total === 1 ? 'library.totalSingular' : 'library.totalPlural', { count: total })}
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
