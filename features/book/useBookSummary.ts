import { useEffect, useState } from 'react';
import { SummaryResponse } from './types';

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

        const data = await fetchJSON<SummaryResponse>(url);
        if (cancelled) return;
        if (!data?.audio_url) {
          throw new Error('Resposta sem "audio_url".');
        }
        setSummary(data);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Falha ao carregar resumo');
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
