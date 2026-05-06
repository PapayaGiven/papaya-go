'use client'

import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { LevelUpEvent, NIVEL_NAMES, NIVEL_EMOJIS } from '@/lib/types'

interface Props {
  events: LevelUpEvent[]
  rewardsByNivel: Record<number, string[]>
}

export default function LevelUpPopup({ events, rewardsByNivel }: Props) {
  // The first non-dismissed event we find is the one we show. Newer-first.
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  useEffect(() => {
    if (events.length === 0) return
    const sorted = [...events].sort((a, b) => b.leveled_up_at.localeCompare(a.leveled_up_at))
    const next = sorted.findIndex((e) => {
      try {
        return localStorage.getItem(`levelup_dismissed_${e.id}`) !== 'true'
      } catch {
        return true // localStorage blocked → still show once
      }
    })
    if (next >= 0) {
      const eventId = sorted[next].id
      // Find original index for stable reference
      const origIdx = events.findIndex((e) => e.id === eventId)
      setActiveIndex(origIdx)
    }
  }, [events])

  useEffect(() => {
    if (activeIndex < 0) return
    // Quick burst on mount
    const fire = () => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.4 }, colors: ['#ff7700', '#ff9ece', '#ffa552', '#fff8f2'] })
    }
    fire()
    const t = setTimeout(fire, 350)
    return () => clearTimeout(t)
  }, [activeIndex])

  if (activeIndex < 0) return null
  const event = events[activeIndex]
  if (!event) return null

  const fromName = NIVEL_NAMES[event.from_nivel] ?? `Nivel ${event.from_nivel}`
  const toName = NIVEL_NAMES[event.to_nivel] ?? `Nivel ${event.to_nivel}`
  const toEmoji = NIVEL_EMOJIS[event.to_nivel] ?? '🎉'
  const rewards = rewardsByNivel[event.to_nivel] ?? []

  function dismiss() {
    try {
      localStorage.setItem(`levelup_dismissed_${event.id}`, 'true')
    } catch {
      // Ignore — popup will show once next visit if storage is blocked.
    }
    setActiveIndex(-1)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center px-4" onClick={dismiss}>
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
          alt=""
          className="w-24 h-24 mx-auto mb-4"
        />
        <h1 className="font-syne font-bold text-3xl text-go-dark mb-2 leading-tight">
          ¡SUBISTE DE NIVEL! 🎉
        </h1>
        <p className="font-dm text-base text-go-dark/70 mb-1">
          De <strong className="text-go-dark">{fromName}</strong> a <strong className="text-go-orange">{toName} {toEmoji}</strong>
        </p>
        {event.carry_total > 0 && (
          <p className="font-dm text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mt-4">
            ¡Y tus <strong>{event.carry_total} videos extra</strong> ya cuentan para tu nuevo nivel!
          </p>
        )}
        {rewards.length > 0 && (
          <div className="mt-5 text-left bg-go-light/50 rounded-2xl border border-go-border p-4">
            <p className="font-dm text-xs font-bold text-go-dark/60 uppercase tracking-wide mb-2">Ahora puedes pedir</p>
            <ul className="space-y-1">
              {rewards.map((r, i) => (
                <li key={i} className="font-dm text-sm text-go-dark">🎁 {r}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={dismiss}
          className="mt-6 w-full bg-go-orange hover:bg-go-orange/90 text-white font-dm font-bold text-base py-3 rounded-xl transition"
        >
          ¡A seguir creando! 🧡
        </button>
      </div>
    </div>
  )
}
