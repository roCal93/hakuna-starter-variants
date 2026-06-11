import { EspaceClientSidebar } from '@/components/espace-client/EspaceClientSidebar'
import { Layout } from '@/components/layout'
import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import type { Metadata } from 'next'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'fr' ? 'Espace client' : 'Customer area',
  }
}

export default async function EspaceClientLayout({ children, params }: Props) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  if (!strapiUser) {
    return <Layout locale={locale}>{children}</Layout>
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-neutral-950">
      <EspaceClientSidebar locale={locale} />

      <main className="flex-1 min-w-0 px-4 py-8 md:px-8 md:py-10">
        <div className="mb-6 font-[family-name:var(--font-geist-mono)] text-[15px] uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">
          <span className="flex flex-col md:flex-row md:gap-1">
            <span>Connecté :</span>
            <span className="text-neutral-600 dark:text-neutral-300 normal-case">
              {strapiUser.email}
            </span>
          </span>
        </div>
        {children}
      </main>
    </div>
  )
}
