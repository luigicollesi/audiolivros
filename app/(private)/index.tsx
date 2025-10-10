// app/(private)/index.tsx
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
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
  Keyboard,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text, View } from '@/components/shared/Themed';
import { GridCards, BookItem, BooksResponse } from '@/components/book/BookGrid';
import { GenreModal, GenreOption } from '@/components/book/GenreModal';
import { BASE_URL } from '@/constants/API';

import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useAuth } from '@/auth/AuthContext';
import { booksLogger } from '@/utils/logger';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

const PAGE_SIZE = 10;
const DEFAULT_LANGUAGE = 'pt-BR';

export default function TabOneScreen() {
  const router = useRouter();
  const insets = useSafeInsets();
  const { fetchJSON } = useAuthedFetch();
  const { session, refreshSession } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const accent = palette.tint;
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryTextColor = isDark ? '#000' : '#fff';

  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, BookItem[]>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreOption | null>(null);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const flatRef = useRef<FlatList<number>>(null);
  const initializedRef = useRef(false);
  const prefetchedPagesRef = useRef<Set<number>>(new Set());
  const searchInputRef = useRef<TextInput>(null);

  const languagePreference = session?.user?.language;
  const languageId = useMemo(() => {
    const normalized =
      typeof languagePreference === 'string' ? languagePreference.trim() : '';
    return normalized || DEFAULT_LANGUAGE;
  }, [languagePreference]);

  const maxPageIndex = useMemo(() => {
    if (total == null) return 0;
    return Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  }, [total]);

  const availablePages = useMemo<number[]>(() => {
    if (total == null) return [0];
    return Array.from({ length: maxPageIndex + 1 }, (_, i) => i);
  }, [total, maxPageIndex]);

  const fetchPage = useCallback(
    async (pageIndex: number, force = false) => {
      if (pageIndex < 0) return;
      if (force) {
        prefetchedPagesRef.current.delete(pageIndex);
      }
      if (!force && pages[pageIndex]) return;
      if (loadingPages.has(pageIndex)) return;

      setLoadingPages(prev => new Set(prev).add(pageIndex));
      setError(null);

      const start = pageIndex * PAGE_SIZE;
      const end = start + (PAGE_SIZE - 1);

      let url: string;

      if (searchApplied) {
        const params = new URLSearchParams({
          start: String(start),
          end: String(end),
          languageId,
          text: searchApplied,
        });
        url = `${BASE_URL}/books/search?${params.toString()}`;
      } else {
        const genreId = selectedGenre?.id ?? null;
        if (genreId != null) {
          const params = new URLSearchParams({
            start: String(start),
            end: String(end),
            languageId,
            genreId: String(genreId),
          });
          url = `${BASE_URL}/books/genre?${params.toString()}`;
        } else {
          const params = new URLSearchParams({
            start: String(start),
            end: String(end),
            languageId,
          });
          url = `${BASE_URL}/books?${params.toString()}`;
        }
      }

      try {
        booksLogger.info('Carregando página de livros', {
          pageIndex,
          start,
          end,
          search: searchApplied || null,
          genreId: selectedGenre?.id ?? null,
          languageId,
        });
        const data = await fetchJSON<BooksResponse>(url);
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
          setTotal(old => (old ?? 0));
        }

        setPages(prev => {
          prefetchedPagesRef.current.add(pageIndex);
          return { ...prev, [pageIndex]: normalizedItems };
        });
        booksLogger.debug('Página de livros carregada', {
          pageIndex,
          itemCount: normalizedItems.length,
          total: typeof data.total === 'number' ? data.total : undefined,
        });
      } catch (err) {
        // Se deu 5xx, trate como “página vazia”
        const msg = err instanceof Error ? err.message : String(err);
        if (/HTTP 5\d\d/.test(msg)) {
          setPages(prev => ({ ...prev, [pageIndex]: [] }));
          setTotal(old => (old == null ? 0 : old));
          booksLogger.warn('Erro 5xx ao carregar página, preenchendo vazia', {
            pageIndex,
            error: msg,
          });
        } else {
          setError(`Falha ao carregar página ${pageIndex}: ${msg}`);
          booksLogger.error('Falha ao carregar página de livros', {
            pageIndex,
            error: err,
          });
        }
      } finally {
        setLoadingPages(prev => {
          const next = new Set(prev);
          next.delete(pageIndex);
          return next;
        });
      }
    },
    [loadingPages, pages, selectedGenre, fetchJSON, languageId, searchApplied]
  );

  const prefetchNext = useCallback(
    (pageIndex: number) => {
      const nextIndex = pageIndex + 1;
      if (nextIndex < 0) return;
      if (total != null && nextIndex > maxPageIndex) return;
      if (prefetchedPagesRef.current.has(nextIndex)) return;
      fetchPage(nextIndex).catch(() => {});
    },
    [fetchPage, total, maxPageIndex]
  );

  // Ao trocar o gênero: zere dados, volte para página 0 e resete o scroll
  useEffect(() => {
    setPages({});
    setTotal(null);
    setCurrentPageIndex(0);
    initializedRef.current = false;
    prefetchedPagesRef.current = new Set();
    flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    fetchPage(0, true).then(() => {
      prefetchNext(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenre, languageId, searchApplied]);

  useFocusEffect(
    useCallback(() => {
      refreshSession().catch(() => {});
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

      return () => {};
    }, [refreshSession, fetchPage, prefetchNext, pages, currentPageIndex])
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
    [screenWidth, fetchPage, prefetchNext, currentPageIndex]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      booksLogger.debug('Atualizando grid de livros via pull-to-refresh');
      await fetchPage(currentPageIndex, true);
      prefetchNext(currentPageIndex);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, prefetchNext, currentPageIndex]);

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
      const items = pages[pageIndex];
      const isLoading = loadingPages.has(pageIndex) && !items;

      return (
        <View style={[screenStyles.page, { width: screenWidth }]}>
          {isLoading && (
            <View style={screenStyles.pageLoading}>
              <ActivityIndicator color={palette.tint} />
              <Text>Carregando...</Text>
            </View>
          )}
          {!!items && items.length === 0 && (
            <View style={screenStyles.pageLoading}>
              <Text>Nenhum item nesta página.</Text>
            </View>
          )}
          {!!items && items.length > 0 && (
            <GridCards books={items} onPressBook={(b) => handlePressBook(b)} />
          )}
        </View>
      );
    },
    [pages, loadingPages, screenWidth, handlePressBook]
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
    booksLogger.info('Aplicando busca na grade de livros', {
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
    booksLogger.info('Busca de livros limpa');
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
      {/* Cabeçalho */}
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

      {/* Silencia mensagens de erro para filtros sem resultado suportado */}

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
          booksLogger.info('Filtro de gênero atualizado', {
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
    backgroundColor: 'rgba(255,0,0,0.12)',
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
