import { NextRequest, NextResponse } from 'next/server'

export function enforceSameOrigin(request: NextRequest): NextResponse | null {
  const expectedOrigin = request.nextUrl.origin
  const origin = request.headers.get('origin')

  if (origin && origin !== expectedOrigin) {
    return NextResponse.json(
      { error: 'Origine non autorisée.' },
      { status: 403 }
    )
  }

  const referer = request.headers.get('referer')
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin
    if (refererOrigin !== expectedOrigin) {
      return NextResponse.json(
        { error: 'Référent non autorisé.' },
        { status: 403 }
      )
    }
  }

  return null
}
