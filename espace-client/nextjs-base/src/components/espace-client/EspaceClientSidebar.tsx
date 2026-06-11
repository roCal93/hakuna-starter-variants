'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { performLogout } from './logout'

const BASE_NAV_ITEMS = [
  { href: '/espace-client/tableau-de-bord', label: 'Tableau de bord' },
  { href: '/espace-client/commandes', label: 'Mes commandes' },
  { href: '/espace-client/favoris', label: 'Favoris' },
  { href: '/espace-client/profil', label: 'Mon profil' },
]

export function EspaceClientSidebar({ locale }: { locale: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const localePrefix = `/${locale}`

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-5 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-900 shadow-lg md:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Menu espace client"
      >
        {mobileOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-35 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 right-0 z-40 w-64 transform border-l border-neutral-200 bg-white transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:shrink-0 dark:border-neutral-700 dark:bg-neutral-900',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-full flex-col pt-16 md:pt-0">
          <div className="px-6 pb-4 pt-6 border-b border-neutral-200 dark:border-neutral-700">
            <p className="font-[family-name:var(--font-geist-mono)] text-[20px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
              Espace client
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {BASE_NAV_ITEMS.map((item) => {
                const fullHref = `${localePrefix}${item.href}`
                const isActive =
                  pathname === fullHref || pathname.startsWith(`${fullHref}/`)
                return (
                  <li key={item.href}>
                    <Link
                      href={fullHref}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        'group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-6 text-lg font-medium transition-colors',
                        isActive
                          ? 'text-neutral-900 font-semibold dark:text-white'
                          : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
                      ].join(' ')}
                    >
                      <span className="relative z-10">{item.label}</span>
                      <span
                        aria-hidden
                        className={[
                          'absolute inset-0 z-0 origin-left transform rounded-lg bg-neutral-200/60 transition-transform duration-200 ease-out dark:bg-neutral-700/60',
                          isActive
                            ? 'scale-x-100'
                            : 'scale-x-0 group-hover:scale-x-100',
                        ].join(' ')}
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="border-t border-neutral-200 p-4 space-y-1 dark:border-neutral-700">
            <Link
              href={`/${locale}`}
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-lg font-medium text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <span>Retour au site</span>
            </Link>
            <button
              onClick={() => performLogout({ locale })}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-lg font-medium text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
