"use client";

import { useCart } from "@/components/cart/CartContext";

interface Props {
  className?: string;
}

export function CartButton({ className = "" }: Props) {
  const { totalItems, openCart } = useCart();

  return (
    <button
      onClick={openCart}
      aria-label={`Panier — ${totalItems} article${totalItems !== 1 ? "s" : ""}`}
      className={`relative flex items-center gap-1 p-2 hover:opacity-75 transition-opacity ${className}`}
    >
      {/* Cart icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>

      {totalItems > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </button>
  );
}
