import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/shared/Themed';

type Props = {
  text: string;
  progress: number; // 0..1
  variant?: 'default' | 'expanded';
};

export function HighlightedSummary({ text, progress, variant = 'default' }: Props) {
  const pct = Math.max(0, Math.min(1, progress || 0));
  const idx = Math.floor(text.length * pct);

  const before = text.slice(0, idx);
  const after = text.slice(idx);

  const readTextStyle = variant === 'expanded' ? styles.readTextExpanded : styles.readText;
  const spokenStyle =
    variant === 'expanded'
      ? [styles.spoken, styles.spokenExpanded]
      : styles.spoken;

  return (
    <Text style={readTextStyle}>
      <Text style={spokenStyle}>{before}</Text>
      <Text>{after}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  readText: { fontSize: 15, lineHeight: 22 },
  readTextExpanded: { fontSize: 18, lineHeight: 28 },
  spoken: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  spokenExpanded: {
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
    paddingHorizontal: 4,
    borderRadius: 6,
  },
});
