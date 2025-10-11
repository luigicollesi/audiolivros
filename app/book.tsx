// src/app/book.tsx
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { Text, View } from '@/components/shared/Themed';
import { BASE_URL } from '@/constants/API';
import Colors from '@/constants/Colors';
import { useOptimizedFavorites } from '@/hooks/useOptimizedFavorites';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { favoritesLogger } from '@/utils/logger';

import { AUDIO_BAR_HEIGHT, AudioBar } from '@/features/book/AudioBar';
import { BookInfo } from '@/features/book/BookInfo';
import { BookSummarySection } from '@/features/book/BookSummarySection';
import { HighlightedSummary } from '@/features/book/HighlightedSummary';
import { useBookAudio } from '@/features/book/useBookAudio';
import { useBookSummary } from '@/features/book/useBookSummary';

export default function BookScreen() {
  const { title, author, year, cover_url, language } =
    useLocalSearchParams<{ title: string; author: string; year: string; cover_url: string; language?: string }>();

  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeInsets();

  const { fetchJSON, authedFetch } = useAuthedFetch();
  const { session, markFavoritesDirty } = useAuth();
  const { scheduleRefresh } = useSmartRefresh();
  const { toggleFavorite, isPending } = useOptimizedFavorites();
  const token = session?.token ?? '';

  const imageUri = useMemo(() => {
    const path = cover_url?.startsWith('/') ? cover_url : `/${cover_url}`;
    return `${BASE_URL}${path}`;
  }, [cover_url]);

  const lang = useMemo(() => {
    const routeLang = typeof language === 'string' ? language.trim() : '';
    const sessionLang =
      typeof session?.user?.language === 'string'
        ? session.user.language.trim()
        : '';
    const candidate = routeLang || sessionLang || 'pt-BR';
    return candidate === 'pt-BR' || candidate === 'en-US' ? candidate : 'pt-BR';
  }, [language, session?.user?.language]);

  const summariesUrl = useMemo(() => {
    if (!title) return null;
    const q = new URLSearchParams({ title: String(title), language: lang });
    return `${BASE_URL}/summaries?${q.toString()}`;
  }, [title, lang]);

  const { summary, loading, error } = useBookSummary(summariesUrl, fetchJSON);
  const [favorite, setFavorite] = useState<boolean>(false);
  
  // Create consistent book ID for optimized favorites
  const bookId = useMemo(() => {
    if (!title || !author) return '';
    return `${title}|||${author}|||${lang}`;
  }, [title, author, lang]);

  const {
    audioReady,
    audioLoading,
    audioErr,
    isPlaying,
    togglePlay,
    seekTo,
    skipBy,
    seeking,
    position,
    duration,
    progressRatio,
    formatTime,
    playbackRate,
    availableRates,
    setPlaybackRate,
  } = useBookAudio({ audioPath: summary?.audio_url, token, authedFetch });

  useFocusEffect(
    useCallback(() => {
      // Smart session refresh - prevents duplicates
      const cleanup = scheduleRefresh();
      return cleanup;
    }, [scheduleRefresh])
  );

  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    if (summary && typeof summary.favorite === 'boolean') {
      setFavorite(summary.favorite);
    } else if (!summary) {
      setFavorite(false);
    }
  }, [summary]);

  const toggleSummaryExpanded = useCallback(() => {
    favoritesLogger.debug('Alternando estado do resumo expandido', {
      expanded: !summaryExpanded,
    });
    setSummaryExpanded((prev) => !prev);
  }, [summaryExpanded]);

  const handleToggleFavorite = useCallback(async () => {
    if (!title || !author) return;
    if (!token) {
      Alert.alert('Favoritos', 'Faça login para gerenciar favoritos.');
      return;
    }

    try {
      await toggleFavorite({
        title,
        author,
        languageId: lang,
        currentState: favorite,
        onOptimisticUpdate: (newState) => {
          setFavorite(newState);
          favoritesLogger.info('Optimistic favorite update', {
            title,
            author,
            favorite: newState,
          });
        },
        onError: (error, rollbackState) => {
          setFavorite(rollbackState);
          Alert.alert('Favoritos', error.message);
          favoritesLogger.error('Falha ao atualizar favorito', {
            title,
            author,
            error: error.message,
          });
        },
      });
      
      favoritesLogger.info('Favorito atualizado com sucesso', {
        title,
        author,
        favorite: !favorite,
      });
    } catch (err: any) {
      // Error already handled by onError callback
      favoritesLogger.debug('Toggle favorite completed with error handling', {
        title,
        author,
      });
    }
  }, [title, author, lang, token, favorite, toggleFavorite]);

  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      summaryExpanded ? styles.scrollContentExpanded : null,
      { paddingBottom: AUDIO_BAR_HEIGHT + insets.bottom + 16 },
    ],
    [summaryExpanded, insets.bottom],
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={scrollContentStyle}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: imageUri }} style={styles.cover} resizeMode="cover" />

        <BookInfo
          title={title}
          author={author}
          year={year}
          language={lang}
          backgroundColor={theme.bookCard}
          favorite={favorite}
          onToggleFavorite={handleToggleFavorite}
          disabling={isPending(title, author, lang) || loading || !summary}
        />

        <BookSummarySection
          loading={loading}
          error={error}
          summaryText={summary?.summary}
          progress={audioReady ? progressRatio : 0}
          backgroundColor={theme.bookCard}
          expanded={summaryExpanded}
          onToggleExpanded={toggleSummaryExpanded}
        />
      </ScrollView>

      {summaryExpanded && summary?.summary && (
        <View
          style={[
            styles.summaryOverlay,
            {
              paddingTop: insets.top + 24,
              paddingBottom: AUDIO_BAR_HEIGHT + insets.bottom + 12,
              bottom: AUDIO_BAR_HEIGHT + insets.bottom + 12,
              backgroundColor: theme.background,
            },
          ]}
        >
          <Pressable
            style={[styles.overlayClose, { top: insets.top + 8 }]}
            onPress={toggleSummaryExpanded}
            hitSlop={12}
          >
            <Text style={styles.overlayCloseText}>✕</Text>
          </Pressable>
          <ScrollView
            contentContainerStyle={[styles.overlayContent, { paddingBottom: AUDIO_BAR_HEIGHT + insets.bottom + 32 }]}
            showsVerticalScrollIndicator
          >
            <Text style={styles.overlayTitle}>Resumo</Text>
            <HighlightedSummary
              text={summary.summary}
              progress={audioReady ? progressRatio : 0}
              variant="expanded"
            />
          </ScrollView>
        </View>
      )}

      <AudioBar
        bottomInset={insets.bottom}
        backgroundColor={theme.bookCard}
        borderColor={scheme === 'dark' ? '#333' : theme.tabIconDefault}
        audioReady={audioReady}
        audioLoading={audioLoading}
        audioError={audioErr}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onSeek={(value: number) => { void seekTo(value); }}
        onSkipBackward={() => { void skipBy(-10); }}
        onSkipForward={() => { void skipBy(10); }}
        seeking={seeking}
        position={position}
        duration={duration}
        formatTime={formatTime}
        playbackRate={playbackRate}
        availableRates={availableRates}
        onSelectRate={setPlaybackRate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
  },
  scrollContentExpanded: {
    minHeight: '100%',
  },
  summaryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    zIndex: 30,
  },
  overlayClose: {
    position: 'absolute',
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseText: {
    fontSize: 18,
    fontWeight: '700',
  },
  overlayContent: {
    paddingTop: 8,
    gap: 16,
    flexGrow: 1,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    marginBottom: 16,
  },
});
