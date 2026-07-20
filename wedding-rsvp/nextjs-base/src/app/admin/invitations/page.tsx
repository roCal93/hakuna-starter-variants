import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CopyUrlInput from './CopyUrlInput'

// Force dynamic rendering – never statically pre-render this admin page.
export const dynamic = 'force-dynamic'

// Guard: ADMIN_SECRET must be explicitly defined — no hardcoded fallback allowed
if (!process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_SECRET must be set in production')
}

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '')

export type Guest = {
  id: number
  name1: string
  name2: string | null
  gender: 'male' | 'female' | null
  greeting: string | null
  token: string
  rsvpStatus: 'pending' | 'attending' | 'declining'
  askPartnerAttendance: boolean
  partnerAttending: boolean | null
  message: string | null
  respondedAt: string | null
  wedding?: { eventName: string } | null
}

type StrapiListResponse = {
  data: Guest[]
  meta: { pagination: { total: number } }
}

async function checkAdminCookie(): Promise<boolean> {
  const ADMIN_SECRET = process.env.ADMIN_SECRET
  if (!ADMIN_SECRET) return false
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get('admin_auth')?.value
  return adminAuth === ADMIN_SECRET
}

async function getAllGuests(): Promise<Guest[]> {
  try {
    const res = await fetch(
      `${STRAPI_URL}/api/guests?populate=wedding&pagination[limit]=1000`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) return []
    const json: StrapiListResponse = await res.json()
    return json.data ?? []
  } catch {
    return []
  }
}

export default async function AdminInvitationsPage() {
  const isAuthorized = await checkAdminCookie()

  if (!isAuthorized) {
    redirect('/admin/login')
  }

  const guests = await getAllGuests()

  // Count real people: 2 if partner is confirmed attending, or if name2 exists
  // and partner attendance is not asked separately (both come as a pair).
  function countPeople(guest: Guest): number {
    if (guest.askPartnerAttendance) {
      return guest.partnerAttending === true ? 2 : 1
    }
    return guest.name2 ? 2 : 1
  }

  const total = guests.reduce((sum, g) => sum + countPeople(g), 0)
  const attending = guests
    .filter((g) => g.rsvpStatus === 'attending')
    .reduce((sum, g) => sum + countPeople(g), 0)
  const declining = guests
    .filter((g) => g.rsvpStatus === 'declining')
    .reduce((sum, g) => sum + countPeople(g), 0)
  const pending = guests
    .filter((g) => g.rsvpStatus === 'pending')
    .reduce((sum, g) => sum + countPeople(g), 0)

  const statusLabel: Record<Guest['rsvpStatus'], string> = {
    pending: '⏳ En attente',
    attending: '✅ Présent',
    declining: '❌ Absent',
  }

  const statusColor: Record<Guest['rsvpStatus'], string> = {
    pending: 'bg-amber-50 text-amber-700',
    attending: 'bg-emerald-50 text-emerald-700',
    declining: 'bg-red-50 text-red-600',
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-serif font-light text-stone-900">
            Liste des invités
          </h1>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Déconnexion
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total invités', value: total, color: 'text-stone-900' },
            { label: 'Présents', value: attending, color: 'text-emerald-600' },
            { label: 'Absents', value: declining, color: 'text-red-500' },
            { label: 'En attente', value: pending, color: 'text-amber-500' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-stone-100 p-4 text-center"
            >
              <p className={`text-3xl font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-stone-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Guest table */}
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-stone-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Invité</th>
                <th className="text-left px-5 py-3 font-medium">Statut</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">
                  Répondu le
                </th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">
                  Partenaire
                </th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">
                  Message
                </th>
                <th className="text-left px-5 py-3 font-medium">
                  URL invitation
                </th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-stone-400">
                    Aucun invité trouvé. Ajoutez des invités dans Strapi.
                  </td>
                </tr>
              ) : (
                guests.map((guest, i) => {
                  const url = `${SITE_URL}/invitation/${guest.token}`
                  return (
                    <tr
                      key={guest.id}
                      className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${
                        i % 2 === 0 ? '' : 'bg-stone-50/40'
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-stone-800">
                        {guest.name2
                          ? `${guest.name1} & ${guest.name2}`
                          : guest.name1}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[guest.rsvpStatus]}`}
                        >
                          {statusLabel[guest.rsvpStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell text-stone-500">
                        {guest.respondedAt
                          ? new Date(guest.respondedAt).toLocaleDateString(
                              'fr-FR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )
                          : '—'}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-stone-500">
                        {guest.askPartnerAttendance && guest.name2 ? (
                          guest.partnerAttending === true ? (
                            '\u2705 Oui'
                          ) : guest.partnerAttending === false ? (
                            '\u274c Non'
                          ) : (
                            '—'
                          )
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell text-stone-500 max-w-xs">
                        {guest.message ? (
                          <span className="italic text-stone-600">
                            &ldquo;{guest.message}&rdquo;
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <CopyUrlInput url={url} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-stone-300 mt-6 text-center">
          Pour copier une URL : cliquez sur le champ puis Cmd+C. Collez-la dans
          votre générateur QR (qrcode-monkey.com, etc.)
        </p>
      </div>
    </main>
  )
}

export const metadata = {
  title: 'Admin — Invitations',
  robots: { index: false, follow: false },
}
