// components/GenreModal.tsx
import React, { memo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  FlatList,
  useColorScheme,
} from 'react-native';
import Colors from '@/constants/Colors';
import { Text, View } from '@/components/Themed';
import { GENRES } from '@/constants/Genres';

export type GenreOption = { id: number; name: string; slug: string };

type Props = {
  visible: boolean;
  selected?: GenreOption | null;
  onSelect: (g: GenreOption | null) => void; // null limpa filtro
  onClose: () => void;
  allowClear?: boolean;
  title?: string;
};

function GenreModalBase({
  visible,
  selected,
  onSelect,
  onClose,
  allowClear = true,
  title = 'Selecione um gênero',
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Overlay segue o background, mas com transparência */}
      <View style={[styles.overlay, { backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)' }]}>
        <View style={[
          styles.sheet,
          { backgroundColor: theme.background, borderColor: theme.bookCard }
        ]}>
          <Text style={[styles.title]}>{title}</Text>

          {/* Botão limpar filtro (opcional) */}
          {allowClear && (
            <Pressable
              onPress={() => { onSelect(null); onClose(); }}
              style={[styles.clearBtn, { backgroundColor: theme.bookCard }]}
            >
              <Text style={[styles.clearBtnText, { color: theme.text }]}>Limpar filtro</Text>
            </Pressable>
          )}

          <FlatList
            data={GENRES}
            keyExtractor={(g) => String(g.id)}
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              return (
                <Pressable
                  onPress={() => { onSelect(item); onClose(); }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? theme.tint : theme.bookCard,
                      borderColor: isSelected ? theme.tint : theme.bookCard,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? (scheme === 'dark' ? '#000' : '#fff') : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingVertical: 6 }}
            style={{ maxHeight: 360 }}
          />

          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.tint }]}>
            <Text style={[styles.closeBtnText, { color: scheme === 'dark' ? '#000' : '#fff' }]}>
              Fechar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const GenreModal = memo(GenreModalBase);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  sheet: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  clearBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 14,
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
