import type { CartItem } from "@/types/cart";

const CART_STORAGE_KEY = "hakuna_cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function setCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_STORAGE_KEY);
}
