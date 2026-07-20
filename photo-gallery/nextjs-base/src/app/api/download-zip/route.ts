import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

const STRAPI_URL =
  process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ''
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL || ''
const MAX_FILES = 500

// ─── ZIP writer (STORE / no compression) ────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of data) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}

function u16le(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

function localHeader(nameBytes: Uint8Array, crc: number, size: number) {
  return concat([
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    u16le(20),
    u16le(0),
    u16le(0),
    u16le(0),
    u16le(0),
    u32le(crc),
    u32le(size),
    u32le(size),
    u16le(nameBytes.length),
    u16le(0),
    nameBytes,
  ])
}

function cdEntry(
  nameBytes: Uint8Array,
  crc: number,
  size: number,
  localOffset: number
) {
  return concat([
    new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
    u16le(20),
    u16le(20),
    u16le(0),
    u16le(0),
    u16le(0),
    u16le(0),
    u32le(crc),
    u32le(size),
    u32le(size),
    u16le(nameBytes.length),
    u16le(0),
    u16le(0),
    u16le(0),
    u16le(0),
    u32le(0),
    u32le(localOffset),
    nameBytes,
  ])
}

function eocdRecord(count: number, cdSize: number, cdOffset: number) {
  return concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16le(0),
    u16le(0),
    u16le(count),
    u16le(count),
    u32le(cdSize),
    u32le(cdOffset),
    u16le(0),
  ])
}

// ─── URL allowlist (anti-SSRF) ───────────────────────────────────────────────

function getAllowedHostnames(): string[] {
  const hosts: string[] = ['localhost', '127.0.0.1']
  for (const rawUrl of [STRAPI_URL, BUNNY_CDN_URL]) {
    if (!rawUrl) continue
    try {
      const { hostname } = new URL(rawUrl)
      if (hostname) hosts.push(hostname)
    } catch {}
  }
  return hosts
}

function isAllowedUrl(raw: string, allowedHosts: string[]): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  const isLocal = ['localhost', '127.0.0.1'].includes(u.hostname)
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocal))
    return false
  return allowedHosts.includes(u.hostname)
}

// ─── Route handler ───────────────────────────────────────────────────────────

type FileRequest = { url: string; name: string }

export async function POST(request: NextRequest) {
  const clientIp = getClientIpFromHeaders(request.headers)
  const rateLimit = await checkRateLimit({
    key: `download-zip:${clientIp}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
      { status: 429 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    files?: FileRequest[]
  } | null

  if (!body?.files || !Array.isArray(body.files)) {
    return NextResponse.json({ error: 'Body invalide.' }, { status: 400 })
  }

  const files = body.files.slice(0, MAX_FILES)
  const allowedHosts = getAllowedHostnames()
  const enc = new TextEncoder()

  // Stream the ZIP so we never hold more than one file in memory at a time.
  const stream = new ReadableStream({
    async start(ctrl) {
      const cdEntries: Uint8Array[] = []
      let localOffset = 0
      const usedNames = new Set<string>()

      for (const file of files) {
        if (!isAllowedUrl(file.url, allowedHosts)) continue

        // Deduplicate filenames
        const name = (file.name || 'file')
          .replace(/[^\w\-. ]/g, '_')
          .slice(0, 200)
        let deduped = name
        let n = 1
        while (usedNames.has(deduped)) {
          const dot = name.lastIndexOf('.')
          deduped =
            dot > 0
              ? `${name.slice(0, dot)}_${n}${name.slice(dot)}`
              : `${name}_${n}`
          n++
        }
        usedNames.add(deduped)
        const nameBytes = enc.encode(deduped)

        // Fetch file data
        let data: Uint8Array
        try {
          const res = await fetch(file.url, { cache: 'no-store' })
          if (!res.ok) continue
          data = new Uint8Array(await res.arrayBuffer())
        } catch {
          continue
        }

        const crc = crc32(data)
        const header = localHeader(nameBytes, crc, data.length)

        ctrl.enqueue(header)
        ctrl.enqueue(data)

        cdEntries.push(cdEntry(nameBytes, crc, data.length, localOffset))
        localOffset += header.length + data.length
      }

      // Central directory + EOCD
      const cd = concat(cdEntries)
      ctrl.enqueue(cd)
      ctrl.enqueue(eocdRecord(cdEntries.length, cd.length, localOffset))
      ctrl.close()
    },
  })

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': "attachment; filename*=UTF-8''photos.zip",
      'Cache-Control': 'private, no-store',
    },
  })
}
