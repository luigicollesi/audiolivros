import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

type SoundContextValue = {
  playClick: () => void;
  playTransition1: () => void;
  playTransition2: () => void;
  skipNextClick: () => void;
  muted: boolean;
};

const SoundContext = createContext<SoundContextValue | null>(null);

function usePreloadedPlayer(asset: number, volume: number = 1) {
  const player = useAudioPlayer();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: false,
          shouldPlayInBackground: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 'duckOthers',
          interruptionMode: 'duckOthers',
        });
      } catch {
        /* noop */
      }
    })();
    (async () => {
      try {
        await player.replace(asset);
        if (player.setVolume) {
          await player.setVolume(volume);
        } else {
          // @ts-ignore legacy
          player.volume = volume;
        }
      } catch {
        // fail silently; clicks are auxiliary
      }
      if (cancelled) return;
      try {
        await player.pause();
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, asset]);

  const play = useCallback(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: false,
          shouldPlayInBackground: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 'duckOthers',
          interruptionMode: 'duckOthers',
        });
      } catch {
        /* noop */
      }
      try {
        await player.seekTo(0);
      } catch {
        /* noop */
      }
      try {
        await player.play();
      } catch {
        /* noop */
      }
    })();
  }, [player]);

  return play;
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [muted] = useState(false);

  const playClick = usePreloadedPlayer(require('../../assets/sound/click.mp3'), 0.8);
  const playTransition1 = usePreloadedPlayer(require('../../assets/sound/transition1.mp3'), 0.22);
  const playTransition2 = usePreloadedPlayer(require('../../assets/sound/transition2.mp3'), 0.22);
  const skipRef = React.useRef(false);

  const skipNextClick = useCallback(() => {
    skipRef.current = true;
  }, []);

  const safePlayClick = useCallback(() => {
    if (muted) return;
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    playClick();
  }, [playClick, muted]);

  const value = useMemo(
    () => ({
      playClick: safePlayClick,
      playTransition1: muted ? () => {} : playTransition1,
      playTransition2: muted ? () => {} : playTransition2,
      skipNextClick,
      muted,
    }),
    [safePlayClick, playTransition1, playTransition2, skipNextClick, muted],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSoundFx(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    return {
      playClick: () => {},
      playTransition1: () => {},
      playTransition2: () => {},
      skipNextClick: () => {},
      muted: false,
    };
  }
  return ctx;
}
