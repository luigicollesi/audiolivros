import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Text, ViewStyle } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  rightAccessory?: React.ReactNode;
  containerStyle?: ViewStyle;
};

export const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  style,
  rightAccessory,
  containerStyle,
  ...rest
}) => {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            error ? styles.inputError : null,
            rightAccessory ? styles.inputWithAccessory : null,
            style,
          ]}
          placeholderTextColor={placeholderColor}
          {...rest}
        />
        {rightAccessory ? (
          <View style={styles.accessoryWrapper}>
            {rightAccessory}
          </View>
        ) : null}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) =>
  StyleSheet.create({
    wrapper: { width: '100%', gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.tint },
    inputWrapper: { position: 'relative' },
    input: {
      borderWidth: 1,
      borderColor: colors.detail,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.bookCard,
    },
    inputWithAccessory: {
      paddingRight: 64,
    },
    inputError: { borderColor: '#ef4444' },
    error: { color: '#ef4444', fontSize: 12 },
    accessoryWrapper: {
      position: 'absolute',
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
