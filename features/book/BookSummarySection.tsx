import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Text, View } from '@/components/shared/Themed';
import { HighlightedSummary } from './HighlightedSummary';

type Props = {
  loading: boolean;
  error?: string | null;
  summaryText?: string | null;
  progress: number;
  backgroundColor: string;
};

export function BookSummarySection({
  loading,
  error,
  summaryText,
  progress,
  backgroundColor,
}: Props) {
  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <Text style={styles.title}>Leitura em voz</Text>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.meta}>Carregando resumo...</Text>
        </View>
      )}
      {error && !loading && (
        <Text style={[styles.meta, styles.error]}>{error}</Text>
      )}
      {!!summaryText && !loading && !error && (
        <HighlightedSummary text={summaryText} progress={progress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 14, opacity: 0.8 },
  error: { color: 'tomato' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
