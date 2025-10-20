import { useStore as useValue } from "@nanostores/react";
import { atom, computed } from "nanostores";
import { useNanoStore } from "~/hooks";

export type StockTransferSessionItem = {
  id: string; // Job material ID
  itemId: string; // Actual item ID
  itemReadableId: string;
  description: string;
  action: "order" | "transfer";
  quantity?: number;
  requiresSerialTracking: boolean;
  requiresBatchTracking: boolean;
  shelfId?: string;
};

export type StockTransferSessionState = {
  items: StockTransferSessionItem[];
};

const $sessionStore = atom<StockTransferSessionState>({
  items: [],
});

const $sessionItemsCount = computed(
  $sessionStore,
  (session) => session.items.length
);

const $orderItems = computed($sessionStore, (session) =>
  session.items.filter((item) => item.action === "order")
);

const $transferItems = computed($sessionStore, (session) =>
  session.items.filter((item) => item.action === "transfer")
);

export const useStockTransferSession = () =>
  useNanoStore<StockTransferSessionState>($sessionStore, "session");
export const useStockTransferSessionItemsCount = () =>
  useValue($sessionItemsCount);
export const useOrderItems = () => useValue($orderItems);
export const useTransferItems = () => useValue($transferItems);

// StockTransferSession actions
export const addToStockTransferSession = (item: StockTransferSessionItem) => {
  const currentStockTransferSession = $sessionStore.get();

  // Check if item already exists with same action
  const existingItemIndex = currentStockTransferSession.items.findIndex(
    (sessionItem) =>
      sessionItem.id === item.id && sessionItem.action === item.action
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    const updatedItems = [...currentStockTransferSession.items];
    updatedItems[existingItemIndex] = {
      ...updatedItems[existingItemIndex],
      ...item,
    };
    $sessionStore.set({ items: updatedItems });
  } else {
    // Add new item
    $sessionStore.set({ items: [...currentStockTransferSession.items, item] });
  }
};

export const removeFromStockTransferSession = (
  itemId: string,
  action: "order" | "transfer"
) => {
  const currentStockTransferSession = $sessionStore.get();
  const updatedItems = currentStockTransferSession.items.filter(
    (item) => !(item.id === itemId && item.action === action)
  );
  $sessionStore.set({ items: updatedItems });
};

export const clearStockTransferSession = () => {
  $sessionStore.set({ items: [] });
};

export const isInStockTransferSession = (
  itemId: string,
  action: "order" | "transfer"
) => {
  const currentStockTransferSession = $sessionStore.get();
  return currentStockTransferSession.items.some(
    (item) => item.id === itemId && item.action === action
  );
};

// Stock Transfer Wizard Store
export type StockTransferWizardLine = {
  itemId: string;
  itemReadableId: string;
  description: string;
  thumbnailPath: string;
  fromShelfId: string;
  fromShelfName: string;
  toShelfId: string;
  toShelfName: string;
  quantityAvailable: number;
  quantity?: number;
  requiresSerialTracking: boolean;
  requiresBatchTracking: boolean;
};

export type StockTransferWizardState = {
  selectedToItemShelfIds: Set<string>; // Set of "itemId:shelfId" composite keys selected in the "to" table
  lines: StockTransferWizardLine[];
};

const $wizardStore = atom<StockTransferWizardState>({
  selectedToItemShelfIds: new Set(),
  lines: [],
});

const $wizardLinesCount = computed(
  $wizardStore,
  (wizard) => wizard.lines.filter((line) => (line.quantity ?? 0) > 0).length
);

export const useStockTransferWizard = () =>
  useNanoStore<StockTransferWizardState>($wizardStore, "wizard");
export const useStockTransferWizardLinesCount = () =>
  useValue($wizardLinesCount);

// Stock Transfer Wizard actions
export const toggleToItemShelfSelection = (itemId: string, shelfId: string) => {
  const currentWizard = $wizardStore.get();
  const compositeKey = `${itemId}:${shelfId}`;
  const newSelectedToItemShelfIds = new Set(
    currentWizard.selectedToItemShelfIds
  );

  if (newSelectedToItemShelfIds.has(compositeKey)) {
    newSelectedToItemShelfIds.delete(compositeKey);
    // Remove all lines that have this itemId and toShelfId
    const updatedLines = currentWizard.lines.filter(
      (line) => !(line.itemId === itemId && line.toShelfId === shelfId)
    );
    $wizardStore.set({
      selectedToItemShelfIds: newSelectedToItemShelfIds,
      lines: updatedLines,
    });
  } else {
    newSelectedToItemShelfIds.add(compositeKey);
    $wizardStore.set({
      ...currentWizard,
      selectedToItemShelfIds: newSelectedToItemShelfIds,
    });
  }
};

export const isToItemShelfSelected = (itemId: string, shelfId: string) => {
  const currentWizard = $wizardStore.get();
  const compositeKey = `${itemId}:${shelfId}`;
  return currentWizard.selectedToItemShelfIds.has(compositeKey);
};

export const addTransferLine = (line: StockTransferWizardLine) => {
  const currentWizard = $wizardStore.get();

  // Check if a line with same itemId, fromShelfId and toShelfId already exists
  const existingLineIndex = currentWizard.lines.findIndex(
    (l) =>
      l.itemId === line.itemId &&
      l.fromShelfId === line.fromShelfId &&
      l.toShelfId === line.toShelfId
  );

  if (existingLineIndex >= 0) {
    // Update existing line
    const updatedLines = [...currentWizard.lines];
    updatedLines[existingLineIndex] = {
      ...updatedLines[existingLineIndex],
      ...line,
    };
    $wizardStore.set({ ...currentWizard, lines: updatedLines });
  } else {
    // Add new line
    $wizardStore.set({
      ...currentWizard,
      lines: [...currentWizard.lines, line],
    });
  }
};

export const removeTransferLine = (
  itemId: string,
  fromShelfId: string,
  toShelfId: string
) => {
  const currentWizard = $wizardStore.get();
  const updatedLines = currentWizard.lines.filter(
    (line) =>
      !(
        line.itemId === itemId &&
        line.fromShelfId === fromShelfId &&
        line.toShelfId === toShelfId
      )
  );
  $wizardStore.set({ ...currentWizard, lines: updatedLines });
};

export const hasTransferLine = (
  itemId: string,
  fromShelfId: string,
  toShelfId: string
) => {
  const currentWizard = $wizardStore.get();
  return currentWizard.lines.some(
    (line) =>
      line.itemId === itemId &&
      line.fromShelfId === fromShelfId &&
      line.toShelfId === toShelfId
  );
};

export const hasTransferLinesToItemShelf = (
  itemId: string,
  shelfId: string
) => {
  const currentWizard = $wizardStore.get();
  return currentWizard.lines.some(
    (line) =>
      line.itemId === itemId &&
      line.toShelfId === shelfId &&
      (line.quantity ?? 0) > 0
  );
};

export const updateTransferLineQuantity = (
  itemId: string,
  fromShelfId: string,
  toShelfId: string,
  quantity: number
) => {
  const currentWizard = $wizardStore.get();
  const lineIndex = currentWizard.lines.findIndex(
    (line) =>
      line.itemId === itemId &&
      line.fromShelfId === fromShelfId &&
      line.toShelfId === toShelfId
  );

  if (lineIndex >= 0) {
    const updatedLines = [...currentWizard.lines];
    updatedLines[lineIndex] = {
      ...updatedLines[lineIndex],
      quantity,
    };
    $wizardStore.set({ ...currentWizard, lines: updatedLines });
  }
};

export const clearStockTransferWizard = () => {
  $wizardStore.set({
    selectedToItemShelfIds: new Set(),
    lines: [],
  });
};

export const clearSelectedToItemShelves = () => {
  const currentWizard = $wizardStore.get();
  $wizardStore.set({
    ...currentWizard,
    selectedToItemShelfIds: new Set(),
  });
};
