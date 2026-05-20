'use client'

import { useEffect, useState } from 'react'

interface Props {
  monthName: string
  videosThisMonth: number
  videosRequired: number
  gmvThisMonth: number
  gmvRequired: number
  accThisMonth: number
  ttdThisMonth: number
  daysRemaining: number
}

const CIRC = 2 * Math.PI * 44 // ≈ 276.46

function formatMoney(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return `$${Math.round(n).toLocaleString()}`
}

function Ring({
  pct,
  color,
}: { pct: number; color: string }) {
  // pct is 0..1
  const offset = CIRC - pct * CIRC
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="block">
      <circle
        cx="55"
        cy="55"
        r="44"
        fill="none"
        stroke="var(--color-border-tertiary, rgba(26,8,0,0.08))"
        strokeWidth="10"
      />
      <circle
        cx="55"
        cy="55"
        r="44"
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s' }}
      />
    </svg>
  )
}

export default function ProgressRings({
  monthName,
  videosThisMonth,
  videosRequired,
  gmvThisMonth,
  gmvRequired,
  accThisMonth,
  ttdThisMonth,
  daysRemaining,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Explorer (nivel 1) has no GMV goal — gmvRequired comes back as 0
  // from go_nivel_requirements. We skip the GMV ring entirely in that
  // case so the layout doesn't show an empty/100% ring that would be
  // misleading, and we don't factor a non-existent goal into the
  // motivational line / "both complete" check.
  const hasGmvGoal = gmvRequired > 0

  const videosTarget = Math.max(videosRequired, 1)
  const gmvTarget = Math.max(gmvRequired, 1)
  const videosPct = Math.min(videosThisMonth / videosTarget, 1)
  const gmvPct = Math.min(gmvThisMonth / gmvTarget, 1)
  const videosComplete = videosPct >= 1
  const gmvComplete = gmvPct >= 1
  const bothComplete = hasGmvGoal ? videosComplete && gmvComplete : videosComplete

  // Animated values: 0 until mounted, then real values
  const animatedVideosPct = mounted ? videosPct : 0
  const animatedGmvPct = mounted ? gmvPct : 0

  const videosRemaining = Math.max(videosRequired - videosThisMonth, 0)
  const gmvRemaining = Math.max(gmvRequired - gmvThisMonth, 0)

  const lowerPct = hasGmvGoal ? Math.min(videosPct, gmvPct) : videosPct
  let motivationLine = ''
  let motivationGreen = false
  if (bothComplete) {
    motivationLine = '¡META CUMPLIDA! Eres una máquina 🎉'
    motivationGreen = true
  } else if (lowerPct === 0) {
    motivationLine = '¡Empieza hoy! Cada video cuenta 🧡'
  } else if (lowerPct < 0.34) {
    motivationLine = '¡Buen comienzo! Sigue así 🔥'
  } else if (lowerPct < 0.67) {
    motivationLine = '¡Vas a la mitad! No pares ahora ⭐'
  } else {
    motivationLine = '¡Casi lo logras! Un último empujón 👑'
  }

  const videosColor = videosComplete ? '#2a9d4a' : '#ff7700'
  const gmvColor = gmvComplete ? '#2a9d4a' : '#ff7700'

  return (
    <div
      className="bg-white"
      style={{
        border: '1px solid rgba(255,119,0,0.12)',
        borderRadius: 20,
        padding: 24,
      }}
    >
      <h2 className="font-syne font-bold text-base text-[#1a0800] mb-5">
        📊 Tu meta de {monthName}
      </h2>

      {/* Rings — two when there's a GMV goal, single (Explorer) when not. */}
      <div className={hasGmvGoal ? 'grid grid-cols-2 gap-4' : 'flex justify-center'}>
        {/* Videos */}
        <div className="flex flex-col items-center text-center">
          <div className="relative" style={{ width: 110, height: 110 }}>
            <Ring pct={animatedVideosPct} color={videosColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontSize: 18, fontWeight: 500 }} className="text-[#1a0800] font-syne leading-none">
                {videosThisMonth}
              </span>
              <span style={{ fontSize: 11 }} className="text-[#1a0800]/40 font-dm mt-1">
                de {videosRequired}
              </span>
            </div>
          </div>
          <p className="mt-2 font-dm text-[#1a0800]" style={{ fontSize: 13, fontWeight: 500 }}>
            Videos
          </p>
          {videosComplete ? (
            <p className="font-dm text-xs mt-1" style={{ color: '#2a9d4a' }}>
              ✅ Meta cumplida!
            </p>
          ) : (
            <p className="font-dm text-xs text-[#1a0800]/50 mt-1">
              Te faltan {videosRemaining} videos
            </p>
          )}
        </div>

        {/* GMV — only when the creator's nivel has a GMV goal. */}
        {hasGmvGoal && (
          <div className="flex flex-col items-center text-center">
            <div className="relative" style={{ width: 110, height: 110 }}>
              <Ring pct={animatedGmvPct} color={gmvColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontSize: 18, fontWeight: 500 }} className="text-[#1a0800] font-syne leading-none">
                  {formatMoney(gmvThisMonth)}
                </span>
                <span style={{ fontSize: 11 }} className="text-[#1a0800]/40 font-dm mt-1">
                  de {formatMoney(gmvRequired)}
                </span>
              </div>
            </div>
            <p className="mt-2 font-dm text-[#1a0800]" style={{ fontSize: 13, fontWeight: 500 }}>
              GMV
            </p>
            {gmvComplete ? (
              <p className="font-dm text-xs mt-1" style={{ color: '#2a9d4a' }}>
                ✅ Meta cumplida!
              </p>
            ) : (
              <p className="font-dm text-xs text-[#1a0800]/50 mt-1">
                Te faltan {formatMoney(gmvRemaining)}
              </p>
            )}
          </div>
        )}
      </div>
      {!hasGmvGoal && (
        <p className="font-dm text-xs text-[#1a0800]/40 text-center mt-3">
          Sin meta de GMV en este nivel — concéntrate en los videos 🎬
        </p>
      )}

      {/* Pills row */}
      <div className="flex flex-wrap gap-2 mt-5 justify-center">
        <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff7700]/10 text-[#ff7700]">
          {accThisMonth} ACC
        </span>
        <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff9ece]/20 text-pink-700">
          {ttdThisMonth} TTD
        </span>
        <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
          {daysRemaining} días restantes
        </span>
      </div>

      {/* Motivational line */}
      <p
        className="font-dm text-sm font-semibold text-center mt-4"
        style={{ color: motivationGreen ? '#2a9d4a' : '#1a0800' }}
      >
        {motivationLine}
      </p>
    </div>
  )
}
