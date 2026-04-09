'use client'

import { useState } from 'react'
import { adminLogin } from '@/app/admin/actions'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await adminLogin(password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, the page revalidates and the server component re-renders
  }

  return (
    <div className="min-h-screen bg-go-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-syne text-3xl font-bold text-white mb-2">
            Papaya <span className="text-go-orange">GO</span>
          </h1>
          <p className="text-white/50 font-dm text-sm">Admin Panel</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-xl border border-go-border"
        >
          <label className="block mb-2 text-sm font-dm font-medium text-go-dark">
            Contraseña de administrador
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-go-border bg-go-light font-dm text-go-dark placeholder:text-go-dark/30 focus:outline-none focus:ring-2 focus:ring-go-orange/40 focus:border-go-orange transition"
            required
          />

          {error && (
            <p className="mt-2 text-sm text-red-600 font-dm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full py-3 rounded-xl bg-go-orange text-white font-syne font-bold text-sm hover:bg-go-orange/90 disabled:opacity-50 transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
