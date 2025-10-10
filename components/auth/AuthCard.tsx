// components/auth/AuthCard.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, ViewProps, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

export type AuthCardProps = ViewProps & {
  title: string;
  subtitle?: string | null;
};

export const AuthCard: React.FC<AuthCardProps> = ({ title, subtitle, style, children, ...rest }) => {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={[styles.card, style]} {...rest}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

type Palette = typeof Colors.light;

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.tabIconDefault,
      padding: 18,
      backgroundColor: colors.bookCard,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: colors.text },
    subtitle: { fontSize: 14, color: colors.text, opacity: 0.7, textAlign: 'center' },
    content: { gap: 12 },
  });
