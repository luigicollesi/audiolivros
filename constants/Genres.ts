// constants/Genres.ts
export type Genre = { id: number; name: string; slug: string };

export const GENRE_ID_TO_SLUG: Record<number, string> = {
  1: 'Anthropology',
  2: 'Art',
  3: 'Autobiography',
  4: 'Biography',
  5: 'Economics',
  6: 'Environment',
  7: 'Fantasy',
  8: 'Fiction',
  9: 'History',
  10: 'Literature',
  11: 'Philosophy',
  12: 'Politics',
  13: 'Psychology',
  14: 'Religion',
  15: 'Science',
  16: 'Science fiction',
  17: 'Self-help',
  18: 'Sociology',
  19: 'Spirituality',
};

export const GENRES: Genre[] = Object.entries(GENRE_ID_TO_SLUG).map(([id, slug]) => ({
  id: Number(id),
  name: slug,
  slug,
}));

const GENRE_LABELS: Record<string, { pt: string; en: string }> = {
  anthropology: { pt: 'Antropologia', en: 'Anthropology' },
  art: { pt: 'Arte', en: 'Art' },
  autobiography: { pt: 'Autobiografia', en: 'Autobiography' },
  biography: { pt: 'Biografia', en: 'Biography' },
  economics: { pt: 'Economia', en: 'Economics' },
  environment: { pt: 'Meio ambiente', en: 'Environment' },
  fantasy: { pt: 'Fantasia', en: 'Fantasy' },
  fiction: { pt: 'Ficção', en: 'Fiction' },
  history: { pt: 'História', en: 'History' },
  literature: { pt: 'Literatura', en: 'Literature' },
  philosophy: { pt: 'Filosofia', en: 'Philosophy' },
  politics: { pt: 'Política', en: 'Politics' },
  psychology: { pt: 'Psicologia', en: 'Psychology' },
  religion: { pt: 'Religião', en: 'Religion' },
  science: { pt: 'Ciência', en: 'Science' },
  'science fiction': { pt: 'Ficção científica', en: 'Science fiction' },
  'self-help': { pt: 'Autoajuda', en: 'Self-help' },
  sociology: { pt: 'Sociologia', en: 'Sociology' },
  spirituality: { pt: 'Espiritualidade', en: 'Spirituality' },
};

const normalizeSlug = (value?: string | null) =>
  (value ?? '').trim().toLowerCase();

export function translateGenreLabel(
  input: { id?: number | null; slug?: string | null; name?: string | null },
  language: 'pt-BR' | 'en-US' = 'en-US',
): string {
  const candidateSlug =
    input.slug ??
    (input.id != null ? GENRE_ID_TO_SLUG[input.id] : undefined) ??
    input.name;
  const normalized = normalizeSlug(candidateSlug);
  if (normalized && GENRE_LABELS[normalized]) {
    return language === 'pt-BR'
      ? GENRE_LABELS[normalized].pt
      : GENRE_LABELS[normalized].en;
  }
  return input.name ?? candidateSlug ?? '';
}
