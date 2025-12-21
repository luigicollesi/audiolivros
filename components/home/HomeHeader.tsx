import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/shared/Themed';
import type { HomeHeaderStrings } from '@/types/home';

const CLOSE_BUTTON_WIDTH = 64;
const ANIM_MS = 200;

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
  keyboardVisible: boolean; // mantido para compatibilidade (não usado)
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
  onClickSound?: () => void;
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
  onClickSound,
}: Props) {
  const trimmedValue = searchInput.trim();
  const submitDisabled = !trimmedValue || trimmedValue === searchApplied;

  const closeWidth = useRef(new Animated.Value(0)).current;
  const chipAnim = useRef(new Animated.Value(hasClearChip ? 1 : 0)).current;
  const titleAnim = useRef(new Animated.Value(1)).current;
  const closeLabelOpacity = closeWidth.interpolate({
    inputRange: [0, CLOSE_BUTTON_WIDTH * 0.7, CLOSE_BUTTON_WIDTH],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const expandClose = useCallback(() => {
    Animated.timing(closeWidth, {
      toValue: CLOSE_BUTTON_WIDTH,
      duration: ANIM_MS,
      useNativeDriver: false,
    }).start();
  }, [closeWidth]);

  const collapseClose = useCallback((dismiss: boolean) => {
    Animated.timing(closeWidth, {
      toValue: 0,
      duration: ANIM_MS,
      useNativeDriver: false,
    }).start(() => {
      if (dismiss) onDismissKeyboard();
    });
  }, [closeWidth, onDismissKeyboard]);

  useEffect(() => {
    if (!keyboardVisible) {
      collapseClose(false);
    }
  }, [keyboardVisible, collapseClose]);

  useEffect(() => {
    Animated.timing(chipAnim, {
      toValue: hasClearChip ? 1 : 0,
      duration: ANIM_MS,
      useNativeDriver: true,
    }).start();
  }, [chipAnim, hasClearChip]);

  useEffect(() => {
    titleAnim.setValue(0);
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: ANIM_MS,
      useNativeDriver: true,
    }).start();
  }, [strings.title, titleAnim]);

  const chipStyle = useMemo(
    () => ({
      opacity: chipAnim,
      transform: [
        {
          translateY: chipAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-4, 0],
          }),
        },
      ],
    }),
    [chipAnim],
  );

  const titleStyle = useMemo(
    () => ({
      opacity: titleAnim,
      transform: [
        {
          translateY: titleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 0],
          }),
        },
      ],
    }),
    [titleAnim],
  );

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
        <Animated.Text
          style={[
            styles.title,
            { color: detailColor ?? textColor },
            titleStyle,
          ]}
        >
          {strings.title}
        </Animated.Text>
        <RNView style={styles.headerActions}>
          <Animated.View style={chipStyle} pointerEvents={hasClearChip ? 'auto' : 'none'}>
            {hasClearChip && (
              <Pressable
                onPress={() => {
                  onClickSound?.();
                  onClearChip();
                }}
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
          </Animated.View>
          <Pressable
            onPress={() => {
              onClickSound?.();
              onOpenFilters();
            }}
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
          onFocus={() => {
            onClickSound?.();
            expandClose();
          }}
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
          onSubmitEditing={() => {
            onClickSound?.();
            onApplySearch();
          }}
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
          onPress={() => {
            onClickSound?.();
            onApplySearch();
          }}
          disabled={submitDisabled}
        >
          <Text style={[styles.searchButtonText, { color: actionTextColor }]}>
            {strings.searchSubmitLabel}
          </Text>
        </Pressable>
        <Animated.View style={[styles.closeSlot, { width: closeWidth }]}>
          <Pressable
            style={styles.keyboardButton}
            onPress={() => {
              onClickSound?.();
              collapseClose(true);
            }}
          >
            <Animated.Text
              style={[
                styles.keyboardButtonText,
                { color: accentColor, opacity: closeLabelOpacity },
              ]}
            >
              {strings.keyboardDismissLabel}
            </Animated.Text>
          </Pressable>
        </Animated.View>
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
  closeSlot: {
    overflow: 'hidden',
    alignItems: 'flex-end',
  },
  keyboardButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 36,
    justifyContent: 'center',
  },
  keyboardButtonText: { fontWeight: '600', fontSize: 12 },
  searchChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0,
  },
  searchChipText: { fontWeight: '600', fontSize: 13 },
});
