'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Radar } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Hibás e-mail cím vagy jelszó.')
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="noise min-h-screen flex">
      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2.5 no-underline mb-12">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gr-primary)' }}>
              <Radar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--gr-text-primary)' }}>
              Grant<span style={{ color: 'var(--gr-primary-light)' }}>Radar</span>
            </span>
          </Link>

          <h1 className="text-2xl font-bold mb-1 tracking-tight">Bejelentkezés</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--gr-text-2)' }}>
            Még nincs fiókod?{' '}
            <Link href="/register" className="no-underline font-medium" style={{ color: 'var(--gr-gold)' }}>Regisztráció</Link>
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input" placeholder="te@ceg.hu" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>Jelszó</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input" placeholder="••••••••" required />
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--gr-red)' }}>{error}</p>}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Belépés <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </div>

      {/* Right — decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative"
        style={{ background: 'var(--gr-bg-raised)', borderLeft: '1px solid var(--gr-border)' }}>
        <div className="absolute inset-0 grid-bg" />
        <div className="relative text-center px-12">
          <div className="text-6xl font-bold mb-4" style={{ color: 'var(--gr-gold)', letterSpacing: '-0.04em' }}>14</div>
          <div className="text-sm font-medium mb-1">forrásból gyűjtjük</div>
          <div className="text-xs" style={{ color: 'var(--gr-text-3)' }}>a pályázati lehetőségeket</div>
        </div>
      </div>
    </div>
  )
}
