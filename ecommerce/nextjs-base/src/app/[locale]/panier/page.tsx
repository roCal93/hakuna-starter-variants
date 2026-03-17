"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { formatPrice } from "@/lib/currency";
import { useRouter } from "next/navigation";

export default function PanierPage() {
  const { items, subtotal } = useCart();
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();

  const handleCheckout = async () => {
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, locale }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) {
      router.push(data.url);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">
        {locale === "fr" ? "Mon panier" : "My cart"}
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500 mb-6">
            {locale === "fr" ? "Votre panier est vide." : "Your cart is empty."}
          </p>
          <Link
            href={`/${locale}/boutique`}
            className="inline-block rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            {locale === "fr" ? "Découvrir la boutique" : "Browse the shop"}
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <ul role="list" className="lg:col-span-2 divide-y">
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

          <div className="rounded-xl border p-6 self-start space-y-4">
            <h2 className="font-semibold">
              {locale === "fr" ? "Récapitulatif" : "Summary"}
            </h2>
            <div className="flex justify-between text-sm text-neutral-600">
              <span>{locale === "fr" ? "Sous-total" : "Subtotal"}</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-xs text-neutral-400">
              {locale === "fr"
                ? "Frais de livraison calculés à l'étape suivante."
                : "Shipping calculated at next step."}
            </p>
            <button
              onClick={handleCheckout}
              className="w-full rounded-md bg-black py-3 text-sm font-semibold text-white hover:bg-neutral-800 active:bg-neutral-900 transition-colors"
            >
              {locale === "fr" ? "Passer commande" : "Proceed to checkout"}
            </button>
            <Link
              href={`/${locale}/boutique`}
              className="block text-center text-sm text-neutral-500 hover:text-black transition-colors"
            >
              {locale === "fr" ? "Continuer mes achats" : "Continue shopping"}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
