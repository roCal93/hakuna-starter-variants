import Link from 'next/link'
import { notFound } from 'next/navigation'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

type GuestData = {
  id: number
  wedding: {
    eventName: string
    date: string
  } | null
}

async function getGuest(token: string): Promise<GuestData | null> {
  try {
    const res = await fetch(`${STRAPI_URL}/api/guests/by-token/${token}`, {
      headers: {
        ...(STRAPI_API_TOKEN
          ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
          : {}),
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export default async function LodgingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const guest = await getGuest(token)

  if (!guest) notFound()

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start px-4 py-12 overflow-hidden">
      <div
        className="hidden md:block fixed inset-0 bg-stone-50 -z-20"
        aria-hidden="true"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-bg-mobile.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="pointer-events-none select-none fixed inset-0 w-full h-full object-cover -z-10 md:hidden"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/wedding-bg.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="pointer-events-none select-none fixed inset-0 w-full h-full object-cover -z-10 hidden md:block"
      />

      <div className="relative w-full max-w-lg overflow-hidden md:bg-white md:rounded-2xl md:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.35)] md:border md:border-stone-100 md:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/card-bg.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover z-0 hidden md:block"
        />

        <div className="relative z-10">
          <div className="mb-6 mx-12  text-center">
            <h2 className="text-3xl font-serif text-stone-900 mb-4">
              Info logement
            </h2>
            <p className="text-stone-700 text-lg mt-1 leading-relaxed italic">
              Les logements à Talloires sont pour le moins limités et souvent
              onéreux (désolés...). On peut toutefois vous recommander les
              solutions suivantes :
            </p>
            <ul className="text-stone-500 leading-relaxed italic mt-4 space-y-3 ">
              <li>
                -{' '}
                <a
                  href="https://www.hotel-du-lac.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-stone-400 font-semibold underline-offset-4 hover:text-stone-700 transition-colors"
                >
                  L&apos;hôtel du Lac, à Talloires
                </a>
                <span className="font-semibold"> :</span> Situé à 100 m du lieu
                de réception, c&apos;est la solution tout confort. À noter
                qu&apos;il est obligatoire de réserver deux nuits minimum.
              </li>
              <li>
                -{' '}
                <a
                  href="/BROCHURE-HORIZON.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-stone-400 font-semibold underline-offset-4 hover:text-stone-700 transition-colors"
                >
                  Le camping Horizon
                </a>
                <span className="font-semibold"> :</span> Il se trouve à un bon
                kilomètre du lieu de réception, sur les hauteurs de Talloires,
                et propose des bungalows. Ici aussi, il faut réserver au minimum
                deux nuits.
              </li>
              <li>
                -{' '}
                <a
                  href="https://www.abritel.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-stone-400 font-semibold underline-offset-4 hover:text-stone-700 transition-colors"
                >
                  Les logements Abritel
                </a>
                <span className="font-semibold"> :</span> Il existe plusieurs
                gites et appartements à louer à Talloires et environs. La
                réservation pour une seule nuit est rarement possible à cette
                saison.
              </li>
            </ul>
            <p className="text-stone-700 leading-relaxed italic mt-6">
              Si vous avez besoin d&apos;aide, n&apos;hésitez pas à nous écrire
              ! On est plein de bons conseils{' '}
              <span className="not-italic">;)</span>
            </p>
          </div>

          <Link
            href={`/invitation/${token}`}
            className="block w-full bg-[#F9E1D1]/70 text-stone-600 py-2 rounded-xl text-lg font-medium hover:bg-[#F9E1D1]/80 transition-colors text-center"
          >
            Retour à l&apos;invitation
          </Link>
        </div>
      </div>
    </main>
  )
}

export const metadata = {
  title: 'Info logement',
  robots: { index: false, follow: false },
}
