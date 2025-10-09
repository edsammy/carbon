import { useStore as useValue } from "@nanostores/react";
import { atom, computed } from "nanostores";
import { useNanoStore } from "~/hooks";

export type PickListSessionItem = {
  id: string;
  itemReadableId: string;
  description: string;
  action: "order" | "transfer";
  quantity?: number;
};

export type PickListSessionState = {
  items: PickListSessionItem[];
};

const $sessionStore = atom<PickListSessionState>({
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

export const usePickListSession = () =>
  useNanoStore<PickListSessionState>($sessionStore, "session");
export const usePickListSessionItemsCount = () => useValue($sessionItemsCount);
export const useOrderItems = () => useValue($orderItems);
export const useTransferItems = () => useValue($transferItems);

// PickListSession actions
export const addToPickListSession = (item: PickListSessionItem) => {
  const currentPickListSession = $sessionStore.get();

  // Check if item already exists with same action
  const existingItemIndex = currentPickListSession.items.findIndex(
    (sessionItem) =>
      sessionItem.id === item.id && sessionItem.action === item.action
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    const updatedItems = [...currentPickListSession.items];
    updatedItems[existingItemIndex] = {
      ...updatedItems[existingItemIndex],
      ...item,
    };
    $sessionStore.set({ items: updatedItems });
  } else {
    // Add new item
    $sessionStore.set({ items: [...currentPickListSession.items, item] });
  }
};

export const removeFromPickListSession = (
  itemId: string,
  action: "order" | "transfer"
) => {
  const currentPickListSession = $sessionStore.get();
  const updatedItems = currentPickListSession.items.filter(
    (item) => !(item.id === itemId && item.action === action)
  );
  $sessionStore.set({ items: updatedItems });
};

export const clearPickListSession = () => {
  $sessionStore.set({ items: [] });
};

export const isInPickListSession = (
  itemId: string,
  action: "order" | "transfer"
) => {
  const currentPickListSession = $sessionStore.get();
  return currentPickListSession.items.some(
    (item) => item.id === itemId && item.action === action
  );
};
