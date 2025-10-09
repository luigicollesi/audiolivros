export type SummaryResponse = {
  audio_url: string;
  summary: string;
};

export type AuthedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
