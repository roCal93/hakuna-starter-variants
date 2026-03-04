'use client'

import { useEffect, useState, useCallback } from 'react'
import BlockedSlotsModal from './BlockedSlotsModal.tsx'
import MaxCoversModal from './MaxCoversModal.tsx'
import { Button } from '@/components/ui/Button'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Reservation {
  id: number
  documentId: string
  firstName: string
  lastName: string
  phone: string
  email: string
  date: string
  time: string
  covers: number
  message?: string
  status: 'pending' | 'confirmed' | 'cancelled'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function decodeHtml(html: string): string {
  const txt = document.createElement('textarea')
  txt.innerHTML = html
  return txt.value
}

function formatDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Row composant ────────────────────────────────────────────────────────────
function ReservationRow({
  r,
  onStatusChange,
  onDelete,
  loading,
}: {
  r: Reservation
  onStatusChange?: (status: 'confirmed' | 'cancelled') => void
  onDelete: () => void
  loading: boolean
}) {
  const [showMessage, setShowMessage] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const copyCell = (value: string, key: string) =>
    'px-4 py-3 text-sm cursor-copy select-none transition-colors ' +
    (copied === key ? 'bg-green-100 text-green-700 font-medium' : '')

  return (
    <>
      <tr className="border-b border-[#B6DFB9] bg-[#EBFFEE] hover:bg-[#D4F0D6] transition-colors">
        <td
          className={
            copyCell(`${r.firstName} ${r.lastName}`, 'name') +
            ' font-medium text-neutral-900 whitespace-nowrap'
          }
          title="Cliquer pour copier"
          onClick={() => copy(`${r.firstName} ${r.lastName}`, 'name')}
        >
          {copied === 'name' ? '✓ Copié' : `${r.firstName} ${r.lastName}`}
        </td>
        <td
          className={
            copyCell(r.date, 'date') + ' text-neutral-800 whitespace-nowrap'
          }
          title="Cliquer pour copier"
          onClick={() => copy(r.date, 'date')}
        >
          {copied === 'date' ? '✓ Copié' : formatDate(r.date)}
        </td>
        <td
          className={copyCell(r.time, 'time') + ' text-neutral-800'}
          title="Cliquer pour copier"
          onClick={() => copy(r.time, 'time')}
        >
          {copied === 'time' ? '✓ Copié' : r.time}
        </td>
        <td
          className={
            copyCell(String(r.covers), 'covers') +
            ' text-neutral-800 text-center'
          }
          title="Cliquer pour copier"
          onClick={() => copy(String(r.covers), 'covers')}
        >
          {copied === 'covers' ? '✓' : r.covers}
        </td>
        <td
          className={copyCell(r.phone, 'phone') + ' text-neutral-700'}
          title="Cliquer pour copier"
          onClick={() => copy(r.phone, 'phone')}
        >
          {copied === 'phone' ? '✓ Copié' : r.phone}
        </td>
        <td
          className={
            copyCell(r.email, 'email') +
            ' text-neutral-700 max-w-[200px] truncate'
          }
          title={copied === 'email' ? '✓ Copié' : r.email}
          onClick={() => copy(r.email, 'email')}
        >
          {copied === 'email' ? '✓ Copié' : r.email}
        </td>
        <td
          className="px-4 py-3 text-sm text-neutral-600 max-w-[160px] truncate cursor-pointer hover:text-neutral-900 hover:underline"
          title={r.message ? 'Cliquer pour lire' : undefined}
          onClick={() => r.message && setShowMessage(true)}
        >
          {r.message ? decodeHtml(r.message) : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            {onStatusChange && r.status === 'pending' && (
              <>
                <button
                  disabled={loading}
                  onClick={() => onStatusChange('confirmed')}
                  title="Confirmer"
                  className="h-8 w-8 flex cursor-pointer items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 transition text-sm font-bold"
                >
                  ✓
                </button>
                <button
                  disabled={loading}
                  onClick={() => onStatusChange('cancelled')}
                  title="Refuser"
                  className="h-8 w-8 flex cursor-pointer items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-40 transition text-sm"
                >
                  ✕
                </button>
              </>
            )}
            {r.status === 'confirmed' && (
              <button
                disabled={loading}
                onClick={() => onStatusChange?.('cancelled')}
                title="Annuler"
                className="text-xs px-2 py-1 cursor-pointer rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition"
              >
                Annuler
              </button>
            )}
            <button
              disabled={loading}
              onClick={onDelete}
              title="Supprimer"
              className="h-8 w-8 flex items-center justify-center cursor-pointer rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40 transition text-sm"
            >
              🗑
            </button>
          </div>
        </td>
      </tr>
      {showMessage && (
        <tr>
          <td
            colSpan={8}
            className="px-4 py-3 bg-[#D4F0D6] border-b border-[#B6DFB9] text-sm text-neutral-700 whitespace-pre-wrap"
          >
            <div className="flex items-start justify-between gap-4">
              <p>{r.message ? decodeHtml(r.message) : ''}</p>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() =>
                    copy(r.message ? decodeHtml(r.message) : '', 'message')
                  }
                  className="text-xs px-2 py-1 cursor-pointer rounded bg-white/60 text-neutral-500 hover:text-green-700 hover:bg-white transition"
                  title="Copier le message"
                >
                  {copied === 'message' ? '✓ Copié' : 'Copier'}
                </button>
                <button
                  onClick={() => setShowMessage(false)}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Table header ─────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <thead>
      <tr className="bg-[#EBFFEE]/40 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">
        <th className="px-4 py-3">Nom</th>
        <th className="px-4 py-3">Date</th>
        <th className="px-4 py-3">Heure</th>
        <th className="px-4 py-3 text-center">Cvts</th>
        <th className="px-4 py-3">Tél.</th>
        <th className="px-4 py-3">Email</th>
        <th className="px-4 py-3">Message</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReservationsPage() {
  const [pending, setPending] = useState<Reservation[]>([])
  const [confirmed, setConfirmed] = useState<Reservation[]>([])
  const [cancelled, setCancelled] = useState<Reservation[]>([])
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [fetchError, setFetchError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [showMaxCoversModal, setShowMaxCoversModal] = useState(false)

  const fetchReservations = useCallback(async () => {
    setFetchError('')
    try {
      const [pendingRes, confirmedRes, cancelledRes] = await Promise.all([
        fetch('/api/admin/reservations?status=pending'),
        fetch('/api/admin/reservations?status=confirmed'),
        fetch('/api/admin/reservations?status=cancelled'),
      ])
      const p = await pendingRes.json()
      const c = await confirmedRes.json()
      const x = await cancelledRes.json()
      setPending(p.data || [])
      setConfirmed(c.data || [])
      setCancelled(x.data || [])
    } catch {
      setFetchError('Impossible de charger les réservations.')
    }
  }, [])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  async function handleStatusChange(
    r: Reservation,
    status: 'confirmed' | 'cancelled'
  ) {
    setActionError('')
    setLoadingIds((s) => new Set(s).add(r.documentId))
    try {
      const res = await fetch(`/api/admin/reservations/${r.documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setActionError(d.error || 'Erreur lors de la mise à jour du statut.')
        return
      }
      await fetchReservations()
    } catch {
      setActionError('Erreur réseau lors de la mise à jour.')
    } finally {
      setLoadingIds((s) => {
        const next = new Set(s)
        next.delete(r.documentId)
        return next
      })
    }
  }

  async function handleDelete(r: Reservation) {
    if (!confirm(`Supprimer la réservation de ${r.firstName} ${r.lastName} ?`))
      return
    setActionError('')
    setLoadingIds((s) => new Set(s).add(r.documentId))
    try {
      const res = await fetch(`/api/admin/reservations?id=${r.documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setActionError(d.error || 'Erreur lors de la suppression.')
        return
      }
      await fetchReservations()
    } catch {
      setActionError('Erreur réseau lors de la suppression.')
    } finally {
      setLoadingIds((s) => {
        const next = new Set(s)
        next.delete(r.documentId)
        return next
      })
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#EBFFEE]">Réservations</h1>
          <p className="text-sm text-[#EBFFEE] mt-1">
            Gérez les demandes de réservation.
          </p>
        </div>
        <button
          onClick={fetchReservations}
          className="text-sm px-3 py-1.5 cursor-pointer rounded border border-[#EBFFEE] hover:bg-[#EBFFEE] hover:text-black transition"
        >
          ↺ Actualiser
        </button>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {fetchError}
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError('')}
            className="cursor-pointer text-red-400 hover:text-red-700 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── En attente ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-amber-700 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          En attente
          {pending.length > 0 && (
            <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-400 italic py-4">
            Aucune réservation en attente.
          </p>
        ) : (
          <div className="overflow-x-auto bg-white border border-neutral-200 rounded-xl shadow-sm">
            <table className="w-full min-w-[700px]">
              <TableHeader />
              <tbody>
                {pending.map((r) => (
                  <ReservationRow
                    key={r.documentId}
                    r={r}
                    loading={loadingIds.has(r.documentId)}
                    onStatusChange={(status) => handleStatusChange(r, status)}
                    onDelete={() => handleDelete(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Confirmées ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-green-700 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
          Confirmées
          {confirmed.length > 0 && (
            <span className="ml-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {confirmed.length}
            </span>
          )}
        </h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-neutral-400 italic py-4">
            Aucune réservation confirmée.
          </p>
        ) : (
          <div className="overflow-x-auto bg-white border border-neutral-200 rounded-xl shadow-sm">
            <table className="w-full min-w-[700px]">
              <TableHeader />
              <tbody>
                {confirmed.map((r) => (
                  <ReservationRow
                    key={r.documentId}
                    r={r}
                    loading={loadingIds.has(r.documentId)}
                    onStatusChange={(status) => handleStatusChange(r, status)}
                    onDelete={() => handleDelete(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Annulées ─────────────────────────────────────────────────────────── */}
      <section>
        <button
          onClick={() => setShowCancelled((v) => !v)}
          className="flex items-center gap-2 text-base font-semibold text-neutral-400 hover:text-neutral-300 cursor-pointer transition mb-3"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-neutral-400" />
          Annulées
          {cancelled.length > 0 && (
            <span className="ml-1 bg-neutral-700 text-neutral-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {cancelled.length}
            </span>
          )}
          <span className="text-xs ml-1">{showCancelled ? '▲' : '▼'}</span>
        </button>
        {showCancelled &&
          (cancelled.length === 0 ? (
            <p className="text-sm text-neutral-400 italic py-4">
              Aucune réservation annulée.
            </p>
          ) : (
            <div className="overflow-x-auto bg-white border border-neutral-200 rounded-xl shadow-sm opacity-75">
              <table className="w-full min-w-[700px]">
                <TableHeader />
                <tbody>
                  {cancelled.map((r) => (
                    <ReservationRow
                      key={r.documentId}
                      r={r}
                      loading={loadingIds.has(r.documentId)}
                      onDelete={() => handleDelete(r)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-wrap gap-4 pt-2">
        <Button variant="primary" onClick={() => setShowBlockedModal(true)}>
          Désactiver jours/heures
        </Button>
        <Button variant="primary" onClick={() => setShowMaxCoversModal(true)}>
          Couverts max par créneau
        </Button>
      </section>

      {showBlockedModal && (
        <BlockedSlotsModal onClose={() => setShowBlockedModal(false)} />
      )}
      {showMaxCoversModal && (
        <MaxCoversModal onClose={() => setShowMaxCoversModal(false)} />
      )}
    </div>
  )
}
