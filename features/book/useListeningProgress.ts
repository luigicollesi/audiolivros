import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_URL } from '@/constants/API';
import { audioLogger } from '@/utils/logger';
import type { AuthedFetch } from './types';

type FetchJSON = <T>(
  input: RequestInfo | URL,
  opts?: RequestInit & { expect?: 'json' | 'text' | 'void' }
) => Promise<T>;

type ListeningProgressRow = {
  profileId?: string;
  book_id?: string;
  position_seconds?: number | null;
  duration_seconds?: number | null;
  progress_percent?: number | null;
  updated_at?: string | null;
};

type ReportPlaybackArgs = {
  position: number;
  duration: number;
  isPlaying: boolean;
  force?: boolean;
};

type UseListeningProgressOptions = {
  bookId?: string | null;
  audioPath?: string | null;
  authedFetch: AuthedFetch;
  fetchJSON: FetchJSON;
  initialProgressHint?: ListeningProgressRow | null;
};

export function useListeningProgress({
  bookId,
  audioPath,
  authedFetch,
  fetchJSON,
  initialProgressHint,
}: UseListeningProgressOptions) {
  const [initialPosition, setInitialPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(bookId) || Boolean(audioPath));
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastPersistedPosition, setLastPersistedPosition] = useState<number | null>(null);

  const audioFileName = useMemo(() => deriveAudioFileName(audioPath), [audioPath]);
  const currentKey = useMemo(() => bookId ?? audioFileName ?? null, [bookId, audioFileName]);

  const sessionStartedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const lastSentPositionRef = useRef(0);
  const engagedRef = useRef(false);

  // Reset session state quando muda o alvo
  useEffect(() => {
    sessionStartedRef.current = false;
    sessionEndedRef.current = false;
    engagedRef.current = false;
    lastSentAtRef.current = 0;
    lastSentPositionRef.current = 0;
    setLastPersistedPosition(null);
    setLastSyncedAt(null);
    if (currentKey) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    setResolvedKey(null);
  }, [currentKey]);

  useEffect(() => {
    if (!initialProgressHint) return;
    if (bookId) return; // prefer dado da API dedicada

    const hinted = sanitizeSeconds(initialProgressHint.position_seconds);
    if (hinted > 0) {
      setInitialPosition(hinted);
      setLastPersistedPosition(hinted);
      setResolvedKey(currentKey);
      setLoading(false);
    }
  }, [initialProgressHint, bookId, currentKey]);

  // Load persisted progress for this book/audio (if available)
  useEffect(() => {
    let cancelled = false;
    if (!bookId && !audioFileName) {
      setInitialPosition(null);
      setLoading(false);
      setResolvedKey(null);
      return;
    }
    if (!bookId) {
      setLoading(false);
      setResolvedKey(currentKey);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const progress = await fetchExistingProgress(fetchJSON, bookId);
        if (cancelled) return;

        if (progress) {
          const position = sanitizeSeconds(progress.position_seconds);
          setInitialPosition(position);
          setLastPersistedPosition(position);
          setLastSyncedAt(Date.now());
          audioLogger.info('Progresso recuperado do servidor', {
            bookId: progress.book_id ?? bookId,
            positionSeconds: position,
            durationSeconds: progress.duration_seconds ?? null,
            progressPercent: progress.progress_percent ?? null,
            updatedAt: progress.updated_at ?? null,
          });
        } else {
          setInitialPosition(null);
          audioLogger.info('Nenhum progresso salvo encontrado', {
            bookId,
          });
        }
      } catch (err: any) {
        if (cancelled) return;
        audioLogger.warn('Falha ao carregar progresso anterior', {
          error: err?.message ?? String(err),
        });
        setInitialPosition(null);
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setResolvedKey(currentKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, audioFileName, fetchJSON, currentKey]);

  const postUpdate = useCallback(
    async (payload: { position: number; duration?: number; force?: boolean; source?: string }) => {
      if (!audioFileName && !bookId) {
        audioLogger.warn('Ignorando batida de progresso: sem bookId e sem audioFileName', payload);
        return false;
      }

      const positionSeconds = sanitizeSeconds(payload.position);
      const durationSeconds =
        typeof payload.duration === 'number' && payload.duration > 0
          ? Math.max(sanitizeSeconds(payload.duration), positionSeconds)
          : undefined;
      const progressPercent =
        typeof durationSeconds === 'number' && durationSeconds > 0
          ? Math.min(100, (positionSeconds / durationSeconds) * 100)
          : undefined;

      const baseBody = {
        positionSeconds,
        durationSeconds,
        audioFileName: audioFileName ?? undefined,
        progressPercent,
        force: payload.force ?? false,
        source: payload.source ?? 'heartbeat',
      };

      if (
        progressPercent != null &&
        (progressPercent <= 5 || progressPercent >= 95)
      ) {
        audioLogger.debug('Batida ignorada por estar nas extremidades', {
          audioFileName,
          bookId,
          positionSeconds,
          durationSeconds,
          progressPercent,
          source: baseBody.source,
        });
        return false;
      }

      try {
        let res: Response | null = null;

        if (bookId) {
          res = await authedFetch(`${BASE_URL}/listening-progress/${bookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(baseBody),
          });
        } else if (audioFileName) {
          res = await authedFetch(`${BASE_URL}/listening-progress/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioFileName,
              currentPosition: positionSeconds,
              duration: durationSeconds,
              forceSave: payload.force ? true : undefined,
            }),
          });
        }

        if (!res) {
          audioLogger.warn('Falha ao construir requisição de progresso', {
            bookId,
            audioFileName,
          });
          return false;
        }

        if (!res.ok) {
          const msg = await safeReadError(res);
          audioLogger.warn('Falha ao atualizar progresso do áudio', {
            audioFileName,
            status: res.status,
            message: msg,
            payload: baseBody,
          });
          return false;
        }

        const data = await res.json().catch(() => null);
        if (data?.persisted) {
          setLastPersistedPosition(positionSeconds);
          setLastSyncedAt(Date.now());
          audioLogger.debug('Progresso persistido', {
            bookId: bookId ?? null,
            audioFileName,
            positionSeconds,
            durationSeconds: durationSeconds ?? null,
            progressPercent,
            source: baseBody.source,
          });
        }
        if (bookId) {
          setResolvedKey(bookId);
        } else if (audioFileName) {
          setResolvedKey(audioFileName);
        }
        sessionStartedRef.current = true;
        return Boolean(data?.persisted);
      } catch (error: any) {
        audioLogger.error('Erro ao enviar progresso do áudio', {
          audioFileName,
          error: error?.message ?? String(error),
        });
        return false;
      }
    },
    [audioFileName, authedFetch, bookId],
  );

  const reportPlayback = useCallback(
    (args: ReportPlaybackArgs) => {
      if (!audioFileName && !bookId) return;
      if (args.duration <= 0 || Number.isNaN(args.duration)) return;

      if (!engagedRef.current && !args.force) {
        audioLogger.debug('Heartbeat ignorado - aguardando interação do usuário');
        return;
      }

      const now = Date.now();
      const roundedPosition = sanitizeSeconds(args.position);
      const roundedDuration = sanitizeSeconds(args.duration);
      const positionDelta = Math.abs(roundedPosition - lastSentPositionRef.current);
      const timeDelta = now - lastSentAtRef.current;

      const shouldStart = !sessionStartedRef.current && roundedDuration > 0;
      const shouldSend =
        args.force ||
        shouldStart ||
        positionDelta >= 5 ||
        timeDelta >= 10000;

      if (!shouldSend) return;

      lastSentAtRef.current = now;
      lastSentPositionRef.current = roundedPosition;

      const sourceLabel = args.force
        ? 'forced-update'
        : shouldStart
        ? 'initial-heartbeat'
        : 'heartbeat';

      audioLogger.debug('Heartbeat de reprodução', {
        audioFileName,
        bookId,
        positionSeconds: roundedPosition,
        durationSeconds: roundedDuration,
        source: sourceLabel,
      });

      void postUpdate({
        position: roundedPosition,
        duration: roundedDuration,
        force: args.force || (!args.isPlaying && positionDelta > 1),
        source: sourceLabel,
      });
    },
    [postUpdate, audioFileName, bookId],
  );

  const endSession = useCallback(
    async (opts?: { force?: boolean; position?: number; duration?: number }) => {
      if (!audioFileName) return;
      if (sessionEndedRef.current) return;
      sessionEndedRef.current = true;

      const finalPosition = sanitizeSeconds(
        opts?.position ?? lastSentPositionRef.current ?? 0,
      );
      if (opts?.duration && !Number.isNaN(opts.duration)) {
        reportPlayback({
          position: finalPosition,
          duration: sanitizeSeconds(opts.duration),
          isPlaying: false,
          force: opts.force ?? true,
        });
      }

      try {
        const res = await authedFetch(`${BASE_URL}/listening-progress/end-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioFileName,
            bookId: bookId ?? undefined,
            positionSeconds: finalPosition,
            durationSeconds: opts?.duration ? sanitizeSeconds(opts.duration) : undefined,
          }),
        });
        if (!res.ok) {
          const msg = await safeReadError(res);
          audioLogger.warn('Falha ao finalizar sessão de áudio', {
            audioFileName,
            status: res.status,
            message: msg,
          });
        } else {
          audioLogger.debug('Sessão de áudio finalizada', {
            audioFileName,
            bookId,
          });
        }
      } catch (error: any) {
        audioLogger.error('Erro ao finalizar sessão de áudio', {
          audioFileName,
          error: error?.message ?? String(error),
        });
      }
    },
    [audioFileName, authedFetch, bookId, reportPlayback],
  );

  const ready =
    currentKey === null ? true : resolvedKey !== null && resolvedKey === currentKey && !loading;

  const markEngaged = useCallback(() => {
    if (!engagedRef.current) {
      engagedRef.current = true;
      audioLogger.debug('Playback marcado como engajado pelo usuário');
    }
  }, []);

  return {
    audioFileName,
    loading,
    ready,
    initialPosition,
    lastPersistedPosition,
    lastSyncedAt,
    reportPlayback,
    endSession,
    markEngaged,
  };
}

function deriveAudioFileName(audioPath?: string | null): string | null {
  if (!audioPath) return null;
  const trimmed = String(audioPath).trim();
  if (!trimmed) return null;

  const segments = trimmed.split(/[\\/]/);
  const last = segments.pop() ?? trimmed;
  if (!last) return null;

  return last.toLowerCase().endsWith('.mp3') ? last : `${last}.mp3`;
}

async function fetchExistingProgress(
  fetchJSON: FetchJSON,
  bookId?: string | null,
): Promise<ListeningProgressRow | null> {
  if (bookId) {
    const res = await fetchJSON<{
      progress: ListeningProgressRow | null;
    }>(`${BASE_URL}/listening-progress/book/${bookId}`);
    return res?.progress ?? null;
  }

  // Sem bookId não há como identificar de forma confiável
  return null;
}

function sanitizeSeconds(value?: number | null): number {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.round(value);
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    if (json && typeof json === 'object') {
      return json.message ?? json.error ?? JSON.stringify(json);
    }
  } catch {
    try {
      return await res.text();
    } catch {
      return '';
    }
  }
  return '';
}
