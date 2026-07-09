import Link from 'next/link'
import { Suspense } from 'react'
import { LayoutDashboard, Search, Bell, Settings, CreditCard, LogOut, Bookmark } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Áttekintés', icon: LayoutDashboard },
  { href: '/dashboard/grants', label: 'Pályázatok', icon: Search },
  { href: '/dashboard/saved', label: 'Mentett', icon: Bookmark },
  { href: '/dashboard/alerts', label: 'Értesítések', icon: Bell },
  { href: '/dashboard/billing', label: 'Előfizetés', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Beállítások', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="noise min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col"
        style={{ background: 'var(--gr-bg-raised)', borderRight: '1px solid var(--gr-border)' }}>
        <div className="p-5">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="w-5 h-5 rounded-sm" style={{ background: 'var(--gr-gold)' }} />
            <span className="text-xs font-bold tracking-tight">GRANTRADAR</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="nav-item">
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--gr-border)' }}>
          <form action={signOut}>
            <button type="submit" className="nav-item w-full text-left" style={{ color: 'var(--gr-text-3)' }}>
              <LogOut className="w-4 h-4" />
              Kilépés
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
      </main>
    </div>
  )
}
