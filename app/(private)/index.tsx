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
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { GridCards, BookItem, BooksResponse } from '@/components/books';
import { GenreModal } from '@/components/GenreModal';
import { BASE_URL } from '@/constants/API';

import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useSafeInsets } from '@/hooks/useSafeInsets';

const PAGE_SIZE = 10;
const LANGUAGE_ID = 'pt-BR';

export default function TabOneScreen() {
  console.log('Renderizando TabOneScreen...');  
  const router = useRouter();
  const insets = useSafeInsets();
  const { fetchJSON } = useAuthedFetch();

  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, BookItem[]>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<{ id: string; name: string } | null>(null);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const flatRef = useRef<FlatList<number>>(null);

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
      if (!force && pages[pageIndex]) return;
      if (loadingPages.has(pageIndex)) return;

      setLoadingPages(prev => new Set(prev).add(pageIndex));
      setError(null);

      const start = pageIndex * PAGE_SIZE;
      const end = start + (PAGE_SIZE - 1);

      const genreValue = selectedGenre?.name ?? selectedGenre?.id ?? '';
      const base = selectedGenre ? `${BASE_URL}/books/genre` : `${BASE_URL}/books`;
      const genreParam = selectedGenre ? `&genre=${encodeURIComponent(genreValue)}` : '';
      const url = `${base}?start=${start}&end=${end}&languageId=${encodeURIComponent(LANGUAGE_ID)}${genreParam}`;

      try {
        const data = await fetchJSON<BooksResponse>(url);

        if (typeof data.total === 'number') {
          setTotal(data.total);
        } else {
          setTotal(old => (old ?? 0));
        }

        setPages(prev => ({ ...prev, [pageIndex]: data.items || [] }));
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

  // Prefetch só da próxima se "parecer existir" (baseado em total)
  const prefetchNeighbors = useCallback(
    (pageIndex: number) => {
      if (total == null || pageIndex < Math.ceil((total - 1) / PAGE_SIZE)) {
        fetchPage(pageIndex + 1).catch(() => {});
      }
      fetchPage(pageIndex - 1).catch(() => {});
    },
    [fetchPage, total]
  );

  // Ao trocar o gênero: zere dados, volte para página 0 e resete o scroll
  useEffect(() => {
    setPages({});
    setTotal(null);
    setCurrentPageIndex(0);
    flatRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    fetchPage(0, true).then(() => prefetchNeighbors(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenre]);

  const onMomentumEnd = useCallback(
    (ev: any) => {
      const x: number = ev.nativeEvent.contentOffset?.x ?? 0;
      const pageIndex = Math.round(x / screenWidth);
      setCurrentPageIndex(pageIndex);
      fetchPage(pageIndex).then(() => prefetchNeighbors(pageIndex));
    },
    [screenWidth, fetchPage, prefetchNeighbors]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPage(currentPageIndex, true);
      prefetchNeighbors(currentPageIndex);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, prefetchNeighbors, currentPageIndex]);

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

      {error && (
        <View style={screenStyles.errorBox}>
          <Text style={screenStyles.errorText}>{error}</Text>
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
