import Link from 'next/link'
import {
  ArrowRight,
  Search,
  Bell,
  ShieldCheck,
  FileText,
  Users,
  Database,
  Building2,
  ClipboardCheck,
  ListChecks,
} from 'lucide-react'
import { PublicNav, PublicFooter } from '@/components/public-nav'
import { PublicPreScreener } from '@/components/PublicPreScreener'

const LIVE_SOURCES = [
  'palyazat.gov.hu (Széchenyi Terv Plusz)',
  'KAP (Agrár- és Vidékfejlesztés)',
  'DIMOP Plusz',
  'GINOP Plusz',
  'KAVOSZ (Széchenyi Kártya)',
  'MFB (Fejlesztési Bank)',
  'NKFIH (Innovációs Alap)',
  'HIPA',
  'Magyar Falu Program',
]

const FAQ_ITEMS = [
  {
    q: 'Kiknek készült a GrantRadar?',
    a: 'Magyar mikro-, kis- és középvállalkozásoknak, egyéni vállalkozóknak, mezőgazdasági őstermelőknek, valamint pályázatíró és könyvelő irodáknak. A célunk, hogy cégvezetőként vagy tanácsadóként ne kelljen több tucat portált és 80 oldalas felhívást végigböngészned, hanem percek alatt lásd, melyik támogatásra érdemes készülnöd.',
  },
  {
    q: 'Honnan származnak a pályázati adatok és milyen gyakran frissülnek?',
    a: 'A magyar pályázati adatbázis közvetlenül a hivatalos állami forrásokra (a palyazat.gov.hu hivatalos rendszerére, a kap.gov.hu portálra, az NKFIH, az MFB és a KAVOSZ oldalaira) épül. A szinkronizálás automatikusan fut, és a lejárt vagy felfüggesztett felhívások státuszát is frissíti, így nem keverednek össze a nyitott és a lezárult kiírások.',
  },
  {
    q: 'Hogyan működik a személyre szabás? Ha megadom a cégem adatait, hol látom a szűrt listát?',
    a: 'Az ingyenes regisztráció után a „Cégprofil & Szűrők” menüben (vagy már itt a főoldali előszűrőben) megadhatod a cégméretedet, telephelyedet, lezárt üzleti éveidet és ágazatodat. Ezután az „Áttekintés” főoldalon és a „Pályázatok” menüben a „Cégemre szabva” gombbal azonnal szűrheted azokat a nyitott pályázatokat, amelyekre potenciálisan jogosult lehetsz.',
  },
  {
    q: 'Hogyan működik az e-mail értesítő, milyen gyakran jön, és le tudok-e iratkozni?',
    a: 'A Pro és Agency csomagokban a Cégprofil beállításainál választhatsz napi értesítést (csak akkor küldünk e-mailt, ha új releváns pályázat nyílt vagy egy mentett pályázatod 14 napon belül lejár), heti hétfői összefoglalót, vagy teljes kikapcsolást. Minden e-mail alján megtalálod az 1-kattintásos leiratkozási és testreszabási linket is.',
  },
  {
    q: 'Magyar vagy angol nyelvű pályázatokat látok alapból?',
    a: 'Alapértelmezetten kizárólag a nyitott és hamarosan nyíló magyarországi pályázatokat mutatjuk fontossági sorrendben. Ha nemzetközi vagy közvetlen brüsszeli uniós pályázatokat is szeretnél látni, vagy egy korábban lezárult konstrukció feltételeire vagy kíváncsi, azt külön fülön egy kattintással bekapcsolhatod.',
  },
  {
    q: 'A feltüntetett árak nettó vagy bruttó összegek, és bármikor lemondhatom?',
    a: 'Az árazási oldalon forintban, egyértelműen feltüntetjük mind a nettó (+ ÁFA), mind a bruttó havi díjat (Pro: 11 900 Ft + ÁFA / hó, Agency: 39 900 Ft + ÁFA / hó). Nincs hűségidő: az előfizetésedet az Előfizetés menüben bármikor, egy kattintással lemondhatod.',
  },
]

export default function LandingPage() {
  return (
    <main className="noise min-h-screen">
      <PublicNav />

      {/* ─── HERO ─── */}
      <section className="relative pt-28 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 grid-bg pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="pill pill-blue">
              KKV-knak • Egyéni vállalkozóknak • Agrártermelőknek
            </span>
            <span className="pill pill-gold">
              Hivatalos magyar pályázati adatbázis
            </span>
          </div>

          <h1 className="display mb-5" style={{ maxWidth: '880px' }}>
            Találd meg a vállalkozásod számára elérhető támogatásokat –{' '}
            <span style={{ color: 'var(--gr-primary)' }}>egyszerűen, egyetlen felületen.</span>
          </h1>

          <p
            className="text-base sm:text-lg leading-relaxed mb-8"
            style={{ color: 'var(--gr-text-2)', maxWidth: '660px' }}
          >
            Összegyűjtjük a nyitott hazai pályázatokat (GINOP Plusz, DIMOP Plusz, KAP, Széchenyi Kártya, MFB, NKFIH), közérthetően összefoglaljuk a feltételeket, és 2 perc alatt megmutatjuk, melyikre jogosult a céged.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="#eloszuro" className="btn-primary text-base py-3.5 px-7">
              Rövid előszűrés indítása
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link href="/grants" className="btn-secondary text-base py-3.5 px-7">
              Aktuális magyar pályázatok
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SOURCE BAR ─── */}
      <section
        className="border-y overflow-hidden"
        style={{ borderColor: 'var(--gr-border)', background: 'var(--gr-bg-raised)' }}
      >
        <div className="py-3.5 flex items-center whitespace-nowrap">
          <div className="marquee flex items-center gap-8 px-4">
            {[...LIVE_SOURCES, ...LIVE_SOURCES].map((src, i) => (
              <span
                key={i}
                className="text-xs font-semibold flex items-center gap-2"
                style={{ color: 'var(--gr-text-2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gr-green)' }} />
                {src}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — 3-STEP FLOWCHART ─── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="pill pill-muted mb-3 inline-flex">Hogyan működik?</span>
            <h2 className="headline">Három egyszerű lépés az első beadható pályázatig</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {[
              {
                num: '1. lépés',
                title: 'Kitöltöd a céged adatait',
                desc: 'Megadod a cégformát, a lezárt üzleti éveket, a telephelyet és hogy mire keresel forrást (akár több célt egyszerre).',
                icon: Building2,
              },
              {
                num: '2. lépés',
                title: 'Elkészül az előszűrés és elemzés',
                desc: 'A rendszer összeveti a vállalkozásodat a pályázati feltételekkel, és jelzi az esetleges kizáró okokat vagy hiányzó iratokat.',
                icon: ClipboardCheck,
              },
              {
                num: '3. lépés',
                title: 'Megkapod a pályázati listádat',
                desc: 'Fontossági sorrendben látod a cégedre szabott nyitott lehetőségeket, elmentheted őket, és kérésre e-mailben is szólunk.',
                icon: ListChecks,
              },
            ].map((step, i) => (
              <div key={step.num} className="card p-6 flex flex-col relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="pill pill-blue">{step.num}</span>
                  {i < 2 && (
                    <ArrowRight
                      className="hidden md:block w-4 h-4"
                      style={{ color: 'var(--gr-text-3)' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'var(--gr-blue-bg)' }}
                >
                  <step.icon className="w-5 h-5" style={{ color: 'var(--gr-primary)' }} />
                </div>
                <h3 className="text-base font-bold mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE 2-MINUTE PRE-SCREENER ─── */}
      <section id="eloszuro" className="py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <PublicPreScreener />
        </div>
      </section>

      {/* ─── FEATURES (PLAIN HUNGARIAN, NO JARGON) ─── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <span className="pill pill-muted mb-3 inline-flex">Miért a GrantRadar?</span>
            <h2 className="headline">
              Átlátható rendszer vállalkozóknak,{' '}
              <span style={{ color: 'var(--gr-primary)' }}>szakzsargon nélkül.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: FileText,
                title: 'Közérthető összefoglalók 80 oldalas kiírások helyett',
                desc: 'Minden pályázatnál azonnal látod a lényeget: mekkora összeg igényelhető, mikor jár le, ki pályázhat és milyen költségek számolhatók el.',
              },
              {
                icon: ShieldCheck,
                title: 'Jogosultsági ellenőrző és előkészítő lista',
                desc: 'Előre kiszűrjük a tipikus buktatókat (pl. saját tőke, lezárt évek, régiós korlát), és lépésről lépésre megmutatjuk, milyen iratokat készíts elő.',
              },
              {
                icon: Search,
                title: 'Fontossági sorrend és magyar fókusz',
                desc: 'Alapból csak a nyitott és hamarosan nyíló magyar pályázatokat mutatjuk relevancia szerint — a lejárt vagy külföldi kiírások nem zavarják a keresést.',
              },
              {
                icon: Bell,
                title: 'Rugalmas e-mail értesítések, spamek nélkül',
                desc: 'Választhatsz napi vagy heti összefoglalót a cégedre szabott új lehetőségekről és közelgő határidőkről, és bármikor egy kattintással leiratkozhatsz.',
              },
            ].map((feat) => (
              <div key={feat.title} className="card p-6 flex gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--gr-bg-surface)' }}
                >
                  <feat.icon className="w-5 h-5" style={{ color: 'var(--gr-primary)' }} />
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1">{feat.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TEAM, EXPERTISE & OFFICIAL DATA SOURCES ─── */}
      <section
        className="py-16 px-6 border-y"
        style={{ borderColor: 'var(--gr-border)', background: 'var(--gr-bg-raised)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <span className="pill pill-gold mb-3 inline-flex">Szakmai háttér és hitelesség</span>
            <h2 className="headline mb-3">Valódi pályázati módszertan és hivatalos források</h2>
            <p className="text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
              A GrantRadar nem találgat és nem általános híroldalakról dolgozik: a magyar KKV- és agrártámogatási szabályrendszerre épülő szűrőlogikát közvetlen hivatalos portáladatokkal kapcsoljuk össze.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border" style={{ background: 'var(--gr-bg)', borderColor: 'var(--gr-border)' }}>
              <Database className="w-5 h-5 mb-3" style={{ color: 'var(--gr-primary)' }} />
              <h3 className="font-bold text-sm mb-1.5">Hivatalos adatkapcsolatok</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                A Széchenyi Terv Plusz (palyazat.gov.hu), a KAP (kap.gov.hu), az NKFIH, az MFB és a KAVOSZ hivatalos felhívásait dolgozzuk fel, pontos határidőkkel és státuszokkal.
              </p>
            </div>
            <div className="p-5 rounded-xl border" style={{ background: 'var(--gr-bg)', borderColor: 'var(--gr-border)' }}>
              <Users className="w-5 h-5 mb-3" style={{ color: 'var(--gr-primary)' }} />
              <h3 className="font-bold text-sm mb-1.5">Tanácsadói szempontrendszer</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                Az előszűrő és a 10 pontos dokumentumlista a gyakorló magyar pályázati tanácsadók tapasztalata alapján készült — kifejezetten a tipikus elutasítási okok megelőzésére.
              </p>
            </div>
            <div className="p-5 rounded-xl border" style={{ background: 'var(--gr-bg)', borderColor: 'var(--gr-border)' }}>
              <ShieldCheck className="w-5 h-5 mb-3" style={{ color: 'var(--gr-green)' }} />
              <h3 className="font-bold text-sm mb-1.5">Támogató automatizmus</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                A mesterséges intelligencia kizárólag a hivatalos kiírások érthető összefoglalásában és a kulcsszavas keresés segítésében működik közre, minden adat ellenőrizhető a forrás linken.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION (NATIVE <details> ACCORDION) ─── */}
      <section id="gyik" className="py-16 px-6" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="pill pill-muted mb-3 inline-flex">GYIK</span>
            <h2 id="faq-heading" className="headline">
              Gyakran ismételt kérdések
            </h2>
          </div>

          <div className="faq-accordion space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <div className="faq-body">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section
        className="py-16 px-6 border-t"
        style={{ borderColor: 'var(--gr-border)', background: 'var(--gr-bg-raised)' }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="headline mb-4">
            Kezdj el tudatosan pályázni.
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
            Regisztrálj ingyen bankkártya nélkül, állítsd be a céged adatait 2 perc alatt, és nézd meg azonnal a vállalkozásodra szabott nyitott támogatásokat.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary text-base py-3 px-8">
              Ingyenes regisztráció
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="btn-secondary text-base py-3 px-8">
              Csomagok és árak (Ft)
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  )
}
