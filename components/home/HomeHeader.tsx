import React from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/shared/Themed';
import type { HomeHeaderStrings } from '@/types/home';

type Props = {
  paddingTop: number;
  backgroundColor: string;
  cardColor: string;
  detailColor?: string;
  textColor: string;
  accentColor: string;
  actionTextColor: string;
  placeholderColor: string;
  isDark: boolean;
  keyboardVisible: boolean;
  searchInputRef: React.RefObject<TextInput | null>;
  searchInput: string;
  searchApplied: string;
  hasClearChip: boolean;
  strings: HomeHeaderStrings;
  onLayout?: (event: LayoutChangeEvent) => void;
  onChangeSearch: (value: string) => void;
  onApplySearch: () => void;
  onClearChip: () => void;
  onDismissKeyboard: () => void;
  onOpenFilters: () => void;
};

export function HomeHeader({
  paddingTop,
  backgroundColor,
  cardColor,
  detailColor,
  textColor,
  accentColor,
  actionTextColor,
  placeholderColor,
  isDark,
  keyboardVisible,
  searchInputRef,
  searchInput,
  searchApplied,
  hasClearChip,
  strings,
  onLayout,
  onChangeSearch,
  onApplySearch,
  onClearChip,
  onDismissKeyboard,
  onOpenFilters,
}: Props) {
  const trimmedValue = searchInput.trim();
  const submitDisabled = !trimmedValue || trimmedValue === searchApplied;

  return (
    <RNView
      style={[
        styles.container,
        {
          paddingTop,
          backgroundColor,
        },
      ]}
      onLayout={onLayout}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: cardColor },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: detailColor ?? textColor },
          ]}
        >
          {strings.title}
        </Text>
        <RNView style={styles.headerActions}>
          {hasClearChip && (
            <Pressable
              onPress={onClearChip}
              style={[
                styles.searchChip,
                {
                  borderColor: detailColor ?? textColor,
                  backgroundColor: cardColor,
                },
              ]}
            >
              <Text style={[styles.searchChipText, { color: accentColor }]}>
                {strings.clearLabel}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={onOpenFilters}
            style={[
              styles.filterButton,
              {
                backgroundColor: accentColor,
                borderColor: detailColor ?? textColor,
              },
            ]}
          >
            <Text style={[styles.filterButtonText, { color: actionTextColor }]}>
              {strings.filterLabel}
            </Text>
          </Pressable>
        </RNView>
      </View>

      <RNView
        style={[
          styles.searchRow,
          {
            backgroundColor: isDark ? 'rgba(16,32,58,0.85)' : cardColor,
          },
        ]}
      >
        <TextInput
          ref={searchInputRef}
          placeholder={strings.searchPlaceholder}
          value={searchInput}
          onChangeText={onChangeSearch}
          style={[
            styles.searchInput,
            {
              borderColor: detailColor ?? textColor,
              backgroundColor,
              color: textColor,
            },
          ]}
          returnKeyType="search"
          blurOnSubmit
          onSubmitEditing={onApplySearch}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={placeholderColor}
        />
        <Pressable
          style={[
            styles.searchButton,
            {
              backgroundColor: accentColor,
              borderColor: detailColor ?? textColor,
            },
            submitDisabled && styles.searchButtonDisabled,
          ]}
          onPress={onApplySearch}
          disabled={submitDisabled}
        >
          <Text style={[styles.searchButtonText, { color: actionTextColor }]}>
            {strings.searchSubmitLabel}
          </Text>
        </Pressable>
        {keyboardVisible && (
          <Pressable style={styles.keyboardButton} onPress={onDismissKeyboard}>
            <Text
              style={[
                styles.keyboardButtonText,
                { color: accentColor },
              ]}
            >
              {strings.keyboardDismissLabel}
            </Text>
          </Pressable>
        )}
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    minHeight: 58,
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  filterButtonText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    gap: 8,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: { fontWeight: '600' },
  keyboardButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardButtonText: { fontWeight: '600' },
  searchChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0,
  },
  searchChipText: { fontWeight: '600', fontSize: 13 },
});
