import { NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

/**
 * Public route — returns blocked slots and reservation config for the frontend.
 * No auth required.
 */
export async function GET() {
  try {
    const [slotsRes, configRes] = await Promise.all([
      fetch(
        `${STRAPI_URL}/api/blocked-slots?sort=date:asc,time:asc&pagination[pageSize]=500`,
        {
          headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
          next: { revalidate: 60 }, // cache 1 minute
        }
      ),
      fetch(`${STRAPI_URL}/api/reservation-config?populate=openingDays`, {
        headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
        next: { revalidate: 60 },
      }),
    ])

    const slotsData = await slotsRes.json()
    const configData = configRes.status === 404
      ? { data: { maxCoversPerSlot: 20 } }
      : await configRes.json()

    return NextResponse.json({
      blockedSlots: slotsData.data || [],
      maxCoversPerSlot: configData?.data?.maxCoversPerSlot ?? 20,
      openingDays: configData?.data?.openingDays ?? [],
    })
  } catch {
    return NextResponse.json(
      { blockedSlots: [], maxCoversPerSlot: 20, openingDays: [] },
      { status: 200 }
    )
  }
}
