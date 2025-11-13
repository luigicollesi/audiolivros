import { BASE_URL } from '@/constants/API';
import { audioLogger } from '@/utils/logger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthedFetch } from './types';
// Session-based completion tracking (no persistent cache)
interface SessionCompletionData {
  sentAt: number;
  lastProgressAfter: number;
}

const sessionCompletionState = new Map<string, SessionCompletionData>();

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
  completed?: boolean;
};

type FinishState = 'idle' | 'pending' | 'completed';
type FinishReason = 'threshold-95' | 'explicit-complete';

const RECENT_COMPLETION_TTL_MS = 2 * 60 * 1000;
const HEARTBEAT_MIN_POSITION_SECONDS = 5;
const HEARTBEAT_EDGE_PERCENT = 5;
const FINISH_THRESHOLD_PERCENT = 95;

const recentlyClearedProgress = new Map<string, number>();

function rememberProgressCleared(bookId?: string | null) {
  if (!bookId) return;
  recentlyClearedProgress.set(bookId, Date.now());
}

function wasProgressRecentlyCleared(bookId?: string | null): boolean {
  if (!bookId) return false;
  const ts = recentlyClearedProgress.get(bookId);
  if (typeof ts !== 'number') return false;
  if (Date.now() - ts > RECENT_COMPLETION_TTL_MS) {
    recentlyClearedProgress.delete(bookId);
    return false;
  }
  return true;
}

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
  const [completionChecked, setCompletionChecked] = useState<boolean>(false);

  const audioFileName = useMemo(() => deriveAudioFileName(audioPath), [audioPath]);
  const currentKey = useMemo(() => bookId ?? audioFileName ?? null, [bookId, audioFileName]);

  const sessionStartedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const lastSentPositionRef = useRef(0);
  const engagedRef = useRef(false);
  const finishStateRef = useRef<FinishState>('idle');

  const clearLocalProgressCache = useCallback(
    (opts?: { bookId?: string | null }) => {
      setInitialPosition(null);
      setLastPersistedPosition(null);
      setLastSyncedAt(null);
      sessionStartedRef.current = false;
      lastSentAtRef.current = 0;
      lastSentPositionRef.current = 0;
      if (opts?.bookId) {
        rememberProgressCleared(opts.bookId);
      }
    },
    [],
  );

  // Reset session state quando muda o alvo
  useEffect(() => {
    sessionStartedRef.current = false;
    sessionEndedRef.current = false;
    engagedRef.current = false;
    lastSentAtRef.current = 0;
    lastSentPositionRef.current = 0;
    finishStateRef.current = 'idle';
    setLastPersistedPosition(null);
    setLastSyncedAt(null);
    setCompletionChecked(false);
    
    // Clear session completion state for this book (new session)
    if (bookId) {
      sessionCompletionState.delete(bookId);
      audioLogger.debug('Nova sessão iniciada - limpando estado de conclusão', { bookId });
    }
    
    if (currentKey) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    setResolvedKey(null);
  }, [currentKey, bookId]);

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
      setCompletionChecked(true); // ⭐ Permite verificação mesmo sem identificadores
      audioLogger.debug('Sem bookId nem audioFileName - habilitando completion', {
        currentKey,
      });
      return;
    }
    if (!bookId) {
      setLoading(false);
      setResolvedKey(currentKey);
      setCompletionChecked(true); // ⭐ Importante: permite conclusão mesmo sem bookId
      audioLogger.debug('Sem bookId - habilitando completion para audioFileName', {
        audioFileName,
        currentKey,
      });
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const progress = await fetchExistingProgress(fetchJSON, bookId);
        if (cancelled) return;

        const skipPersistedProgress = wasProgressRecentlyCleared(bookId);
        if (skipPersistedProgress) {
          setInitialPosition(null);
          setLastPersistedPosition(null);
          setLastSyncedAt(null);
          audioLogger.info('Ignorando progresso persistido devido a finalização recente', {
            bookId,
          });
        } else if (progress) {
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

        // No pre-check needed - completion is session-based
        setCompletionChecked(true);
      } catch (err: any) {
        if (cancelled) return;
        audioLogger.warn('Falha ao carregar progresso anterior', {
          error: err?.message ?? String(err),
        });
        setInitialPosition(null);
        setCompletionChecked(true); // ⭐ Habilita completion mesmo com erro
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setResolvedKey(currentKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, audioFileName, fetchJSON, currentKey]);

  const ensureFinished = useCallback(
    ({
      reason,
      positionSeconds,
      durationSeconds,
      progressPercent,
    }: {
      reason: FinishReason;
      positionSeconds: number;
      durationSeconds?: number;
      progressPercent?: number;
    }) => {
      audioLogger.info('🎯 ensureFinished chamado', {
        bookId,
        audioFileName,
        reason,
        progressPercent: progressPercent ?? null,
        positionSeconds,
        durationSeconds: durationSeconds ?? null,
      });

      if (!bookId) {
        audioLogger.warn('Finalização detectada, mas bookId ausente', {
          audioFileName,
          reason,
          progressPercent: progressPercent ?? null,
          positionSeconds,
          durationSeconds: durationSeconds ?? null,
        });
        return;
      }

      const state = finishStateRef.current;
      
      // Skip if already pending to avoid duplicate requests
      if (state === 'pending') {
        audioLogger.debug('Finalização em andamento - ignorando repetição', {
          bookId,
          reason,
          progressPercent: progressPercent ?? null,
          positionSeconds,
          durationSeconds: durationSeconds ?? null,
        });
        return;
      }

      // Check session completion state
      const sessionData = sessionCompletionState.get(bookId);
      const now = Date.now();
      
      // If we sent completion in this session and haven't had progress since then, skip
      if (sessionData && sessionData.sentAt > sessionData.lastProgressAfter) {
        audioLogger.debug('Livro já foi marcado como concluído nesta sessão sem progresso posterior', {
          bookId,
          sentAt: new Date(sessionData.sentAt).toISOString(),
          lastProgressAfter: new Date(sessionData.lastProgressAfter).toISOString(),
          reason,
        });
        return;
      }

      finishStateRef.current = 'pending';
      audioLogger.info('Iniciando finalização do livro', {
        bookId,
        reason,
        progressPercent: progressPercent ?? null,
        positionSeconds,
        durationSeconds: durationSeconds ?? null,
        sessionHadProgress: sessionData ? sessionData.lastProgressAfter > sessionData.sentAt : false,
      });
      
      void (async () => {
        try {
          const res = await authedFetch(`${BASE_URL}/finished-books/${bookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason,
              progressPercent,
              positionSeconds,
              durationSeconds,
            }),
          });
          
          if (!res.ok) {
            const msg = await safeReadError(res);
            audioLogger.warn('Falha ao marcar livro como concluído', {
              bookId,
              status: res.status,
              message: msg,
              reason,
              progressPercent: progressPercent ?? null,
              positionSeconds,
              durationSeconds: durationSeconds ?? null,
            });
            finishStateRef.current = 'idle';
            return;
          }

          const data = await res.json().catch(() => null);
          finishStateRef.current = 'completed';
          
          // Update session completion state
          sessionCompletionState.set(bookId, {
            sentAt: now,
            lastProgressAfter: sessionData?.lastProgressAfter ?? 0,
          });

          clearLocalProgressCache({ bookId });
          
          audioLogger.info('Livro marcado como concluído com sucesso', {
            bookId,
            reason,
            progressPercent: progressPercent ?? null,
            positionSeconds,
            durationSeconds: durationSeconds ?? null,
            completedAt: data?.completedAt,
            sessionSequence: sessionCompletionState.get(bookId),
          });
        } catch (error: any) {
          finishStateRef.current = 'idle';
          audioLogger.error('Erro ao enviar finalização do livro', {
            bookId,
            reason,
            error: error?.message ?? String(error),
          });
        }
      })();
    },
    [audioFileName, authedFetch, bookId, clearLocalProgressCache],
  );

  const postUpdate = useCallback(
    async (payload: {
      position: number;
      duration?: number;
      force?: boolean;
      source?: string;
      markFinished?: boolean;
    }) => {
      audioLogger.debug('postUpdate chamado', {
        bookId,
        audioFileName,
        payload,
        completionChecked,
      });

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

      const isNearStartBySeconds = positionSeconds <= HEARTBEAT_MIN_POSITION_SECONDS;
      const isNearStartByPercent =
        typeof progressPercent === 'number' && progressPercent <= HEARTBEAT_EDGE_PERCENT;

      const shouldMarkFinished =
        Boolean(payload.markFinished) ||
        (typeof progressPercent === 'number' && progressPercent >= FINISH_THRESHOLD_PERCENT);

      // Debug logging for threshold detection
      audioLogger.debug('Verificando threshold de conclusão', {
        bookId,
        audioFileName,
        progressPercent,
        shouldMarkFinished,
        markFinished: payload.markFinished,
        completionChecked,
        source: baseBody.source,
      });

      const canFinalize = shouldMarkFinished && (completionChecked || Boolean(payload.markFinished));

      const shouldSkipEdgeHeartbeat =
        !canFinalize && !payload.markFinished && (isNearStartBySeconds || isNearStartByPercent);

      if (shouldSkipEdgeHeartbeat) {
        audioLogger.debug('Batida ignorada no início do áudio', {
          audioFileName,
          bookId,
          positionSeconds,
          durationSeconds,
          progressPercent,
          source: baseBody.source,
        });
        return false;
      }

      if (canFinalize) {
        const reason: FinishReason = payload.markFinished ? 'explicit-complete' : 'threshold-95';
        audioLogger.info('Threshold atingido - disparando ensureFinished', {
          bookId,
          reason,
          progressPercent,
          positionSeconds,
          durationSeconds,
        });
        ensureFinished({
          reason,
          positionSeconds,
          durationSeconds,
          progressPercent,
        });
        return false;
      }

      const isNearEndByPercent =
        typeof progressPercent === 'number' &&
        progressPercent >= 100 - HEARTBEAT_EDGE_PERCENT;

      if (isNearEndByPercent && !canFinalize) {
        audioLogger.debug('Batida ignorada próximo ao fim - aguardando finalização', {
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
          
          // Update session completion state - this enables re-completion if threshold is hit again
          if (bookId) {
            const now = Date.now();
            const existing = sessionCompletionState.get(bookId);
            sessionCompletionState.set(bookId, {
              sentAt: existing?.sentAt ?? 0,
              lastProgressAfter: now,
            });
            recentlyClearedProgress.delete(bookId);
          }
          
          audioLogger.debug('Progresso persistido', {
            bookId: bookId ?? null,
            audioFileName,
            positionSeconds,
            durationSeconds: durationSeconds ?? null,
            progressPercent,
            source: baseBody.source,
            sessionUpdated: !!bookId,
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
    [audioFileName, authedFetch, bookId, ensureFinished],
  );

  const reportPlayback = useCallback(
    (args: ReportPlaybackArgs) => {
      audioLogger.debug('🎯 reportPlayback ENTRADA', {
        bookId,
        audioFileName,
        'args.duration': args.duration,
        'args.position': args.position,
        'args.force': args.force,
        'args.completed': args.completed,
        'engagedRef.current': engagedRef.current,
      });

      if (!audioFileName && !bookId) {
        audioLogger.warn('❌ reportPlayback BLOQUEADO - sem audioFileName nem bookId');
        return;
      }
      
      if (args.duration <= 0 || Number.isNaN(args.duration)) {
        audioLogger.warn('❌ reportPlayback BLOQUEADO - duration inválida', {
          duration: args.duration,
          isNaN: Number.isNaN(args.duration),
        });
        return;
      }

      if (!engagedRef.current && !args.force) {
        audioLogger.debug('❌ reportPlayback BLOQUEADO - aguardando interação do usuário', {
          engaged: engagedRef.current,
          force: args.force,
        });
        return;
      }

      // Debug log for reportPlayback calls
      const progressPercent = args.duration > 0 ? (args.position / args.duration) * 100 : 0;
      audioLogger.info('✅ reportPlayback EXECUTANDO', {
        bookId,
        audioFileName,
        position: args.position,
        duration: args.duration,
        progressPercent: progressPercent.toFixed(1),
        isPlaying: args.isPlaying,
        force: args.force,
        completed: args.completed,
        engaged: engagedRef.current,
      });

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
        markFinished: Boolean(args.completed),
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

  const clearBookCompletion = useCallback(() => {
    if (bookId) {
      sessionCompletionState.delete(bookId);
      finishStateRef.current = 'idle';
      setCompletionChecked(false);
      recentlyClearedProgress.delete(bookId);
      audioLogger.info('Cleared session completion status for book', { bookId });
    }
  }, [bookId]);

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
    clearBookCompletion, // For testing/debugging
    isBookCompleted: finishStateRef.current === 'completed',
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
