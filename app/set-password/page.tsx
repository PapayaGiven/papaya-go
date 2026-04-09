'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function SetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [exchanging, setExchanging] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const resolved = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    const hashStr = window.location.hash

    function done(ready: boolean, err?: string) {
      if (resolved.current) return
      resolved.current = true
      if (err) setError(err)
      setSessionReady(ready)
      setExchanging(false)
    }

    // Listen for auth state changes (catches hash fragment auto-processing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        done(true)
      }
    })

    async function handleToken() {
      const tokenHash = searchParams.get('token_hash')
      const token = searchParams.get('token')
      const type = searchParams.get('type')
      const code = searchParams.get('code')

      // Format 1: ?token_hash=xxx&type=invite
      if (tokenHash && (type === 'invite' || type === 'email')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'invite',
        })
        if (error) done(false, `Enlace de invitación no válido: ${error.message}`)
        return
      }

      // Format 2: ?token=xxx&type=invite (legacy)
      if (token && (type === 'invite' || type === 'email')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'invite',
        })
        if (error) done(false, `Enlace de invitación no válido: ${error.message}`)
        return
      }

      // Format 3: #access_token=xxx&refresh_token=yyy (hash/implicit flow)
      if (hashStr && hashStr.includes('access_token')) {
        const hashParams = new URLSearchParams(hashStr.replace('#', ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) done(false, `No se pudo establecer la sesión: ${error.message}`)
          else if (data?.session) done(true)
        } else {
          done(false, 'Enlace de invitación incompleto. Pide una nueva invitación.')
        }
        return
      }

      // Format 4: ?code=xxx (PKCE)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) done(false, `Error en el intercambio de código: ${error.message}`)
        return
      }

      // Check existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) done(true)
      else done(false, 'No se encontró un enlace de invitación válido. Pide una nueva invitación.')
    }

    const startTimer = setTimeout(() => {
      if (!resolved.current) handleToken()
    }, 300)

    const timeout = setTimeout(() => {
      if (!resolved.current) done(false, 'La confirmación tardó demasiado. Intenta de nuevo.')
    }, 20000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(startTimer)
      clearTimeout(timeout)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Sesión expirada. Pide una nueva invitación.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(`Error: ${updateError.message}`)
      setLoading(false)
      return
    }

    // Check creator status
    const { data: creator } = await supabase
      .from('go_creators')
      .select('status')
      .eq('email', session.user.email!)
      .single()

    if (creator?.status === 'active') {
      router.push('/dashboard')
    } else {
      router.push('/pending')
    }
    router.refresh()
  }

  if (exchanging) {
    return (
      <div className="min-h-screen bg-go-light flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-go-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-dm text-sm text-gray-500">Confirmando invitación…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-go-light flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-go-border p-10">
          <div className="text-center mb-8">
            <img
              src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
              alt="Papaya GO"
              className="w-16 h-16 mx-auto mb-3"
            />
            <img
              src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/Papaya%20Go%20Logo.png"
              alt="Papaya GO"
              className="h-8 mx-auto object-contain mb-4"
            />
            <h1 className="font-syne font-bold text-2xl text-go-dark">
              {sessionReady ? '¡Bienvenida a Papaya GO!' : 'Error'}
            </h1>
            {sessionReady && (
              <p className="font-dm text-gray-500 mt-2 text-sm">
                Crea tu contraseña para comenzar.
              </p>
            )}
          </div>

          {/* Error state */}
          {!sessionReady && error && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm font-dm text-red-600">{error}</p>
              </div>
              <p className="text-center font-dm text-xs text-gray-400">
                Contacta a tu agencia para una nueva invitación.
              </p>
            </div>
          )}

          {/* Password form */}
          {sessionReady && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-dm font-medium text-gray-700 mb-1.5">
                  Crea tu contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-dm font-medium text-gray-700 mb-1.5">
                  Confirma tu contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repetir contraseña"
                  className="input-field"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-dm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2"
              >
                {loading ? 'Guardando...' : 'Crear contraseña →'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 font-dm mt-6">© 2025 Papaya GO · Todos los derechos reservados</p>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  )
}
