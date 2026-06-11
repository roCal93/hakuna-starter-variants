'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Email invalide'),
})

type FormData = z.infer<typeof schema>

type ForgotPasswordResult = {
  ok: boolean
  error: string | null
}

export async function requestPasswordReset(
  email: string,
  strapiUrl: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<ForgotPasswordResult> {
  const fallbackMessage = "Erreur lors de l'envoi. Vérifiez votre email."

  if (!strapiUrl) {
    return {
      ok: false,
      error: 'Configuration locale manquante pour envoyer cet email.',
    }
  }

  try {
    const response = await fetchImpl(`${strapiUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      return { ok: false, error: fallbackMessage }
    }

    return { ok: true, error: null }
  } catch {
    return { ok: false, error: fallbackMessage }
  }
}

export function MotDePasseOubliePageClient({ locale }: { locale: string }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setError(null)
    const result = await requestPasswordReset(
      data.email,
      process.env.NEXT_PUBLIC_STRAPI_URL
    )

    if (!result.ok) {
      setError(result.error)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="text-2xl font-semibold tracking-[0.01em] text-neutral-900 dark:text-white">
              Email envoyé !
            </h2>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              Si un compte existe pour cet email, vous recevrez un lien de
              réinitialisation.
            </p>
            <div className="mt-8">
              <Link
                href={`/${locale}/espace-client/connexion`}
                className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.1em] text-neutral-800 transition-colors hover:text-black dark:text-neutral-200 dark:hover:text-white"
              >
                ← Retour à la connexion
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            Espace client
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[0.01em] text-neutral-900 dark:text-white">
            Mot de passe oublié
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.12em] text-neutral-600 dark:text-neutral-400"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-black dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {error && (
              <p
                className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full border border-black bg-black px-4 py-3 font-[family-name:var(--font-geist-mono)] text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link
              href={`/${locale}/espace-client/connexion`}
              className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.1em] text-neutral-800 transition-colors hover:text-black dark:text-neutral-200 dark:hover:text-white"
            >
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
