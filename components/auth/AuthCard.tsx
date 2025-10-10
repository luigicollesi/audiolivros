// components/auth/AuthCard.tsx
import React from 'react';
import { StyleSheet, View, ViewProps, Text } from 'react-native';

export type AuthCardProps = ViewProps & {
  title: string;
  subtitle?: string | null;
};

export const AuthCard: React.FC<AuthCardProps> = ({ title, subtitle, style, children, ...rest }) => {
  return (
    <View style={[styles.card, style]} {...rest}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    padding: 18,
    backgroundColor: '#fff',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  content: { gap: 12 },
});
