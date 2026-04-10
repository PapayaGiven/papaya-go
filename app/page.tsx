'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkEmail, verifyAccessCode, createAuthAndLogin } from '@/app/admin/actions'

type Step = 'email' | 'password' | 'access-code' | 'create-password'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await checkEmail(email)
    if (result.error) { setError(result.error); setLoading(false); return }
    if (result.hasAuth) {
      setStep('password')
    } else {
      setStep('access-code')
    }
    setLoading(false)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError('Contraseña incorrecta.'); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Error al iniciar sesión. Intenta de nuevo.'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleAccessCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await verifyAccessCode(email, accessCode)
    if (result.error) { setError(result.error); setLoading(false); return }
    setStep('create-password')
    setLoading(false)
  }

  async function handleCreatePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); setLoading(false); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setLoading(false); return }
    const createResult = await createAuthAndLogin(email, password)
    if (createResult.error) { setError(createResult.error); setLoading(false); return }
    await new Promise(resolve => setTimeout(resolve, 500))
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Error al iniciar sesión. Intenta de nuevo.'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  function getSubtitle() {
    switch (step) {
      case 'email': return 'Ingresa tu email para continuar'
      case 'password': return 'Ingresa tu contraseña'
      case 'access-code': return 'Ingresa tu código de acceso'
      case 'create-password': return 'Crea tu contraseña para comenzar'
    }
  }

  function goBack() {
    setError(null)
    setPassword('')
    setConfirmPassword('')
    setAccessCode('')
    setStep('email')
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
              {getSubtitle()}
            </p>
          </div>

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-dm text-gray-500 mb-1.5">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" className="input-field" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-sm font-dm text-red-600">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2">
                {loading ? 'Verificando...' : 'Continuar →'}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="bg-go-light rounded-xl px-4 py-3 mb-2">
                <p className="font-dm text-xs text-gray-400">Entrando como</p>
                <p className="font-dm text-sm font-semibold text-go-dark">{email}</p>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-dm text-gray-500 mb-1.5">Contraseña</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" className="input-field" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-sm font-dm text-red-600">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2">
                {loading ? 'Entrando...' : 'Iniciar sesión →'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-center font-dm text-xs text-gray-400 hover:text-go-orange transition mt-1">
                ← Volver
              </button>
            </form>
          )}

          {step === 'access-code' && (
            <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
              <div className="bg-go-light rounded-xl px-4 py-3 mb-2">
                <p className="font-dm text-xs text-gray-400">Entrando como</p>
                <p className="font-dm text-sm font-semibold text-go-dark">{email}</p>
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
                {loading ? 'Verificando...' : 'Verificar →'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-center font-dm text-xs text-gray-400 hover:text-go-orange transition mt-1">
                ← Volver
              </button>
            </form>
          )}

          {step === 'create-password' && (
            <form onSubmit={handleCreatePasswordSubmit} className="space-y-4">
              <div className="bg-go-light rounded-xl px-4 py-3 mb-2">
                <p className="font-dm text-xs text-gray-400">Entrando como</p>
                <p className="font-dm text-sm font-semibold text-go-dark">{email}</p>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-dm text-gray-500 mb-1.5">Crea tu contraseña</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" className="input-field" />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-dm text-gray-500 mb-1.5">Confirma tu contraseña</label>
                <input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repetir contraseña" className="input-field" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-sm font-dm text-red-600">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60 mt-2">
                {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
              </button>
              <button type="button" onClick={goBack} className="w-full text-center font-dm text-xs text-gray-400 hover:text-go-orange transition mt-1">
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
