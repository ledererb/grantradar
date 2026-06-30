import Link from 'next/link'
import { Radar, ArrowRight } from 'lucide-react'

/**
 * Shared public navbar used on all non-dashboard pages.
 * Glass-effect fixed bar with logo and auth CTAs.
 */
export function PublicNav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--gr-glass-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--gr-primary)' }}
          >
            <Radar className="w-5 h-5 text-white" />
          </div>
          <span
            className="text-lg font-bold"
            style={{ color: 'var(--gr-text-primary)' }}
          >
            Grant
            <span style={{ color: 'var(--gr-primary-light)' }}>Radar</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/grants" className="text-sm font-medium no-underline" style={{ color: 'var(--gr-text-secondary)' }}>
            Pályázatok
          </Link>
          <Link href="/pricing" className="text-sm font-medium no-underline" style={{ color: 'var(--gr-text-secondary)' }}>
            Árak
          </Link>
          <Link href="/login" className="btn-secondary text-sm">
            Bejelentkezés
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Ingyenes próba
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </nav>
  )
}

/**
 * Shared public footer used on all non-dashboard pages.
 */
export function PublicFooter() {
  return (
    <footer
      className="py-8 px-6"
      style={{ borderTop: '1px solid var(--gr-glass-border)' }}
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'var(--gr-primary)' }}
          >
            <Radar className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--gr-text-primary)' }}>
            Grant<span style={{ color: 'var(--gr-primary-light)' }}>Radar</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/impresszum"
            className="text-xs no-underline"
            style={{ color: 'var(--gr-text-muted)' }}
          >
            Impresszum
          </Link>
          <Link
            href="/adatkezeles"
            className="text-xs no-underline"
            style={{ color: 'var(--gr-text-muted)' }}
          >
            Adatkezelés
          </Link>
          <span className="text-xs" style={{ color: 'var(--gr-text-muted)' }}>
            © {new Date().getFullYear()} GrantRadar
          </span>
        </div>
      </div>
    </footer>
  )
}
