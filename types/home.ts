import type { RowHookState } from '@/hooks/homeHooks';
export type ShelfDescriptor = {
  id: string;
  title: string;
  state: RowHookState;
  emptyLabel?: string;
};

export type RowRenderItem = {
  key: string;
  shelf: ShelfDescriptor;
  baseIndex: number;
};

export type HomeHeaderStrings = {
  title: string;
  filterLabel: string;
  clearLabel: string;
  searchPlaceholder: string;
  searchSubmitLabel: string;
  keyboardDismissLabel: string;
};
