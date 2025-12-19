import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View as RNView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useTranslation } from '@/i18n/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

export type AudioBarProps = {
  bottomInset: number;
  backgroundColor: string;
  borderColor: string;
  audioReady: boolean;
  audioLoading: boolean;
  audioError?: string | null;
  locked?: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (value: number) => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  seeking: boolean;
  position: number;
  duration: number;
  formatTime: (value?: number) => string;
  playbackRate: number;
  availableRates: number[];
  onSelectRate: (rate: number) => void;
};

export const AUDIO_BAR_HEIGHT = 120;

export function AudioBar({
  bottomInset,
  backgroundColor,
  borderColor,
  audioReady,
  audioLoading,
  audioError,
  locked = false,
  isPlaying,
  onTogglePlay,
  onSeek,
  onSkipForward,
  onSkipBackward,
  seeking,
  position,
  duration,
  formatTime,
  playbackRate,
  availableRates,
  onSelectRate,
}: AudioBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const accent = palette.tint;
  const [ratePickerVisible, setRatePickerVisible] = useState(false);
  const { t } = useTranslation();

  const rateButtons = useMemo(
    () =>
      availableRates.map((rate) => {
        const selected = Math.abs(rate - playbackRate) < 0.001;
        return (
          <Pressable
            key={rate}
            onPress={() => {
              onSelectRate(rate);
              setRatePickerVisible(false);
            }}
            style={[styles.rateOption, selected && styles.rateOptionSelected]}
          >
            <Text
              style={[
                styles.rateOptionText,
                selected && styles.rateOptionTextSelected,
              ]}
            >
              {rate.toFixed(1)}x
            </Text>
          </Pressable>
        );
      }),
    [availableRates, playbackRate, onSelectRate],
  );

  return (
    <>
      {ratePickerVisible && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.rateOverlay]}
          onPress={() => setRatePickerVisible(false)}
        />
      )}
      <View
        style={[
          styles.audioBar,
          {
            paddingBottom: 10 + bottomInset,
            backgroundColor,
            borderColor,
          },
        ]}
      >
      {locked && (
        <View
          style={[
            styles.lockOverlay,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.45)',
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons
            name="lock-closed"
            size={28}
            color={isDark ? '#111827' : '#f8fafc'}
          />
        </View>
      )}
      <Pressable
        onPress={onTogglePlay}
        disabled={!audioReady || !!audioError || audioLoading || locked}
        style={[
          styles.playBtn,
          (!audioReady || audioLoading || locked) && styles.disabled,
        ]}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
      </Pressable>

      <View style={styles.progressWrap}>
        {audioLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={accent} />
            <Text style={styles.meta}>{t('book.audioLoading')}</Text>
          </View>
        )}

        {audioError && !audioLoading && (
          <Text style={[styles.meta, styles.error]}>{audioError}</Text>
        )}

        {audioReady && !audioLoading && !audioError && (
          <RNView style={styles.progressSection}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              minimumTrackTintColor={accent}
              maximumTrackTintColor={palette.border ?? palette.tabIconDefault}
              thumbTintColor={accent}
              onSlidingComplete={onSeek}
              disabled={seeking}
            />
            <View style={styles.timerRow}>
              <Text style={styles.timer}>{formatTime(position)}</Text>
              <Text style={styles.timer}>{formatTime(duration)}</Text>
            </View>
            <View style={styles.controlsRow}>
              <View style={styles.rateWrapper}>
                <Pressable
                  onPress={() => setRatePickerVisible((v) => !v)}
                  style={styles.rateSelectorBtn}
                >
                  <Text style={styles.rateSelectorText}>{playbackRate.toFixed(1)}x</Text>
                </Pressable>
                {ratePickerVisible && (
                  <RNView
                    style={styles.ratePopover}
                  >
                    <RNView style={styles.rateOptionsColumn}>{rateButtons}</RNView>
                  </RNView>
                )}
              </View>
              <Pressable
                onPress={onSkipBackward}
                disabled={!audioReady || audioLoading}
                style={[styles.smallBtn, (!audioReady || audioLoading) && styles.disabled]}
              >
                <Text style={styles.smallBtnText}>⏪ 10s</Text>
              </Pressable>
              <Pressable
                onPress={onSkipForward}
                disabled={!audioReady || audioLoading}
                style={[styles.smallBtn, (!audioReady || audioLoading) && styles.disabled]}
              >
                <Text style={styles.smallBtnText}>10s ⏩</Text>
              </Pressable>
            </View>
          </RNView>
        )}
      </View>
    </View>
    </>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) =>
  StyleSheet.create({
    audioBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 0,
      paddingHorizontal: 12,
      paddingTop: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      zIndex: 20,
      height: AUDIO_BAR_HEIGHT + 10,
    },
    lockOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: 14,
    },
    playBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: isDark ? colors.bookCard : colors.background,
    },
    playIcon: { fontSize: 18, color: colors.text },
    disabled: { opacity: 0.6 },
    progressWrap: { flex: 1, gap: 8 },
    progressSection: { gap: 6 },
    slider: { width: '100%', height: 30 },
    timerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    timer: { fontSize: 12, color: colors.text, opacity: 0.8 },
    meta: { fontSize: 14, color: colors.text, opacity: 0.8 },
    error: { color: 'tomato' },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
      gap: 8,
    },
    rateWrapper: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    rateSelectorBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: colors.bookCard,
    },
    rateSelectorText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.tint,
    },
    ratePopover: {
      position: 'absolute',
      alignItems: 'stretch',
      alignSelf: 'center',
      bottom: 0,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border ?? colors.detail,
      backgroundColor: colors.bookCard,
      paddingVertical: 6,
      paddingHorizontal: 8,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      zIndex: 30,
    },
    smallBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border ?? colors.detail,
      backgroundColor: colors.secondary,
    },
    smallBtnText: { fontSize: 12, fontWeight: '600', color: colors.background },
    rateOverlay: {
      backgroundColor: 'transparent',
    },
    rateOptionsColumn: {
      gap: 8,
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    rateOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border ?? colors.detail,
      alignItems: 'center',
      minWidth: 72,
      minHeight: 36,
      justifyContent: 'center',
      backgroundColor: colors.bookCard,
    },
    rateOptionSelected: {
      backgroundColor: colors.secondary,
      borderColor: colors.detail,
    },
    rateOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    rateOptionTextSelected: {
      color: colors.background,
    },
  });
