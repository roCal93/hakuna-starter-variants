'use client'

import { useEffect, useState } from 'react'

type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type OpeningDay = {
  dayLabel: DayKey
  isClosedAllDay: boolean
  firstPeriodOpenTime: string
  firstPeriodCloseTime: string
  secondPeriodOpenTime: string
  secondPeriodCloseTime: string
}

const DAY_ORDER: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
}

function buildDefaultOpeningDays(): OpeningDay[] {
  return DAY_ORDER.map((dayLabel) => ({
    dayLabel,
    isClosedAllDay: false,
    firstPeriodOpenTime: '11:00',
    firstPeriodCloseTime: '13:00',
    secondPeriodOpenTime: '18:00',
    secondPeriodCloseTime: '20:00',
  }))
}

function normalizeTimeForInput(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim()
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return fallback

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function normalizeOpeningDays(input: unknown): OpeningDay[] {
  const defaults = buildDefaultOpeningDays()
  if (!Array.isArray(input)) return defaults

  const byDay = new Map<DayKey, OpeningDay>()
  for (const item of input) {
    const day = String(
      (item as { dayLabel?: unknown }).dayLabel || ''
    ) as DayKey
    if (!DAY_ORDER.includes(day)) continue

    byDay.set(day, {
      dayLabel: day,
      isClosedAllDay: !!(item as { isClosedAllDay?: unknown }).isClosedAllDay,
      firstPeriodOpenTime: normalizeTimeForInput(
        (item as { firstPeriodOpenTime?: unknown }).firstPeriodOpenTime,
        defaults.find((d) => d.dayLabel === day)!.firstPeriodOpenTime
      ),
      firstPeriodCloseTime: normalizeTimeForInput(
        (item as { firstPeriodCloseTime?: unknown }).firstPeriodCloseTime,
        defaults.find((d) => d.dayLabel === day)!.firstPeriodCloseTime
      ),
      secondPeriodOpenTime: normalizeTimeForInput(
        (item as { secondPeriodOpenTime?: unknown }).secondPeriodOpenTime,
        defaults.find((d) => d.dayLabel === day)!.secondPeriodOpenTime
      ),
      secondPeriodCloseTime: normalizeTimeForInput(
        (item as { secondPeriodCloseTime?: unknown }).secondPeriodCloseTime,
        defaults.find((d) => d.dayLabel === day)!.secondPeriodCloseTime
      ),
    })
  }

  return DAY_ORDER.map(
    (day) => byDay.get(day) || defaults.find((d) => d.dayLabel === day)!
  )
}

export default function HorairesPage() {
  const [maxCoversPerSlot, setMaxCoversPerSlot] = useState(20)
  const [openingDays, setOpeningDays] = useState<OpeningDay[]>(
    buildDefaultOpeningDays()
  )
  const [firstPeriodLabel, setFirstPeriodLabel] = useState('Service 1')
  const [secondPeriodLabel, setSecondPeriodLabel] = useState('Service 2')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.maxCoversPerSlot)
          setMaxCoversPerSlot(Number(d.data.maxCoversPerSlot))
        setOpeningDays(normalizeOpeningDays(d?.data?.openingDays))
        if (d?.periodLabels?.firstPeriodLabel)
          setFirstPeriodLabel(String(d.periodLabels.firstPeriodLabel))
        if (d?.periodLabels?.secondPeriodLabel)
          setSecondPeriodLabel(String(d.periodLabels.secondPeriodLabel))
      })
      .catch(() => {
        setError('Impossible de charger la configuration.')
      })
  }, [])

  function updateDay(dayLabel: DayKey, patch: Partial<OpeningDay>) {
    setOpeningDays((prev: OpeningDay[]) =>
      prev.map((day: OpeningDay) =>
        day.dayLabel === dayLabel ? { ...day, ...patch } : day
      )
    )
  }

  async function handleSave() {
    setError('')
    setLoading(true)
    setSaved(false)

    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxCoversPerSlot, openingDays }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Erreur lors de la sauvegarde.')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch {
      setError('Erreur reseau lors de la sauvegarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#EBFFEE]">Horaires</h1>
        <p className="text-[#EBFFEE] mt-1">
          Modifiez les jours ouverts/fermes et les horaires utilises par le
          module de reservation.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-[#EBFFEE] p-5 space-y-4">
        {openingDays.map((day: OpeningDay) => (
          <div
            key={day.dayLabel}
            className="rounded-lg border border-neutral-200 bg-white/70 p-3"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-sm font-semibold text-neutral-800">
                {DAY_LABELS[day.dayLabel]}
              </span>
              <label className="inline-flex items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={day.isClosedAllDay}
                  onChange={(e) =>
                    updateDay(day.dayLabel, {
                      isClosedAllDay: e.target.checked,
                    })
                  }
                />
                Ferme toute la journee
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-neutral-600">
                  {firstPeriodLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    disabled={day.isClosedAllDay}
                    value={day.firstPeriodOpenTime}
                    onChange={(e) =>
                      updateDay(day.dayLabel, {
                        firstPeriodOpenTime: e.target.value,
                      })
                    }
                    className="border border-neutral-300 rounded bg-white px-2 py-1.5 text-sm text-neutral-900 [color-scheme:light] disabled:opacity-50"
                    aria-label={`${DAY_LABELS[day.dayLabel]} ${firstPeriodLabel} ouverture`}
                  />
                  <input
                    type="time"
                    disabled={day.isClosedAllDay}
                    value={day.firstPeriodCloseTime}
                    onChange={(e) =>
                      updateDay(day.dayLabel, {
                        firstPeriodCloseTime: e.target.value,
                      })
                    }
                    className="border border-neutral-300 rounded bg-white px-2 py-1.5 text-sm text-neutral-900 [color-scheme:light] disabled:opacity-50"
                    aria-label={`${DAY_LABELS[day.dayLabel]} ${firstPeriodLabel} fermeture`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-neutral-600">
                  {secondPeriodLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    disabled={day.isClosedAllDay}
                    value={day.secondPeriodOpenTime}
                    onChange={(e) =>
                      updateDay(day.dayLabel, {
                        secondPeriodOpenTime: e.target.value,
                      })
                    }
                    className="border border-neutral-300 rounded bg-white px-2 py-1.5 text-sm text-neutral-900 [color-scheme:light] disabled:opacity-50"
                    aria-label={`${DAY_LABELS[day.dayLabel]} ${secondPeriodLabel} ouverture`}
                  />
                  <input
                    type="time"
                    disabled={day.isClosedAllDay}
                    value={day.secondPeriodCloseTime}
                    onChange={(e) =>
                      updateDay(day.dayLabel, {
                        secondPeriodCloseTime: e.target.value,
                      })
                    }
                    className="border border-neutral-300 rounded bg-white px-2 py-1.5 text-sm text-neutral-900 [color-scheme:light] disabled:opacity-50"
                    aria-label={`${DAY_LABELS[day.dayLabel]} ${secondPeriodLabel} fermeture`}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && (
          <p className="text-xs text-green-600 font-medium">Enregistre.</p>
        )}

        <div className="pt-1">
          <button
            disabled={loading}
            onClick={handleSave}
            className="bg-neutral-900 text-white rounded-lg py-2.5 px-5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer les horaires'}
          </button>
        </div>
      </div>
    </div>
  )
}
