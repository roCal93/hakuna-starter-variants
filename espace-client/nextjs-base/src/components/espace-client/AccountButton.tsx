'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { performLogout } from './logout'

const menuItems = [
  { href: '/espace-client/commandes', label: 'Mes commandes' },
  { href: '/espace-client/favoris', label: 'Favoris' },
  { href: '/espace-client/profil', label: 'Mon profil' },
]

type AccountButtonState = {
  locale: 'fr' | 'en'
  href: string
  isCurrentHref: boolean
}

export function resolveAccountButtonState(
  pathname: string,
  isAuthenticated: boolean
): AccountButtonState {
  const locale = pathname.split('/')[1] === 'en' ? 'en' : 'fr'
  const href = isAuthenticated
    ? `/${locale}/espace-client/tableau-de-bord`
    : `/${locale}/espace-client/connexion`

  return {
    locale,
    href,
    isCurrentHref: pathname === href,
  }
}

export function AccountButton() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { locale, href, isCurrentHref } = resolveAccountButtonState(
    pathname,
    !!session
  )
  const iconButtonClass =
    'flex h-9 w-9 items-center justify-center rounded-full border border-gray-400 dark:border-gray-500 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors'

  const firstName = session?.user?.name?.split(' ')[0] ?? null

  if (!session) {
    if (isCurrentHref) {
      return (
        <span
          aria-label="Se connecter"
          aria-current="page"
          className={iconButtonClass}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 shrink-0"
            aria-hidden
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </span>
      )
    }

    return (
      <Link href={href} aria-label="Se connecter" className={iconButtonClass}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 shrink-0"
          aria-hidden
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </Link>
    )
  }

  return (
    <div className="relative group">
      {/* Trigger */}
      <Link
        href={href}
        aria-label="Mon espace client"
        className="flex h-9 items-center gap-1.5 px-2 rounded-full border border-gray-400 dark:border-gray-500 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 shrink-0"
          aria-hidden
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
        {firstName && (
          <span className="text-sm font-medium">Bonjour, {firstName}</span>
        )}
      </Link>

      {/* Dropdown — visible on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 hidden group-hover:block z-50">
        <div className="w-52 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg overflow-hidden">
          <ul className="py-1">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={`/${locale}${item.href}`}
                  className="block px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-stone-100 dark:border-stone-700 py-1">
            <button
              onClick={() => performLogout({ locale })}
              className="w-full text-left px-4 py-2.5 text-sm text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
