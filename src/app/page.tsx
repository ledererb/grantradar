import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Zap, Search, Bell, Shield, BarChart3, Globe2 } from 'lucide-react'
import { PublicNav, PublicFooter } from '@/components/public-nav'

const LIVE_SOURCES = [
  'palyazat.gov.hu', 'NKFIH', 'DIMOP Plusz', 'KAVOSZ', 'MFB',
  'HIPA', 'VOSZ Port', 'OFA', 'EU Funding Portal', 'EIC',
  'EUREKA', 'Enterprise Europe', 'Interreg', 'EIF/EIB',
]

export default function LandingPage() {
  return (
    <main className="noise min-h-screen">
      <PublicNav />

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg" />
        {/* Gold glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(232,185,49,0.06) 0%, transparent 70%)' }} />

        <div className="relative max-w-5xl mx-auto">
          <div className="slide-up mb-6">
            <span className="pill pill-gold">
              <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: 'var(--gr-gold)' }} />
              14 forrás · Valós idejű figyelés
            </span>
          </div>

          <h1 className="display slide-up slide-up-delay-1 mb-6" style={{ maxWidth: '900px' }}>
            Minden magyar
            <br />
            pályázat,{' '}
            <span style={{ color: 'var(--gr-gold)' }}>egy helyen.</span>
          </h1>

          <p className="text-lg leading-relaxed slide-up slide-up-delay-2 mb-10"
            style={{ color: 'var(--gr-text-2)', maxWidth: '520px' }}>
            AI-alapú pályázatfigyelő KKV-knak. Automatikus szkennelés,
            szemantikus keresés, azonnali értesítés — hogy ne maradj le soha.
          </p>

          <div className="flex flex-wrap gap-3 slide-up slide-up-delay-3">
            <Link href="/register" className="btn-primary text-base py-3 px-8">
              Ingyenes regisztráció
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/grants" className="btn-secondary text-base py-3 px-8">
              Pályázatok böngészése
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SOURCE MARQUEE ─── */}
      <section className="border-y overflow-hidden" style={{ borderColor: 'var(--gr-border)' }}>
        <div className="py-4 flex items-center whitespace-nowrap">
          <div className="marquee flex items-center gap-8 px-4">
            {[...LIVE_SOURCES, ...LIVE_SOURCES].map((src, i) => (
              <span key={i} className="text-xs font-medium flex items-center gap-2"
                style={{ color: 'var(--gr-text-3)' }}>
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--gr-green)' }} />
                {src}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — 3 big numbered steps ─── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-0 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--gr-border)' }}>
            {[
              {
                num: '01',
                title: 'Szkennelés',
                desc: '14 magyar és EU forrásból gyűjtjük a pályázatokat — automatikusan, minden nap.',
                icon: Search,
              },
              {
                num: '02',
                title: 'AI elemzés',
                desc: 'GPT-4o összefoglal, pontoz, szektorba sorol — hogy azonnal lásd, melyik releváns neked.',
                icon: Zap,
              },
              {
                num: '03',
                title: 'Értesítés',
                desc: 'Beállítod a szűrőidet, mi pedig e-mailben szólunk, amint releváns pályázat jelenik meg.',
                icon: Bell,
              },
            ].map((step, i) => (
              <div key={step.num} className="p-8 flex flex-col"
                style={{
                  background: 'var(--gr-bg-raised)',
                  borderRight: i < 2 ? '1px solid var(--gr-border)' : 'none',
                }}>
                <span className="mono text-xs font-bold mb-6" style={{ color: 'var(--gr-gold)' }}>
                  {step.num}
                </span>
                <step.icon className="w-5 h-5 mb-4" style={{ color: 'var(--gr-text-3)' }} />
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES — Bold asymmetric layout ─── */}
      <section className="py-24 px-6" style={{ borderTop: '1px solid var(--gr-border)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-16">
            <div>
              <span className="pill pill-muted mb-4 inline-flex">Képességek</span>
              <h2 className="headline">
                Nem csak lista.<br />
                <span style={{ color: 'var(--gr-gold)' }}>Pályázati radar.</span>
              </h2>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Search,
                title: 'Szemantikus keresés',
                desc: 'Írd le szavakkal, mire keresel — az AI megtalálja a releváns pályázatokat, még ha a cím nem is egyezik.',
                accent: true,
              },
              {
                icon: BarChart3,
                title: 'Nehézségi pontszám',
                desc: 'Minden pályázatot 1-10 skálán pontozunk — tudd előre, mekkora adminisztrációra számíts.',
                accent: false,
              },
              {
                icon: Globe2,
                title: '14 forrás, egy dashboard',
                desc: 'palyazat.gov.hu, NKFIH, EU Funding Portal, EIC Accelerator és még 10 forrás — mind egy helyen.',
                accent: false,
              },
              {
                icon: Shield,
                title: 'Nincs lemaradás',
                desc: 'E-mail értesítés az általad beállított szektorokra, cégméretekre és határidőkre.',
                accent: true,
              },
            ].map((feat) => (
              <div key={feat.title} className="card p-6 flex gap-4"
                style={feat.accent ? { borderColor: 'var(--gr-gold-dim)' } : {}}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: feat.accent ? 'var(--gr-gold-muted)' : 'var(--gr-bg-surface)' }}>
                  <feat.icon className="w-5 h-5" style={{ color: feat.accent ? 'var(--gr-gold)' : 'var(--gr-text-3)' }} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feat.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="border-y" style={{ borderColor: 'var(--gr-border)', background: 'var(--gr-bg-raised)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {[
            { value: '14', label: 'Forrás' },
            { value: '24/7', label: 'Figyelés' },
            { value: '<5 mp', label: 'AI elemzés' },
            { value: '0 Ft', label: 'Indulás' },
          ].map((stat, i) => (
            <div key={stat.label} className="py-8 px-6 text-center"
              style={{ borderRight: i < 3 ? '1px solid var(--gr-border)' : 'none' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--gr-gold)' }}>
                {stat.value}
              </div>
              <div className="text-xs font-medium" style={{ color: 'var(--gr-text-3)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="headline mb-4">
            Kezdj el pályázni.<br />
            <span style={{ color: 'var(--gr-gold)' }}>Most.</span>
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--gr-text-2)', maxWidth: '400px', margin: '0 auto' }}>
            Regisztrálj ingyen, és 2 percen belül megtalálod a vállalkozásodnak releváns pályázatokat.
          </p>
          <Link href="/register" className="btn-primary text-base py-3 px-10">
            Ingyenes regisztráció
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  )
}
