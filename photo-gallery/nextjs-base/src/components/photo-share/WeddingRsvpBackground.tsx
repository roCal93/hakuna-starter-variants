type WeddingRsvpBackgroundProps = {
  desktopColorClassName?: string
}

export function WeddingRsvpCardBackground() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-bg.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 hidden h-full w-full object-cover md:block"
      />
      <div
        className="pointer-events-none absolute inset-0 hidden bg-white/65 md:block"
        aria-hidden="true"
      />
    </>
  )
}

export function WeddingRsvpBackground({
  desktopColorClassName = 'bg-stone-50',
}: WeddingRsvpBackgroundProps) {
  return (
    <>
      <div
        className={`hidden md:block fixed inset-0 ${desktopColorClassName} -z-20`}
        aria-hidden="true"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-bg-mobile.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="pointer-events-none select-none fixed inset-0 h-full w-full object-cover -z-10 md:hidden"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/wedding-bg.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="pointer-events-none select-none fixed inset-0 hidden h-full w-full object-cover -z-10 md:block"
      />
    </>
  )
}
