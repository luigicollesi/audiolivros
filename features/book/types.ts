export type SummaryResponse = {
  audio_url: string | null;
  summary: string | null;
  favorite?: boolean;
  bookId?: string;
  listeningProgress?: {
    position_seconds?: number;
    duration_seconds?: number;
    progress_percent?: number;
    updated_at?: string;
  } | null;
  genres?: string[];
  locked?: boolean;
};

export type AuthedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
