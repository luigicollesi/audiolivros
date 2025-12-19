import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/constants/API';
import Colors from '@/constants/Colors';
import { BookItem } from '@/components/book/BookGrid';
import { useTranslation } from '@/i18n/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

type HomeShelfProps = {
  title: string;
  books: BookItem[];
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  accentColor: string;
  onRetry?: () => void;
  onPressBook: (book: BookItem) => void;
};

const CARD_WIDTH = 148;

function HomeShelfBase({
  title,
  books,
  loading = false,
  error,
  emptyLabel,
  accentColor,
  onRetry,
  onPressBook,
}: HomeShelfProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const baseTextColor = palette.text;
  const { t } = useTranslation();

  const renderItem = ({ item }: ListRenderItemInfo<BookItem>) => (
    <PosterCard
      book={item}
      onPress={() => onPressBook(item)}
    />
  );

  const keyExtractor = (item: BookItem, index: number) =>
    `${item.cover_url}-${item.title}-${index}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.bookCard,
          shadowColor: palette.detail,
          shadowOpacity: scheme === 'dark' ? 0.25 : 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: scheme === 'dark' ? 5 : 3,
        },
      ]}
    >
      <View style={styles.headingRow}>
        <View>
          <Text
            style={[
              styles.heading,
              { color: baseTextColor },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={[styles.accent, { backgroundColor: palette.detail }]} />
        </View>
        {loading && !error && (
          <ActivityIndicator size="small" color={accentColor} />
        )}
      </View>

      {error ? (
        <View style={[styles.feedbackBox, styles.errorBox]}>
          <Text style={[styles.feedbackText, { color: baseTextColor }]} numberOfLines={2}>
            {error}
          </Text>
          {!!onRetry && (
            <Pressable
              style={[styles.retryBtn, { borderColor: palette.tint }]}
              onPress={onRetry}
            >
              <Text style={[styles.retryText, { color: palette.tint }]}>{t('home.shelf.retry')}</Text>
            </Pressable>
          )}
        </View>
      ) : books.length === 0 && !loading ? (
        <View style={styles.feedbackBox}>
          <Text style={[styles.feedbackText, { color: baseTextColor, opacity: 0.75 }]}>
            {emptyLabel ?? t('home.shelf.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          snapToAlignment="start"
          decelerationRate="fast"
          bounces={false}
          getItemLayout={(_, index) => ({
            index,
            length: CARD_WIDTH + 16,
            offset: index * (CARD_WIDTH + 16),
          })}
        />
      )}
    </View>
  );
}

type PosterCardProps = {
  book: BookItem;
  onPress: () => void;
  baseUrl?: string;
};

function PosterCardBase({ book, onPress, baseUrl = BASE_URL }: PosterCardProps) {
  const { session } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const isLocked =
    book.locked === true ||
    book.locked === 'true' ||
    book.locked === 1;
  const token = session?.token;

  const imageSource = useMemo(() => {
    const path = book.cover_url?.startsWith('/') ? book.cover_url : `/${book.cover_url ?? ''}`;
    const uri = `${baseUrl}${path}`;
    return token
      ? { uri, headers: { Authorization: `Bearer ${String(token).trim()}` } }
      : { uri };
  }, [book.cover_url, baseUrl, token]);

  const progress = typeof book.listeningProgressPercent === 'number'
    ? Math.min(100, Math.max(0, Math.round(book.listeningProgressPercent)))
    : null;

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: palette.bookCard,
          borderColor: palette.detail ?? palette.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.posterWrapper}>
        <Image
          source={imageSource}
          style={styles.poster}
          resizeMode="cover"
        />
        {isLocked && (
          <View
            style={[
              styles.lockOverlay,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.38)'
                  : 'rgba(0,0,0,0.45)',
              },
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name="lock-closed"
              size={28}
              color={isDark ? '#111827' : '#f8fafc'}
            />
          </View>
        )}
      </View>
      <View style={[styles.meta, { backgroundColor: palette.bookCard }]}>
        <Text
          style={[styles.title, { color: palette.text }]}
          numberOfLines={2}
        >
          {book.title}
        </Text>
        <Text
          style={[styles.subtitle, { color: palette.text, opacity: 0.75 }]}
          numberOfLines={1}
        >
          {book.author}
        </Text>
      </View>
      {progress !== null && (
        <View style={[styles.progressTrack, { backgroundColor: palette.border ?? 'rgba(0,0,0,0.08)' }]}>
          <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: palette.detail }]} />
        </View>
      )}
    </Pressable>
  );
}

export const HomeShelf = memo(HomeShelfBase);
const PosterCard = memo(PosterCardBase);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 0,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  accent: {
    marginTop: 4,
    height: 2,
    width: 52,
    borderRadius: 2,
  },
  carouselContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 0,
  },
  poster: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  posterWrapper: {
    position: 'relative',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    minHeight: 72,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  progressBar: {
    height: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  feedbackBox: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    borderRadius: 10,
    marginHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
