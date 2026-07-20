import Link from 'next/link'
import type { ReactNode } from 'react'

type BackToGalleryButtonProps = {
  href: string
  className?: string
  children: ReactNode
}

export function BackToGalleryButton({
  href,
  className,
  children,
}: BackToGalleryButtonProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
