'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('type=invite')) {
      router.replace('/auth/confirm' + hash)
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-go-light flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-go-border p-10">
          <div className="text-center mb-8">
            <p className="text-5xl mb-4">🧳</p>
            <h1 className="font-syne font-extrabold text-3xl text-go-dark">Papaya GO</h1>
            <p className="font-dm text-gray-500 mt-2 text-sm">Inicia sesión para acceder a tu portal</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-dm font-medium text-gray-700 mb-1.5">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" className="input-field" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-dm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input-field" />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm font-dm text-red-600">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2">
              {loading ? 'Entrando...' : 'Iniciar sesión →'}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 font-dm mt-6">
            ¿No tienes cuenta? Tu agencia te enviará una invitación.
          </p>
        </div>
        <p className="text-center text-xs text-gray-400 font-dm mt-6">© 2025 Papaya GO · Todos los derechos reservados</p>
      </div>
    </div>
  )
}
