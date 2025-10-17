declare module 'expo-localization' {
  export type Locale = {
    languageTag?: string;
    languageCode?: string;
    regionCode?: string;
  };

  export function getLocales(): Locale[];
}
