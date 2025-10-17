import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatLanguageLabel, normalizeLanguage } from '@/i18n/translations';

type Props = {
  title?: string | null;
  author?: string | null;
  year?: string | null;
  language: string;
  backgroundColor: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  disabling?: boolean;
};

export function BookInfo({
  title,
  author,
  year,
  language,
  backgroundColor,
  favorite = false,
  onToggleFavorite,
  disabling,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette, scheme === 'dark'), [palette, scheme]);
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <View style={styles.headerRow}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        {onToggleFavorite && (
          <Pressable
            onPress={onToggleFavorite}
            disabled={disabling}
            style={[styles.favoriteBtn, favorite ? styles.favoriteBtnActive : null, disabling && styles.favoriteBtnDisabled]}
            hitSlop={6}
          >
            <Text style={[styles.favoriteText, favorite ? styles.favoriteTextActive : null]}>
              {favorite ? '★' : '☆'}
            </Text>
          </Pressable>
        )}
      </View>
      {!!author && <Text style={styles.meta}>{t('book.author')}: {author}</Text>}
      {!!year && <Text style={styles.meta}>{t('book.year')}: {year}</Text>}
      <Text style={styles.meta}>{t('book.language')}: {formatLanguageLabel(normalizeLanguage(language))}</Text>
    </View>
  );
}

const createStyles = (colors: typeof Colors.light, isDark: boolean) =>
  StyleSheet.create({
    container: {
      padding: 14,
      borderRadius: 12,
      gap: 6,
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '700' },
    meta: { fontSize: 14, opacity: 0.8 },
    favoriteBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.tabIconDefault,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.bookCard : colors.background,
    },
    favoriteBtnActive: {
      backgroundColor: colors.tint,
      borderColor: colors.tint,
    },
    favoriteBtnDisabled: {
      opacity: 0.5,
    },
    favoriteText: {
      fontSize: 18,
      color: colors.tint,
    },
    favoriteTextActive: {
      color: isDark ? '#000' : '#fff',
    },
  });
