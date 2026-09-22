"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { CartItem, Product } from "@/lib/types";

const STORAGE_KEY = "infinite-layers-cart";
const CART_EVENT = "infinite-layers-cart-change";
const EMPTY_CART: CartItem[] = [];

let cachedRaw: string | null | undefined;
let cachedItems: CartItem[] = EMPTY_CART;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalPaise: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function parseStoredItems(raw: string | null): CartItem[] {
  if (!raw) return EMPTY_CART;

  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return EMPTY_CART;

    return value.flatMap((item): CartItem[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;

      if (
        typeof record.productId !== "string" ||
        typeof record.slug !== "string" ||
        typeof record.name !== "string" ||
        !Number.isInteger(record.pricePaise) ||
        (record.pricePaise as number) < 1 ||
        !Number.isInteger(record.quantity) ||
        (record.quantity as number) < 1
      ) {
        return [];
      }

      return [
        {
          productId: record.productId,
          slug: record.slug,
          name: record.name,
          pricePaise: record.pricePaise as number,
          imageUrl:
            typeof record.imageUrl === "string" ? record.imageUrl : null,
          quantity: Math.min(record.quantity as number, 10),
        },
      ];
    });
  } catch {
    return EMPTY_CART;
  }
}

function getClientSnapshot(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    cachedItems = parseStoredItems(raw);
    return cachedItems;
  } catch {
    return cachedItems;
  }
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function subscribe(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    cachedRaw = undefined;
    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CART_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CART_EVENT, onStoreChange);
  };
}

function writeItems(items: CartItem[]) {
  const raw = JSON.stringify(items);
  cachedRaw = raw;
  cachedItems = items;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Keep the in-memory cart usable when storage is unavailable.
  }

  window.dispatchEvent(new Event(CART_EVENT));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const addItem = useCallback((product: Product, quantity = 1) => {
    const currentItems = getClientSnapshot();
    const existing = currentItems.find((item) => item.productId === product.id);

    if (existing) {
      writeItems(
        currentItems.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, 10) }
            : item,
        ),
      );
      return;
    }

    writeItems([
      ...currentItems,
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        pricePaise: product.pricePaise,
        imageUrl: product.imageUrl,
        quantity: Math.min(Math.max(quantity, 1), 10),
      },
    ]);
  }, []);

  const removeItem = useCallback((productId: string) => {
    writeItems(
      getClientSnapshot().filter((item) => item.productId !== productId),
    );
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const currentItems = getClientSnapshot();
    if (quantity < 1) {
      writeItems(currentItems.filter((item) => item.productId !== productId));
      return;
    }

    writeItems(
      currentItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(Math.round(quantity), 10) }
          : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => writeItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const subtotalPaise = items.reduce(
      (total, item) => total + item.pricePaise * item.quantity,
      0,
    );

    return {
      items,
      count,
      subtotalPaise,
      addItem,
      removeItem,
      setQuantity,
      clearCart,
    };
  }, [items, addItem, removeItem, setQuantity, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
