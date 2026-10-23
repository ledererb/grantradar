'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { CompanyPreScreenProfile } from '@/lib/grant-handbook'

export const PRESCREEN_STORAGE_KEY = 'grantradar_prescreen_draft'

type ApplicantChoice = 'KFT_MICRO' | 'KFT_SMALL' | 'EV' | 'OSTERMELO'
type YearsChoice = '0' | '1' | '2'
type RegionChoice = 'VIDEK' | 'FALU' | 'BP_PEST'
type GoalChoice = 'TECH' | 'DIGITAL' | 'AGRI' | 'ENERGY' | 'RDI'
type FinanceChoice = 'OK' | 'ISSUE'

export function PublicPreScreener() {
  const router = useRouter()
  const [applicant, setApplicant] = useState<ApplicantChoice>('KFT_SMALL')
  const [years, setYears] = useState<YearsChoice>('2')
  const [region, setRegion] = useState<RegionChoice>('VIDEK')
  const [goal, setGoal] = useState<GoalChoice>('TECH')
  const [finance, setFinance] = useState<FinanceChoice>('OK')

  const analysis = useMemo(() => {
    const programs: { name: string; tag: string; fit: string }[] = []
    const risks: { level: 'fail' | 'warn' | 'pass'; text: string }[] = []
    const docsToPrepare: string[] = [
      'Cégkivonat / EV vagy őstermelői nyilvántartás + TEÁOR/ÖVTJ ellenőrzés',
      'Utolsó 1–2 lezárt év beszámolója és NAV KOMA köztartozásmentesség',
      '2–3 db összehasonlítható, független piaci árajánlat (benyújtás előtti megrendelés nélkül!)',
    ]

    // 1. Financial disqualifier check
    if (finance === 'ISSUE') {
      risks.push({
        level: 'fail',
        text: 'Kizáró kockázat: a negatív saját tőke vagy a lejárt köztartozás szinte minden hazai és EU-s pályázatnál azonnali kizáró ok. Először a mérleg szerinti saját tőkét és a NAV KOMA státuszt kell rendezni.',
      })
    } else {
      risks.push({
        level: 'pass',
        text: 'Pénzügyi alapstátusz rendben: pozitív saját tőke és rendezett köztartozásmentes (KOMA) státusz.',
      })
    }

    // 2. Operating history check
    if (years === '0') {
      risks.push({
        level: 'warn',
        text: '0 lezárt üzleti év (induló cég): a legtöbb GINOP Plusz és DIMOP Plusz beruházási pályázat min. 1–2 lezárt teljes üzleti évet kér. Indulóként célzott startup / fiatal gazda konstrukciók vagy KAVOSZ/MFB hitelek jöhetnek szóba.',
      })
    } else if (years === '1') {
      risks.push({
        level: 'pass',
        text: '1 lezárt üzleti év: a legtöbb mikro- és kisvállalkozói felhívás alapfeltételének megfelel (egyes nagyobb beruházások 2 lezárt évet kérnek).',
      })
    } else {
      risks.push({
        level: 'pass',
        text: '2+ lezárt üzleti év: teljesíti a GINOP Plusz, DIMOP Plusz és KAP beruházási felhívások működési múlt elvárását.',
      })
    }

    // 3. Goal & Program Matching (Section 7, 8, 9, 13)
    if (goal === 'AGRI' || applicant === 'OSTERMELO') {
      programs.push({
        name: 'KAP (Közös Agrárpolitika)',
        tag: '50–85% VNT támogatás',
        fit: 'Mezőgazdasági kisüzemek, gépbeszerzés, állattartó telep és élelmiszeripari beruházások.',
      })
      docsToPrepare.push(
        'KNYR regisztráció, STÉ üzemméret kalkuláció, Egységes Kérelem (EK) és mezőgazdasági árbevétel arány igazolás',
      )
      risks.push({
        level: 'warn',
        text: 'KAP szabály: kötelező a KNYR nyilvántartás, az előírt STÉ üzemméret, és a támogatási döntéstől számított 12 hónapon belül a támogatás >10%-ával el kell számolni.',
      })
    }

    if (goal === 'DIGITAL') {
      programs.push({
        name: 'DIMOP Plusz',
        tag: 'Szoftver, felhő, MI & kiberbiztonság',
        fit: 'KKV-k digitális intenzitásának és üzleti folyamatainak fejlesztése.',
      })
      docsToPrepare.push(
        'Előzetes digitális érettségi felmérés és szoftver/felhő specifikáció',
      )
      risks.push({
        level: 'warn',
        text: 'DIMOP Plusz szabály: önálló hardvercsere nem elegendő — valódi digitális szintlépést (ERP/CRM, felhő, MI, kiberbiztonság) kell igazolni.',
      })
    }

    if (goal === 'TECH' || goal === 'ENERGY') {
      if (region === 'BP_PEST') {
        programs.push({
          name: 'MFB Pont Plusz / Széchenyi Kártya MAX+',
          tag: 'Kamattámogatott KKV finanszírozás',
          fit: 'Budapest és Pest vármegyei beruházásokhoz elérhető kedvezményes finanszírozás.',
        })
        programs.push({
          name: 'Célzott GINOP Plusz / Energia programok',
          tag: 'Országos hatályú kiírások',
          fit: 'Országos energetikai, e-mobilitási vagy technológiai konstrukciók.',
        })
        risks.push({
          level: 'warn',
          text: 'Területi figyelem: a klasszikus GINOP Plusz VNT felhívások jelentős része csak a kevésbé fejlett (Budapesten és Pest vármegyén kívüli) régiókban érhető el!',
        })
      } else {
        programs.push({
          name: 'GINOP Plusz',
          tag: 'Technológia, gép & energetika',
          fit: 'Vidéki és kevésbé fejlett régiós KKV-k technológiai korszerűsítése és kapacitásbővítése.',
        })
        if (region === 'FALU') {
          programs.push({
            name: 'Magyar Falu Program / Vidéki KKV alapok',
            tag: 'Kistelepülési többlettámogatás',
            fit: '5000 fő alatti településeken megvalósuló mikrovállalkozói beruházások.',
          })
        }
      }
    }

    if (goal === 'RDI') {
      programs.push({
        name: 'NKFIH (NKFI Alap) & Horizon / EIC',
        tag: 'K+F+I vissza nem térítendő támogatás',
        fit: 'Ipari kutatás, kísérleti fejlesztés, prototípus és piaci bevezetés (Budapesten és vidéken is).',
      })
      docsToPrepare.push(
        'NKFIH K+F minősítés / szakértői vélemény és kutató-fejlesztő munkaidő-nyilvántartás',
      )
    }

    const overallStatus =
      finance === 'ISSUE'
        ? {
            label: 'Kizáró kockázat — pénzügyi rendezés szükséges',
            tone: 'red' as const,
            Icon: XCircle,
          }
        : years === '0' || (region === 'BP_PEST' && goal === 'TECH')
          ? {
              label: 'Feltételesen alkalmas — célzott konstrukció javasolt',
              tone: 'amber' as const,
              Icon: AlertTriangle,
            }
          : {
              label: 'Jó pályázati esély — érdemes előkészíteni',
              tone: 'green' as const,
              Icon: CheckCircle2,
            }

    return { programs, risks, docsToPrepare, overallStatus }
  }, [applicant, years, region, goal, finance])

  function handleContinueToPlatform(e: React.FormEvent) {
    e.preventDefault()

    const draft: Partial<CompanyPreScreenProfile> = {
      legalForm:
        applicant === 'EV'
          ? 'EV'
          : applicant === 'OSTERMELO'
            ? 'OSTERMELO'
            : 'KFT_ZRT',
      companySizePref:
        applicant === 'KFT_SMALL' ? ['SMALL', 'MEDIUM'] : ['MICRO'],
      closedFiscalYears: Number(years),
      positiveEquity: finance === 'OK' ? 'YES' : 'NO',
      noTaxDebt: finance === 'OK' ? 'YES' : 'NO',
      regions:
        region === 'BP_PEST'
          ? ['Budapest / Pest vármegye']
          : region === 'FALU'
            ? [
                'Kevésbé fejlett régió (Észak-Magyarország, Észak-Alföld, Dél-Alföld, Dél-Dunántúl)',
                '5000 fő alatti település (Magyar Falu / vidéki előny)',
              ]
            : ['Kevésbé fejlett régió (Észak-Magyarország, Észak-Alföld, Dél-Alföld, Dél-Dunántúl)'],
      isAgriProducer: goal === 'AGRI' || applicant === 'OSTERMELO',
      sectorPrefs:
        goal === 'DIGITAL'
          ? ['IT és szoftverfejlesztés']
          : goal === 'AGRI'
            ? ['Mezőgazdaság', 'Élelmiszeripar']
            : goal === 'ENERGY'
              ? ['Energetika']
              : goal === 'RDI'
                ? ['Kutatás-fejlesztés']
                : ['Feldolgozóipar'],
    }

    try {
      localStorage.setItem(PRESCREEN_STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // ignore storage errors
    }

    router.push('/register?from=prescreen')
  }

  return (
    <div className="card p-6 md:p-8" style={{ borderColor: 'var(--gr-gold-dim)' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <span className="pill pill-gold mb-2 inline-flex">
            <Sparkles className="w-3 h-3" />
            Interaktív 2 perces előszűrés
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Érdemes-e egyáltalán elindulnod? Ellenőrizd 30 másodperc alatt.
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--gr-text-2)' }}>
            GINOP Plusz • DIMOP Plusz • KAP • NKFIH 2021–2027-es jogosultsági szabályok alapján
          </p>
        </div>
      </div>

      <form onSubmit={handleContinueToPlatform} className="grid lg:grid-cols-12 gap-8">
        {/* Left column: 5 quick questions */}
        <div className="lg:col-span-7 space-y-5">
          {/* Q1: Applicant type */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              1. Pályázó formája és mérete
            </legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { value: 'KFT_MICRO', label: 'Kft. / Zrt. — Mikro (0–9 fő)' },
                { value: 'KFT_SMALL', label: 'Kft. / Zrt. — Kis és közép (10–249 fő)' },
                { value: 'EV', label: 'Egyéni vállalkozó (EV)' },
                { value: 'OSTERMELO', label: 'Őstermelő / ŐCSG / Agrár szövetkezet' },
              ].map((opt) => (
                <label key={opt.value} className="prescreen-option">
                  <input
                    type="radio"
                    name="applicant"
                    value={opt.value}
                    checked={applicant === opt.value}
                    onChange={() => setApplicant(opt.value as ApplicantChoice)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Q2: Closed fiscal years */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              2. Lezárt teljes üzleti évek száma
            </legend>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { value: '0', label: '0 év (induló / startup)' },
                { value: '1', label: '1 lezárt üzleti év' },
                { value: '2', label: '2 vagy több lezárt év' },
              ].map((opt) => (
                <label key={opt.value} className="prescreen-option">
                  <input
                    type="radio"
                    name="years"
                    value={opt.value}
                    checked={years === opt.value}
                    onChange={() => setYears(opt.value as YearsChoice)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Q3: Project location */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              3. Beruházás helyszíne (telephely)
            </legend>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { value: 'VIDEK', label: 'Vidéki régió (kevésbé fejlett)' },
                { value: 'FALU', label: '5000 fő alatti település' },
                { value: 'BP_PEST', label: 'Budapest vagy Pest vármegye' },
              ].map((opt) => (
                <label key={opt.value} className="prescreen-option">
                  <input
                    type="radio"
                    name="region"
                    value={opt.value}
                    checked={region === opt.value}
                    onChange={() => setRegion(opt.value as RegionChoice)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Q4: Goal */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              4. Mire szeretnél támogatást igényelni?
            </legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { value: 'TECH', label: 'Gépbeszerzés, technológia, építés' },
                { value: 'DIGITAL', label: 'Szoftver, felhő, MI, kiberbiztonság' },
                { value: 'AGRI', label: 'Mezőgazdaság, élelmiszeripar (KAP)' },
                { value: 'ENERGY', label: 'Napelem, energiatárolás, energetika' },
                { value: 'RDI', label: 'K+F+I, prototípus és innováció' },
              ].map((opt) => (
                <label key={opt.value} className="prescreen-option">
                  <input
                    type="radio"
                    name="goal"
                    value={opt.value}
                    checked={goal === opt.value}
                    onChange={() => setGoal(opt.value as GoalChoice)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Q5: Equity & Tax status */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              5. Saját tőke és köztartozás (NAV KOMA)
            </legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { value: 'OK', label: 'Pozitív saját tőke & köztartozásmentes' },
                { value: 'ISSUE', label: 'Negatív saját tőke vagy lejárt tartozás' },
              ].map((opt) => (
                <label key={opt.value} className="prescreen-option">
                  <input
                    type="radio"
                    name="finance"
                    value={opt.value}
                    checked={finance === opt.value}
                    onChange={() => setFinance(opt.value as FinanceChoice)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Right column: Instant Pre-Screening Diagnosis */}
        <div
          className="lg:col-span-5 rounded-xl p-5 flex flex-col justify-between border"
          style={{
            background: 'var(--gr-bg-surface)',
            borderColor: 'var(--gr-border-strong)',
          }}
        >
          <div className="space-y-4">
            {/* Status header with icon + text */}
            <div className="flex items-start gap-2.5 pb-3 border-b" style={{ borderColor: 'var(--gr-border)' }}>
              <analysis.overallStatus.Icon
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{
                  color:
                    analysis.overallStatus.tone === 'green'
                      ? 'var(--gr-green)'
                      : analysis.overallStatus.tone === 'amber'
                        ? 'var(--gr-amber)'
                        : 'var(--gr-red)',
                }}
              />
              <div>
                <div className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--gr-text-2)' }}>
                  Előszűrési diagnózis
                </div>
                <div className="text-sm font-bold" style={{ color: 'var(--gr-text)' }}>
                  {analysis.overallStatus.label}
                </div>
              </div>
            </div>

            {/* Recommended Program Families */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--gr-gold)' }}>
                Ajánlott konstrukciók neked:
              </div>
              <div className="space-y-2">
                {analysis.programs.map((prog) => (
                  <div
                    key={prog.name}
                    className="p-2.5 rounded-lg border"
                    style={{ background: 'var(--gr-bg-raised)', borderColor: 'var(--gr-border)' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold">{prog.name}</span>
                      <span className="pill pill-gold text-[10px]">{prog.tag}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                      {prog.fit}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Specific Findings & Pitfalls */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--gr-text-2)' }}>
                Kritikus jogosultsági pontok:
              </div>
              <ul className="space-y-1.5">
                {analysis.risks.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                    {r.level === 'fail' ? (
                      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--gr-red)' }} />
                    ) : r.level === 'warn' ? (
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--gr-amber)' }} />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--gr-green)' }} />
                    )}
                    <span style={{ color: 'var(--gr-text-2)' }}>{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Required docs preview */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Mit érdemes előkészíteni?
              </div>
              <ul className="space-y-1">
                {analysis.docsToPrepare.map((doc, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--gr-text-2)' }}>
                    <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--gr-gold)' }} />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t" style={{ borderColor: 'var(--gr-border)' }}>
            <button type="submit" className="btn-primary w-full py-3 text-sm">
              Releváns nyitott pályázatok megtekintése
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-center mt-2" style={{ color: 'var(--gr-text-3)' }}>
              A válaszaidat elmentjük, így regisztráció után azonnal kész a jogosultsági mátrixod.
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
