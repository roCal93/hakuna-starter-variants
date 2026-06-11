import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import { redirect } from 'next/navigation'
import { ConnexionPageClient } from './ConnexionPageClient'

export default async function ConnexionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  if (strapiUser) {
    redirect(`/${locale}/espace-client/tableau-de-bord`)
  }

  return <ConnexionPageClient locale={locale} />
}
