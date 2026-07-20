import { notFound } from 'next/navigation'
import InvitationClient from './InvitationClient'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

export type GuestData = {
  id: number
  name1: string
  name2: string | null
  gender: 'male' | 'female' | null
  greeting: string | null
  coverMessage: string | null
  status: 'pending' | 'attending' | 'declining'
  askPartnerAttendance: boolean
  partnerAttending: boolean | null
  confirmAttendingSoloTitle: string | null
  confirmAttendingSoloBody: string | null
  confirmAttendingWithPartnerTitle: string | null
  confirmAttendingWithPartnerBody: string | null
  confirmDecliningTitle: string | null
  confirmDecliningBody: string | null
  message: string | null
  respondedAt: string | null
  wedding: {
    eventName: string
    date: string
    coverMessage: string | null
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
      // No cache — always fresh (guest status can change)
      cache: 'no-store',
    })

    if (!res.ok) return null

    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const guest = await getGuest(token)

  if (!guest) notFound()

  return (
    <>
      {/* Preload background images for faster LCP */}
      <link
        rel="preload"
        as="image"
        type="image/webp"
        href="/images/card-bg-mobile.webp"
        media="(max-width: 767px)"
      />
      <link
        rel="preload"
        as="image"
        type="image/webp"
        href="/images/wedding-bg.webp"
        media="(min-width: 768px)"
      />
      <InvitationClient guest={guest} token={token} />
    </>
  )
}

export const metadata = {
  title: 'Votre invitation',
  robots: { index: false, follow: false },
}
