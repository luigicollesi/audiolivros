import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/Themed';

type Props = {
  text: string;
  progress: number; // 0..1
};

export function HighlightedSummary({ text, progress }: Props) {
  const pct = Math.max(0, Math.min(1, progress || 0));
  const idx = Math.floor(text.length * pct);

  const before = text.slice(0, idx);
  const after = text.slice(idx);

  return (
    <Text style={styles.readText}>
      <Text style={styles.spoken}>{before}</Text>
      <Text>{after}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  readText: { fontSize: 15, lineHeight: 22 },
  spoken: {
    textDecorationLine: 'underline',
    textDecorationColor: 'red',
  },
});
