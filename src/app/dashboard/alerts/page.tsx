import { Bell, Lock } from 'lucide-react'
import Link from 'next/link'
import { getCurrentUserPlan, planLimits } from '@/lib/plan-limits'

export default async function AlertsPage() {
  const { plan } = await getCurrentUserPlan()
  const alertsEnabled = planLimits(plan).alerts

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Értesítések</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Pályázati értesítések és figyelmeztetések
        </p>
      </div>

      {!alertsEnabled ? (
        <div className="card p-12 text-center">
          <Lock className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--gr-gold)' }} />
          <h3 className="font-semibold mb-2">Az értesítések PRO csomagot igényelnek</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--gr-text-3)', maxWidth: '400px', margin: '0 auto' }}>
            Az e-mail értesítések és határidő-figyelmeztetések a PRO csomag része.
            Válts PRO-ra, hogy sose maradj le egy fontos pályázatról sem.
          </p>
          <Link href="/pricing" className="btn-primary text-sm py-2 px-6 inline-flex">
            Váltás PRO csomagra
          </Link>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Bell className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--gr-text-3)' }} />
          <h3 className="font-semibold mb-2">Hamarosan elérhető</h3>
          <p className="text-sm" style={{ color: 'var(--gr-text-3)', maxWidth: '400px', margin: '0 auto' }}>
            Az e-mail értesítések beállítása hamarosan elérhető lesz.
            Állítsd be a szektoraidat és cégméreted a Beállításoknál, hogy releváns értesítéseket kapj.
          </p>
        </div>
      )}
    </div>
  )
}
