'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Check, Radar } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="noise min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--gr-gold-muted)' }}>
            <Check className="w-6 h-6" style={{ color: 'var(--gr-gold)' }} />
          </div>
          <h1 className="text-xl font-bold mb-2">Ellenőrizd az e-mailed</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--gr-text-2)' }}>
            Küldtünk egy megerősítő linket a <strong>{email}</strong> címre.
            Kattints rá a fiók aktiválásához.
          </p>
          <Link href="/login" className="btn-secondary">Vissza a belépéshez</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="noise min-h-screen flex">
      {/* Left — decorative */}
      <div className="hidden lg:flex flex-1 flex-col justify-between relative p-10"
        style={{ background: 'var(--gr-bg-raised)', borderRight: '1px solid var(--gr-border)' }}>
        <div className="absolute inset-0 grid-bg" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gr-primary)' }}>
              <Radar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--gr-text-primary)' }}>
              Grant<span style={{ color: 'var(--gr-primary-light)' }}>Radar</span>
            </span>
          </Link>
        </div>
        <div className="relative">
          <blockquote className="text-lg font-medium leading-relaxed mb-4" style={{ maxWidth: '380px' }}>
            "A GrantRadar nélkül lemaradtunk volna a GINOP pályázatról. Most már minden reggel van friss összefoglaló."
          </blockquote>
          <div className="text-sm font-medium">— Egy elégedett KKV-vezető</div>
          <div className="text-xs" style={{ color: 'var(--gr-text-3)' }}>Budapest</div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-12">
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gr-primary)' }}>
                <Radar className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--gr-text-primary)' }}>
                Grant<span style={{ color: 'var(--gr-primary-light)' }}>Radar</span>
              </span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold mb-1 tracking-tight">Fiók létrehozása</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--gr-text-2)' }}>
            Már van fiókod?{' '}
            <Link href="/login" className="no-underline font-medium" style={{ color: 'var(--gr-gold)' }}>Belépés</Link>
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input" placeholder="te@ceg.hu" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>Jelszó</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input" placeholder="Min. 6 karakter" required minLength={6} />
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--gr-red)' }}>{error}</p>}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Regisztráció <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-xs text-center" style={{ color: 'var(--gr-text-3)' }}>
              Ingyenes csomag. Bankkártya nem szükséges.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
