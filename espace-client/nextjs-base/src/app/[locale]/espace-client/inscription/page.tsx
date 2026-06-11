import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import { redirect } from 'next/navigation'
import { InscriptionPageClient } from './InscriptionPageClient'

export default async function InscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  if (strapiUser) {
    redirect(`/${locale}/espace-client/tableau-de-bord`)
  }

  return <InscriptionPageClient locale={locale} />
}
