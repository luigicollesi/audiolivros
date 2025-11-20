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
import { useAuth } from '@/auth/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';

const GRID_CARD_HEIGHT = 320;

export type BookItem = {
  title: string;
  author: string;
  year: number;
  cover_url: string;
  listeningProgressPercent?: number | null;
};

export type BooksResponse = {
  total: number;
  items: BookItem[];
};

type GridCardsProps = {
  books: BookItem[];
  baseUrl?: string;
  onPressBook?: (book: BookItem, index: number) => void;
  prefetchCovers?: boolean;
};

function GridCardsBase({ books, baseUrl = BASE_URL, onPressBook, prefetchCovers }: GridCardsProps) {
  const insets = useSafeInsets();
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { session } = useAuth();
  const { t } = useTranslation();
  const token = session?.token;
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${String(token).trim()}` } : undefined),
    [token],
  );

  useEffect(() => {
    if (!prefetchCovers) return;
    books.forEach((b) => {
      const path = b.cover_url.startsWith('/') ? b.cover_url : `/${b.cover_url}`;
      const url = `${baseUrl}${path}`;
      if (authHeaders) {
        fetch(url, { headers: authHeaders }).catch(() => {});
      } else {
        Image.prefetch(url).catch(() => {});
      }
    });
  }, [books, baseUrl, prefetchCovers, authHeaders]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BookItem>) => (
      <RNView style={styles.cardWrapper}>
        <BookCard
          book={item}
          baseUrl={baseUrl}
          headers={authHeaders}
          onPress={() => onPressBook?.(item, index)}
        />
      </RNView>
    ),
    [baseUrl, onPressBook, authHeaders]
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
      style={{ backgroundColor: theme.background }}
    />
  );
}

export const GridCards = memo(GridCardsBase);

type BookCardProps = {
  book: BookItem;
  baseUrl?: string;
  headers?: Record<string, string>;
  onPress?: () => void;
};

function BookCardBase({ book, baseUrl = BASE_URL, headers, onPress }: BookCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { t } = useTranslation();

  const imageUri = useMemo(() => {
    const path = book.cover_url.startsWith('/') ? book.cover_url : `/${book.cover_url}`;
    return `${baseUrl}${path}`;
  }, [book.cover_url, baseUrl]);
  const imageSource = useMemo(
    () =>
      headers
        ? { uri: imageUri, headers }
        : { uri: imageUri },
    [imageUri, headers],
  );

  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const progressPercent =
    typeof book.listeningProgressPercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(book.listeningProgressPercent)))
      : null;
  const showProgress = progressPercent !== null && progressPercent > 0 && progressPercent < 100;

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: theme.bookCard,
          borderColor: theme.detail ?? theme.border,
        },
      ]}
      android_ripple={{ color: '#ddd' }}
      onPress={onPress}
      hitSlop={8}
    >
      <RNView style={[styles.cover, { backgroundColor: theme.bookCard }]}>
        {!imgError ? (
          <Image
            source={imageSource}
            style={styles.coverImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
            onLoadStart={() => setImgLoading(true)}
            onLoadEnd={() => setImgLoading(false)}
          />
        ) : (
          <RNView style={styles.coverFallback}>
            <Text style={styles.coverFallbackText}>{t('book.noCover')}</Text>
          </RNView>
        )}
        {imgLoading && !imgError && <RNView style={styles.coverOverlay} />}
      </RNView>

      <View style={[styles.cardInfo, { backgroundColor: theme.bookCard }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{book.title}</Text>
        <Text style={[styles.cardAuthor, { color: theme.text }]} numberOfLines={1}>{book.author}</Text>
        <Text style={[styles.cardYear, { color: theme.text }]}>{book.year}</Text>
      </View>
      {showProgress && (
        <RNView style={[styles.cardProgressTrack, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
          <RNView
            style={[
              styles.cardProgressBar,
              { width: `${progressPercent}%`, backgroundColor: theme.detail },
            ]}
          />
        </RNView>
      )}
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
  cardWrapper: {
    flexBasis: '48%',
    maxWidth: '48%',
    marginHorizontal: 4,
    marginBottom: 10,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: GRID_CARD_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
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
  cardProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  cardProgressBar: {
    height: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  cardInfo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  cardAuthor: { fontSize: 13, opacity: 0.8 },
  cardYear: { fontSize: 12, opacity: 0.6 },
});
