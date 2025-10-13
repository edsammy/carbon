import { useStore as useValue } from "@nanostores/react";
import { atom, computed } from "nanostores";
import { useNanoStore } from "~/hooks";

export type StockTransferSessionItem = {
  id: string;
  itemReadableId: string;
  description: string;
  action: "order" | "transfer";
  quantity?: number;
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
