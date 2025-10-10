import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/shared/Themed';

type Props = {
  title?: string | null;
  author?: string | null;
  year?: string | null;
  language: string;
  backgroundColor: string;
};

export function BookInfo({ title, author, year, language, backgroundColor }: Props) {
  return (
    <View style={[styles.container, { backgroundColor }]}> 
      {!!title && <Text style={styles.title}>{title}</Text>}
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
  title: { fontSize: 20, fontWeight: '700' },
  meta: { fontSize: 14, opacity: 0.8 },
});
