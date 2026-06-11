import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import { redirect } from 'next/navigation'

export default async function EspaceClientRootPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  redirect(
    strapiUser
      ? `/${locale}/espace-client/tableau-de-bord`
      : `/${locale}/espace-client/connexion`
  )
}
