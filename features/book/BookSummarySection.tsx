import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/shared/Themed';
import { HighlightedSummary } from './HighlightedSummary';
import { useTranslation } from '@/i18n/LanguageContext';

type Props = {
  loading: boolean;
  error?: string | null;
  summaryText?: string | null;
  progress: number;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function BookSummarySection({
  loading,
  error,
  summaryText,
  progress,
  backgroundColor,
  accentColor,
  textColor,
  expanded,
  onToggleExpanded,
}: Props) {
  const { t } = useTranslation();
  const containerStyle = useMemo(
    () => [
      styles.container,
      { backgroundColor },
      expanded ? styles.containerExpanded : null,
    ],
    [backgroundColor, expanded],
  );

  const handlePress = useCallback(() => {
    if (!loading && !error && summaryText) {
      onToggleExpanded();
    }
  }, [loading, error, summaryText, onToggleExpanded]);

  return (
    <Pressable style={containerStyle} onPress={handlePress}>
      <Text style={styles.title}>{t('book.summaryTitle')}</Text>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.meta}>{t('book.summaryLoading')}</Text>
        </View>
      )}
      {error && !loading && (
        <Text style={[styles.meta, styles.error]}>{error}</Text>
      )}
      {!!summaryText && !loading && !error && (
        <HighlightedSummary
          text={summaryText}
          progress={progress}
          variant="default"
          accentColor={accentColor}
          textColor={textColor}
        />
      )}
      <Text style={styles.hint}>
        {expanded ? t('book.summaryCollapse') : t('book.summaryExpand')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  containerExpanded: {
    minHeight: 320,
    paddingHorizontal: 10,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 14, opacity: 0.8 },
  error: { color: 'tomato' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
});
