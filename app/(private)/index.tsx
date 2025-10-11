// app/(private)/index.tsx
import { BookItem, GridCards } from '@/components/book/BookGrid';
import { GenreModal, GenreOption } from '@/components/book/GenreModal';
import { Text, View } from '@/components/shared/Themed';
import { useFocusEffect, useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  ListRenderItemInfo,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useColorScheme } from '@/components/shared/useColorScheme';
import Colors from '@/constants/Colors';
import { useOptimizedBooks } from '@/hooks/useOptimizedBooks';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { booksLogger } from '@/utils/logger';

const PAGE_SIZE = 10;
const DEFAULT_LANGUAGE = 'pt-BR';

export default function TabOneScreen() {
  const router = useRouter();
  const insets = useSafeInsets();
  const { fetchJSON } = useAuthedFetch();
  const { session } = useAuth();
  const { scheduleRefresh } = useSmartRefresh();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const accent = palette.tint;
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryTextColor = isDark ? '#000' : '#fff';

  const [selectedGenre, setSelectedGenre] = useState<GenreOption | null>(null);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const flatRef = useRef<FlatList<number>>(null);
  const initializedRef = useRef(false);
  const searchInputRef = useRef<TextInput>(null);

  const languagePreference = session?.user?.language;
  const languageId = useMemo(() => {
    const normalized =
      typeof languagePreference === 'string' ? languagePreference.trim() : '';
    return normalized || DEFAULT_LANGUAGE;
  }, [languagePreference]);

  // Stable parameters and options to prevent infinite re-renders
  const bookQueryParams = useMemo(() => ({
    pageIndex: currentPageIndex,
    pageSize: PAGE_SIZE,
    languageId,
    genreId: selectedGenre?.id || null,
    searchText: searchApplied || undefined,
  }), [currentPageIndex, languageId, selectedGenre?.id, searchApplied]);

  const bookQueryOptions = useMemo(() => ({
    enabled: true,
    staleTime: 3 * 60 * 1000, // 3 minutes for books
    prefetchDistance: 1,
  }), []);

  // Use optimized books hook with intelligent caching and prefetching
  const {
    data: currentPageData,
    isLoading: pageLoading,
    error: pageError,
    refetch: refetchCurrentPage,
    prefetchAdjacent,
    invalidateCache: invalidateBooksCache,
  } = useOptimizedBooks(bookQueryParams, bookQueryOptions);

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

  // Helper to trigger prefetch of adjacent pages
  const triggerPrefetch = useCallback(
    (pageIndex: number) => {
      prefetchAdjacent(pageIndex, maxPageIndex).catch(() => {
        booksLogger.warn('Failed to prefetch adjacent pages', { pageIndex });
      });
    },
    [prefetchAdjacent, maxPageIndex]
  );

  // Reset pagination when filters change
  useEffect(() => {
    // Invalidate cache when filters change
    invalidateBooksCache();
    
    setCurrentPageIndex(0);
    initializedRef.current = false;
    flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    
    booksLogger.info('Filter changed, resetting pagination', {
      genre: selectedGenre?.name || null,
      search: searchApplied || null,
      languageId,
    });
  }, [selectedGenre, languageId, searchApplied, invalidateBooksCache]);

  // Only trigger prefetch after data is loaded and we're on page 0
  useEffect(() => {
    if (currentPageData && typeof currentPageData.total === 'number' && currentPageIndex === 0 && !isLoading) {
      // Only prefetch if there are more pages available
      if (currentPageData.total > PAGE_SIZE) {
        booksLogger.debug('Data loaded for page 0, triggering prefetch', { 
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
      
      if (!initializedRef.current) {
        initializedRef.current = true;
        // Don't prefetch on first load - wait for data to arrive
        booksLogger.debug('Initial focus - waiting for data before prefetch');
      } else {
        // Only prefetch on subsequent focus if we have data
        if (currentPageData && typeof currentPageData.total === 'number') {
          triggerPrefetch(currentPageIndex);
        }
      }

      return cleanup;
    }, [scheduleRefresh, triggerPrefetch, currentPageIndex, currentPageData])
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
    [screenWidth, currentPageIndex, triggerPrefetch]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      booksLogger.debug('Refreshing books grid via pull-to-refresh');
      await refetchCurrentPage();
      // Prefetch will be triggered by the useEffect above after data loads
    } finally {
      setRefreshing(false);
    }
  }, [refetchCurrentPage]);

  const handlePressBook = useCallback(
    (b: BookItem) => {
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
    [router, languageId]
  );

  const renderPage = useCallback(
    ({ item: pageIndex }: ListRenderItemInfo<number>) => {
      // For optimized version, we only render the current page
      const isCurrentPage = pageIndex === currentPageIndex;
      const items = isCurrentPage ? currentPageItems : [];
      const isLoadingPage = isCurrentPage && isLoading;

      return (
        <View style={[screenStyles.page, { width: screenWidth }]}>
          {isLoadingPage && (
            <View style={screenStyles.pageLoading}>
              <ActivityIndicator color={palette.tint} />
              <Text>Carregando...</Text>
            </View>
          )}
          {!isLoadingPage && items.length === 0 && (
            <View style={screenStyles.pageLoading}>
              <Text>Nenhum item nesta página.</Text>
            </View>
          )}
          {!isLoadingPage && items.length > 0 && (
            <GridCards books={items} onPressBook={(b) => handlePressBook(b)} />
          )}
        </View>
      );
    },
    [currentPageIndex, currentPageItems, isLoading, screenWidth, handlePressBook, palette.tint]
  );

  const dismissKeyboard = useCallback(() => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const applySearch = useCallback(() => {
    const trimmed = searchInput.trim();
    if (trimmed === searchApplied) {
      dismissKeyboard();
      return;
    }
    if (trimmed) {
      setSelectedGenre(null);
    }
    setSearchApplied(trimmed);
    dismissKeyboard();
    booksLogger.info('Applying search to books grid', {
      text: trimmed,
    });
  }, [searchInput, searchApplied, dismissKeyboard]);

  const clearSearch = useCallback(() => {
    if (!searchApplied && !searchInput) return;
    setSearchInput('');
    if (searchApplied) {
      setSearchApplied('');
    }
    dismissKeyboard();
    booksLogger.info('Books search cleared');
  }, [searchApplied, searchInput, dismissKeyboard]);

  const onChangeSearch = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const searchActive = searchApplied.length > 0;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View
      style={[
        screenStyles.container,
        { paddingTop: insets.top + 6, backgroundColor: palette.background },
      ]}
    >
      {/* Header */}
      <View style={screenStyles.header}>
        <Text style={screenStyles.title}>
          {searchActive
            ? `Resultado: "${searchApplied}"`
            : selectedGenre
            ? selectedGenre.name
            : 'Mais recentes'}
        </Text>
        <Text style={screenStyles.pageCount}>
          {maxPageIndex > 0 ? `${currentPageIndex + 1} / ${maxPageIndex + 1}` : ''}
        </Text>
        <Pressable
          onPress={() => setShowGenreModal(true)}
          style={[screenStyles.filterButton, { backgroundColor: accent }]}
        >
          <Text style={[screenStyles.filterButtonText, { color: primaryTextColor }]}>
            Filtrar
          </Text>
        </Pressable>
      </View>

      <View style={screenStyles.searchRow}>
        <TextInput
          ref={searchInputRef}
          placeholder="Buscar por título ou autor"
          value={searchInput}
          onChangeText={onChangeSearch}
          style={[
            screenStyles.searchInput,
            {
              borderColor: palette.tabIconDefault,
              backgroundColor: isDark ? palette.bookCard : palette.background,
              color: palette.text,
            },
          ]}
          returnKeyType="search"
          blurOnSubmit
          onSubmitEditing={applySearch}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={placeholderColor}
        />
        <Pressable
          style={[
            screenStyles.searchButton,
            { backgroundColor: accent },
            (!searchInput.trim() || searchInput.trim() === searchApplied) && screenStyles.searchButtonDisabled,
          ]}
          onPress={applySearch}
          disabled={!searchInput.trim() || searchInput.trim() === searchApplied}
        >
          <Text style={[screenStyles.searchButtonText, { color: primaryTextColor }]}>
            Buscar
          </Text>
        </Pressable>
        {searchActive && (
          <Pressable
            style={[screenStyles.clearButton, { borderColor: palette.tabIconDefault }]}
            onPress={clearSearch}
          >
            <Text style={[screenStyles.clearButtonText, { color: accent }]}>Limpar</Text>
          </Pressable>
        )}
        {keyboardVisible && (
          <Pressable style={screenStyles.keyboardButton} onPress={dismissKeyboard}>
            <Text style={[screenStyles.keyboardButtonText, { color: palette.text, opacity: 0.7 }]}>
              Fechar
            </Text>
          </Pressable>
        )}
      </View>

      {/* Error display */}
      {error && (
        <View style={[screenStyles.errorBox, { backgroundColor: 'rgba(255,0,0,0.12)' }]}>
          <Text style={[screenStyles.errorText, { color: palette.text }]}>
            {error}
          </Text>
        </View>
      )}

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

      <View
        style={[
          screenStyles.footer,
          { borderTopColor: palette.tabIconDefault, paddingBottom: insets.bottom },
        ]}
      >
        <Text style={[screenStyles.footerText, { color: palette.text }]}>
          {total == null ? '...' : `${total} livros no total`}
        </Text>
      </View>

      <GenreModal
        visible={showGenreModal}
        selected={selectedGenre ?? undefined}
        onSelect={(g) => {
          setSearchApplied('');
          setSearchInput('');
          setSelectedGenre(g);
          booksLogger.info('Genre filter updated', {
            genreId: g?.id ?? null,
            name: g?.name ?? null,
          });
        }}
        onClose={() => setShowGenreModal(false)}
        allowClear
        title="Selecione um gênero"
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
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
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterButtonText: {
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    backgroundColor: 'transparent',
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: { fontWeight: '600' },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  clearButtonText: { fontWeight: '600' },
  keyboardButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardButtonText: { fontWeight: '600' },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
  },
  errorText: { fontSize: 13 },
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
  },
  footerText: { fontSize: 12, opacity: 0.7 },
});
