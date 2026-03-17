"use client";

import { useCart } from "@/components/cart/CartContext";
import { formatPrice } from "@/lib/currency";

interface Props {
  product: {
    id: number;
    documentId: string;
    name: string;
    slug: string;
    price: number;
    imageUrl: string | null;
    stock: number;
  };
}

export function AddToCartButton({ product }: Props) {
  const { addItem, openCart } = useCart();

  const handleAdd = () => {
    addItem({
      id: product.id,
      documentId: product.documentId,
      name: product.name,
      slug: product.slug,
      price: product.price,
      imageUrl: product.imageUrl,
    });
    openCart();
  };

  if (product.stock === 0) {
    return (
      <p className="text-sm text-neutral-500 font-medium">
        Vendu
      </p>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className="w-full rounded-md bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 active:bg-neutral-900 transition-colors"
    >
      Ajouter au panier — {formatPrice(product.price)}
    </button>
  );
}
