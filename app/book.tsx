// app/book.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/Colors';
import { Text, View } from '@/components/Themed';
import { BASE_URL } from '@/constants/API';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { useAuth } from '@/auth/AuthContext';
import { useLocalSearchParams } from 'expo-router';
import { useSafeInsets } from '@/hooks/useSafeInsets';

type SummaryResponse = { audio_url: string; summary: string };

const BAR_HEIGHT = 64;

export default function BookScreen() {
  const { title, author, year, cover_url, language } =
    useLocalSearchParams<{ title: string; author: string; year: string; cover_url: string; language?: string }>();

  const scheme = useColorScheme() ?? 'light';
  const theme  = Colors[scheme];
  const insets = useSafeInsets();

  const { fetchJSON, authedFetch } = useAuthedFetch();
  const { session } = useAuth();
  const token = session?.token ?? '';

  // estado de summary
  const [summaryObj, setSummaryObj] = useState<SummaryResponse | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // estado de áudio
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  // Player
  const player = useAudioPlayer(undefined, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  const imageUri = useMemo(() => {
    const path = cover_url?.startsWith('/') ? cover_url : `/${cover_url}`;
    return `${BASE_URL}${path}`; // /cover liberado no middleware
  }, [cover_url]);

  const lang = useMemo(() => {
    const v = String(language ?? '').trim();
    return v === 'pt-BR' || v === 'en-US' ? v : 'pt-BR';
  }, [language]);

  const summariesUrl = useMemo(() => {
    if (!title) return '';
    const q = new URLSearchParams({ title: String(title), language: lang });
    return `${BASE_URL}/summaries?${q.toString()}`; // se /summaries ficar protegido, fetchJSON já manda Bearer
  }, [title, lang]);

  // util: fetch com timeout (reaproveitando o authedFetch p/ mandar o header)
  const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, ms = 12000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await authedFetch(input, { ...init, signal: ctrl.signal }); // << aqui vai Authorization
    } finally {
      clearTimeout(t);
    }
  };

  // 1) busca summary (agora autenticado)
  useEffect(() => {
    let active = true;
    if (!summariesUrl) return;

    (async () => {
      try {
        setLoadingSummary(true);
        setSummaryErr(null);
        setSummaryObj(null);

        const data = await fetchJSON<SummaryResponse>(summariesUrl);
        if (!active) return;
        if (!data?.audio_url) throw new Error('Resposta sem "audio_url".');

        setSummaryObj(data);
      } catch (e: any) {
        if (!active) return;
        setSummaryErr(e?.message ?? 'Falha ao carregar resumo');
      } finally {
        if (active) setLoadingSummary(false);
      }
    })();

    return () => { active = false; };
  }, [summariesUrl, fetchJSON]);

  // 2) vincula o PLAYER quando tiver audio_url — COM HEADERS
  useEffect(() => {
    let active = true;
    (async () => {
      if (!summaryObj?.audio_url) return;
      setAudioReady(false);
      setAudioErr(null);
      setAudioLoading(true);

      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });

      // Se você trocou para /audio protegido no backend:
      // Sugiro padronizar para `/audio/<slug>.mp3`
      const slug = encodeURIComponent(summaryObj.audio_url);
      const candidate = `${BASE_URL}/audios/luiz/${slug}.mp3`;

      // 1) Probe com Range + Authorization
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
        setAudioErr('Áudio não encontrado ou acesso negado em /audio.');
        setAudioLoading(false);
        return;
      }

      // 2) Tenta carregar direto com headers no player
      try {
        await player.replace({ uri: candidate, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (!active) return;
        setAudioReady(true);
        setAudioLoading(false);
        return;
      } catch (e: any) {
        // Pode falhar no iOS dependendo da versão por bug nos headers
        // (workaround abaixo)
      }

      // 3) Fallback iOS/geral: baixar arquivo com headers e tocar local
      try {
        const localFile = new FileSystem.File(FileSystem.Paths.cache, `audio-${slug}.mp3`);
        const dl = await FileSystem.File.downloadFileAsync(candidate, localFile, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        // Agora tocar via arquivo local (sem headers)
        await player.replace({ uri: dl.uri });
        if (!active) return;
        setAudioReady(true);
      } catch (e2: any) {
        if (!active) return;
        setAudioErr(e2?.message ?? 'Falha ao carregar áudio');
      } finally {
        if (active) setAudioLoading(false);
      }
    })();

    return () => { active = false; };
  }, [summaryObj?.audio_url, token, player]);

  // Controles
  const togglePlay = () => {
    if (!player || !audioReady) return;
    status?.playing ? player.pause() : player.play();
  };

  const stopPlayback = async () => {
    if (!player || !audioReady) return;
    player.pause();
    await player.seekTo(0);
  };

  const fmt = (sec?: number) => {
    const s = Math.floor(sec ?? 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const pos = status?.currentTime ?? 0;
  const dur = status?.duration ?? 0;
  const pct = dur ? (pos / dur) * 100 : 0;

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: BAR_HEIGHT + insets.bottom + 16,
        }}
      >
        <Image source={{ uri: imageUri }} style={styles.cover} resizeMode="cover" />
        <View style={[styles.info, { backgroundColor: theme.bookCard }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>Autor: {author}</Text>
          <Text style={styles.meta}>Ano: {year}</Text>
          <Text style={styles.meta}>Língua: {lang}</Text>
        </View>

        <View style={[styles.textBox, { backgroundColor: theme.bookCard }]}>
          <Text style={styles.textTitle}>Leitura em voz</Text>
          {loadingSummary && <Text style={styles.meta}>Carregando resumo...</Text>}
          {summaryErr && <Text style={[styles.meta, { color: 'tomato' }]}>{summaryErr}</Text>}
          {!!summaryObj && (
            <HighlightedSummary
              text={summaryObj.summary}
              progress={audioReady && status?.duration ? (status.currentTime ?? 0) / (status.duration ?? 1) : 0}
            />
          )}
        </View>
      </ScrollView>

      {/* barra fixa (sempre visível) */}
      <View
        style={[
          styles.audioBar,
          {
            paddingBottom: 10 + insets.bottom,
            backgroundColor: theme.bookCard,
            borderColor: scheme === 'dark' ? '#333' : '#e5e5e5',
          },
        ]}
      >
        {/* Lado esquerdo: botão play/pause (desabilitado quando não pronto) */}
        <Pressable
          onPress={togglePlay}
          disabled={!audioReady || !!audioErr || audioLoading}
          style={[
            styles.playBtn,
            (!audioReady || audioLoading) && { opacity: 0.6 },
          ]}
        >
          <Text style={{ fontSize: 18 }}>
            {status?.playing ? '⏸' : '▶️'}
          </Text>
        </Pressable>

        {/* Centro: estado do áudio */}
        <View style={styles.progressWrap}>
          {audioLoading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator />
              <Text style={styles.meta}>Carregando áudio...</Text>
            </View>
          )}

          {audioErr && !audioLoading && (
            <Text style={[styles.meta, { color: 'tomato' }]}>{audioErr}</Text>
          )}

          {audioReady && !audioLoading && !audioErr && (
            <>
              <View style={styles.progressBg}>
                <View style={[styles.progressFg, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.timer}>
                {fmt(pos)} / {fmt(dur)}
              </Text>
            </>
          )}
        </View>

        {/* Lado direito: stop (desabilitado quando não pronto) */}
        <Pressable
          onPress={stopPlayback}
          disabled={!audioReady || !!audioErr || audioLoading}
          style={[
            styles.stopBtn,
            (!audioReady || audioLoading) && { opacity: 0.6 },
          ]}
        >
          <Text style={{ fontSize: 16 }}>■</Text>
        </Pressable>
      </View>
    </>
  );
}

function HighlightedSummary({
  text,
  progress,
}: {
  text: string;
  progress: number; // 0..1
}) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const idx = Math.floor(text.length * p);

  const before = text.slice(0, idx);
  const after  = text.slice(idx);

  return (
    <Text style={styles.readText}>
      <Text style={styles.spoken}>{before}</Text>
      <Text>{after}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    marginBottom: 16,
  },
  info: {
    padding: 14,
    borderRadius: 12,
    gap: 6,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  meta: { fontSize: 14, opacity: 0.8 },

  textBox: { padding: 14, borderRadius: 12, gap: 8, marginTop: 8 },
  textTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  readText: { fontSize: 15, lineHeight: 22 },

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
    height: BAR_HEIGHT + 10,
    backgroundColor: 'white',
  },
  playBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  stopBtn: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressWrap: { flex: 1, gap: 6 },
  progressBg: {
    height: 6, borderRadius: 3, backgroundColor: '#d1d5db', overflow: 'hidden',
  },
  progressFg: { height: 6, borderRadius: 3, backgroundColor: '#111827' },
  timer: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  spoken: {
    textDecorationLine: 'underline',
    textDecorationColor: 'red',
  },
});
