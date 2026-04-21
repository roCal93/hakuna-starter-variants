'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuButton {
  sectionDocumentId: string
  sectionTitle: string
  blockId: number
  buttonId: number
  buttonLabel: string
  file: { id: number; name: string; url: string } | null
}

interface PdfFile {
  id: number
  name: string
  url: string
  size: number
  createdAt: string
}

// ─── PDF Picker modal ─────────────────────────────────────────────────────────
function PdfPicker({
  onUpload,
  onClose,
}: {
  onUpload: (file: File) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-[#EBFFEE] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900 text-sm">
            Importer un PDF
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 cursor-pointer transition text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-[#B6DFB9] cursor-pointer hover:bg-[#D4F0D6] transition text-sm font-medium text-neutral-700"
          >
            Choisir un fichier PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const [buttons, setButtons] = useState<MenuButton[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pickerFor, setPickerFor] = useState<MenuButton | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadButtons = useCallback(async () => {
    const res = await fetch('/api/admin/menu-buttons')
    if (res.ok) {
      const data = await res.json()
      setButtons(Array.isArray(data) ? data : [])
    }
  }, [])

  useEffect(() => {
    loadButtons()
  }, [loadButtons])

  async function uploadAndAssign(btn: MenuButton, rawFile: File) {
    if (rawFile.type !== 'application/pdf') {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setPickerFor(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', rawFile)
      const res = await fetch('/api/admin/menu', { method: 'POST', body: form })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || "Erreur lors de l'import.")
        return
      }
      const data = await res.json()
      // Strapi upload returns an array
      const uploaded: PdfFile = Array.isArray(data) ? data[0] : data
      await handleAssign(btn, uploaded)
    } finally {
      setUploading(false)
    }
  }

  async function handleAssign(btn: MenuButton, file: PdfFile) {
    setPickerFor(null)
    const key = `${btn.sectionDocumentId}-${btn.buttonId}`
    setAssigning(key)
    try {
      const res = await fetch('/api/admin/menu-buttons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionDocumentId: btn.sectionDocumentId,
          blockId: btn.blockId,
          buttonId: btn.buttonId,
          fileId: file.id,
        }),
      })
      if (res.ok) {
        setSuccess(`Bouton "${btn.buttonLabel}" mis à jour → ${file.name}`)
        await loadButtons()
      } else {
        const d = await res.json()
        setError(d.error || 'Erreur lors de la mise à jour.')
      }
    } finally {
      setAssigning(null)
    }
  }

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#EBFFEE]">Menus</h1>
        <p className="text-sm text-[#EBFFEE] mt-1">
          Changez le PDF associé à chaque bouton du site.
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          ✓ {success}
        </div>
      )}

      {/* ── Boutons PDF du site ──────────────────────────────────────────────── */}
      {buttons.length === 0 ? (
        <p className="text-sm text-[#EBFFEE]/60 italic">
          Aucun bouton PDF trouvé dans le contenu Strapi.
        </p>
      ) : (
        <div className="space-y-2 mt-4">
          {buttons.map((btn) => {
            const key = `${btn.sectionDocumentId}-${btn.buttonId}`
            const isAssigning = assigning === key
            return (
              <div
                key={key}
                className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl px-4 py-3 shadow-sm gap-4"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-neutral-800">
                    {btn.buttonLabel || '(sans label)'}
                  </span>
                  {btn.file ? (
                    <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                      <span>📄</span>
                      <span className="truncate">{btn.file.name}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-500 mt-0.5">
                      ⚠ Aucun PDF assigné
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {btn.file && (
                    <a
                      href={
                        btn.file.url.startsWith('http')
                          ? btn.file.url
                          : `${strapiUrl}${btn.file.url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1.5 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition"
                    >
                      Voir
                    </a>
                  )}
                  <button
                    disabled={isAssigning || uploading}
                    onClick={() => setPickerFor(btn)}
                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 transition"
                  >
                    {isAssigning || uploading
                      ? '…'
                      : btn.file
                        ? 'Modifier'
                        : 'Assigner'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Picker ───────────────────────────────────────────────────────────── */}
      {pickerFor && (
        <PdfPicker
          onUpload={(rawFile) => uploadAndAssign(pickerFor, rawFile)}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  )
}
