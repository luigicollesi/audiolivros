import React, { useCallback } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { HomeShelf } from '@/components/home/HomeShelf';
import type { BookItem } from '@/components/book/BookGrid';
import type { RowRenderItem } from '@/types/home';

type Props = {
  rows: RowRenderItem[];
  listRef: React.RefObject<FlatList<RowRenderItem> | null>;
  header: React.ReactElement | null;
  accentColor: string;
  refreshing: boolean;
  onRefresh: () => void;
  onMomentumScrollEnd: (event: any) => void;
  onPressBook: (book: BookItem) => void;
  onRowLayout: (baseIndex: number, height: number) => void;
  contentPaddingBottom: number;
};

export function HomeShelvesList({
  rows,
  listRef,
  header,
  accentColor,
  refreshing,
  onRefresh,
  onMomentumScrollEnd,
  onPressBook,
  onRowLayout,
  contentPaddingBottom,
}: Props) {
  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<RowRenderItem>) => {
      const { shelf } = item;
      const state = shelf.state;
      return (
        <RNView
          style={styles.shelfWrapper}
          onLayout={(event) =>
            onRowLayout(item.baseIndex, event.nativeEvent.layout.height)
          }
        >
          <HomeShelf
            title={shelf.title}
            books={state.books}
            loading={state.loading}
            error={state.error}
            emptyLabel={shelf.emptyLabel}
            accentColor={accentColor}
            onRetry={state.refetch}
            onPressBook={onPressBook}
          />
        </RNView>
      );
    },
    [accentColor, onPressBook, onRowLayout],
  );

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={renderRow}
      stickyHeaderIndices={header ? [0] : undefined}
      ListHeaderComponent={header}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: contentPaddingBottom },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      onMomentumScrollEnd={onMomentumScrollEnd}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 0,
    gap: 12,
  },
  shelfWrapper: {
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
});
