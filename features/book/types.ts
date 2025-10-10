export type SummaryResponse = {
  audio_url: string;
  summary: string;
  favorite?: boolean;
};

export type AuthedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
