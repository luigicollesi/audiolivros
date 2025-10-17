import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Localization from 'expo-localization';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, translate, normalizeLanguage } from './translations';
import type { LanguageCode, LanguageContextValue } from './types';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function detectInitialLanguage(): LanguageCode {
  try {
    const locales = Localization.getLocales();
    if (Array.isArray(locales) && locales.length > 0) {
      const primary = locales[0];
      if (primary?.regionCode === 'BR') {
        return 'pt-BR';
      }
      const fromTag = normalizeLanguage(primary?.languageTag ?? primary?.languageCode ?? undefined);
      if (fromTag) return fromTag;
    }
  } catch {
    // ignore detection failures, fallback below
  }
  return DEFAULT_LANGUAGE;
}

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => detectInitialLanguage());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(normalizeLanguage(next));
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    isInitialized,
    availableLanguages: SUPPORTED_LANGUAGES,
  }), [language, setLanguage, isInitialized]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

export const useTranslation = useLanguage;
