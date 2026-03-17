"use client";

import { useCart } from "@/components/cart/CartContext";
import { formatPrice } from "@/lib/currency";
import Image from "next/image";

interface Props {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
}

export function CartLineItem({ id, name, price, imageUrl, quantity }: Props) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <li className="flex gap-4 py-4">
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-neutral-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill className="object-cover" sizes="64px" />
        ) : (
          <div className="h-full w-full bg-neutral-200" aria-hidden />
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-sm font-medium">{formatPrice(price * quantity)}</p>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">{formatPrice(price)} / unité</p>

        <div className="mt-2 flex items-center gap-2">
          <button
            aria-label="Diminuer la quantité"
            onClick={() => updateQuantity(id, quantity - 1)}
            className="flex h-6 w-6 items-center justify-center rounded border text-sm leading-none hover:bg-neutral-100 disabled:opacity-40"
            disabled={quantity <= 1}
          >
            −
          </button>
          <span className="w-6 text-center text-sm">{quantity}</span>
          <button
            aria-label="Augmenter la quantité"
            onClick={() => updateQuantity(id, quantity + 1)}
            className="flex h-6 w-6 items-center justify-center rounded border text-sm leading-none hover:bg-neutral-100"
          >
            +
          </button>
          <button
            aria-label="Supprimer l'article"
            onClick={() => removeItem(id)}
            className="ml-auto text-xs text-neutral-400 hover:text-red-500 transition-colors"
          >
            Retirer
          </button>
        </div>
      </div>
    </li>
  );
}
