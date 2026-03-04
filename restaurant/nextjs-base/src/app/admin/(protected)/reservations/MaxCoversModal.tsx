'use client'

import { useEffect, useState } from 'react'

export default function MaxCoversModal({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState<number>(20)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.maxCoversPerSlot) setValue(d.data.maxCoversPerSlot)
      })
  }, [])

  async function handleSave() {
    if (value < 1) return setError('La valeur doit être supérieure à 0.')
    setError('')
    setLoading(true)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxCoversPerSlot: value }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        const d = await res.json()
        setError(d.error || 'Erreur.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#EBFFEE]/40 backdrop-blur-sm">
      <div className="bg-[#EBFFEE] rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">
            Couverts max par créneau
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-neutral-400 hover:text-neutral-700 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-neutral-500">
            Définissez le nombre maximum de couverts acceptés par créneau
            horaire.
          </p>

          <div>
            <label className="block text-xs font-medium text-neutral-900 mb-1">
              Nombre de couverts
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 w-full focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && (
            <p className="text-xs text-green-600 font-medium">✓ Enregistré !</p>
          )}

          <div className="flex gap-3">
            <button
              disabled={loading}
              onClick={handleSave}
              className="flex-1 bg-neutral-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-50 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
