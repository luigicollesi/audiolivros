import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Text } from 'react-native';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export const TextField: React.FC<TextFieldProps> = ({ label, error, style, ...rest }) => {
  return (
    <View style={styles.wrapper}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#9ca3af"
        {...rest}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputError: { borderColor: '#ef4444' },
  error: { color: '#ef4444', fontSize: 12 },
});
