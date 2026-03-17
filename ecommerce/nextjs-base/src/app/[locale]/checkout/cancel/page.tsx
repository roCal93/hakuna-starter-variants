import Link from "next/link";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CheckoutCancelPage({ params }: Props) {
  const { locale } = await params;

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#737373"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold">
        {locale === "fr" ? "Paiement annulé" : "Payment cancelled"}
      </h1>
      <p className="mt-3 text-neutral-600">
        {locale === "fr"
          ? "Votre panier a été conservé. Vous pouvez reprendre votre commande à tout moment."
          : "Your cart has been saved. You can resume your order at any time."}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/${locale}/panier`}
          className="rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
        >
          {locale === "fr" ? "Retour au panier" : "Back to cart"}
        </Link>
        <Link
          href={`/${locale}/boutique`}
          className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-neutral-50 transition-colors"
        >
          {locale === "fr" ? "Continuer mes achats" : "Continue shopping"}
        </Link>
      </div>
    </main>
  );
}
