import React, { useMemo } from 'react';
import { Animated, StyleSheet, TextStyle, View } from 'react-native';
import { Text } from '@/components/shared/Themed';

type Props = {
  text: string;
  progress: number; // 0..1
  variant?: 'default' | 'expanded';
  accentColor?: string;
  textColor?: string;
  animatedStyle?: Animated.AnimatedProps<TextStyle>;
};

export function HighlightedSummary({
  text,
  progress,
  variant = 'default',
  accentColor = '#2563eb',
  textColor,
  animatedStyle,
}: Props) {
  const pct = Math.max(0, Math.min(1, progress || 0));
  const idx = Math.floor(text.length * pct);

  const before = text.slice(0, idx);
  const after = text.slice(idx);

  const readTextStyle = [
    variant === 'expanded' ? styles.readTextExpanded : styles.readText,
    textColor ? { color: textColor } : null,
    animatedStyle,
  ];
  const highlightColor = useMemo(() => {
    // Try to convert hex (#RRGGBB) to rgba for opacity control
    const hex = accentColor?.trim?.() || '';
    if (/^#?[0-9a-fA-F]{6}$/.test(hex)) {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const alpha = variant === 'expanded' ? 0.35 : 0.25;
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return variant === 'expanded'
      ? 'rgba(37, 99, 235, 0.35)'
      : 'rgba(37, 99, 235, 0.25)';
  }, [accentColor, variant]);

  const spokenStyle = [
    styles.spokenBase,
    variant === 'expanded'
      ? styles.spokenExpanded
      : styles.spokenDefault,
    { backgroundColor: highlightColor },
  ];

  return (
    <View style={styles.textWrapper}>
      <Animated.Text style={readTextStyle}>
        <Text style={spokenStyle}>{before}</Text>
        <Text>{after}</Text>
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  textWrapper: {
    borderRadius: 12,
    overflow: 'visible',
    padding: 0,
  },
  readText: { fontSize: 15, lineHeight: 22, borderRadius: 10 },
  readTextExpanded: { fontSize: 17, lineHeight: 26, borderRadius: 12 },
  spokenBase: { borderRadius: 10, overflow: 'hidden' },
  spokenDefault: { paddingHorizontal: 2, paddingVertical: 2 },
  spokenExpanded: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
});
