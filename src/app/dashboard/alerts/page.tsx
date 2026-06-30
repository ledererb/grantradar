import { Bell } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Értesítések</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Pályázati értesítések és figyelmeztetések
        </p>
      </div>

      <div className="card p-12 text-center">
        <Bell className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--gr-text-3)' }} />
        <h3 className="font-semibold mb-2">Hamarosan elérhető</h3>
        <p className="text-sm" style={{ color: 'var(--gr-text-3)', maxWidth: '400px', margin: '0 auto' }}>
          Az e-mail értesítések beállítása hamarosan elérhető lesz.
          Állítsd be a szektoraidat és cégméreted a Beállításoknál, hogy releváns értesítéseket kapj.
        </p>
      </div>
    </div>
  )
}
