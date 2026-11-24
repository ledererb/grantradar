import Link from 'next/link'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { PublicNav, PublicFooter } from '@/components/public-nav'

export const metadata = { title: 'Értesítési leiratkozás — GrantRadar' }

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const isOk = params.status === 'ok'

  return (
    <main className="noise min-h-screen flex flex-col">
      <PublicNav />

      <div className="flex-1 flex items-center justify-center px-6 pt-24 pb-16">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          {isOk ? (
            <>
              <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: 'var(--gr-green)' }} />
              <h1 className="text-xl font-bold">Sikeresen leiratkoztál az e-mail értesítőkről</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                Több automatikus pályázati hírlevelet nem küldünk erre a fiókra. A Cégprofil beállításokban bármikor újra bekapcsolhatod a napi vagy heti értesítést.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-10 h-10 mx-auto" style={{ color: 'var(--gr-amber)' }} />
              <h1 className="text-xl font-bold">Érvénytelen vagy lejárt leiratkozó link</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                Jelentkezz be a fiókodba, és a Cégprofil &amp; Szűrők menüben bármikor egy kattintással kikapcsolhatod az e-mail értesítéseket.
              </p>
            </>
          )}

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/settings" className="btn-primary text-xs py-2.5 px-5">
              Értesítési beállítások
            </Link>
            <Link href="/" className="btn-secondary text-xs py-2.5 px-5">
              Vissza a főoldalra
            </Link>
          </div>
        </div>
      </div>

      <PublicFooter />
    </main>
  )
}
