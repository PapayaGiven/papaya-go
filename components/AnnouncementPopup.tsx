'use client'

import { useState, useEffect } from 'react'
import type { Announcement } from '@/lib/types'

export default function AnnouncementPopup({ announcement }: { announcement: Announcement }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const key = `dismissed_announcement_${announcement.id}`
    if (!localStorage.getItem(key)) {
      setShow(true)
    }
  }, [announcement.id])

  function dismiss() {
    localStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.2)] shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"
        >
          ✕
        </button>
        {announcement.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={announcement.image_url}
            alt=""
            className="w-full rounded-xl mb-4 max-h-48 object-cover"
          />
        )}
        <p className="font-dm text-sm text-go-dark leading-relaxed">{announcement.message}</p>
        <button
          onClick={dismiss}
          className="mt-4 w-full py-2.5 rounded-xl font-dm text-sm font-semibold text-white bg-go-orange hover:bg-go-orange/90 transition"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
