// components/books.tsx
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View as RNView,
  ListRenderItemInfo,
  useColorScheme,
} from 'react-native';
import Colors from '@/constants/Colors';
import { Text, View } from '@/components/shared/Themed';
import { BASE_URL } from '@/constants/API';
import { useSafeInsets } from '@/hooks/useSafeInsets';

export type BookItem = {
  title: string;
  author: string;
  year: number;
  cover_url: string;
};

export type BooksResponse = {
  total: number;
  items: BookItem[];
};

type GridCardsProps = {
  books: BookItem[];
  baseUrl?: string;
  onPressBook?: (book: BookItem, index: number) => void; // <- usaremos no onPress
  prefetchCovers?: boolean;
};

function GridCardsBase({ books, baseUrl = BASE_URL, onPressBook, prefetchCovers }: GridCardsProps) {
  const insets = useSafeInsets();
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  useEffect(() => {
    if (!prefetchCovers) return;
    books.forEach((b) => {
      const path = b.cover_url.startsWith('/') ? b.cover_url : `/${b.cover_url}`;
      Image.prefetch(`${baseUrl}${path}`).catch(() => {});
    });
  }, [books, baseUrl, prefetchCovers]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BookItem>) => (
      <BookCard
        book={item}
        baseUrl={baseUrl}
        onPress={() => onPressBook?.(item, index)}
      />
    ),
    [baseUrl, onPressBook]
  );

  const keyExtractor = useCallback(
    (item: BookItem, idx: number) => `${item.cover_url}-${item.title}-${item.author}-${item.year}-${idx}`,
    []
  );

  return (
    <FlatList
      data={books}
      keyExtractor={keyExtractor}
      numColumns={2}
      renderItem={renderItem}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={[styles.gridContent, { paddingBottom: 40 + insets.bottom }]}
      ListFooterComponent={<RNView style={{ height: 8 }} />}
      removeClippedSubviews
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      // fundo atrás dos cards (opcional)
      style={{ backgroundColor: theme.background }}
    />
  );
}

export const GridCards = memo(GridCardsBase);

type BookCardProps = {
  book: BookItem;
  baseUrl?: string;
  onPress?: () => void;
};

function BookCardBase({ book, baseUrl = BASE_URL, onPress }: BookCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const imageUri = useMemo(() => {
    const path = book.cover_url.startsWith('/') ? book.cover_url : `/${book.cover_url}`;
    return `${baseUrl}${path}`;
  }, [book.cover_url, baseUrl]);

  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.bookCard }]} // <- bookCard atrás do card
      android_ripple={{ color: '#ddd' }}
      onPress={onPress}
      hitSlop={8}
    >
      <RNView style={[styles.cover, { backgroundColor: theme.bookCard }]}>
        {!imgError ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.coverImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
            onLoadStart={() => setImgLoading(true)}
            onLoadEnd={() => setImgLoading(false)}
          />
        ) : (
          <RNView style={styles.coverFallback}>
            <Text style={styles.coverFallbackText}>Sem capa</Text>
          </RNView>
        )}
        {imgLoading && !imgError && <RNView style={styles.coverOverlay} />}
      </RNView>

      {/* fundo do bloco de infos também com bookCard */}
      <View style={[styles.cardInfo, { backgroundColor: theme.bookCard }]}>
        <Text style={styles.cardTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.cardAuthor} numberOfLines={1}>{book.author}</Text>
        <Text style={styles.cardYear}>{book.year}</Text>
      </View>
    </Pressable>
  );
}

export const BookCard = memo(BookCardBase);

const styles = StyleSheet.create({
  gridContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
  },
  gridRow: {
    gap: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    minHeight: 280,
  },
  cover: {
    width: '100%',
    height: 270,
    position: 'relative',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    fontSize: 12,
    opacity: 0.7,
  },
  cardInfo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardAuthor: { fontSize: 13, opacity: 0.8 },
  cardYear: { fontSize: 12, opacity: 0.6 },
});
