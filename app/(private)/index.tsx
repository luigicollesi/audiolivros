// app/(private)/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text, View } from '@/components/shared/Themed';
import { GridCards, BookItem, BooksResponse } from '@/components/book/BookGrid';
import { GenreModal, GenreOption } from '@/components/book/GenreModal';
import { BASE_URL } from '@/constants/API';

import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useAuth } from '@/auth/AuthContext';

const PAGE_SIZE = 10;
const LANGUAGE_ID = 'pt-BR';

export default function TabOneScreen() {
  const router = useRouter();
  const insets = useSafeInsets();
  const { fetchJSON } = useAuthedFetch();
  const { refreshSession } = useAuth();

  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, BookItem[]>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreOption | null>(null);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const flatRef = useRef<FlatList<number>>(null);
  const initializedRef = useRef(false);
  const prefetchedPagesRef = useRef<Set<number>>(new Set());

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

      const genreId = selectedGenre?.id ?? null;
      const base = selectedGenre ? `${BASE_URL}/books/genre` : `${BASE_URL}/books`;
      const genreParam = selectedGenre ? `&genreId=${encodeURIComponent(String(genreId))}` : '';
      const url = `${base}?start=${start}&end=${end}&languageId=${encodeURIComponent(LANGUAGE_ID)}${genreParam}`;

      try {
        const data = await fetchJSON<BooksResponse>(url);

        if (typeof data.total === 'number') {
          setTotal(data.total);
        } else {
          setTotal(old => (old ?? 0));
        }

        setPages(prev => {
          prefetchedPagesRef.current.add(pageIndex);
          return { ...prev, [pageIndex]: data.items || [] };
        });
      } catch (e: any) {
        // Se deu 5xx, trate como “página vazia”
        const msg = String(e?.message ?? e);
        if (/HTTP 5\d\d/.test(msg)) {
          setPages(prev => ({ ...prev, [pageIndex]: [] }));
          setTotal(old => (old == null ? 0 : old));
        } else {
          setError(`Falha ao carregar página ${pageIndex}: ${msg}`);
        }
      } finally {
        setLoadingPages(prev => {
          const next = new Set(prev);
          next.delete(pageIndex);
          return next;
        });
      }
    },
    [loadingPages, pages, selectedGenre, fetchJSON]
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
  }, [selectedGenre]);

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
        },
      });
    },
    [router]
  );

  const renderPage = useCallback(
    ({ item: pageIndex }: ListRenderItemInfo<number>) => {
      const items = pages[pageIndex];
      const isLoading = loadingPages.has(pageIndex) && !items;

      return (
        <View style={[screenStyles.page, { width: screenWidth }]}>
          {isLoading && (
            <View style={screenStyles.pageLoading}>
              <ActivityIndicator />
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

  return (
    <View style={[screenStyles.container, { paddingTop: insets.top + 6 }]}>
      {/* Cabeçalho */}
      <View style={screenStyles.header}>
        <Text style={screenStyles.title}>
          {selectedGenre ? selectedGenre.name : 'Mais recentes'}
        </Text>
        <Text style={screenStyles.pageCount}>
          {maxPageIndex > 0 ? `${currentPageIndex + 1} / ${maxPageIndex + 1}` : ''}
        </Text>
        <Pressable onPress={() => setShowGenreModal(true)} style={screenStyles.filterButton}>
          <Text style={screenStyles.filterButtonText}>Filtrar</Text>
        </Pressable>
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

      <View style={screenStyles.footer}>
        <Text style={screenStyles.footerText}>
          {total == null ? '...' : `${total} livros no total`}
        </Text>
      </View>

      <GenreModal
        visible={showGenreModal}
        selected={selectedGenre ?? undefined}
        onSelect={(g) => setSelectedGenre(g)}
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
    backgroundColor: '#2f95dc',
    borderRadius: 8,
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
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
    borderTopColor: '#ddd',
  },
  footerText: { fontSize: 12, opacity: 0.7 },
});
