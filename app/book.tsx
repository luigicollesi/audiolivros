// src/app/book.tsx
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { Text, View } from '@/components/shared/Themed';
import { BASE_URL } from '@/constants/API';
import Colors from '@/constants/Colors';
import { useOptimizedFavorites } from '@/hooks/useOptimizedFavorites';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { audioLogger, favoritesLogger } from '@/utils/logger';
import { useTranslation } from '@/i18n/LanguageContext';
import { normalizeLanguage } from '@/i18n/translations';

import { AUDIO_BAR_HEIGHT, AudioBar } from '@/features/book/AudioBar';
import { BookInfo } from '@/features/book/BookInfo';
import { BookSummarySection } from '@/features/book/BookSummarySection';
import { HighlightedSummary } from '@/features/book/HighlightedSummary';
import { useBookAudio } from '@/features/book/useBookAudio';
import { useBookSummary } from '@/features/book/useBookSummary';
import { useListeningProgress } from '@/features/book/useListeningProgress';

export default function BookScreen() {
  const { title, author, year, cover_url, language } =
    useLocalSearchParams<{ title: string; author: string; year: string; cover_url: string; language?: string }>();

  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeInsets();

  const { fetchJSON, authedFetch } = useAuthedFetch();
  const { session } = useAuth();
  const { scheduleRefresh } = useSmartRefresh();
  const { toggleFavorite, isPending } = useOptimizedFavorites();
  const token = session?.token ?? '';
  const { language: appLanguage } = useTranslation();

  const imageUri = useMemo(() => {
    const path = cover_url?.startsWith('/') ? cover_url : `/${cover_url}`;
    return `${BASE_URL}${path}`;
  }, [cover_url]);
  const coverHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${String(token).trim()}` } : undefined),
    [token],
  );
  const coverSource = useMemo(
    () => (coverHeaders ? { uri: imageUri, headers: coverHeaders } : { uri: imageUri }),
    [imageUri, coverHeaders],
  );

  const lang = useMemo(() => {
    const routeLang = typeof language === 'string' ? language.trim() : '';
    const sessionLang =
      typeof session?.user?.language === 'string'
        ? session.user.language.trim()
        : '';
    const candidate = routeLang || sessionLang || appLanguage;
    return normalizeLanguage(candidate);
  }, [language, session?.user?.language, appLanguage]);

  const summariesUrl = useMemo(() => {
    if (!title) return null;
    const q = new URLSearchParams({ title: String(title), language: lang });
    return `${BASE_URL}/summaries?${q.toString()}`;
  }, [title, lang]);

  const { summary, loading, error } = useBookSummary(summariesUrl, fetchJSON);
  const progressSync = useListeningProgress({
    bookId: summary?.bookId,
    audioPath: summary?.audio_url,
    authedFetch,
    fetchJSON,
    initialProgressHint: summary?.listeningProgress ?? null,
  });
  const {
    initialPosition: savedPosition,
    reportPlayback,
    endSession,
    loading: progressLoading,
    ready: progressReady,
    markEngaged,
  } = progressSync;
  const [favorite, setFavorite] = useState<boolean>(false);
  const audioPath = useMemo(
    () => (progressReady ? summary?.audio_url ?? null : null),
    [progressReady, summary?.audio_url],
  );
  
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
  } = useBookAudio({ audioPath, token, authedFetch, ready: progressReady });

  const initialSeekAttemptedRef = useRef(false);
  const initialSyncCompletedRef = useRef(false);
  const prevPlayingRef = useRef(isPlaying);
  const latestPlaybackRef = useRef({ position: 0, duration: 0 });

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

  useEffect(() => {
    initialSeekAttemptedRef.current = false;
    initialSyncCompletedRef.current = false;
  }, [audioPath, savedPosition]);

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

  useEffect(() => {
    if (!audioReady) return;
    if (!audioPath) return;
    if (initialSyncCompletedRef.current || initialSeekAttemptedRef.current) return;

    const initial = typeof savedPosition === 'number' ? savedPosition : 0;
    const hasDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0;

    if (!hasDuration) {
      if (initial > 0) {
        audioLogger.debug('Aguardando metadados do áudio para retomar posição', {
          bookId: summary?.bookId ?? null,
          savedPosition: initial,
          duration,
        });
      }
      return;
    }

    if (initial <= 0) {
      audioLogger.debug('Nenhum progresso salvo, iniciando do começo', {
        bookId: summary?.bookId ?? null,
      });
      initialSyncCompletedRef.current = true;
      return;
    }

    initialSeekAttemptedRef.current = true;

    const safetyBuffer = Math.max(Math.min(duration * 0.01, 3), 0.5);
    const maxAllowed = Math.max(duration - safetyBuffer, 0);
    const target = Math.max(0, Math.min(initial, maxAllowed));

    audioLogger.info('Retomando reprodução', {
      bookId: summary?.bookId ?? null,
      audioPath,
      savedPosition: initial,
      duration,
      safetyBuffer,
      target,
    });

    (async () => {
      try {
        await seekTo(target);
        audioLogger.info('Reprodução reposicionada com sucesso', {
          bookId: summary?.bookId ?? null,
          target,
        });
      } catch (err: any) {
        audioLogger.error('Erro ao reposicionar áudio', {
          bookId: summary?.bookId ?? null,
          target,
          error: err?.message ?? String(err),
        });
      } finally {
        initialSyncCompletedRef.current = true;
      }
    })();
  }, [audioReady, audioPath, duration, savedPosition, seekTo, summary?.bookId]);

  useEffect(() => {
    if (!audioReady || !duration || duration <= 0) {
      prevPlayingRef.current = isPlaying;
      return;
    }

    if (!initialSyncCompletedRef.current) {
      prevPlayingRef.current = isPlaying;
      return;
    }

    reportPlayback({
      position,
      duration,
      isPlaying,
    });

    if (prevPlayingRef.current && !isPlaying) {
      reportPlayback({
        position,
        duration,
        isPlaying,
        force: true,
      });
    }

    prevPlayingRef.current = isPlaying;
  }, [audioReady, duration, isPlaying, position, reportPlayback]);

  useEffect(() => {
    latestPlaybackRef.current = {
      position,
      duration,
    };
  }, [position, duration]);

  useEffect(
    () => () => {
      const snapshot = latestPlaybackRef.current;
      void endSession({
        force: true,
        position: snapshot.position,
        duration: snapshot.duration,
      });
    },
    [endSession],
  );

  const handleTogglePlay = useCallback(() => {
    markEngaged();
    togglePlay();
  }, [markEngaged, togglePlay]);

  const handleSeek = useCallback(
    (value: number) => {
      markEngaged();
      initialSyncCompletedRef.current = true;
      void seekTo(value);
      if (!audioReady || !duration || duration <= 0) return;
      reportPlayback({
        position: value,
        duration,
        isPlaying,
        force: true,
      });
    },
    [audioReady, duration, isPlaying, markEngaged, reportPlayback, seekTo],
  );

  const handleSkipBackward = useCallback(() => {
    markEngaged();
    void skipBy(-10);
  }, [markEngaged, skipBy]);

  const handleSkipForward = useCallback(() => {
    markEngaged();
    void skipBy(10);
  }, [markEngaged, skipBy]);

  return (
    <>
      <ScrollView
        contentContainerStyle={scrollContentStyle}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={coverSource} style={styles.cover} resizeMode="cover" />

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
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onSkipBackward={handleSkipBackward}
        onSkipForward={handleSkipForward}
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
