'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z
  .object({
    username: z.string().min(2, 'Minimum 2 caractères'),
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

type RegistrationResponse = {
  ok: boolean
  error: string | null
}

async function readRegistrationError(response: Response) {
  const json = (await response.json().catch(() => null)) as {
    error?: { message?: string }
  } | null

  return json?.error?.message ?? 'Erreur lors de la création du compte.'
}

export async function createAccount(
  data: Pick<FormData, 'username' | 'email' | 'password'>,
  strapiUrl: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<RegistrationResponse> {
  if (!strapiUrl) {
    return {
      ok: false,
      error: 'Configuration locale manquante pour créer un compte.',
    }
  }

  try {
    const response = await fetchImpl(`${strapiUrl}/api/auth/local/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: await readRegistrationError(response),
      }
    }

    return { ok: true, error: null }
  } catch {
    return {
      ok: false,
      error: 'Erreur lors de la création du compte.',
    }
  }
}

export function InscriptionPageClient({ locale }: { locale: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setError(null)

    const result = await createAccount(
      {
        username: data.username,
        email: data.email,
        password: data.password,
      },
      process.env.NEXT_PUBLIC_STRAPI_URL
    )

    if (!result.ok) {
      setError(result.error)
      return
    }

    const signInResult = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (signInResult?.error) {
      setError('Compte créé ! Connectez-vous.')
      router.push(`/${locale}/espace-client/connexion`)
    } else {
      router.push(`/${locale}/espace-client/tableau-de-bord`)
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            Espace client
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[0.01em] text-neutral-900 dark:text-white">
            Créer un compte
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Rejoignez l&apos;espace client
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
                className="mb-1.5 block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.12em] text-neutral-600"
                htmlFor="username"
              >
                Nom / Prénom
              </label>
              <input
                id="username"
                type="text"
                autoComplete="name"
                {...register('username')}
                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-black dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.12em] text-neutral-600"
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

            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.12em] text-neutral-600"
                htmlFor="password"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-black dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.12em] text-neutral-600"
                htmlFor="confirm"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register('confirm')}
                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-black dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
              />
              {errors.confirm && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.confirm.message}
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
              className="w-full border border-black bg-black px-4 py-3 font-[family-name:var(--font-geist-mono)] text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {isSubmitting ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Déjà un compte ?{' '}
            <Link
              href={`/${locale}/espace-client/connexion`}
              className="font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-black dark:text-white dark:decoration-neutral-600 dark:hover:text-neutral-300"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
