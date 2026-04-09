'use client'

import { useState, useTransition, useRef } from 'react'
import { saveMediaKitUrl } from './actions'
import { createClient } from '@/lib/supabase/client'

interface Props {
  creatorId: string
  existingUrl: string | null
}

export default function MediaKitCTA({ creatorId, existingUrl }: Props) {
  const [showLink, setShowLink] = useState(false)
  const [url, setUrl] = useState(existingUrl ?? '')
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSaveUrl() {
    if (!url.trim()) return
    startTransition(async () => {
      await saveMediaKitUrl(creatorId, url.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadMsg(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
      const path = `${creatorId}/mediakit.${ext}`

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('briefs')
        .upload(path, file, { upsert: true })

      if (uploadError) {
        setUploadMsg(`Error: ${uploadError.message}`)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('briefs').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      await saveMediaKitUrl(creatorId, publicUrl)
      setUrl(publicUrl)
      setUploadMsg('✅ Media kit subido correctamente')
      setTimeout(() => setUploadMsg(null), 4000)
    } catch (err) {
      setUploadMsg(`Error: ${err instanceof Error ? err.message : 'No se pudo subir el archivo'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-[#fff8f2] border border-[rgba(255,119,0,0.12)] rounded-2xl overflow-hidden relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-lightOrange.png"
        alt=""
        className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-28 opacity-[0.08] pointer-events-none"
        aria-hidden="true"
      />
      <div className="flex">
        <div className="w-1 bg-go-orange shrink-0" />
        <div className="p-5 md:p-6 flex-1 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">☀️</span>
            <h2 className="font-syne font-bold text-lg text-go-dark">
              ¿Lista para que Papaya te pitchee a marcas? 🧡
            </h2>
          </div>
          <p className="font-dm text-sm text-gray-500 mb-5 max-w-lg">
            Sube tu portafolio o media kit y nuestro equipo lo usará para conseguirte deals con hoteles, atracciones y restaurantes.
          </p>

          {uploadMsg && (
            <div className={`mb-4 font-dm text-sm px-4 py-2.5 rounded-xl ${uploadMsg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {uploadMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 font-dm text-sm font-semibold text-white bg-go-orange hover:bg-go-orange/90 px-5 py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {uploading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Subiendo...</>
              ) : (
                '📎 Subir mi media kit'
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => setShowLink(!showLink)}
              className="inline-flex items-center justify-center gap-2 font-dm text-sm font-semibold text-go-orange bg-white border border-go-orange/30 hover:bg-go-orange/5 px-5 py-2.5 rounded-xl transition"
            >
              🔗 Pegar link de mi media kit
            </button>
          </div>

          {showLink && (
            <div className="mt-4 flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-orange-200 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
              />
              <button
                onClick={handleSaveUrl}
                disabled={isPending || !url.trim()}
                className="font-dm text-sm font-semibold text-white bg-go-orange hover:bg-go-orange/90 px-5 py-2.5 rounded-xl transition disabled:opacity-50"
              >
                {saved ? '¡Guardado! ✓' : isPending ? '...' : 'Guardar'}
              </button>
            </div>
          )}

          {existingUrl && !showLink && (
            <p className="mt-3 font-dm text-xs text-gray-400">
              Media kit guardado: <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="text-go-orange hover:underline">{existingUrl.length > 50 ? existingUrl.slice(0, 50) + '...' : existingUrl}</a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
