import { useEffect, useState } from 'react';
import { SummaryResponse } from './types';
import { summariesLogger } from '@/utils/logger';

type FetchJSON = <T>(
  input: RequestInfo | URL,
  opts?: RequestInit & { expect?: 'json' | 'text' | 'void' }
) => Promise<T>;

export function useBookSummary(url: string | null | undefined, fetchJSON: FetchJSON) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSummary(null);

        summariesLogger.info('Solicitando resumo do livro', { url });
        const data = await fetchJSON<SummaryResponse>(url);
        if (cancelled) return;
        if (!data?.audio_url) {
          throw new Error('Resposta sem "audio_url".');
        }
        setSummary({
          audio_url: data.audio_url,
          summary: data.summary,
          favorite: Boolean(data.favorite),
          bookId: typeof data.bookId === 'string' ? data.bookId : undefined,
          listeningProgress: data.listeningProgress ?? null,
        });
        summariesLogger.info('Resumo carregado com sucesso', { url, favorite: Boolean(data.favorite) });
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.message ?? 'Falha ao carregar resumo';
        summariesLogger.error('Erro ao carregar resumo', { url, error: message });
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, fetchJSON]);

  return { summary, loading, error };
}
