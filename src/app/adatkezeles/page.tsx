import Link from 'next/link'
import { PublicNav, PublicFooter } from '@/components/public-nav'

export const metadata = {
  title: 'Adatkezelési Tájékoztató — GrantRadar',
}

export default function AdatkezelesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--gr-bg-base)' }}>
      <PublicNav />

      <article className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-3xl font-bold mb-2">Adatkezelési Tájékoztató</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--gr-text-muted)' }}>
          Utolsó frissítés: 2026. április 30.
        </p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>1. Az adatkezelő</h2>
            <p>
              Az adatkezelő a GrantRadar (a továbbiakban: &ldquo;Szolgáltató&rdquo;), elérhetősége: hello@grantradar.hu
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>2. Kezelt adatok köre</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Regisztrációs adatok:</strong> e-mail cím, név (opcionális)</li>
              <li><strong>Cégprofil adatok:</strong> cégnév, adószám, cégméret, szektorpreferenciák</li>
              <li><strong>Használati adatok:</strong> mentett pályázatok, keresési előzmények</li>
              <li><strong>Számlázási adatok:</strong> a Stripe fizetési szolgáltatón keresztül kezelt adatok</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>3. Adatkezelés célja</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Felhasználói fiók létrehozása és kezelése</li>
              <li>Személyre szabott pályázati értesítések küldése</li>
              <li>Szolgáltatás fejlesztése és elemzés</li>
              <li>Számlázás és előfizetés-kezelés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>4. Adatkezelés jogalapja</h2>
            <p>
              Az adatkezelés jogalapja az Ön hozzájárulása (GDPR 6. cikk (1) bek. a) pont),
              valamint a szerződés teljesítése (GDPR 6. cikk (1) bek. b) pont).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>5. Adattovábbítás</h2>
            <p>A Szolgáltató az alábbi harmadik feleknek továbbít adatokat:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Supabase Inc.</strong> — Adatbázis (EU-West-1 régió, Írország)</li>
              <li><strong>Vercel Inc.</strong> — Tárhelyszolgáltató (Washington D.C. régió)</li>
              <li><strong>Stripe Inc.</strong> — Fizetési szolgáltató</li>
              <li><strong>OpenAI Inc.</strong> — AI szolgáltatások (pályázati összefoglalók)</li>
              <li><strong>Brevo (Sendinblue)</strong> — E-mail értesítések</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>6. Adatmegőrzés</h2>
            <p>
              Az adatokat a felhasználói fiók fennállásáig, illetve törlési kérelemig tároljuk.
              Számlázási adatokat a számviteli törvény szerint 8 évig megőrizzük.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>7. Az Ön jogai</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hozzáférés joga — tájékoztatás kérése a kezelt adatokról</li>
              <li>Helyesbítés joga — pontatlan adatok javítása</li>
              <li>Törlés joga (&ldquo;elfeledtetéshez való jog&rdquo;)</li>
              <li>Adathordozhatóság joga</li>
              <li>Tiltakozás joga</li>
              <li>Felügyeleti hatósághoz fordulás joga (NAIH)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>8. Cookie-k (Sütik)</h2>
            <p>
              A weboldal kizárólag működéshez szükséges sütiket használ (munkamenet-kezelés, hitelesítés).
              Nem használunk marketing vagy nyomkövető sütiket.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--gr-text)' }}>9. Kapcsolat</h2>
            <p>
              Adatvédelmi kérdéseivel forduljon hozzánk: <strong>hello@grantradar.hu</strong>
            </p>
            <p className="mt-2">
              Felügyeleti hatóság: Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)<br />
              Cím: 1055 Budapest, Falk Miksa utca 9-11.<br />
              Weboldal: <a href="https://www.naih.hu" className="underline" style={{ color: 'var(--gr-gold)' }}>www.naih.hu</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t" style={{ borderColor: 'var(--gr-glass-border)' }}>
          <Link href="/impresszum" className="text-sm no-underline" style={{ color: 'var(--gr-primary-light)' }}>
            ← Impresszum
          </Link>
        </div>
      </article>

      <PublicFooter />
    </div>
  )
}
