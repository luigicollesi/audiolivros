// src/app/book.tsx
import React, { useMemo, useCallback } from 'react';
import { Image, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import Colors from '@/constants/Colors';
import { BASE_URL } from '@/constants/API';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useAuth } from '@/auth/AuthContext';
import { useSafeInsets } from '@/hooks/useSafeInsets';

import { useBookSummary } from '@/features/book/useBookSummary';
import { useBookAudio } from '@/features/book/useBookAudio';
import { BookInfo } from '@/features/book/BookInfo';
import { BookSummarySection } from '@/features/book/BookSummarySection';
import { AudioBar, AUDIO_BAR_HEIGHT } from '@/features/book/AudioBar';

export default function BookScreen() {
  const { title, author, year, cover_url, language } =
    useLocalSearchParams<{ title: string; author: string; year: string; cover_url: string; language?: string }>();

  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeInsets();

  const { fetchJSON, authedFetch } = useAuthedFetch();
  const { session, refreshSession } = useAuth();
  const token = session?.token ?? '';

  const imageUri = useMemo(() => {
    const path = cover_url?.startsWith('/') ? cover_url : `/${cover_url}`;
    return `${BASE_URL}${path}`;
  }, [cover_url]);

  const lang = useMemo(() => {
    const normalized = String(language ?? '').trim();
    return normalized === 'pt-BR' || normalized === 'en-US' ? normalized : 'pt-BR';
  }, [language]);

  const summariesUrl = useMemo(() => {
    if (!title) return null;
    const q = new URLSearchParams({ title: String(title), language: lang });
    return `${BASE_URL}/summaries?${q.toString()}`;
  }, [title, lang]);

  const { summary, loading, error } = useBookSummary(summariesUrl, fetchJSON);

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
  } = useBookAudio({ audioPath: summary?.audio_url, token, authedFetch });

  useFocusEffect(
    useCallback(() => {
      refreshSession().catch(() => {});
      return () => {};
    }, [refreshSession])
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: AUDIO_BAR_HEIGHT + insets.bottom + 16 },
        ]}
      >
        <Image source={{ uri: imageUri }} style={styles.cover} resizeMode="cover" />

        <BookInfo
          title={title}
          author={author}
          year={year}
          language={lang}
          backgroundColor={theme.bookCard}
        />

        <BookSummarySection
          loading={loading}
          error={error}
          summaryText={summary?.summary}
          progress={audioReady ? progressRatio : 0}
          backgroundColor={theme.bookCard}
        />
      </ScrollView>

      <AudioBar
        bottomInset={insets.bottom}
        backgroundColor={theme.bookCard}
        borderColor={scheme === 'dark' ? '#333' : '#e5e5e5'}
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
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
  },
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    marginBottom: 16,
  },
});
