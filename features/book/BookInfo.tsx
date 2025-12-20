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
        <View style={styles.titleWrapper}>
          {!!title && <Text style={styles.title}>{title}</Text>}
        </View>
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: 'transparent',
    },
    titleWrapper: { flex: 1, backgroundColor: 'transparent' },
    title: { fontSize: 20, fontWeight: '700', color: colors.tint, letterSpacing: 0.2, flexWrap: 'wrap' },
    meta: { fontSize: 14, opacity: 0.85, color: colors.text },
    favoriteBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bookCard,
    },
    favoriteBtnActive: {
      backgroundColor: colors.secondary,
      borderColor: colors.detail,
    },
    favoriteBtnDisabled: {
      opacity: 0.5,
    },
    favoriteText: { fontSize: 18, color: colors.tint },
    favoriteTextActive: { color: colors.background },
  });
