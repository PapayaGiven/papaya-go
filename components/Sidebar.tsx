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
  { href: '/ai-coach', icon: '🎬', label: 'Crea tu Video' },
  { href: '/papaya-visit', icon: '🌺', label: 'Papaya Visit' },
  { href: '/inspiracion', icon: '🔥', label: 'Inspiración' },
  { href: '/niveles', icon: '⭐', label: 'Niveles' },
]

const MOBILE_NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/ai-coach', icon: '🎬', label: 'Video' },
  { href: '/papaya-visit', icon: '🌺', label: 'Visit' },
  { href: '/inspiracion', icon: '🔥', label: 'Inspo' },
  { href: '/niveles', icon: '⭐', label: 'Niveles' },
]

export default function Sidebar({ creatorName, tiktokHandle, nivel }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        <Link href="/dashboard" className="flex flex-col items-start gap-2">
          <img
            src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-lightOrange.png"
            alt=""
            className="w-6 h-6 object-contain"
          />
          <img
            src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/Papaya%20Go%20Logo.png"
            alt="Papaya GO"
            className="h-7 object-contain"
          />
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
              className={`flex items-center gap-3 px-4 py-3 font-dm text-sm transition-colors ${
                isActive
                  ? 'border-l-[3px] border-go-orange bg-[rgba(255,119,0,0.06)] text-go-dark'
                  : 'text-gray-500 hover:text-go-dark hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 mb-2">
        <a
          href="https://chat.whatsapp.com/IKy0BMc8ROl55Hm4r47C2Z?mode=gi_t"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white font-dm text-xs font-semibold hover:bg-[#20BD5A] transition w-full"
        >
          💬 Grupo de WhatsApp
        </a>
      </div>

      <div className="p-4 border-t border-go-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-go-orange/10 flex items-center justify-center text-sm font-syne font-bold text-go-orange">
            {(creatorName ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-dm text-sm text-go-dark truncate">{creatorName ?? 'Creator'}</p>
            {tiktokHandle && <p className="font-dm text-xs text-gray-400 truncate">@{tiktokHandle}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-dm text-xs font-bold px-2.5 py-1 rounded-full bg-go-orange/10 text-go-orange">
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-go-border z-40 flex overflow-x-auto safe-area-bottom">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-w-[60px] flex-shrink-0 flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-dm transition-colors ${
                isActive ? 'text-go-orange' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="truncate text-[10px]">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
