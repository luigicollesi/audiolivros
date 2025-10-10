import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export const TextField: React.FC<TextFieldProps> = ({ label, error, style, ...rest }) => {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <View style={styles.wrapper}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={placeholderColor}
        {...rest}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) =>
  StyleSheet.create({
    wrapper: { width: '100%', gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.tabIconDefault,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: isDark ? colors.bookCard : colors.background,
    },
    inputError: { borderColor: '#ef4444' },
    error: { color: '#ef4444', fontSize: 12 },
  });
