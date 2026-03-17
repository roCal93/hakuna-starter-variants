"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartContext";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { formatPrice } from "@/lib/currency";
import { useParams, useRouter } from "next/navigation";

export function CartDrawer() {
  const { items, subtotal, isOpen, closeCart } = useCart();
  const overlayRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? "fr";

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  const handleCheckout = async () => {
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, locale }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) {
      router.push(data.url);
    } else {
      console.error("Checkout session error:", data.error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        aria-hidden
        onClick={closeCart}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal
        aria-label="Panier"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            Panier{" "}
            {items.length > 0 && (
              <span className="ml-1 text-sm font-normal text-neutral-500">
                ({items.length} {items.length === 1 ? "article" : "articles"})
              </span>
            )}
          </h2>
          <button
            onClick={closeCart}
            aria-label="Fermer le panier"
            className="rounded p-1 hover:bg-neutral-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-neutral-500">
              Votre panier est vide.
            </p>
          ) : (
            <ul role="list" className="divide-y">
              {items.map((item) => (
                <CartLineItem
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  price={item.price}
                  imageUrl={item.imageUrl}
                  quantity={item.quantity}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-6 py-4 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Sous-total (hors livraison)</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full rounded-md bg-black py-3 text-sm font-medium text-white hover:bg-neutral-800 active:bg-neutral-900 transition-colors"
            >
              Passer commande
            </button>
            <button
              onClick={closeCart}
              className="w-full text-center text-sm text-neutral-500 hover:text-black transition-colors"
            >
              Continuer mes achats
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
