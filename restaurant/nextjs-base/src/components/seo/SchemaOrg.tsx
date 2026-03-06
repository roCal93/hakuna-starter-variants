import React from 'react'

type SchemaOrgProps = {
  type?: 'Organization' | 'ProfessionalService' | 'LocalBusiness' | 'Restaurant'
  name?: string
  description?: string
  url?: string
  logo?: string
  telephone?: string
  email?: string
  address?:
    | string
    | {
        streetAddress?: string
        addressLocality?: string
        postalCode?: string
        addressCountry?: string
      }
  areaServed?: string
  priceRange?: string
  servesCuisine?: string | string[]
  menu?: string
  acceptsReservations?: boolean
  openingHours?: Array<{
    dayOfWeek: string | string[]
    opens: string
    closes: string
  }>
  geo?: {
    latitude: number
    longitude: number
  }
  sameAs?: string[]
}

export const SchemaOrg = ({
  type = 'Restaurant',
  name,
  description,
  url,
  logo,
  telephone,
  email,
  address,
  areaServed,
  priceRange,
  servesCuisine,
  menu,
  acceptsReservations,
  openingHours,
  geo,
  sameAs,
}: SchemaOrgProps) => {
  const siteName = name || process.env.NEXT_PUBLIC_SITE_NAME || 'Restaurant'
  const siteUrl =
    url || process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'

  // Build Organization/LocalBusiness schema
  const organizationSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    name: siteName,
    description:
      description ||
      'Restaurant experience with seasonal cuisine and warm service',
    url: siteUrl,
  }

  if (logo) organizationSchema.logo = logo
  if (telephone) organizationSchema.telephone = telephone
  if (email) organizationSchema.email = email
  if (address) organizationSchema.address = address
  if (areaServed) organizationSchema.areaServed = areaServed
  if (priceRange) organizationSchema.priceRange = priceRange
  if (servesCuisine) organizationSchema.servesCuisine = servesCuisine
  if (menu) organizationSchema.menu = menu
  if (typeof acceptsReservations === 'boolean') {
    organizationSchema.acceptsReservations = acceptsReservations
  }
  if (openingHours && openingHours.length > 0) {
    organizationSchema.openingHoursSpecification = openingHours.map((slot) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: slot.dayOfWeek,
      opens: slot.opens,
      closes: slot.closes,
    }))
  }
  if (geo) {
    organizationSchema.geo = {
      '@type': 'GeoCoordinates',
      latitude: geo.latitude,
      longitude: geo.longitude,
    }
  }
  if (sameAs && sameAs.length > 0) organizationSchema.sameAs = sameAs

  // Build WebSite schema
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    publisher: {
      '@type': type,
      name: siteName,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  )
}
