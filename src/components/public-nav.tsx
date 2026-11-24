import Link from 'next/link'
import { Radar, ArrowRight } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

/**
 * Shared public navbar used on all non-dashboard pages.
 * Always keeps "Ingyenes regisztráció" visible and easy to reach.
 */
export function PublicNav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'var(--gr-nav-bg)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--gr-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--gr-primary)' }}
          >
            <Radar className="w-5 h-5" style={{ color: 'var(--gr-on-primary)' }} />
          </div>
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: 'var(--gr-text)' }}
          >
            Grant
            <span style={{ color: 'var(--gr-primary)' }}>Radar</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-6">
          <Link href="/#eloszuro" className="text-sm font-medium no-underline" style={{ color: 'var(--gr-text-2)' }}>
            Előszűrés
          </Link>
          <Link href="/grants" className="text-sm font-medium no-underline" style={{ color: 'var(--gr-text-2)' }}>
            Pályázatok
          </Link>
          <Link href="/pricing" className="text-sm font-medium no-underline" style={{ color: 'var(--gr-text-2)' }}>
            Árak
          </Link>
          <Link href="/#gyik" className="text-sm font-medium no-underline" style={{ color: 'var(--gr-text-2)' }}>
            GYIK
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <ThemeToggle variant="compact" />
          <Link
            href="/login"
            className="text-xs sm:text-sm font-semibold no-underline px-2 py-2 rounded-lg whitespace-nowrap"
            style={{ color: 'var(--gr-text-2)' }}
          >
            Bejelentkezés
          </Link>
          <Link
            href="/register"
            className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 whitespace-nowrap shrink-0"
          >
            <span>Ingyenes regisztráció</span>
            <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
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
      className="py-10 px-6"
      style={{
        borderTop: '1px solid var(--gr-border)',
        background: 'var(--gr-bg-raised)',
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'var(--gr-primary)' }}
          >
            <Radar className="w-4 h-4" style={{ color: 'var(--gr-on-primary)' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--gr-text)' }}>
            Grant<span style={{ color: 'var(--gr-primary)' }}>Radar</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/grants" className="text-xs font-medium no-underline" style={{ color: 'var(--gr-text-2)' }}>
            Pályázatok
          </Link>
          <Link href="/pricing" className="text-xs font-medium no-underline" style={{ color: 'var(--gr-text-2)' }}>
            Árak
          </Link>
          <Link href="/register" className="text-xs font-semibold no-underline" style={{ color: 'var(--gr-primary)' }}>
            Ingyenes regisztráció
          </Link>
          <Link
            href="/impresszum"
            className="text-xs no-underline"
            style={{ color: 'var(--gr-text-3)' }}
          >
            Impresszum
          </Link>
          <Link
            href="/adatkezeles"
            className="text-xs no-underline"
            style={{ color: 'var(--gr-text-3)' }}
          >
            Adatkezelés
          </Link>
          <span className="text-xs" style={{ color: 'var(--gr-text-3)' }}>
            © {new Date().getFullYear()} GrantRadar
          </span>
        </div>
      </div>
    </footer>
  )
}
