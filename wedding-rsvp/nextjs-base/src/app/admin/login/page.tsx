'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })

      if (res.ok) {
        router.push('/admin/invitations')
      } else {
        const data = await res.json()
        setError(data.error || 'Secret invalide')
        setLoading(false)
      }
    } catch {
      setError('Erreur réseau, réessayez.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-stone-100 p-10 w-full max-w-sm shadow-sm"
      >
        <h1 className="text-xl font-serif font-light text-stone-900 mb-6 text-center">
          Administration
        </h1>

        <label className="block text-sm text-stone-500 mb-1" htmlFor="secret">
          Secret d&apos;accès
        </label>
        <input
          id="secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-stone-400"
          required
          autoComplete="current-password"
        />

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-stone-900 text-white text-sm rounded-lg py-2 hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Accéder'}
        </button>
      </form>
    </main>
  )
}
