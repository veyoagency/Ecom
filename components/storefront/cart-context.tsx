"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  id: number;
  slug: string;
  title: string;
  priceCents: number;
  imageUrl?: string | null;
  variantLabel?: string;
  quantity: number;
};

export type CartDiscount = {
  code: string;
  discountType: "fixed" | "percent";
  amountCents: number | null;
  percentOff: number | null;
};

type AddCartItemInput = {
  id: number;
  slug: string;
  title: string;
  priceCents: number;
  imageUrl?: string | null;
  variantLabel?: string;
};

type CartContextValue = {
  items: CartItem[];
  totalCents: number;
  discount: CartDiscount | null;
  discountCents: number;
  estimatedTotalCents: number;
  cartOpen: boolean;
  addItem: (item: AddCartItemInput) => void;
  incrementItem: (id: number, variantLabel?: string) => void;
  decrementItem: (id: number, variantLabel?: string) => void;
  removeItem: (id: number, variantLabel?: string) => void;
  setCartOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  setDiscount: (discount: CartDiscount | null) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "storefront_cart_v1";

type StoredCartState = {
  items: CartItem[];
  discount?: CartDiscount | null;
};

function normalizeDiscount(value: unknown): CartDiscount | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const discountType =
    record.discountType === "percent" ? "percent" : "fixed";
  const amountCents =
    typeof record.amountCents === "number" ? record.amountCents : null;
  const percentOff =
    typeof record.percentOff === "number" ? record.percentOff : null;
  if (!code.trim()) return null;
  return {
    code: code.trim(),
    discountType,
    amountCents,
    percentOff,
  };
}

function calculateDiscountCents(
  subtotalCents: number,
  discount: CartDiscount | null,
) {
  if (!discount || subtotalCents <= 0) return 0;
  const baseCents = Math.max(0, Math.round(subtotalCents));
  let discountCents = 0;
  if (discount.discountType === "percent") {
    const percent = discount.percentOff ?? 0;
    discountCents = Math.round((baseCents * percent) / 100);
  } else {
    discountCents = discount.amountCents ?? 0;
  }
  return Math.min(Math.max(discountCents, 0), baseCents);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<CartDiscount | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredCartState | CartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed);
        } else if (parsed && Array.isArray(parsed.items)) {
          setItems(parsed.items);
          setDiscount(normalizeDiscount(parsed.discount));
        }
      }
    } catch {
      // Ignore localStorage errors.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: StoredCartState = {
        items,
        discount,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore localStorage errors.
    }
  }, [discount, hydrated, items]);

  const openCart = useCallback(() => {
    setCartOpen(true);
  }, [setCartOpen]);

  const closeCart = useCallback(() => {
    setCartOpen(false);
  }, [setCartOpen]);

  const addItem = useCallback((item: AddCartItemInput) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.id === item.id &&
          (entry.variantLabel ?? "") === (item.variantLabel ?? ""),
      );
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            ...item,
            quantity: 1,
          },
        ];
      }
      return prev.map((entry, index) =>
        index === existingIndex
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry,
      );
    });
  }, []);

  const incrementItem = useCallback((id: number, variantLabel?: string) => {
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === id &&
        (entry.variantLabel ?? "") === (variantLabel ?? "")
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry,
      ),
    );
  }, []);

  const decrementItem = useCallback((id: number, variantLabel?: string) => {
    setItems((prev) => {
      const next = prev
        .map((entry) => {
          if (
            entry.id === id &&
            (entry.variantLabel ?? "") === (variantLabel ?? "")
          ) {
            return { ...entry, quantity: entry.quantity - 1 };
          }
          return entry;
        })
        .filter((entry) => entry.quantity > 0);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: number, variantLabel?: string) => {
    setItems((prev) =>
      prev.filter(
        (entry) =>
          entry.id !== id ||
          (entry.variantLabel ?? "") !== (variantLabel ?? ""),
      ),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDiscount(null);
  }, []);

  const totalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    [items],
  );
  const discountCents = useMemo(
    () => calculateDiscountCents(totalCents, discount),
    [discount, totalCents],
  );
  const estimatedTotalCents = useMemo(
    () => Math.max(totalCents - discountCents, 0),
    [discountCents, totalCents],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalCents,
      discount,
      discountCents,
      estimatedTotalCents,
      cartOpen,
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      setCartOpen,
      openCart,
      closeCart,
      setDiscount,
      clear,
    }),
    [
      addItem,
      cartOpen,
      clear,
      closeCart,
      decrementItem,
      discount,
      discountCents,
      estimatedTotalCents,
      incrementItem,
      items,
      openCart,
      removeItem,
      setCartOpen,
      setDiscount,
      totalCents,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return context;
}
