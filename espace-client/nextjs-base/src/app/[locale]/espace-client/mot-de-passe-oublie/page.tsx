import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import { redirect } from 'next/navigation'
import { MotDePasseOubliePageClient } from './MotDePasseOubliePageClient'

export default async function MotDePasseOubliePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  if (strapiUser) {
    redirect(`/${locale}/espace-client/tableau-de-bord`)
  }

  return <MotDePasseOubliePageClient locale={locale} />
}
