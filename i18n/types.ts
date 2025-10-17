export type LanguageCode = 'pt-BR' | 'en-US';

export type TranslationDictionary = Record<string, string>;

export interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isInitialized: boolean;
  availableLanguages: LanguageCode[];
}
