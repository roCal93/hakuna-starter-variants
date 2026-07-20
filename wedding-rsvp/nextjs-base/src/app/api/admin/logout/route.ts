import { NextResponse } from 'next/server'

export async function POST() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const response = NextResponse.redirect(new URL('/admin/login', siteUrl))
  response.cookies.delete('admin_auth')
  return response
}
