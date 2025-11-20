import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Platform,
  RefreshControl,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { GridCards } from '@/components/book/BookGrid';
import type { BookItem } from '@/components/book/BookGrid';
import { Text, View } from '@/components/shared/Themed';

type Props = {
  header: React.ReactElement | null;
  errorMessage: string | null;
  pages: number[];
  listRef: React.RefObject<FlatList<number> | null>;
  refreshing: boolean;
  onRefresh: () => void;
  onMomentumScrollEnd: (event: any) => void;
  currentPageIndex: number;
  items: BookItem[];
  isLoading: boolean;
  screenWidth: number;
  indicatorColor: string;
  footerText: string;
  borderColor: string;
  textColor: string;
  footerPaddingBottom: number;
  emptyLabel: string;
  loadingLabel: string;
  onPressBook: (book: BookItem) => void;
};

export function HomeFilteredResults({
  header,
  errorMessage,
  pages,
  listRef,
  refreshing,
  onRefresh,
  onMomentumScrollEnd,
  currentPageIndex,
  items,
  isLoading,
  screenWidth,
  indicatorColor,
  footerText,
  borderColor,
  textColor,
  footerPaddingBottom,
  emptyLabel,
  loadingLabel,
  onPressBook,
}: Props) {
  const renderPage = useCallback(
    ({ item: pageIndex }: ListRenderItemInfo<number>) => {
      const isCurrentPage = pageIndex === currentPageIndex;
      const pageItems = isCurrentPage ? items : [];
      const isLoadingPage = isCurrentPage && isLoading;

      return (
        <RNView style={[styles.filteredPage, { width: screenWidth }]}>
          {isLoadingPage && (
            <RNView style={styles.filteredPageLoading}>
              <ActivityIndicator color={indicatorColor} />
              <Text>{loadingLabel}</Text>
            </RNView>
          )}
          {!isLoadingPage && pageItems.length === 0 && (
            <RNView style={styles.filteredPageLoading}>
              <Text>{emptyLabel}</Text>
            </RNView>
          )}
          {!isLoadingPage && pageItems.length > 0 && (
            <GridCards books={pageItems} onPressBook={onPressBook} />
          )}
        </RNView>
      );
    },
    [currentPageIndex, emptyLabel, indicatorColor, isLoading, items, loadingLabel, onPressBook, screenWidth],
  );

  return (
    <View style={styles.container}>
      {header}
      {errorMessage && (
        <View style={[styles.errorBox, { backgroundColor: 'rgba(255,0,0,0.12)' }]}>
          <Text style={[styles.errorText, { color: textColor }]}>{errorMessage}</Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={renderPage}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        directionalLockEnabled
        snapToInterval={screenWidth}
        disableIntervalMomentum
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
        nestedScrollEnabled
      />
      <View
        style={[
          styles.footer,
          { borderTopColor: borderColor, paddingBottom: footerPaddingBottom },
        ]}
      >
        <Text style={[styles.footerText, { color: textColor }]}>{footerText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: { fontSize: 13 },
  filteredPage: { flex: 1 },
  filteredPageLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { fontSize: 12, opacity: 0.7 },
});
