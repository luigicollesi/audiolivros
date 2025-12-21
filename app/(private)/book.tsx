// src/app/book.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, useColorScheme, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { Text, View } from '@/components/shared/Themed';
import { BASE_URL } from '@/constants/API';
import Colors from '@/constants/Colors';
import { GENRES, translateGenreLabel } from '@/constants/Genres';
import { useOptimizedFavorites } from '@/hooks/useOptimizedFavorites';
import { useSafeInsets } from '@/hooks/useSafeInsets';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { useTranslation } from '@/i18n/LanguageContext';
import { normalizeLanguage } from '@/i18n/translations';
import { useSoundFx } from '@/features/sound/SoundProvider';
import { audioLogger, favoritesLogger } from '@/utils/logger';

import { AUDIO_BAR_HEIGHT, AudioBar } from '@/features/book/AudioBar';
import { BookInfo } from '@/features/book/BookInfo';
import { BookSummarySection } from '@/features/book/BookSummarySection';
import { HighlightedSummary } from '@/features/book/HighlightedSummary';
import { useBookAudio } from '@/features/book/useBookAudio';
import { useBookSummary } from '@/features/book/useBookSummary';
import { useListeningProgress } from '@/features/book/useListeningProgress';
import { useRequestCache } from '@/hooks/useRequestCache';

export default function BookScreen() {
  const { title, author, year, cover_url, language, locked: lockedParam } =
    useLocalSearchParams<{ title: string; author: string; year: string; cover_url: string; language?: string; locked?: string }>();

  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeInsets();

  const { fetchJSON, authedFetch } = useAuthedFetch();
  const { session, updateSessionUser } = useAuth();
  const requestCache = useRequestCache();
  const { scheduleRefresh } = useSmartRefresh();
  const { toggleFavorite, isPending } = useOptimizedFavorites();
  const token = session?.token ?? '';
  const { language: appLanguage, t } = useTranslation();
  const { skipNextClick, playClick } = useSoundFx();

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
  const initialLocked = useMemo(() => {
    if (typeof lockedParam === 'string') {
      const val = lockedParam.toLowerCase();
      return val === 'true' || val === '1' || val === 'locked';
    }
    return false;
  }, [lockedParam]);

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
    onMissionComplete: () => {
      const newKeys = (session?.user?.keys ?? 0) + 1;
      const newDaysRead = (session?.user?.daysRead ?? 0) + 1;
      updateSessionUser({ keys: newKeys, mission: true, daysRead: newDaysRead });
      showToast(
        t('book.missionComplete') ?? 'Missão diária concluída! Você ganhou 1 chave.',
        t('book.missionTitle') ?? 'Missão diária',
      );
    },
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
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockedSummary, setUnlockedSummary] = useState<{ summary: string | null; audio_url: string | null } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTitle, setToastTitle] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const detailsAnim = useRef(new Animated.Value(0)).current;
  const uiTransition = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const summaryFontAnim = useRef(new Animated.Value(0)).current;
  const [lockedVisual, setLockedVisual] = useState<boolean>(initialLocked);
  const [summaryOverlayVisible, setSummaryOverlayVisible] = useState(false);
  const summaryTouchStartRef = useRef<number | null>(null);
  const apiLocked = useMemo(
    () => Boolean(summary?.locked) || (summary !== null && !summary?.audio_url),
    [summary],
  );
  useEffect(() => {
    if (summary) {
      setLockedVisual(apiLocked && !unlockedSummary);
    }
  }, [summary, apiLocked, unlockedSummary]);
  const audioPath = useMemo(
    () => {
      const effectiveAudio = unlockedSummary?.audio_url ?? summary?.audio_url ?? null;
      return progressReady && !lockedVisual ? effectiveAudio : null;
    },
    [progressReady, summary?.audio_url, lockedVisual, unlockedSummary?.audio_url],
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
    didJustFinish,
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
  const genreChips = useMemo(() => {
    if (!summary?.genres || summary.genres.length === 0) return [];
    const seen = new Set<string>();
    return summary.genres
      .map((raw) => {
        if (typeof raw !== 'string') return null;
        const label = raw.trim();
        if (!label) return null;
        const key = label.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        const match = GENRES.find(
          (genre) =>
            genre.name.toLowerCase() === key || genre.slug.toLowerCase() === key,
        );
        return {
          label: translateGenreLabel(
            { id: match?.id ?? null, slug: match?.slug ?? label, name: label },
            lang as 'pt-BR' | 'en-US',
          ),
          genreId: match?.id ?? null,
          slug: match?.slug ?? label,
        };
      })
      .filter(
        (item): item is { label: string; genreId: number | null; slug: string } => !!item,
      );
  }, [summary?.genres, lang]);

  const handleGenrePress = useCallback(
    (genre: { label: string; genreId: number | null; slug: string }) => {
      playClick();
      const genreIdParam = genre.genreId ? String(genre.genreId) : undefined;
      router.push({
        pathname: '/(private)/(home)',
        params: {
          initialGenreName: genre.slug,
          initialGenreId: genreIdParam,
          genreName: genre.slug,
          genreId: genreIdParam,
        },
      });
    },
    [router, playClick],
  );

  const showToast = useCallback(
    (message: string, title?: string | null) => {
      setToastMessage(message);
      setToastTitle(title ?? null);
      setToastVisible(true);
      toastAnim.setValue(0);
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    },
    [toastAnim],
  );

  useEffect(() => {
    if (summary && typeof summary.favorite === 'boolean') {
      setFavorite(summary.favorite);
    } else if (!summary) {
      setFavorite(false);
    }
    setUnlockedSummary(null);
    setUnlockError(null);
  }, [summary]);

  useEffect(() => {
    uiTransition.setValue(0);
    Animated.timing(uiTransition, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) {
      contentOpacity.setValue(1);
      detailsAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(detailsAnim, {
        toValue: 1,
        duration: 500,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [loading, contentOpacity, detailsAnim]);

  useEffect(() => {
    initialSeekAttemptedRef.current = false;
    initialSyncCompletedRef.current = false;
  }, [audioPath, savedPosition]);

  const toggleSummaryExpanded = useCallback(() => {
    playClick();
    const next = !summaryExpanded;
    favoritesLogger.debug('Alternando estado do resumo expandido', {
      expanded: next,
    });
    if (next) {
      setSummaryExpanded(true);
      setSummaryOverlayVisible(true);
      summaryAnim.setValue(0);
      summaryFontAnim.setValue(0);
      Animated.timing(summaryFontAnim, { toValue: 1, duration: 1000, useNativeDriver: false }).start();
      Animated.timing(summaryAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(summaryAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setSummaryExpanded(false);
        setSummaryOverlayVisible(false);
      });
      Animated.timing(summaryFontAnim, { toValue: 0, duration: 1000, useNativeDriver: false }).start();
    }
  }, [summaryExpanded, summaryAnim, summaryFontAnim, playClick]);

  const handleUnlock = useCallback(async () => {
    playClick();
    if (!summary?.bookId) return;
    const keyBalance = session?.user?.keys ?? 0;
    if (keyBalance <= 0) {
      showToast(
        t('book.noKeysMessage') ??
          'Você não tem chaves suficientes para desbloquear este livro.',
        t('book.noKeysTitle') ?? 'Sem chaves suficientes',
      );
      return;
    }
    setUnlockError(null);
    setUnlocking(true);
    try {
      const res = await authedFetch(`${BASE_URL}/summaries/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: summary.bookId, language: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Falha ao desbloquear livro.');
      }
      if (!data?.hasKey || data?.unlocked === false) {
        setUnlockError(
          t('book.noKeys') ??
            'Você não tem chaves disponíveis para desbloquear este livro.',
        );
        showToast(
          t('book.noKeysMessage') ??
            'Você não tem chaves suficientes para desbloquear este livro.',
          t('book.noKeysTitle') ?? 'Sem chaves suficientes',
        );
        return;
      }

      const nextSummary = {
        summary: typeof data?.summary === 'string' ? data.summary : null,
        audio_url: typeof data?.audio_url === 'string' ? data.audio_url : null,
      };
      setUnlockedSummary(nextSummary);
      setLockedVisual(false);
      setUnlockError(null);
      setToastVisible(false);
      if (typeof data?.remainingKeys === 'number') {
        updateSessionUser({ keys: data.remainingKeys });
      }
      const currentUnlocked =
        typeof session?.user?.unlockedCount === 'number'
          ? session.user.unlockedCount
          : (session?.user as any)?.unlockedCount ?? 0;
      updateSessionUser({ unlockedCount: currentUnlocked + 1 });

      const matchesCurrentBook = (item: any) => {
        const sameTitle =
          typeof item?.title === 'string' &&
          item.title.trim().toLowerCase() === String(title ?? '').trim().toLowerCase();
        const sameAuthor =
          typeof item?.author === 'string' &&
          item.author.trim().toLowerCase() === String(author ?? '').trim().toLowerCase();
        return sameTitle && sameAuthor;
      };

      const unlockItems = (dataObj: any) => {
        if (!dataObj) return dataObj;
        if (Array.isArray(dataObj?.items)) {
          let changed = false;
          const items = dataObj.items.map((item: any) => {
            if (matchesCurrentBook(item) && item?.locked !== false) {
              changed = true;
              return { ...item, locked: false };
            }
            return item;
          });
          return changed ? { ...dataObj, items } : dataObj;
        }
        return dataObj;
      };

      requestCache.mutate('home-row', unlockItems);
      requestCache.mutate('books', unlockItems);
      requestCache.mutate('favorites', unlockItems);
    } catch (err: any) {
      showToast(err?.message ?? 'Não foi possível desbloquear o livro.');
    } finally {
      setUnlocking(false);
    }
  }, [authedFetch, lang, summary?.bookId, t, updateSessionUser, requestCache, title, author, session?.user?.unlockedCount, showToast, playClick]);

  const loadReview = useCallback(
    async (bookId: string) => {
      setReviewLoading(true);
      try {
        const res = await fetchJSON<{ rating?: number | null }>(`${BASE_URL}/reviews/${bookId}`);
        const incoming = typeof res?.rating === 'number' ? res.rating : null;
        setReviewRating(incoming);
      } catch {
        setReviewRating(null);
      } finally {
        setReviewLoading(false);
      }
    },
    [fetchJSON],
  );

  useEffect(() => {
    if (!summary?.bookId) {
      setReviewRating(null);
      return;
    }
    void loadReview(summary.bookId);
  }, [summary?.bookId, loadReview]);

  const handleSelectRating = useCallback(
    async (value: number) => {
      playClick();
      if (!summary?.bookId) return;
      if (reviewSubmitting) return;
      if (progressRatio <= 0) {
        showToast(
          t('book.rateAfterListening') ??
            'Finalize ou ouça parte do livro antes de avaliá-lo.',
          t('book.ratingBlockedTitle') ?? 'Avaliação indisponível',
        );
        return;
      }
      setReviewSubmitting(true);
      try {
        const res = await authedFetch(`${BASE_URL}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: summary.bookId, rating: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || 'Não foi possível registrar sua avaliação.');
        }
        setReviewRating(value);
        Alert.alert('Avaliação', 'Sua avaliação foi registrada.');
      } catch (err: any) {
        showToast(
          err?.message ??
            (t('book.rateAfterListening') ??
              'Finalize ou ouça parte do livro antes de avaliá-lo.'),
          t('book.ratingBlockedTitle') ?? 'Avaliação indisponível',
        );
      } finally {
        setReviewSubmitting(false);
      }
    },
    [authedFetch, reviewSubmitting, summary?.bookId, progressRatio, t, showToast, playClick],
  );

  const handleToggleFavorite = useCallback(async () => {
    playClick();
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
  }, [title, author, lang, token, favorite, toggleFavorite, playClick]);

  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      summaryExpanded ? styles.scrollContentExpanded : null,
      { paddingBottom: AUDIO_BAR_HEIGHT + insets.bottom + 16, paddingTop: insets.top + 12 },
    ],
    [summaryExpanded, insets.bottom, insets.top],
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
    audioLogger.debug('useEffect reportPlayback - verificando condições', {
      audioReady,
      audioLoading,
      duration,
      isPlaying,
      position,
      initialSyncCompleted: initialSyncCompletedRef.current,
      bookId: summary?.bookId,
    });

    if (!audioReady || !duration || duration <= 0) {
      prevPlayingRef.current = isPlaying;
      audioLogger.debug('Skipping reportPlayback - audio not ready or invalid duration', {
        audioReady,
        duration,
      });
      return;
    }

    if (audioLoading) {
      prevPlayingRef.current = isPlaying;
      audioLogger.debug('Skipping reportPlayback - audio ainda carregando', {
        bookId: summary?.bookId,
        position,
        duration,
      });
      return;
    }

    if (!initialSyncCompletedRef.current) {
      prevPlayingRef.current = isPlaying;
      audioLogger.debug('Skipping reportPlayback - initial sync not completed');
      return;
    }

    if (!isPlaying) {
      prevPlayingRef.current = isPlaying;
      audioLogger.debug('Skipping reportPlayback - player não está em execução', {
        bookId: summary?.bookId,
        position,
        duration,
      });
      return;
    }

    const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
    audioLogger.debug('Calling reportPlayback from book.tsx', {
      position,
      duration,
      progressPercent: progressPercent.toFixed(1),
      isPlaying,
      bookId: summary?.bookId,
    });

    reportPlayback({
      position,
      duration,
      isPlaying,
    });

    prevPlayingRef.current = isPlaying;
  }, [audioReady, audioLoading, duration, isPlaying, position, reportPlayback, summary?.bookId]);

  useEffect(() => {
    audioLogger.debug('useEffect didJustFinish - verificando conclusão', {
      didJustFinish,
      audioReady,
      duration,
      bookId: summary?.bookId,
    });

    if (!didJustFinish) return;
    if (!audioReady || !duration || duration <= 0) {
      audioLogger.warn('didJustFinish ignored - audio not ready or invalid duration', {
        audioReady,
        duration,
      });
      return;
    }

    audioLogger.info('Audio finished - calling reportPlayback with completed=true', {
      position: duration,
      duration,
      bookId: summary?.bookId,
    });

    reportPlayback({
      position: duration,
      duration,
      isPlaying: false,
      force: true,
      completed: true,
    });
  }, [audioReady, didJustFinish, duration, reportPlayback, summary?.bookId]);

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
      if (!audioReady || audioLoading || !duration || duration <= 0 || !isPlaying) return;
      reportPlayback({
        position: value,
        duration,
        isPlaying,
        force: true,
      });
    },
    [audioReady, audioLoading, duration, isPlaying, markEngaged, reportPlayback, seekTo],
  );

  const handleSkipBackward = useCallback(() => {
    markEngaged();
    void skipBy(-10);
  }, [markEngaged, skipBy]);

  const handleSkipForward = useCallback(() => {
    markEngaged();
    void skipBy(10);
  }, [markEngaged, skipBy]);

  const detailsTranslateY = useMemo(
    () =>
      detailsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-24, 0],
      }),
    [detailsAnim],
  );

  const fauxTabOpacity = useMemo(
    () =>
      uiTransition.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [uiTransition],
  );

  const fauxTabScale = useMemo(
    () =>
      uiTransition.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.9],
      }),
    [uiTransition],
  );

  const audioOpacity = uiTransition;
  const audioScale = useMemo(
    () =>
      uiTransition.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
      }),
    [uiTransition],
  );

  const resolvedSummaryText = useMemo(
    () =>
      unlockedSummary?.summary ??
      summary?.summary ??
      (lockedVisual
        ? (lang.toLowerCase().startsWith('pt') ? 'Livro bloqueado' : 'Locked book')
        : undefined),
    [unlockedSummary?.summary, summary?.summary, lockedVisual, lang],
  );

  return (
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
      {!summaryExpanded && (
        <Pressable
          style={[styles.backButton, { top: insets.top + 12 }]}
          onPressIn={() => skipNextClick()}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={[styles.backButtonText, { color: theme.tint }]}>←</Text>
        </Pressable>
      )}
      {lockedVisual && (
        <Pressable
          style={[
            styles.unlockFloating,
            {
              top: insets.top + 12,
              right: 16,
              backgroundColor: '#d4af37',
              shadowColor: '#d4af37',
            },
          ]}
          onPress={handleUnlock}
          disabled={unlocking}
          hitSlop={8}
        >
          {unlocking ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.unlockFloatingText}>
              {t('book.unlockCta') ?? 'Desbloquear'}
            </Text>
          )}
        </Pressable>
      )}
      <ScrollView contentContainerStyle={scrollContentStyle} keyboardShouldPersistTaps="handled">
        <View style={styles.coverWrapper}>
          <Image source={coverSource} style={styles.cover} resizeMode="cover" />
          {lockedVisual && (
            <View
              style={[
                styles.coverLockOverlay,
                {
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.45)',
                },
              ]}
              pointerEvents="none"
            >
              <Ionicons
                name="lock-closed"
                size={32}
                color={scheme === 'dark' ? '#111827' : '#f8fafc'}
              />
            </View>
          )}
        </View>

        <Animated.View style={{ opacity: detailsAnim, transform: [{ translateY: detailsTranslateY }] }}>
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

          {summary?.bookId ? (
            <View
              style={[
                styles.ratingCard,
                {
                  backgroundColor: theme.bookCard,
                  borderColor: theme.detail ?? '#e5e5e5',
                },
              ]}
            >
              <Text style={[styles.ratingTitle, { color: theme.tint }]}>
                {t('book.yourRating') ?? 'Sua avaliação'}
              </Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const filled = (reviewRating ?? 0) >= value;
                  return (
                    <Pressable
                      key={value}
                      style={[
                        styles.ratingStar,
                        {
                          borderColor: theme.detail ?? '#d4d4d4',
                          backgroundColor: filled ? theme.tint : 'transparent',
                          opacity: reviewSubmitting || reviewLoading ? 0.6 : 1,
                        },
                      ]}
                      disabled={reviewSubmitting || reviewLoading}
                      hitSlop={8}
                      onPress={() => handleSelectRating(value)}
                    >
                      <Text
                        style={[
                          styles.ratingStarText,
                          { color: filled ? theme.background : theme.tint },
                        ]}
                      >
                        ★
                      </Text>
                    </Pressable>
                  );
                })}
                {(reviewLoading || reviewSubmitting) && (
                  <ActivityIndicator
                    style={styles.ratingSpinner}
                    size="small"
                    color={theme.tint}
                  />
                )}
              </View>
              {reviewRating != null ? (
                <Text style={[styles.ratingHint, { color: theme.tint }]}>
                  {t('book.yourRatingValue', { rating: reviewRating }) ??
                    `Avaliação: ${reviewRating}/5`}
                </Text>
              ) : null}
            </View>
          ) : null}

          {genreChips.length > 0 && (
            <View
              style={[
                styles.genreSection,
                {
                  backgroundColor: theme.bookCard,
                  borderColor: theme.detail ?? '#e5e5e5',
                },
              ]}
            >
              <Text style={[styles.genreLabel, { color: theme.tint }]}>
                {t('book.genres') ?? 'Gêneros'}
              </Text>
              <View style={styles.genreList}>
                {genreChips.map((genre) => (
                  <Pressable
                    key={`${genre.label}-${genre.genreId ?? 'unknown'}`}
                    onPress={() => handleGenrePress(genre)}
                    style={[
                      styles.genreChip,
                      {
                        borderColor: theme.detail ?? '#d4d4d4',
                        backgroundColor: scheme === 'dark'
                          ? 'rgba(255,255,255,0.05)'
                          : '#f4f4f5',
                      },
                    ]}
                    hitSlop={8}
                  >
                    <Text style={[styles.genreChipText, { color: theme.tint }]}>
                      {genre.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {lockedVisual && (
            <View
              style={[
                styles.unlockCard,
                {
                  backgroundColor: theme.bookCard,
                  borderColor: theme.detail ?? '#e5e5e5',
                },
              ]}
            >
              <Text style={[styles.unlockTitle, { color: theme.tint }]}>
                {t('book.locked') ?? 'Livro bloqueado'}
              </Text>
              <Text style={[styles.unlockSubtitle, { color: theme.text }]}>
                {t('book.unlockWithKey') ??
                  'Use 1 chave para liberar o áudio e o resumo deste título.'}
              </Text>
              {(session?.user?.keys ?? 0) <= 0 && (
                <Text style={[styles.unlockWarning, { color: theme.text }]}>
                  {t('book.noKeysMessage') ??
                    'Você não tem chaves suficientes para desbloquear este livro.'}
                </Text>
              )}
              {unlockError ? (
                <View style={[styles.unlockError, { backgroundColor: scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fee2e2' }]}>
                  <Text style={[styles.unlockErrorText, { color: '#b91c1c' }]}>
                    {unlockError}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

        <BookSummarySection
          loading={loading}
          error={error}
          summaryText={resolvedSummaryText}
          progress={audioReady ? progressRatio : 0}
          backgroundColor={theme.bookCard}
          accentColor={theme.tint}
          textColor={theme.text}
          expanded={summaryExpanded}
          onToggleExpanded={toggleSummaryExpanded}
        />
        </Animated.View>
      </ScrollView>

      {summaryOverlayVisible && (resolvedSummaryText || lockedVisual) && (
        <Animated.View
          pointerEvents={summaryExpanded ? 'auto' : 'none'}
          style={[
            styles.summaryOverlay,
            {
              paddingTop: insets.top + 10,
              paddingBottom: 0,
              bottom: 0,
              backgroundColor: theme.background,
              opacity: summaryAnim,
              transform: [
                {
                  translateY: summaryAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
              zIndex: 90,
            },
          ]}
        >
          <Pressable
            style={[styles.overlayClose, { top: insets.top + 4 }]}
            onPress={toggleSummaryExpanded}
            hitSlop={12}
            pointerEvents="auto"
          >
            <Text style={styles.overlayCloseText}>✕</Text>
          </Pressable>
          <ScrollView
            contentContainerStyle={[
              styles.overlayContent,
              {
                paddingBottom: AUDIO_BAR_HEIGHT + insets.bottom + 24,
                paddingHorizontal: 12,
              },
            ]}
            showsVerticalScrollIndicator
            onTouchStart={() => {
              summaryTouchStartRef.current = Date.now();
            }}
            onTouchEnd={() => {
              const start = summaryTouchStartRef.current;
              summaryTouchStartRef.current = null;
              if (!start) return;
              const delta = Date.now() - start;
              if (delta <= 100) toggleSummaryExpanded();
            }}
          >
            <Text style={[styles.overlayTitle, { color: theme.tint }]}>Resumo</Text>
            <HighlightedSummary
              text={resolvedSummaryText ?? ''}
              progress={audioReady ? progressRatio : 0}
              variant="expanded"
              accentColor={theme.tint}
              textColor={theme.text}
              animatedStyle={{
                transform: [
                  {
                    scale: summaryFontAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              }}
            />
          </ScrollView>
        </Animated.View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.fauxTabBar,
          {
            opacity: fauxTabOpacity,
            transform: [{ scale: fauxTabScale }],
          },
        ]}
      >
        <View
          style={[
            styles.fauxBarInner,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.detail ?? theme.border,
            },
          ]}
        >
          <View style={styles.fauxTabItem}>
            <Ionicons name="library-outline" size={22} color={theme.tint} />
          </View>
          <View style={[styles.fauxTabItem, styles.fauxTabCenter]}>
            <Ionicons name="search-outline" size={22} color={theme.tint} />
          </View>
          <View style={styles.fauxTabItem}>
            <Ionicons name="person-outline" size={22} color={theme.tint} />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: audioOpacity,
          transform: [{ scale: audioScale }],
          zIndex: 95,
        }}
      >
        <AudioBar
          bottomInset={insets.bottom}
          backgroundColor={theme.bookCard}
          borderColor={scheme === 'dark' ? '#333' : theme.detail ?? theme.border}
          audioReady={audioReady}
          audioLoading={audioLoading}
          audioError={audioErr}
          locked={lockedVisual}
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
      </Animated.View>

      {toastVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.toastOverlay,
            { opacity: toastAnim, backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)' },
          ]}
        >
          <Animated.View
            style={[
              styles.toastBox,
              {
                backgroundColor: theme.bookCard,
                borderColor: '#d4af37',
                shadowColor: theme.text,
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.noKeysTitle, { color: theme.tint }]}>
              {toastTitle ?? t('book.noKeysTitle') ?? 'Sem chaves suficientes'}
            </Text>
            <Text style={[styles.noKeysBody, { color: theme.text }]}>
              {toastMessage ??
                t('book.noKeysMessage') ??
                'Você não tem chaves suficientes para desbloquear este livro.'}
            </Text>
            <View style={styles.toastDivider} />
            <Pressable
              style={[
                styles.toastButton,
                { backgroundColor: theme.tint },
              ]}
              onPress={() => {
                Animated.timing(toastAnim, {
                  toValue: 0,
                  duration: 180,
                  useNativeDriver: true,
                }).start(() => {
                  setToastVisible(false);
                  setToastMessage(null);
                });
              }}
            >
              <Text style={[styles.toastButtonText, { color: theme.background }]}>
                {t('common.confirm') ?? 'OK'}
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontSize: 20, fontWeight: '700' },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseText: {
    fontSize: 20,
    fontWeight: '800',
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
    maxWidth: 420,
    aspectRatio: 2 / 3,
    borderRadius: 18,
  },
  ratingCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 8,
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  ratingStar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  ratingSpinner: {
    marginLeft: 8,
  },
  ratingHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 16,
  },
  coverWrapper: {
    borderWidth: 2,
    borderColor: '#d4af37',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    paddingEnd: 0,
    marginBottom: 16,
  },
  coverLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  fauxTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  fauxBarInner: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingLeft: 54,
    paddingRight: 54,
  },
  fauxTabItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fauxTabCenter: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  genreSection: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 8,
  },
  genreLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  genreList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  genreChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  unlockCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 10,
  },
  unlockTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  unlockSubtitle: {
    fontSize: 13,
    opacity: 0.8,
  },
  unlockWarning: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.9,
  },
  unlockError: {
    borderRadius: 8,
    padding: 10,
  },
  unlockErrorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  unlockFloating: {
    position: 'absolute',
    right: 16,
    zIndex: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b8860b',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  unlockFloatingText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  toastBox: {
    position: 'absolute',
    maxWidth: '88%',
    alignSelf: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    zIndex: 70,
    gap: 8,
    alignItems: 'center',
    top: '40%',
  },
  noKeysTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  noKeysBody: {
    fontSize: 13,
    opacity: 0.9,
  },
  toastDivider: {
    width: '75%',
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: '#d4af37',
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 999,
  },
  toastOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#2563eb',
  },
  toastButtonText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
});
