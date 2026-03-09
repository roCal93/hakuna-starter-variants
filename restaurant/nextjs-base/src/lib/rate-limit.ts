type RateLimitInput = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  source: 'upstash' | 'memory'
}

type LocalEntry = {
  count: number
  resetAt: number
}

const localStore = new Map<string, LocalEntry>()

function localRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now()
  const current = localStore.get(input.key)

  if (!current || now >= current.resetAt) {
    const resetAt = now + input.windowMs
    localStore.set(input.key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      resetAt,
      source: 'memory',
    }
  }

  current.count += 1
  localStore.set(input.key, current)

  if (localStore.size > 2000) {
    for (const [k, v] of localStore.entries()) {
      if (v.resetAt <= now) {
        localStore.delete(k)
      }
    }
  }

  return {
    allowed: current.count <= input.limit,
    remaining: Math.max(0, input.limit - current.count),
    resetAt: current.resetAt,
    source: 'memory',
  }
}

async function upstashCommand<T>(
  command: string,
  key: string,
  args: Array<string | number> = []
): Promise<T> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!baseUrl || !token) {
    throw new Error('UPSTASH_NOT_CONFIGURED')
  }

  const encodedKey = encodeURIComponent(key)
  const encodedArgs = args.map((arg) => encodeURIComponent(String(arg)))
  const url = `${baseUrl}/${command}/${encodedKey}${encodedArgs.length ? `/${encodedArgs.join('/')}` : ''}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`UPSTASH_${response.status}`)
  }

  const body = (await response.json()) as { result?: T }
  return body.result as T
}

async function upstashRateLimit(
  input: RateLimitInput
): Promise<RateLimitResult | null> {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null
  }

  const now = Date.now()

  try {
    const count = Number(await upstashCommand<number>('incr', input.key))
    if (count === 1) {
      await upstashCommand<number>('pexpire', input.key, [input.windowMs])
    }

    const ttl = Number(await upstashCommand<number>('pttl', input.key))
    const resetAt = now + (ttl > 0 ? ttl : input.windowMs)

    return {
      allowed: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      resetAt,
      source: 'upstash',
    }
  } catch (error) {
    console.warn('Rate limit store unavailable, falling back to memory:', error)
    return null
  }
}

export async function checkRateLimit(
  input: RateLimitInput
): Promise<RateLimitResult> {
  const remote = await upstashRateLimit(input)
  if (remote) return remote
  return localRateLimit(input)
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return headers.get('x-real-ip') || 'unknown'
}