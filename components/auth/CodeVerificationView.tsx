// components/auth/CodeVerificationView.tsx
import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import ClickPressable from '@/components/shared/ClickPressable';

const DEFAULT_CODE_LENGTH = 6;

export type CodeVerificationViewProps = {
  code: string;
  setCode: (value: string) => void;
  title: string;
  subtitle?: string | null;
  loading?: boolean;
  error?: string | null;
  codeLength?: number;
  onSubmit: () => void;
  submitLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  secondActionLabel?: string;
  onSecondAction?: (() => void) | null;
  secondActionDisabled?: boolean;
};

export function CodeVerificationView({
  code,
  setCode,
  title,
  subtitle,
  loading,
  error,
  codeLength = DEFAULT_CODE_LENGTH,
  onSubmit,
  submitLabel = 'Confirmar',
  onBack,
  backLabel = 'Voltar',
  secondActionLabel,
  onSecondAction,
  secondActionDisabled,
}: CodeVerificationViewProps) {
  const inputRef = useRef<TextInput>(null);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const indicatorColor = palette.tint;
  const digits = useMemo(() => {
    const arr = new Array(codeLength).fill('');
    const safe = code.replace(/\D/g, '').slice(0, codeLength);
    for (let i = 0; i < safe.length; i += 1) arr[i] = safe[i];
    return arr;
  }, [code, codeLength]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!loading && code.length === codeLength) {
      onSubmit();
    }
  }, [loading, code.length, codeLength, onSubmit]);

  return (
    <View style={styles.container} pointerEvents={loading ? 'none' : 'auto'}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <ClickPressable style={styles.codeBoxes} onPress={focusInput}>
        {digits.map((digit, index) => (
          <View key={index} style={styles.codeBox}>
            <Text style={styles.codeDigit}>{digit}</Text>
          </View>
        ))}
      </ClickPressable>

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        keyboardType="number-pad"
        autoFocus
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, codeLength))}
        maxLength={codeLength}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <ClickPressable
        style={[styles.primaryBtn, (code.length !== codeLength || loading) && styles.primaryBtnDisabled]}
        onPress={handleSubmit}
        disabled={code.length !== codeLength || loading}
      >
        {loading ? (
          <ActivityIndicator color={indicatorColor} />
        ) : (
          <Text style={styles.primaryBtnText}>{submitLabel}</Text>
        )}
      </ClickPressable>

      {!!secondActionLabel && onSecondAction && (
        <ClickPressable
          style={[styles.secondaryBtn, secondActionDisabled && styles.secondaryBtnDisabled]}
          onPress={onSecondAction}
          disabled={secondActionDisabled}
        >
          <Text style={styles.secondaryBtnText}>{secondActionLabel}</Text>
        </ClickPressable>
      )}

      {!!onBack && (
        <ClickPressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{backLabel}</Text>
        </ClickPressable>
      )}
    </View>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) => {
  const secondaryBackground = colors.bookCard;

  return StyleSheet.create({
    container: {
      gap: 16,
      width: '100%',
      alignItems: 'center',
    },
    title: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.tint, letterSpacing: 0.3 },
    subtitle: { fontSize: 14, color: colors.text, opacity: 0.7, textAlign: 'center' },
    codeBoxes: { flexDirection: 'row', gap: 10 },
    codeBox: {
      width: 48,
      height: 58,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.detail,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bookCard,
    },
    codeDigit: { fontSize: 22, fontWeight: '700', color: colors.text },
    hiddenInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
    primaryBtn: {
      marginTop: 6,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      alignSelf: 'stretch',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: colors.background, fontWeight: '700', fontSize: 16 },
    secondaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: secondaryBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    secondaryBtnDisabled: { opacity: 0.6 },
    secondaryBtnText: { color: colors.tint, fontWeight: '600', textAlign: 'center' },
    backBtn: { paddingVertical: 8 },
    backBtnText: { color: colors.tint, fontWeight: '600' },
    error: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  });
};
