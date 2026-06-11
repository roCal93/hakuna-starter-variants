type PerformLogoutOptions = {
  locale: string
  resetSession?: () => Promise<unknown>
  navigate?: (url: string) => void
}

async function defaultResetSession() {
  await fetch('/api/auth/reset-session', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  })
}

function defaultNavigate(url: string) {
  window.location.assign(url)
}

export async function performLogout({
  locale,
  resetSession = defaultResetSession,
  navigate = defaultNavigate,
}: PerformLogoutOptions) {
  const targetUrl = `/${locale}`

  await resetSession().catch(() => undefined)

  navigate(targetUrl)

  return targetUrl
}
