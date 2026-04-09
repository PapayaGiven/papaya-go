'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NIVEL_NAMES, NIVEL_COLORS } from '@/lib/types'

interface SidebarProps {
  creatorName: string | null
  tiktokHandle: string | null
  nivel: number
}

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/estrategia', icon: '🎯', label: 'Mi Estrategia' },
  { href: '/ai-coach', icon: '✨', label: 'AI Coach' },
  { href: '/pois', icon: '📍', label: 'Hoteles & Atracciones' },
  { href: '/niveles', icon: '⭐', label: 'Niveles' },
]

export default function Sidebar({ creatorName, tiktokHandle, nivel }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const nivelColor = NIVEL_COLORS[nivel] ?? NIVEL_COLORS[1]

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navContent = (
    <>
      <div className="p-5 border-b border-go-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🧳</span>
          <span className="font-syne font-extrabold text-lg text-go-dark">Papaya GO</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-dm text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-go-orange text-white'
                  : 'text-gray-600 hover:bg-go-orange/5 hover:text-go-orange'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-go-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-go-orange/10 flex items-center justify-center text-sm font-syne font-bold text-go-orange">
            {(creatorName ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-dm text-sm font-semibold text-go-dark truncate">{creatorName ?? 'Creator'}</p>
            {tiktokHandle && <p className="font-dm text-xs text-gray-400 truncate">@{tiktokHandle}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-dm text-xs font-bold px-2.5 py-1 rounded-full ${nivelColor.bg} ${nivelColor.text}`}>
            Nivel {nivel} · {NIVEL_NAMES[nivel] ?? 'Explorer'}
          </span>
          <button onClick={handleSignOut} disabled={signingOut} className="font-dm text-xs text-gray-400 hover:text-go-orange transition">
            {signingOut ? '...' : 'Salir'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] bg-white border-r border-go-border flex-col z-40">
        {navContent}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-go-border z-40 flex">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-dm transition-colors ${
                isActive ? 'text-go-orange' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="truncate text-[10px]">{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
