import Link from 'next/link'
import { Suspense } from 'react'
import { LayoutDashboard, Search, Bell, Settings, CreditCard, LogOut, Bookmark, Radar } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { ThemeToggle } from '@/components/ThemeToggle'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Áttekintés', icon: LayoutDashboard },
  { href: '/dashboard/grants', label: 'Pályázatok', icon: Search },
  { href: '/dashboard/saved', label: 'Mentett', icon: Bookmark },
  { href: '/dashboard/alerts', label: 'Értesítések', icon: Bell },
  { href: '/dashboard/billing', label: 'Előfizetés', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Cégprofil & Szűrők', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="noise min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside
        className="w-full md:w-60 shrink-0 flex flex-col"
        style={{ background: 'var(--gr-bg-raised)', borderRight: '1px solid var(--gr-border)' }}
      >
        <div className="p-5 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'var(--gr-primary)' }}
            >
              <Radar className="w-4 h-4" style={{ color: 'var(--gr-on-primary)' }} />
            </div>
            <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--gr-text)' }}>
              Grant<span style={{ color: 'var(--gr-primary)' }}>Radar</span>
            </span>
          </Link>
          <div className="md:hidden">
            <ThemeToggle variant="compact" />
          </div>
        </div>

        <nav className="flex-1 px-3 pb-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="nav-item whitespace-nowrap">
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          className="hidden md:flex flex-col gap-2 p-3"
          style={{ borderTop: '1px solid var(--gr-border)' }}
        >
          <div className="px-2 py-1 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--gr-text-3)' }}>
              Megjelenés
            </span>
            <ThemeToggle variant="compact" />
          </div>
          <form action={signOut}>
            <button type="submit" className="nav-item w-full text-left cursor-pointer" style={{ color: 'var(--gr-text-3)' }}>
              <LogOut className="w-4 h-4" />
              Kilépés
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
      </main>
    </div>
  )
}
