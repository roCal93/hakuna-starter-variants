import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import { redirect } from 'next/navigation'
import { ProfilPageClient } from './ProfilPageClient'

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  if (!strapiUser) {
    redirect(`/${locale}/espace-client/connexion`)
  }

  return <ProfilPageClient />
}
