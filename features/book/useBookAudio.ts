import { useCallback, useEffect, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { BASE_URL } from '@/constants/API';
import { AuthedFetch } from './types';

export type BookAudioControls = {
  audioReady: boolean;
  audioLoading: boolean;
  audioErr: string | null;
  isPlaying: boolean;
  togglePlay: () => void;
  seekTo: (value: number) => Promise<void>;
  skipBy: (delta: number) => Promise<void>;
  seeking: boolean;
  position: number;
  duration: number;
  progressRatio: number;
  formatTime: (sec?: number) => string;
};

type UseBookAudioOptions = {
  audioPath?: string | null;
  token: string;
  authedFetch: AuthedFetch;
};

export function useBookAudio({ audioPath, token, authedFetch }: UseBookAudioOptions): BookAudioControls {
  const player = useAudioPlayer(undefined, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  const [audioLoading, setAudioLoading] = useState(false);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [seeking, setSeeking] = useState(false);

  const fetchWithTimeout = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit, ms = 12000) => {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), ms);
      try {
        return await authedFetch(input, { ...init, signal: ctrl.signal });
      } finally {
        clearTimeout(timeout);
      }
    },
    [authedFetch]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      if (!audioPath) {
        setAudioReady(false);
        setAudioErr(null);
        return;
      }

      setAudioReady(false);
      setAudioErr(null);
      setAudioLoading(true);

      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });

      const slug = encodeURIComponent(audioPath);
      const candidate = `${BASE_URL}/audios/luiz/${slug}.mp3`;

      const probeHeaders: HeadersInit = {
        Range: 'bytes=0-0',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const ok = await (async () => {
        try {
          const r = await fetchWithTimeout(candidate, { headers: probeHeaders }, 8000);
          return r.ok || r.status === 206;
        } catch {
          return false;
        }
      })();

      if (!ok) {
        if (!active) return;
        setAudioErr('Áudio não encontrado ou acesso negado em /audio.');
        setAudioLoading(false);
        return;
      }

      try {
        await player.replace({
          uri: candidate,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!active) return;
        setAudioReady(true);
        setAudioLoading(false);
        return;
      } catch {
        // continua para o fallback
      }

      try {
        const localFile = new FileSystem.File(FileSystem.Paths.cache, `audio-${slug}.mp3`);
        const dl = await FileSystem.File.downloadFileAsync(candidate, localFile, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        await player.replace({ uri: dl.uri });
        if (!active) return;
        setAudioReady(true);
      } catch (err: any) {
        if (!active) return;
        setAudioErr(err?.message ?? 'Falha ao carregar áudio');
      } finally {
        if (active) setAudioLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [audioPath, token, player, fetchWithTimeout]);

  const isPlaying = !!status?.playing;
  const position = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;
  const progressRatio = duration ? position / duration : 0;

  const togglePlay = useCallback(() => {
    if (!audioReady || audioLoading || audioErr) return;
    if (isPlaying) player.pause();
    else player.play();
  }, [audioReady, audioLoading, audioErr, isPlaying, player]);
  const seekTo = useCallback(
    async (value: number) => {
      if (!audioReady || audioErr || audioLoading || Number.isNaN(value)) return;
      setSeeking(true);
      try {
        await player.seekTo(value);
        if (!isPlaying) {
          // Caso termine e o usuário arraste para o meio, manter parado
        }
      } finally {
        setSeeking(false);
      }
    },
    [audioReady, audioErr, audioLoading, player, isPlaying]
  );

  const skipBy = useCallback(
    async (delta: number) => {
      if (!audioReady || audioErr || audioLoading) return;
      const current = status?.currentTime ?? 0;
      const total = status?.duration ?? 0;
      if (!total) return;
      const next = Math.max(0, Math.min(total, current + delta));
      await seekTo(next);
    },
    [audioReady, audioErr, audioLoading, seekTo, status?.duration, status?.currentTime]
  );

  const formatTime = useCallback((sec?: number) => {
    const s = Math.floor(sec ?? 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (!audioReady || audioLoading || audioErr) return;
    if (!status?.playing && !seeking && status?.duration) {
      const finished = Math.abs((status.currentTime ?? 0) - status.duration) < 0.2;
      if (finished) {
        player.seekTo(0).catch(() => {});
      }
    }
  }, [status?.playing, status?.currentTime, status?.duration, audioReady, audioLoading, audioErr, player, seeking]);

  return {
    audioReady,
    audioLoading,
    audioErr,
    isPlaying,
    togglePlay,
    seekTo,
    skipBy,
    seeking,
    position,
    duration,
    progressRatio,
    formatTime,
  };
}
