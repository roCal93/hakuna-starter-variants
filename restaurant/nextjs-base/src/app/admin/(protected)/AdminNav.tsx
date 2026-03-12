'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  async function handleLogout() {
    await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/admin/login')
    router.refresh()
  }

  const navLinks = [
    { href: '/admin', label: 'Accueil' },
    { href: '/admin/reservations', label: 'Réservations' },
    { href: '/admin/horaires', label: 'Horaires' },
    { href: '/admin/menu', label: 'Menus' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/10 backdrop-blur-md shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
        <nav className="flex items-center gap-1">
          <span className="font-semibold text-white mr-4 text-sm tracking-wide uppercase">
            Restaurant Admin
          </span>
          {navLinks.map((link, index) => {
            const active = pathname === link.href
            const hovered = hoveredIndex === index
            return (
              <Link
                key={link.href}
                href={link.href}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <span className="z-10">{link.label}</span>
                <motion.span
                  aria-hidden
                  className="absolute left-3 right-3 bottom-1 h-[1px] w-[calc(100%-1.5rem)] bg-white origin-left"
                  initial={shouldReduceMotion ? {} : { scaleX: active ? 1 : 0 }}
                  animate={
                    shouldReduceMotion
                      ? {}
                      : { scaleX: active || hovered ? 1 : 0 }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                    duration: 0.18,
                  }}
                />
              </Link>
            )
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          Déconnexion
        </button>
      </div>
    </header>
  )
}
