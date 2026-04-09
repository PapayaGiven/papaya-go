'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { verifyAccessCode, createAuthAndLogin } from '@/app/admin/actions'

export default function LoginPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await verifyAccessCode(email, accessCode)
    if (result.error) { setError(result.error); setLoading(false); return }
    setIsNewUser(!result.hasAuthAccount)
    setStep(2)
    setLoading(false)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    if (isNewUser) {
      if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); setLoading(false); return }
      if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setLoading(false); return }
      const createResult = await createAuthAndLogin(email, password)
      if (createResult.error) { setError(createResult.error); setLoading(false); return }
      await new Promise(resolve => setTimeout(resolve, 500))
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); setLoading(false); return }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError('Contraseña incorrecta.'); setLoading(false); return }
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Error al iniciar sesión. Intenta de nuevo.'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-go-light flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background sun watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-lightOrange.png"
        alt=""
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.04] pointer-events-none select-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-sm border border-[rgba(255,119,0,0.12)] p-10">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
              alt=""
              className="w-20 h-20 mx-auto mb-3"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/Papaya%20Go%20Logo.png"
              alt="Papaya GO"
              className="h-9 mx-auto object-contain"
            />
            <p className="font-dm text-gray-400 mt-3 text-sm">
              {step === 1 ? 'Ingresa tu email y código de acceso' : isNewUser ? 'Crea tu contraseña para comenzar' : 'Ingresa tu contraseña'}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-dm text-gray-500 mb-1.5">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" className="input-field" />
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-dm text-gray-500 mb-1.5">Código de acceso</label>
                <input
                  id="code" type="text" value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  required placeholder="Ej: PAP7X2" maxLength={6}
                  className="input-field uppercase tracking-[0.3em] text-center font-semibold text-lg"
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-sm font-dm text-red-600">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2">
                {loading ? 'Verificando...' : 'Continuar →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="bg-go-light rounded-xl px-4 py-3 mb-2">
                <p className="font-dm text-xs text-gray-400">Entrando como</p>
                <p className="font-dm text-sm font-semibold text-go-dark">{email}</p>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-dm text-gray-500 mb-1.5">
                  {isNewUser ? 'Crea tu contraseña' : 'Contraseña'}
                </label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder={isNewUser ? 'Mínimo 8 caracteres' : '••••••••'} className="input-field" />
              </div>
              {isNewUser && (
                <div>
                  <label htmlFor="confirm" className="block text-sm font-dm text-gray-500 mb-1.5">Confirma tu contraseña</label>
                  <input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repetir contraseña" className="input-field" />
                </div>
              )}
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-sm font-dm text-red-600">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2">
                {loading ? (isNewUser ? 'Creando cuenta...' : 'Entrando...') : (isNewUser ? 'Crear cuenta →' : 'Iniciar sesión →')}
              </button>
              <button type="button" onClick={() => { setStep(1); setError(null); setPassword(''); setConfirmPassword('') }} className="w-full text-center font-dm text-xs text-gray-400 hover:text-go-orange transition mt-1">
                ← Volver
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400 font-dm mt-6">
            ¿No tienes código? Pídelo a tu agencia.
          </p>
        </div>
        <p className="text-center text-xs text-gray-300 font-dm mt-6">© 2025 Papaya GO</p>
      </div>
    </div>
  )
}
