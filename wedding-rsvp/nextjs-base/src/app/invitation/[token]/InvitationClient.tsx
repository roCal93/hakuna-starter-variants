'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { GuestData } from './page'

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}.${month}.${year}`
}

/** Returns the correctly gendered word. Falls back to "male(female)" when gender is unknown. */
function g(
  gender: 'male' | 'female' | null,
  male: string,
  female: string,
  neutral?: string
) {
  if (gender === 'male') return male
  if (gender === 'female') return female
  return neutral ?? `${male}(e)`
}

export default function InvitationClient({
  guest,
  token,
}: {
  guest: GuestData
  token: string
}) {
  const alreadyResponded =
    guest.status === 'attending' || guest.status === 'declining'

  const [submitted, setSubmitted] = useState(alreadyResponded)
  const [submittedStatus, setSubmittedStatus] = useState<
    'attending' | 'declining' | null
  >(alreadyResponded && guest.status !== 'pending' ? guest.status : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state — set both at once from each button so no inconsistent intermediate state
  const [status, setStatus] = useState<'attending' | 'declining' | ''>('')
  const [partnerAttending, setPartnerAttending] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')

  // True when the organizer wants to ask if name2 will attend
  const hasPartnerChoice = guest.askPartnerAttendance && !!guest.name2
  // Two guests are invited together and must answer as a pair.
  const isDuoWithoutPartnerChoice = !!guest.name2 && !guest.askPartnerAttendance

  function choose(
    newStatus: 'attending' | 'declining',
    newPartner: boolean | null
  ) {
    setStatus(newStatus)
    setPartnerAttending(newPartner)
  }

  function isSelected(
    checkStatus: 'attending' | 'declining',
    checkPartner: boolean | null
  ) {
    if (status !== checkStatus) return false
    if (hasPartnerChoice) return partnerAttending === checkPartner
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!status) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          partnerAttending: hasPartnerChoice ? partnerAttending : undefined,
          message: message.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Une erreur est survenue')
      }

      setSubmittedStatus(status)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const wedding = guest.wedding
  const gender = guest.gender

  // Use the organizer-provided greeting if set, otherwise auto-generate from gender
  const greetingIsCustom = !!guest.greeting

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start px-4 py-12 overflow-hidden">
      {/* Page background color — desktop only */}
      <div
        className="hidden md:block fixed inset-0 bg-stone-50 -z-20"
        aria-hidden="true"
      />
      {/* SVG background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-bg-mobile.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="pointer-events-none select-none fixed inset-0 w-full h-full object-cover -z-10 md:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/wedding-bg.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="pointer-events-none select-none fixed inset-0 w-full h-full object-cover -z-10 hidden md:block"
      />
      {/* Header */}
      <div className="w-full max-w-lg text-center mb-6">
        {wedding ? (
          <>
            {(() => {
              const sep = wedding.eventName.includes(' & ')
                ? ' & '
                : wedding.eventName.includes(' et ')
                  ? ' et '
                  : null
              if (sep) {
                const [left, right] = wedding.eventName.split(sep)
                return (
                  <h1 className="font-serif font-normal text-[#74511e] mb-1 leading-tight">
                    <span className="block text-4xl tracking-widest uppercase">
                      {left.trim()}
                    </span>
                    <span
                      className="block text-center text-5xl text-stone-600 my-1 relative -left-2"
                      style={{ fontFamily: 'var(--font-hurricane)' }}
                    >
                      et
                    </span>
                    <span className="block text-4xl tracking-widest uppercase">
                      {right.trim()}
                    </span>
                  </h1>
                )
              }
              return (
                <h1 className="text-3xl font-serif font-normal text-[#74511e] mb-1">
                  {wedding.eventName}
                </h1>
              )
            })()}
            <p className="text-stone-500 text-2xl mt-3">
              {formatDate(wedding.date)}
            </p>
          </>
        ) : (
          <h1 className="text-2xl font-serif text-stone-900">
            Votre invitation
          </h1>
        )}
      </div>

      {/* Card */}
      <div className="relative w-full max-w-lg overflow-hidden md:bg-white md:rounded-2xl md:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.35)] md:border md:border-stone-100 md:p-8">
        {/* Card SVG background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/card-bg.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover z-0 hidden md:block"
        />
        <div className="relative z-10">
          {/* Personal greeting */}
          <div className="mb-6 text-center">
            <p className="text-3xl font-serif text-stone-900 mb-4">
              {guest.name2 ? (
                <>
                  {guest.name1} <span className="text-stone-400">&</span>{' '}
                  {guest.name2}
                </>
              ) : (
                guest.name1
              )}
            </p>
            <p className="text-xl text-stone-700">
              {greetingIsCustom
                ? guest.greeting
                : guest.name2
                  ? 'Chers amis,'
                  : g(gender, 'Cher ami,', 'Chère amie,', 'Cher(e) ami(e),')}
            </p>
            <p className="text-stone-500 text-lg mt-1 leading-relaxed italic">
              {guest.coverMessage ??
                wedding?.coverMessage ??
                'Nous avons la joie de vous convier à la célébration de notre mariage et serions honorés de partager ce moment magique avec vous.'}
            </p>
          </div>

          {/* RSVP form or confirmation */}
          {submitted ? (
            <div className="space-y-4 mt-12 w-2/3 mx-auto">
              <ConfirmationView
                status={submittedStatus!}
                guest={guest}
                partnerAttending={partnerAttending}
              />
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="block w-3/4 mx-auto bg-[#F9E1D1] text-stone-600 py-3 rounded-xl text-lg font-medium hover:bg-[#F9E1D1]/80 transition-colors"
              >
                Modifier ma réponse
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Attendance buttons */}
              <fieldset>
                <legend className="text-lg text-center font-medium text-stone-700 mb-3">
                  {hasPartnerChoice
                    ? 'Serez-vous présents ?'
                    : isDuoWithoutPartnerChoice
                      ? 'Serez-vous présents ?'
                      : gender
                        ? `Seras-tu ${g(gender, 'présent', 'présente')} ?`
                        : `Serez-vous ${g(gender, 'présent', 'présente')} ?`}{' '}
                </legend>

                {hasPartnerChoice ? (
                  /* Three-option layout when a partner is expected */
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => choose('attending', true)}
                      className={`w-3/4 mx-auto py-2 px-4 rounded-xl text-center text-lg font-medium transition-all ${
                        isSelected('attending', true)
                          ? 'bg-[#D4E8C5] text-stone-600'
                          : 'bg-[#D9EDCB]/40 text-stone-600 hover:bg-[#D9EDCB]/60'
                      }`}
                    >
                      Je serai {g(gender, 'présent', 'présente')} avec{' '}
                      {guest.name2}.
                    </button>

                    <button
                      type="button"
                      onClick={() => choose('attending', false)}
                      className={`w-3/4 mx-auto py-2 px-4 rounded-xl text-center text-lg font-medium transition-all ${
                        isSelected('attending', false)
                          ? 'bg-[#D4E8C5] text-stone-600'
                          : 'bg-[#D9EDCB]/40 text-stone-600 hover:bg-[#D9EDCB]/60'
                      }`}
                    >
                      Je viendrai {g(gender, 'seul', 'seule')}.
                    </button>

                    <button
                      type="button"
                      onClick={() => choose('declining', null)}
                      className={`w-3/4 mx-auto py-2 px-4 rounded-xl text-lg font-medium transition-all text-center ${
                        isSelected('declining', null)
                          ? 'bg-[#D4E8C5] text-stone-600'
                          : 'bg-[#D9EDCB]/40 text-stone-600 hover:bg-[#D9EDCB]/60'
                      }`}
                    >
                      Je ne pourrai pas venir.
                    </button>
                  </div>
                ) : (
                  /* Two-option layout for solo invitations */
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => choose('attending', null)}
                      className={`w-3/4 mx-auto py-2 px-4 rounded-xl text-lg font-medium transition-all ${
                        isSelected('attending', null)
                          ? 'bg-[#D4E8C5] text-stone-600'
                          : 'bg-[#D9EDCB]/40 text-stone-600 hover:bg-[#D9EDCB]/60'
                      }`}
                    >
                      Avec plaisir !
                    </button>

                    <button
                      type="button"
                      onClick={() => choose('declining', null)}
                      className={`w-3/4 mx-auto py-2 px-4 rounded-xl text-lg font-medium transition-all ${
                        isSelected('declining', null)
                          ? 'bg-[#D4E8C5] text-stone-600'
                          : 'bg-[#D9EDCB]/40 text-stone-600 hover:bg-[#D9EDCB]/60'
                      }`}
                    >
                      {isDuoWithoutPartnerChoice
                        ? 'Nous ne pourrons pas venir.'
                        : 'Je ne pourrai pas venir.'}
                    </button>
                  </div>
                )}
              </fieldset>

              {/* Optional message */}
              {status && (
                <div>
                  <label
                    htmlFor="message"
                    className="text-lg text-center font-medium text-stone-700 block mb-2"
                  >
                    Un message ?
                  </label>
                  <textarea
                    id="message"
                    rows={3}
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="On aime les messages..."
                    className="w-full border border-[#D9EDCB]/60 rounded-xl px-4 py-2.5 text-lg text-stone-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#D9EDCB]/60"
                  />
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="text-lg text-red-500 bg-red-50 rounded-lg px-4 py-2"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!status || loading}
                aria-busy={loading}
                className="w-full bg-[#F9E1D1] text-stone-600 py-2 rounded-xl text-lg font-medium hover:bg-[#F9E1D1]/80 transition-colors disabled:bg-[#F9E1D1]/40 disabled:cursor-not-allowed"
              >
                {loading ? 'Envoi en cours...' : 'Confirmer ma réponse'}
              </button>

              <Link
                href={`/invitation/${token}/logement`}
                className="block w-fit ml-auto bg-[#D9EDCB]/70 text-stone-600 px-6 py-2 mt-8 rounded-xl text-lg font-medium hover:bg-[#D9EDCB] transition-colors text-center"
              >
                Info logement
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

function ConfirmationView({
  status,
  guest,
  partnerAttending,
}: {
  status: 'attending' | 'declining'
  guest: GuestData
  partnerAttending: boolean | null
}) {
  const { name1, name2, gender } = guest
  // withPartner is true when name2 exists and the partner hasn't explicitly declined
  // (covers both "attending with partner" and "two names, partner not asked")
  const withPartner = !!name2 && partnerAttending !== false
  const tutoie = gender === 'male' || gender === 'female'
  const isDuoWithoutPartnerChoice = !!name2 && !guest.askPartnerAttendance

  if (status === 'attending') {
    if (withPartner) {
      const defaultTitle = `À très bientôt à vous deux !`
      const defaultBody = `Ta présence, ainsi que celle de ${name2}, a bien été confirmée. Les mariés ont hâte de vous voir !`
      return (
        <div className="text-center p-6 rounded-xl bg-[#D9EDCB]/50">
          <h2 className="text-xl font-serif text-stone-900 mb-2">
            {guest.confirmAttendingWithPartnerTitle ?? defaultTitle}
          </h2>
          <p className="text-stone-500 text-lg">
            {guest.confirmAttendingWithPartnerBody ?? defaultBody}
          </p>
        </div>
      )
    }

    const defaultSoloTitle = `À très bientôt, ${name1} !`
    // Use "tu" form when gender is known OR when the partner explicitly won't come
    // (we know exactly one person is attending in both cases)
    const useTutoie = tutoie || partnerAttending === false
    const defaultSoloBody = useTutoie
      ? `Ta présence a bien été confirmée. Les mariés ont hâte de te voir !`
      : `Votre présence a bien été confirmée. Les mariés ont hâte de vous voir !`
    return (
      <div className="text-center p-6 rounded-xl bg-[#D9EDCB]/50">
        <h2 className="text-xl font-serif text-stone-900 mb-2">
          {guest.confirmAttendingSoloTitle ?? defaultSoloTitle}
        </h2>
        <p className="text-stone-500 text-lg">
          {guest.confirmAttendingSoloBody ?? defaultSoloBody}
        </p>
      </div>
    )
  }

  const defaultDecliningTitle = isDuoWithoutPartnerChoice
    ? `Message bien reçu !`
    : tutoie
      ? `Message bien reçu, ${name1}.`
      : `Message bien reçu !`
  const defaultDecliningBody = isDuoWithoutPartnerChoice
    ? `Vous serez dans les pensées des mariés en ce jour.`
    : tutoie
      ? `Tu seras dans les pensées des mariés en ce jour.`
      : `Vous serez dans les pensées des mariés en ce jour.`

  return (
    <div className="text-center p-6 rounded-xl bg-[#D9EDCB]/50">
      <h2 className="text-xl font-serif text-stone-900 mb-2">
        {guest.confirmDecliningTitle ?? defaultDecliningTitle}
      </h2>
      <p className="text-stone-500 text-lg">
        {guest.confirmDecliningBody ?? defaultDecliningBody}
      </p>
    </div>
  )
}
