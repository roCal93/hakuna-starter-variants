"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";

export default function CheckoutSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) ?? "fr";
  const sessionId = searchParams.get("session_id");
  const { clearCartItems } = useCart();
  const router = useRouter();

  useEffect(() => {
    clearCartItems();
    router.refresh();
  }, [clearCartItems, router]);

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold">
        {locale === "fr" ? "Commande confirmée !" : "Order confirmed!"}
      </h1>
      <p className="mt-3 text-neutral-600">
        {locale === "fr"
          ? "Merci pour votre achat. Vous recevrez un email de confirmation prochainement."
          : "Thank you for your purchase. You will receive a confirmation email shortly."}
      </p>

      <a
        href={`/${locale}/boutique`}
        className="mt-8 inline-block rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
      >
        {locale === "fr" ? "Retour à la boutique" : "Back to shop"}
      </a>
    </main>
  );
}
