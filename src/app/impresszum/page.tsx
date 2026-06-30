import Link from 'next/link'
import { PublicNav, PublicFooter } from '@/components/public-nav'

export const metadata = {
  title: 'Impresszum — GrantRadar',
}

export default function ImpresszumPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--gr-bg-base)' }}>
      <PublicNav />

      <article className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-3xl font-bold mb-8">Impresszum</h1>

        <section className="space-y-6 text-sm leading-relaxed" style={{ color: 'var(--gr-text-secondary)' }}>
          <div>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--gr-text-primary)' }}>Szolgáltató adatai</h2>
            <p>
              <strong>Név:</strong> GrantRadar<br />
              <strong>Székhely:</strong> Magyarország<br />
              <strong>E-mail:</strong> hello@grantradar.hu<br />
              <strong>Weboldal:</strong> https://grantradar-alpha.vercel.app
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--gr-text-primary)' }}>Tárhelyszolgáltató</h2>
            <p>
              <strong>Név:</strong> Vercel Inc.<br />
              <strong>Cím:</strong> 440 N Barranca Ave #4133, Covina, CA 91723, USA<br />
              <strong>Weboldal:</strong> https://vercel.com
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--gr-text-primary)' }}>Adatbázis</h2>
            <p>
              <strong>Szolgáltató:</strong> Supabase Inc.<br />
              <strong>Székhely:</strong> San Francisco, CA, USA<br />
              <strong>Adatkezelési régió:</strong> EU-West-1 (Írország)
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--gr-text-primary)' }}>Fizetési szolgáltató</h2>
            <p>
              <strong>Név:</strong> Stripe, Inc.<br />
              <strong>Székhely:</strong> 354 Oyster Point Blvd, South San Francisco, CA 94080, USA<br />
              <strong>Weboldal:</strong> https://stripe.com
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--gr-text-primary)' }}>Szellemi tulajdon</h2>
            <p>
              A GrantRadar név, logó és az oldal tartalma szerzői jogi védelem alatt áll.
              Az oldalon megjelenő pályázati információk nyilvános forrásból származnak.
            </p>
          </div>
        </section>

        <div className="mt-12 pt-6 border-t" style={{ borderColor: 'var(--gr-glass-border)' }}>
          <Link href="/adatkezeles" className="text-sm no-underline" style={{ color: 'var(--gr-primary-light)' }}>
            Adatkezelési tájékoztató →
          </Link>
        </div>
      </article>

      <PublicFooter />
    </div>
  )
}
