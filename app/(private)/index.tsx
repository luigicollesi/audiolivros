import { GenreModal, GenreOption } from '@/components/book/GenreModal';
import type { BookItem } from '@/components/book/BookGrid';
import { View } from '@/components/shared/Themed';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeShelvesList } from '@/components/home/HomeShelvesList';
import { HomeFilteredResults } from '@/components/home/HomeFilteredResults';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, Keyboard, LayoutChangeEvent, StyleSheet, TextInput } from 'react-native';
import type { FlatList } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import Colors from '@/constants/Colors';
import { GENRES } from '@/constants/Genres';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { booksLogger } from '@/utils/logger';
import { useTranslation } from '@/i18n/LanguageContext';
import { normalizeLanguage } from '@/i18n/translations';
import { useOptimizedBooks } from '@/hooks/useOptimizedBooks';
import type { HomeHeaderStrings, RowRenderItem, ShelfDescriptor } from '@/types/home';

import {
  LOOP_MULTIPLIER,
  RowHookState,
  useHomeRowBooks,
  buildRowConfigs,
  getSessionGenreSequence,
  useTopReadShelf,
  useListeningShelf,
  useFinishedShelf,
  useRecommendationShelf,
} from '@/hooks/homeHooks';

const PAGE_SIZE = 10;

export default function HomeScreen() {
  const router = useRouter();
  const rawRouteParams = useLocalSearchParams<{
    initialGenreId?: string | string[];
    initialGenreName?: string | string[];
    genreId?: string | string[];
    genreName?: string | string[];
  }>();
  const routeParams = useMemo(
    () => ({ ...rawRouteParams }),
    [rawRouteParams],
  );
  const insets = useSafeInsets();
  const { session } = useAuth();
  const { scheduleRefresh } = useSmartRefresh();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const accent = palette.tint;
  const isDark = scheme === 'dark';
  const actionTextColor = isDark ? palette.background : '#FFFFFF';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';
  const { language: baseLanguage, t } = useTranslation();

  const incomingGenre = useMemo(() => {
    const pickFirst = (value?: string | string[]) =>
      Array.isArray(value) ? value[0] : value;

    const initialId = pickFirst(routeParams.initialGenreId);
    const initialName = pickFirst(routeParams.initialGenreName);
    const fallbackId = pickFirst(routeParams.genreId);
    const fallbackName = pickFirst(routeParams.genreName);

    const rawId = initialId ?? fallbackId;
    const rawName = initialName ?? fallbackName;

    let match: GenreOption | null = null;
    const parsedId = rawId ? Number(rawId) : NaN;
    if (!Number.isNaN(parsedId)) {
      const byId = GENRES.find((genre) => genre.id === parsedId);
      if (byId) {
        match = byId;
      }
    }

    if (!match && rawName) {
      const normalized = rawName.trim().toLowerCase();
      if (normalized) {
        const byName = GENRES.find(
          (genre) =>
            genre.name.toLowerCase() === normalized ||
            genre.slug.toLowerCase() === normalized,
        );
        if (byName) {
          match = byName;
        }
      }
    }

    return match;
  }, [
    routeParams.initialGenreId,
    routeParams.initialGenreName,
    routeParams.genreId,
    routeParams.genreName,
  ]);

  const [selectedGenre, setSelectedGenre] = useState<GenreOption | null>(incomingGenre ?? null);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  useEffect(() => {
    if (!incomingGenre) return;
    setSelectedGenre((prev: GenreOption | null) => {
      if (prev?.id === incomingGenre.id) {
        return prev;
      }
      return incomingGenre;
    });
  }, [incomingGenre]);

  const searchInputRef = useRef<TextInput>(null);
  const filteredFlatRef = useRef<FlatList<number>>(null);
  const shelvesListRef = useRef<FlatList<RowRenderItem>>(null);
  const headerHeightRef = useRef(0);
  const [rowHeights, setRowHeights] = useState<number[]>([]);

  const screenWidth = Dimensions.get('window').width;

  const languagePreference = session?.user?.language ?? baseLanguage;
  const languageId = useMemo(
    () => normalizeLanguage(languagePreference),
    [languagePreference],
  );

  const favoriteGenreId = useMemo(() => {
    const slug = session?.user?.genre?.trim().toLowerCase();
    if (!slug) return null;
    const match = GENRES.find(
      (genre) => genre.slug.toLowerCase() === slug || genre.name.toLowerCase() === slug,
    );
    return match?.id ?? null;
  }, [session?.user?.genre]);

  const genreSequence = useMemo(
    () => getSessionGenreSequence(session?.user?.email ?? 'guest'),
    [session?.user?.email],
  );

  const searchText = searchApplied.trim();
  const filtersActive = searchText.length > 0 || !!selectedGenre;
  const showShelves = !filtersActive;
  const cycleHeight = useMemo(
    () => rowHeights.reduce((sum, h) => sum + h, 0),
    [rowHeights],
  );

  const rowConfigs = useMemo(
    () =>
      buildRowConfigs({
        t,
        searchText,
        selectedGenre,
        favoriteGenreId,
        randomOrder: genreSequence,
      }),
    [t, searchText, selectedGenre?.id, selectedGenre?.name, favoriteGenreId, genreSequence],
  );

  const bookQueryParams = useMemo(
    () => ({
      pageIndex: currentPageIndex,
      pageSize: PAGE_SIZE,
      languageId,
      genreId: selectedGenre?.id || null,
      searchText: searchText || undefined,
    }),
    [currentPageIndex, languageId, selectedGenre?.id, searchText],
  );

  const bookQueryOptions = useMemo(
    () => ({
      enabled: filtersActive,
      staleTime: 3 * 60 * 1000,
      prefetchDistance: 1,
    }),
    [filtersActive],
  );

  const {
    data: filteredPageData,
    isLoading: filteredPageLoading,
    error: filteredPageError,
    refetch: refetchFilteredPage,
    prefetchAdjacent,
    invalidateCache: invalidateFilteredCache,
  } = useOptimizedBooks(bookQueryParams, bookQueryOptions);

  const filteredTotal = filteredPageData?.total ?? null;
  const filteredItems = filteredPageData?.items ?? [];
  const filteredIsLoading = filteredPageLoading;
  const filteredError = filteredPageError;

  const filteredMaxPageIndex = useMemo(() => {
    if (!filtersActive || filteredTotal == null) return 0;
    return Math.max(0, Math.ceil(filteredTotal / PAGE_SIZE) - 1);
  }, [filtersActive, filteredTotal]);

  const filteredAvailablePages = useMemo(() => {
    if (!filtersActive) return [];
    if (filteredTotal == null) return [0];
    return Array.from({ length: filteredMaxPageIndex + 1 }, (_, i) => i);
  }, [filtersActive, filteredTotal, filteredMaxPageIndex]);

  const filteredTriggerPrefetch = useCallback(
    (pageIndex: number) => {
      if (!filtersActive) return;
      prefetchAdjacent(pageIndex, filteredMaxPageIndex).catch(() => {
        booksLogger.warn('Failed to prefetch filtered page', { pageIndex });
      });
    },
    [filtersActive, prefetchAdjacent, filteredMaxPageIndex],
  );

  const [
    firstRow,
    secondRow,
    thirdRow,
    fourthRow,
    fifthRow,
    sixthRow,
  ] = rowConfigs;

  const firstState = useHomeRowBooks(firstRow, languageId, showShelves);
  const secondState = useHomeRowBooks(secondRow, languageId, showShelves);
  const thirdState = useHomeRowBooks(thirdRow, languageId, showShelves);
  const fourthState = useHomeRowBooks(fourthRow, languageId, showShelves);
  const fifthState = useHomeRowBooks(fifthRow, languageId, showShelves);
  const sixthState = useHomeRowBooks(sixthRow, languageId, showShelves);

  const bookShelves = useMemo<ShelfDescriptor[]>(() => {
    if (
      !showShelves ||
      !firstRow ||
      !secondRow ||
      !thirdRow ||
      !fourthRow ||
      !fifthRow ||
      !sixthRow
    ) {
      return [];
    }
    return [
      { id: firstRow.id, title: firstRow.title, state: firstState, emptyLabel: firstRow.emptyLabel },
      { id: secondRow.id, title: secondRow.title, state: secondState, emptyLabel: secondRow.emptyLabel },
      { id: thirdRow.id, title: thirdRow.title, state: thirdState, emptyLabel: thirdRow.emptyLabel },
      { id: fourthRow.id, title: fourthRow.title, state: fourthState, emptyLabel: fourthRow.emptyLabel },
      { id: fifthRow.id, title: fifthRow.title, state: fifthState, emptyLabel: fifthRow.emptyLabel },
      { id: sixthRow.id, title: sixthRow.title, state: sixthState, emptyLabel: sixthRow.emptyLabel },
    ];
  }, [
    showShelves,
    firstRow,
    secondRow,
    thirdRow,
    fourthRow,
    fifthRow,
    sixthRow,
    firstState,
    secondState,
    thirdState,
    fourthState,
    fifthState,
    sixthState,
  ]);

  const topReadShelf = useTopReadShelf(languageId, showShelves);
  const listeningShelf = useListeningShelf(languageId, showShelves);
  const finishedShelf = useFinishedShelf(languageId, showShelves);
  const recommendationShelf = useRecommendationShelf(languageId, showShelves);

  const insightShelves = useMemo<ShelfDescriptor[]>(() => {
    if (!showShelves) return [];
    const shelves: ShelfDescriptor[] = [];
    const defaultEmpty = t('home.rows.insightEmpty');

    const includeShelf = (id: string, title: string, state: RowHookState) => {
      if (!state.loading && state.books.length === 0) {
        return;
      }
      shelves.push({
        id,
        title,
        state,
        emptyLabel: defaultEmpty,
      });
    };

    includeShelf('insight-top-read', t('home.rows.topRead'), topReadShelf);
    includeShelf('insight-continue', t('home.rows.continue'), listeningShelf);
    includeShelf('insight-rewatch', t('home.rows.rewatch'), finishedShelf);
    includeShelf(
      'insight-recommend',
      recommendationShelf.meta?.baseBookTitle
        ? t('home.rows.recommendBecause', {
            title: String(recommendationShelf.meta.baseBookTitle),
          })
        : t('home.rows.recommendFallback'),
      recommendationShelf,
    );

    return shelves;
  }, [
    showShelves,
    t,
    topReadShelf,
    listeningShelf,
    finishedShelf,
    recommendationShelf,
  ]);

  const activeShelves = useMemo<ShelfDescriptor[]>(() => {
    if (!showShelves) return [];
    const combined = [...insightShelves, ...bookShelves];
    const deferred: ShelfDescriptor[] = [];
    const pullById = (id: string) => {
      const index = combined.findIndex((shelf) => shelf.id === id);
      if (index >= 0) {
        const [match] = combined.splice(index, 1);
        deferred.push(match);
      }
    };

    pullById('insight-rewatch');
    pullById('row-library');

    return [...combined, ...deferred];
  }, [showShelves, insightShelves, bookShelves]);

  const activeShelfIds = useMemo(
    () => (activeShelves.length ? activeShelves.map((row) => row.id).join('|') : ''),
    [activeShelves],
  );

  useEffect(() => {
    if (!showShelves) {
      setRowHeights([]);
      return;
    }
    setRowHeights((prev) => {
      if (prev.length === activeShelves.length) return prev;
      return Array(activeShelves.length).fill(0);
    });
  }, [showShelves, activeShelves.length]);

  const rowStateList = useMemo(
    () => (showShelves ? activeShelves.map((shelf) => shelf.state) : []),
    [showShelves, activeShelves],
  );

  const loopedRows = useMemo<RowRenderItem[]>(() => {
    if (!showShelves) return [];
    const items: RowRenderItem[] = [];
    for (let loop = 0; loop < LOOP_MULTIPLIER; loop++) {
      activeShelves.forEach((shelf, index) => {
        items.push({ key: `${loop}-${index}-${shelf.id}`, shelf, baseIndex: index });
      });
    }
    return items;
  }, [activeShelves, showShelves]);

  const handleRowLayout = useCallback((baseIndex: number, height: number) => {
    setRowHeights((prev) => {
      if (baseIndex < 0 || baseIndex >= prev.length) {
        return prev;
      }
      if (Math.abs(prev[baseIndex] - height) < 1) {
        return prev;
      }
      const next = [...prev];
      next[baseIndex] = height;
      return next;
    });
  }, []);

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    headerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  useEffect(() => {
    if (!showShelves) return;
    const ids = activeShelfIds ? activeShelfIds.split('|') : [];
    booksLogger.debug('Home rows prepared', {
      rows: ids,
    });
  }, [activeShelfIds, showShelves]);

  useEffect(() => {
    if (!filtersActive) {
      setCurrentPageIndex(0);
      return;
    }
    invalidateFilteredCache();
    setCurrentPageIndex(0);
    filteredFlatRef.current?.scrollToIndex({
      index: 0,
      animated: false,
      viewPosition: 0,
    });
    booksLogger.info('Filters updated, resetting search results', {
      genre: selectedGenre?.name || null,
      search: searchText || null,
      languageId,
    });
  }, [
    filtersActive,
    selectedGenre?.id,
    selectedGenre?.name,
    languageId,
    searchText,
    invalidateFilteredCache,
  ]);

  useEffect(() => {
    if (!filtersActive) return;
    if (
      filteredPageData &&
      typeof filteredPageData.total === 'number' &&
      currentPageIndex === 0 &&
      !filteredIsLoading
    ) {
      if (filteredPageData.total > PAGE_SIZE) {
        filteredTriggerPrefetch(currentPageIndex);
      }
    }
  }, [
    filtersActive,
    filteredPageData,
    currentPageIndex,
    filteredIsLoading,
    filteredTriggerPrefetch,
  ]);

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

  useEffect(() => {
    if (!searchText) return;
    booksLogger.info('Search applied on home timeline', { text: searchText });
  }, [searchText]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = scheduleRefresh();
      return cleanup;
    }, [scheduleRefresh]),
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
  }, [dismissKeyboard, searchInput, searchApplied]);

  const clearSearch = useCallback(() => {
    if (!searchApplied && !searchInput) return;
    setSearchInput('');
    if (searchApplied) {
      setSearchApplied('');
    }
    dismissKeyboard();
  }, [dismissKeyboard, searchApplied, searchInput]);

  const onChangeSearch = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const searchActive = searchText.length > 0;
  const hasClearChip = searchActive || !!selectedGenre;
  const headerStrings = useMemo<HomeHeaderStrings>(() => {
    const title = searchActive
      ? t('home.heading.search', { text: searchApplied })
      : selectedGenre
      ? selectedGenre.name
      : 'Livros Disponiveis';
    return {
      title,
      filterLabel: t('home.filter'),
      clearLabel: t('home.searchClear'),
      searchPlaceholder: t('home.searchPlaceholder'),
      searchSubmitLabel: t('home.searchSubmit'),
      keyboardDismissLabel: t('home.keyboardDismiss'),
    };
  }, [searchActive, searchApplied, selectedGenre, t]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (filtersActive) {
        await refetchFilteredPage();
        booksLogger.debug('Filtered results refreshed manually');
      } else {
        await Promise.all(rowStateList.map((state) => state.refetch()));
        booksLogger.debug('Home rows refreshed manually');
      }
    } catch (error: any) {
      booksLogger.warn('Failed to refresh data', { error: error?.message });
    } finally {
      setRefreshing(false);
    }
  }, [filtersActive, refetchFilteredPage, rowStateList]);

  const handleClearChipPress = useCallback(() => {
    let cleared = false;
    if (searchActive) {
      clearSearch();
      cleared = true;
    }
    if (selectedGenre) {
      setSelectedGenre(null);
      cleared = true;
    }
    if (cleared) {
      booksLogger.info('Home filters cleared via chip', {
        clearedSearch: searchActive,
        clearedGenre: Boolean(selectedGenre),
      });
    }
  }, [searchActive, selectedGenre, clearSearch, setSelectedGenre]);

  const handlePressBook = useCallback(
    (book: BookItem) => {
      router.push({
        pathname: '/book',
        params: {
          title: book.title,
          author: book.author,
          year: String(book.year),
          cover_url: book.cover_url,
          language: languageId,
        },
      });
    },
    [router, languageId],
  );

  const onFilteredMomentumEnd = useCallback(
    (ev: any) => {
      const x: number = ev.nativeEvent.contentOffset?.x ?? 0;
      const pageIndex = Math.round(x / screenWidth);
      if (pageIndex !== currentPageIndex) {
        setCurrentPageIndex(pageIndex);
        filteredTriggerPrefetch(pageIndex);
      }
    },
    [screenWidth, currentPageIndex, filteredTriggerPrefetch],
  );

  const handleShelvesMomentumEnd = useCallback(
    (ev: any) => {
      if (!showShelves || cycleHeight <= 0) return;
      const offsetY: number = ev.nativeEvent.contentOffset?.y ?? 0;
      const headerHeight = headerHeightRef.current || 0;
      if (offsetY <= headerHeight) return;
      let relativeOffset = offsetY - headerHeight;
      let adjusted = false;
      while (relativeOffset >= cycleHeight) {
        relativeOffset -= cycleHeight;
        adjusted = true;
      }
      if (adjusted) {
        const target = headerHeight + relativeOffset;
        requestAnimationFrame(() => {
          shelvesListRef.current?.scrollToOffset({
            offset: target,
            animated: false,
          });
        });
      }
    },
    [cycleHeight, showShelves],
  );

  const listHeader = useMemo(
    () => (
      <HomeHeader
        paddingTop={insets.top + 6}
        backgroundColor={palette.background}
        cardColor={palette.bookCard}
        detailColor={palette.detail}
        textColor={palette.text}
        accentColor={accent}
        actionTextColor={actionTextColor}
        placeholderColor={placeholderColor}
        isDark={isDark}
        keyboardVisible={keyboardVisible}
        searchInputRef={searchInputRef}
        searchInput={searchInput}
        searchApplied={searchApplied}
        hasClearChip={hasClearChip}
        strings={headerStrings}
        onLayout={handleHeaderLayout}
        onChangeSearch={onChangeSearch}
        onApplySearch={applySearch}
        onClearChip={handleClearChipPress}
        onDismissKeyboard={dismissKeyboard}
        onOpenFilters={() => setShowGenreModal(true)}
      />
    ),
    [
      accent,
      actionTextColor,
      applySearch,
      dismissKeyboard,
      handleClearChipPress,
      handleHeaderLayout,
      hasClearChip,
      headerStrings,
      insets.top,
      isDark,
      keyboardVisible,
      onChangeSearch,
      placeholderColor,
      searchApplied,
      searchInput,
      setShowGenreModal,
      palette.background,
      palette.bookCard,
      palette.detail,
      palette.text,
    ],
  );

  const shelvesContent = showShelves ? (
    <HomeShelvesList
      rows={loopedRows}
      listRef={shelvesListRef}
      header={listHeader}
      accentColor={accent}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onMomentumScrollEnd={handleShelvesMomentumEnd}
      onPressBook={handlePressBook}
      onRowLayout={handleRowLayout}
      contentPaddingBottom={insets.bottom + 40}
    />
  ) : null;

  const filteredErrorMessage =
    filteredError && typeof filteredError === 'string' && filteredError.trim()
      ? filteredError
      : filteredError
      ? t('home.error')
      : null;

  const filteredFooterText =
    filteredTotal == null
      ? '...'
      : t(filteredTotal === 1 ? 'home.totalSingular' : 'home.totalPlural', {
          count: filteredTotal,
        });

  const filteredEmptyLabel = searchText.length
    ? t('home.rows.searchEmpty')
    : selectedGenre
    ? t('home.rows.genrePrefix', { name: selectedGenre.name })
    : t('home.empty');

  const filteredContent = !showShelves ? (
    <HomeFilteredResults
      header={listHeader}
      errorMessage={filteredErrorMessage}
      pages={filteredAvailablePages}
      listRef={filteredFlatRef}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onMomentumScrollEnd={onFilteredMomentumEnd}
      currentPageIndex={currentPageIndex}
      items={filteredItems}
      isLoading={filteredIsLoading}
      screenWidth={screenWidth}
      indicatorColor={palette.tint}
      footerText={filteredFooterText}
      borderColor={palette.detail ?? palette.border}
      textColor={palette.text}
      footerPaddingBottom={insets.bottom}
      emptyLabel={filteredEmptyLabel}
      loadingLabel={t('home.loading')}
      onPressBook={handlePressBook}
    />
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {showShelves ? shelvesContent : filteredContent}

      <GenreModal
        visible={showGenreModal}
        selected={selectedGenre ?? undefined}
        onSelect={(genre) => {
          setSearchApplied('');
          setSearchInput('');
          setSelectedGenre(genre);
          booksLogger.info('Genre filter updated', {
            id: genre?.id ?? null,
            name: genre?.name ?? null,
          });
        }}
        onClose={() => setShowGenreModal(false)}
        allowClear
        title="Selecione um gênero"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
