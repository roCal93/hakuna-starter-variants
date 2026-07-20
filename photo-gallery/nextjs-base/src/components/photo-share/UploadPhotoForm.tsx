'use client'

import { FormEvent, useRef, useState } from 'react'

type SubmitState = {
  type: 'idle' | 'success' | 'error'
  message?: string
}

type UploadPhase = 'idle' | 'uploading' | 'publishing'

const BUNNY_UPLOAD_PROXY_URL = '/api/bunny-upload'
const DEFAULT_MAX_PARALLEL_UPLOADS = 4
const configuredParallelUploads = Number.parseInt(
  process.env.NEXT_PUBLIC_UPLOAD_PARALLELISM || '',
  10
)
const MAX_PARALLEL_UPLOADS = Number.isFinite(configuredParallelUploads)
  ? Math.max(1, Math.min(8, configuredParallelUploads))
  : DEFAULT_MAX_PARALLEL_UPLOADS

function getDirectBunnyUploadUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  if (!baseUrl) return null

  try {
    return new URL('/api/bunny-upload', baseUrl).toString()
  } catch {
    return null
  }
}

type BunnyUploadResponse = {
  url?: string
  mime?: string
  title?: string
  width?: number
  height?: number
  error?: string | { message?: string }
}

type BunnyUploadAttempt = {
  status: number
  ok: boolean
  json: BunnyUploadResponse | null
  rawText: string
  targetLabel: string
}

function getErrorMessage(error: BunnyUploadResponse['error']) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message
  }

  return null
}

async function uploadMediaToBunny(
  file: File,
  authorName: string,
  onProgress?: (loaded: number, total: number) => void
) {
  const bunnyBody = new FormData()
  bunnyBody.append('file', file)
  bunnyBody.append('authorName', authorName)

  const directBunnyUrl = getDirectBunnyUploadUrl()
  const uploadTargets = directBunnyUrl
    ? [
        { url: directBunnyUrl, label: 'direct Strapi' },
        { url: BUNNY_UPLOAD_PROXY_URL, label: 'proxy Next.js' },
      ]
    : [{ url: BUNNY_UPLOAD_PROXY_URL, label: 'proxy Next.js' }]

  const attemptUpload = (uploadUrl: string, targetLabel: string) =>
    new Promise<BunnyUploadAttempt>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl)
      xhr.responseType = 'text'

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        onProgress?.(event.loaded, event.total)
      }

      xhr.onerror = () => {
        reject(
          new Error(
            `Erreur réseau pendant l'upload Bunny.net (${targetLabel}).`
          )
        )
      }

      xhr.onload = () => {
        const rawText = xhr.responseText || ''
        let json: BunnyUploadResponse | null = null

        if (rawText) {
          try {
            json = (JSON.parse(rawText) as BunnyUploadResponse | null) ?? null
          } catch {
            json = null
          }
        }

        resolve({
          status: xhr.status,
          ok: xhr.status >= 200 && xhr.status < 300,
          json,
          rawText,
          targetLabel,
        })
      }

      xhr.send(bunnyBody)
    })

  let response: BunnyUploadAttempt | null = null

  for (const target of uploadTargets) {
    try {
      response = await attemptUpload(target.url, target.label)

      if (
        response.ok &&
        response.json &&
        typeof response.json.url === 'string' &&
        typeof response.json.mime === 'string'
      ) {
        break
      }
    } catch {
      response = null
    }
  }

  onProgress?.(file.size, file.size)

  const json = response?.json

  if (
    !response?.ok ||
    !json ||
    typeof json.url !== 'string' ||
    typeof json.mime !== 'string'
  ) {
    const backendMessage = getErrorMessage(json?.error)
    const details = response?.rawText?.trim()
    const shortDetails = details ? details.slice(0, 180) : ''
    const status = response?.status ? ` (${response.status})` : ''
    const target = response?.targetLabel ? ` via ${response.targetLabel}` : ''

    const message =
      backendMessage ||
      (shortDetails
        ? `Échec upload Bunny.net${status}${target}: ${shortDetails}`
        : `Échec upload Bunny.net${status}${target}.`)

    throw new Error(message)
  }

  return {
    url: json.url,
    mime: json.mime,
    title: json.title || file.name.replace(/\.[^.]+$/, ''),
    width: json.width,
    height: json.height,
  }
}

export function UploadPhotoForm() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [state, setState] = useState<SubmitState>({ type: 'idle' })
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0)
  const [totalFilesCount, setTotalFilesCount] = useState(0)
  const [selectedFilesCount, setSelectedFilesCount] = useState(0)
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setState({ type: 'idle' })
    setUploadPhase('uploading')
    setUploadProgress(0)
    setUploadedFilesCount(0)
    setTotalFilesCount(0)

    const form = event.currentTarget
    const body = new FormData(form)
    const authorName = (body.get('authorName') as string) || ''
    const rawFiles = body
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File)

    if (rawFiles.length === 0) {
      setState({
        type: 'error',
        message: 'Sélectionne au moins un fichier avant de publier.',
      })
      setUploadPhase('idle')
      setSubmitting(false)
      return
    }

    setTotalFilesCount(rawFiles.length)
    const totalBytes = rawFiles.reduce((sum, file) => sum + file.size, 0)
    let uploadedBytes = 0

    async function uploadFiles(files: File[]) {
      const uploadedMedia = new Array(files.length)
      const loadedByFileIndex = new Array(files.length).fill(0)
      let nextIndex = 0

      const worker = async () => {
        while (true) {
          const index = nextIndex
          nextIndex += 1

          if (index >= files.length) {
            return
          }

          const file = files[index]

          const uploadedMediaItem = await uploadMediaToBunny(
            file,
            authorName,
            (loaded) => {
              const safeLoaded = Math.max(
                loadedByFileIndex[index],
                Math.min(file.size, loaded)
              )
              const delta = safeLoaded - loadedByFileIndex[index]

              if (delta > 0) {
                loadedByFileIndex[index] = safeLoaded
                uploadedBytes += delta

                if (totalBytes > 0) {
                  setUploadProgress(
                    Math.min(
                      100,
                      Math.round((uploadedBytes / totalBytes) * 100)
                    )
                  )
                }
              }
            }
          )

          uploadedMedia[index] = uploadedMediaItem
          setUploadedFilesCount((current) => current + 1)
        }
      }

      const parallelism = Math.min(MAX_PARALLEL_UPLOADS, files.length)
      await Promise.all(Array.from({ length: parallelism }, () => worker()))

      return uploadedMedia
    }

    try {
      const uploadedMedia = await uploadFiles(rawFiles)
      setUploadPhase('publishing')

      const publishResponse = await fetch('/api/photo-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorName: (body.get('authorName') as string) || '',
          externalMedia: uploadedMedia,
        }),
      })

      const publishJson = (await publishResponse.json().catch(() => null)) as {
        error?: string
      } | null

      if (!publishResponse.ok) {
        setState({
          type: 'error',
          message:
            publishJson?.error ||
            'La publication a échoué. Réessaie dans un instant.',
        })
        return
      }

      form.reset()
      setUploadProgress(100)
      setUploadPhase('idle')
      setSelectedFilesCount(0)
      setSelectedFileNames([])
      setState({
        type: 'success',
        message: `${rawFiles.length} média(s) publié(s) avec succès.`,
      })
    } catch (error) {
      setState({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : "Erreur réseau pendant l'envoi. Réessaie dans un instant.",
      })
    } finally {
      setUploadPhase('idle')
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 flex flex-col items-center"
    >
      <label className="w-full grid gap-2 text-sm font-medium text-stone-700">
        <input
          name="authorName"
          required
          maxLength={80}
          className="w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-500"
          placeholder="Ton nom"
        />
      </label>

      <div className="flex flex-col items-center justify-center">
        <input
          ref={fileInputRef}
          name="files"
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          multiple
          required
          className="sr-only"
          id="upload-files-input"
          onChange={(e) => {
            const files = e.currentTarget.files
            setSelectedFilesCount(files ? files.length : 0)
            setSelectedFileNames(
              files ? Array.from(files).map((file) => file.name) : []
            )
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-full bg-[#74511e]/60 px-4 py-2 text-lg font-semibold text-white transition hover:bg-[#74511e]"
        >
          Sélectionner des fichiers
        </button>
        {selectedFilesCount > 0 && (
          <p className="mt-2 text-sm text-stone-600">
            {selectedFilesCount} fichier{selectedFilesCount > 1 ? 's' : ''}{' '}
            sélectionné{selectedFilesCount > 1 ? 's' : ''}
          </p>
        )}

        {selectedFileNames.length > 0 && (
          <p className="mt-1 text-xs text-stone-500 text-center">
            {selectedFileNames.slice(0, 2).join(', ')}
            {selectedFileNames.length > 2
              ? ` +${selectedFileNames.length - 2} autre(s)`
              : ''}
          </p>
        )}
      </div>

      {submitting ? (
        <div className="space-y-2 rounded-3xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-col gap-1 text-sm text-stone-700 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {uploadPhase === 'publishing'
                ? 'Publication en cours...'
                : 'Envoi des fichiers...'}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <p className="text-xs text-stone-500">
            {uploadPhase === 'publishing'
              ? `${uploadedFilesCount} fichier(s) sur ${totalFilesCount} envoyés, publication en cours`
              : `${uploadedFilesCount} fichier(s) sur ${totalFilesCount} envoyés`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900 transition-[width] duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      {state.type !== 'idle' ? (
        <p
          className={
            state.type === 'success'
              ? 'rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-[#74511e]/60 px-4 py-2 text-base font-semibold text-white transition hover:bg-[#74511e] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Envoi en cours...' : 'Envoyer'}
      </button>
    </form>
  )
}
