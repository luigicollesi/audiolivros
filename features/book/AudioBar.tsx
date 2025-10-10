import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View as RNView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Text, View } from '@/components/shared/Themed';

export type AudioBarProps = {
  bottomInset: number;
  backgroundColor: string;
  borderColor: string;
  audioReady: boolean;
  audioLoading: boolean;
  audioError?: string | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (value: number) => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  seeking: boolean;
  position: number;
  duration: number;
  formatTime: (value?: number) => string;
};

export const AUDIO_BAR_HEIGHT = 120;

export function AudioBar({
  bottomInset,
  backgroundColor,
  borderColor,
  audioReady,
  audioLoading,
  audioError,
  isPlaying,
  onTogglePlay,
  onSeek,
  onSkipForward,
  onSkipBackward,
  seeking,
  position,
  duration,
  formatTime,
}: AudioBarProps) {
  return (
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
      <Pressable
        onPress={onTogglePlay}
        disabled={!audioReady || !!audioError || audioLoading}
        style={[styles.playBtn, (!audioReady || audioLoading) && styles.disabled]}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
      </Pressable>

      <View style={styles.progressWrap}>
        {audioLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.meta}>Carregando áudio...</Text>
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
              minimumTrackTintColor="#111827"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#111827"
              onSlidingComplete={onSeek}
              disabled={seeking}
            />
            <View style={styles.timerRow}>
              <Text style={styles.timer}>{formatTime(position)}</Text>
              <Text style={styles.timer}>{formatTime(duration)}</Text>
            </View>
            <View style={styles.controlsRow}>
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
  );
}

const styles = StyleSheet.create({
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
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  playIcon: { fontSize: 18 },
  disabled: { opacity: 0.6 },
  progressWrap: { flex: 1, gap: 8 },
  progressSection: { gap: 6 },
  slider: { width: '100%', height: 30 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timer: { fontSize: 12, opacity: 0.8 },
  meta: { fontSize: 14, opacity: 0.8 },
  error: { color: 'tomato' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
  },
  smallBtnText: { fontSize: 12, fontWeight: '600' },
});
