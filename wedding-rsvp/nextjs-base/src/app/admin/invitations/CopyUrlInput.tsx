'use client'

export default function CopyUrlInput({ url }: { url: string }) {
  return (
    <input
      readOnly
      value={url}
      onClick={(e) => (e.target as HTMLInputElement).select()}
      className="text-xs text-stone-400 bg-stone-50 border border-stone-200 rounded px-2 py-1 w-48 cursor-pointer focus:outline-none focus:border-stone-400"
      title="Cliquer pour sélectionner, puis copier"
    />
  )
}
