import { useEffect, useMemo, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

const TRACKS = [
  require('../../assets/sound/music1.mp3'),
  require('../../assets/sound/music2.mp3'),
];

export function BackgroundMusic() {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [index, setIndex] = useState(0);
  const tracks = useMemo(() => TRACKS, []);

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
      try {
        await player.replace(tracks[index]);
        if (player.setVolume) {
          await player.setVolume(0.12);
        } else {
          // @ts-ignore fallback for older expo-audio
          player.volume = 0.12;
        }
        if (!cancelled) {
          await player.play();
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, player, tracks]);

  useEffect(() => {
    if (status?.didJustFinish) {
      setIndex((prev) => (prev + 1) % tracks.length);
    }
  }, [status?.didJustFinish, tracks.length]);

  return null;
}
