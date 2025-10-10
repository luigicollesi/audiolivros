import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/shared/Themed';

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
      {!!author && <Text style={styles.meta}>Autor: {author}</Text>}
      {!!year && <Text style={styles.meta}>Ano: {year}</Text>}
      <Text style={styles.meta}>Língua: {language}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  favoriteBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  favoriteBtnDisabled: {
    opacity: 0.5,
  },
  favoriteText: {
    fontSize: 18,
    color: '#2563eb',
  },
  favoriteTextActive: {
    color: '#fff',
  },
});
