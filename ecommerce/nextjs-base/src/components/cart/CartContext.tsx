"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem, CartState, CartAction } from "@/types/cart";
import { getCart, setCart, clearCart } from "@/lib/cart-storage";

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.payload };

    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        const updated = state.items.map((i) =>
          i.id === action.payload.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
        return { items: updated };
      }
      return { items: [...state.items, { ...action.payload, quantity: 1 }] };
    }

    case "REMOVE_ITEM":
      return {
        items: state.items.filter((i) => i.id !== action.payload.id),
      };

    case "UPDATE_QUANTITY": {
      if (action.payload.quantity <= 0) {
        return {
          items: state.items.filter((i) => i.id !== action.payload.id),
        };
      }
      return {
        items: state.items.map((i) =>
          i.id === action.payload.id
            ? { ...i, quantity: action.payload.quantity }
            : i
        ),
      };
    }

    case "CLEAR_CART":
      return { items: [] };

    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCartItems: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [isOpen, setIsOpen] = useReducer(
    (_: boolean, next: boolean) => next,
    false
  );

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = getCart();
    if (stored.length > 0) {
      dispatch({ type: "HYDRATE", payload: stored });
    }
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    setCart(state.items);
  }, [state.items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    dispatch({ type: "ADD_ITEM", payload: item });
  }, []);

  const removeItem = useCallback((id: number) => {
    dispatch({ type: "REMOVE_ITEM", payload: { id } });
  }, []);

  const updateQuantity = useCallback((id: number, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } });
  }, []);

  const clearCartItems = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
    clearCart();
  }, []);

  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        totalItems,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        clearCartItems,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
