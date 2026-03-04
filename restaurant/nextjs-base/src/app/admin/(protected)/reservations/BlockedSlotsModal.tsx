'use client'

import { useEffect, useState } from 'react'
import { LUNCH_SLOTS, DINNER_SLOTS } from '@/lib/reservation-slots'

// ─── Types ────────────────────────────────────────────────────────────────────
interface BlockedSlot {
  id: number
  documentId: string
  date: string
  time: string | null
  label: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Mini calendrier multi-sélection ─────────────────────────────────────────
function MultiDayCalendar({
  selected,
  onToggle,
  blocked,
}: {
  selected: Set<string>
  onToggle: (date: string) => void
  blocked: Set<string>
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const offset = (firstDay + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const todayStr = toDateStr(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else setViewMonth((m) => m + 1)
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="h-7 w-7 cursor-pointer flex items-center justify-center rounded hover:bg-neutral-200 text-neutral-600 text-lg"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-neutral-800">
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="h-7 w-7 cursor-pointer flex items-center justify-center rounded hover:bg-neutral-200 text-neutral-600 text-lg"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_FR.map((d) => (
          <div
            key={d}
            className="text-center  text-xs text-neutral-400 font-medium py-0.5"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) =>
          day === null ? (
            <div key={`e-${idx}`} />
          ) : (
            (() => {
              const dateStr = toDateStr(viewYear, viewMonth, day)
              const isPast = dateStr < todayStr
              const isBlocked = blocked.has(dateStr)
              const isSelected = selected.has(dateStr)
              const isToday = dateStr === todayStr
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast || isBlocked}
                  onClick={() => onToggle(dateStr)}
                  className={[
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                    isBlocked
                      ? 'bg-red-100 text-red-400 cursor-not-allowed line-through'
                      : isSelected
                        ? 'bg-neutral-900 text-white font-semibold cursor-pointer'
                        : isPast
                          ? 'text-neutral-300 cursor-not-allowed'
                          : isToday
                            ? 'border border-neutral-900 text-neutral-900 hover:bg-neutral-100 cursor-pointer'
                            : 'text-neutral-800 hover:bg-neutral-200 cursor-pointer',
                  ].join(' ')}
                >
                  {day}
                </button>
              )
            })()
          )
        )}
      </div>
      {selected.size > 0 && (
        <p className="mt-2 text-xs text-neutral-500 text-center">
          {selected.size} jour{selected.size > 1 ? 's' : ''} sélectionné
          {selected.size > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function BlockedSlotsModal({
  onClose,
}: {
  onClose: () => void
}) {
  const [slots, setSlots] = useState<BlockedSlot[]>([])
  const [tab, setTab] = useState<'day' | 'slot'>('day')

  // Jour(s) — multi-sélection
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())

  // Créneau — une date + créneaux horaires
  const [slotDate, setSlotDate] = useState('')
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set())

  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/admin/blocked-slots')
    const data = await res.json()
    setSlots(data.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  function toggleDay(date: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  function toggleTime(time: string) {
    setSelectedTimes((prev) => {
      const next = new Set(prev)
      if (next.has(time)) {
        next.delete(time)
      } else {
        next.add(time)
      }
      return next
    })
  }

  async function handleAdd() {
    setError('')
    if (tab === 'day') {
      if (selectedDays.size === 0)
        return setError('Sélectionnez au moins un jour.')
      setLoading(true)
      try {
        await Promise.all(
          Array.from(selectedDays).map((date) =>
            fetch('/api/admin/blocked-slots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date, label: label || null }),
            })
          )
        )
        setSelectedDays(new Set())
        setLabel('')
        await load()
      } finally {
        setLoading(false)
      }
    } else {
      if (!slotDate) return setError('Choisissez une date.')
      if (selectedTimes.size === 0)
        return setError('Sélectionnez au moins un créneau.')
      setLoading(true)
      try {
        await Promise.all(
          Array.from(selectedTimes).map((time) =>
            fetch('/api/admin/blocked-slots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: slotDate,
                time,
                label: label || null,
              }),
            })
          )
        )
        setSlotDate('')
        setSelectedTimes(new Set())
        setLabel('')
        await load()
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleDelete(documentId: string) {
    await fetch(`/api/admin/blocked-slots/${documentId}`, { method: 'DELETE' })
    await load()
  }

  const dayBlocks = slots.filter((s) => !s.time)
  const timeBlocks = slots.filter((s) => s.time)
  const blockedTimesForDate = new Set(
    timeBlocks.filter((s) => s.date === slotDate).map((s) => s.time as string)
  )

  const canAdd =
    tab === 'day' ? selectedDays.size > 0 : !!slotDate && selectedTimes.size > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#EBFFEE]/40 backdrop-blur-sm">
      <div className="bg-[#EBFFEE] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">
            Désactiver jours/heures
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-neutral-400 hover:text-neutral-700 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['day', 'slot'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t)
                  setError('')
                }}
                className={[
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition',
                  tab === t
                    ? 'bg-neutral-900 text-white cursor-pointer'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 cursor-pointer',
                ].join(' ')}
              >
                {t === 'day'
                  ? 'Désactiver des jours'
                  : 'Désactiver des créneaux'}
              </button>
            ))}
          </div>

          {/* ── Formulaire ── */}
          <div className="space-y-4">
            {tab === 'day' ? (
              <MultiDayCalendar
                selected={selectedDays}
                onToggle={toggleDay}
                blocked={new Set(dayBlocks.map((s) => s.date))}
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <MultiDayCalendar
                    selected={new Set(slotDate ? [slotDate] : [])}
                    onToggle={(date) => {
                      if (date === slotDate) {
                        setSlotDate('')
                      } else {
                        setSlotDate(date)
                      }
                      setSelectedTimes(new Set())
                    }}
                    blocked={new Set(dayBlocks.map((s) => s.date))}
                  />
                  {slotDate && dayBlocks.some((s) => s.date === slotDate) && (
                    <p className="mt-1.5 text-xs text-red-500">
                      Ce jour est entièrement désactivé — impossible de bloquer
                      des créneaux individuels.
                    </p>
                  )}
                </div>
                {slotDate && !dayBlocks.some((s) => s.date === slotDate) && (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                        Midi
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {LUNCH_SLOTS.map((s) => {
                          const isBlocked = blockedTimesForDate.has(s)
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={isBlocked}
                              onClick={() => toggleTime(s)}
                              className={[
                                'rounded-lg border py-1.5 text-sm font-medium transition',
                                isBlocked
                                  ? 'bg-red-100 text-red-400 border-red-200 cursor-not-allowed line-through'
                                  : selectedTimes.has(s)
                                    ? 'bg-neutral-900 text-white border-neutral-900 cursor-pointer'
                                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 cursor-pointer',
                              ].join(' ')}
                            >
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                        Soir
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DINNER_SLOTS.map((s) => {
                          const isBlocked = blockedTimesForDate.has(s)
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={isBlocked}
                              onClick={() => toggleTime(s)}
                              className={[
                                'rounded-lg border py-1.5 text-sm font-medium transition',
                                isBlocked
                                  ? 'bg-red-100 text-red-400 border-red-200 cursor-not-allowed line-through'
                                  : selectedTimes.has(s)
                                    ? 'bg-neutral-900 text-white border-neutral-900 cursor-pointer'
                                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 cursor-pointer',
                              ].join(' ')}
                            >
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {selectedTimes.size > 0 && (
                      <p className="text-xs text-neutral-500">
                        {selectedTimes.size} créneau
                        {selectedTimes.size > 1 ? 'x' : ''} sélectionné
                        {selectedTimes.size > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-900 mb-1">
                Note interne (optionnel)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Fermeture exceptionnelle"
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 w-full focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              disabled={loading || !canAdd}
              onClick={handleAdd}
              className="w-full bg-neutral-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {loading
                ? 'Ajout…'
                : `+ Désactiver ${
                    tab === 'day'
                      ? selectedDays.size > 1
                        ? `${selectedDays.size} jours`
                        : 'le jour'
                      : selectedTimes.size > 1
                        ? `${selectedTimes.size} créneaux`
                        : 'le créneau'
                  }`}
            </button>
          </div>

          {/* ── Jours bloqués ── */}
          {dayBlocks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                Jours désactivés
              </h3>
              <ul className="space-y-1.5">
                {dayBlocks.map((s) => (
                  <li
                    key={s.documentId}
                    className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-neutral-800">
                        {formatDate(s.date)}
                      </span>
                      {s.label && (
                        <span className="ml-2 text-neutral-400 text-xs">
                          — {s.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(s.documentId)}
                      className="cursor-pointer text-neutral-400 hover:text-red-500 transition ml-3"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Créneaux bloqués ── */}
          {timeBlocks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                Créneaux désactivés
              </h3>
              <ul className="space-y-1.5">
                {timeBlocks.map((s) => (
                  <li
                    key={s.documentId}
                    className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-neutral-800">
                        {formatDate(s.date)}
                      </span>
                      <span className="ml-2 text-neutral-600">à {s.time}</span>
                      {s.label && (
                        <span className="ml-2 text-neutral-400 text-xs">
                          — {s.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(s.documentId)}
                      className="cursor-pointer text-neutral-400 hover:text-red-500 transition ml-3"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {slots.length === 0 && (
            <p className="text-sm text-neutral-400 italic">
              Aucune désactivation configurée.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
