import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'
import AdminNav from './AdminNav'

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!verifyToken(token)) {
    redirect('/admin/login')
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          'radial-gradient(43.41% 65.16% at 65.56% 45.02%, #3CB152 0%, #194B23 79.62%)',
      }}
    >
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </div>
  )
}
