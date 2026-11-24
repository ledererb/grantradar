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
  Check,
} from 'lucide-react'
import type { CompanyPreScreenProfile } from '@/lib/grant-handbook'

export const PRESCREEN_STORAGE_KEY = 'grantradar_prescreen_draft'

type ApplicantChoice = 'KFT_MICRO' | 'KFT_SMALL' | 'EV' | 'OSTERMELO'
type YearsChoice = '0' | '1' | '2'
type RegionChoice = 'VIDEK' | 'FALU' | 'BP_PEST'
type GoalChoice = 'TECH' | 'DIGITAL' | 'AGRI' | 'ENERGY' | 'RDI'
type FinanceChoice = 'OK' | 'ISSUE'

const GOAL_SECTOR_MAP: Record<GoalChoice, string[]> = {
  TECH: ['Feldolgozóipar'],
  DIGITAL: ['IT és szoftverfejlesztés'],
  AGRI: ['Mezőgazdaság', 'Élelmiszeripar'],
  ENERGY: ['Energetika'],
  RDI: ['Kutatás-fejlesztés'],
}

export function PublicPreScreener() {
  const router = useRouter()
  const [applicant, setApplicant] = useState<ApplicantChoice>('KFT_SMALL')
  const [years, setYears] = useState<YearsChoice>('2')
  const [region, setRegion] = useState<RegionChoice>('VIDEK')
  const [goals, setGoals] = useState<GoalChoice[]>(['TECH'])
  const [finance, setFinance] = useState<FinanceChoice>('OK')

  function toggleGoal(choice: GoalChoice) {
    setGoals((prev) => {
      if (prev.includes(choice)) {
        if (prev.length === 1) return prev // Keep at least 1 selected for meaningful analysis
        return prev.filter((g) => g !== choice)
      }
      return [...prev, choice]
    })
  }

  const analysis = useMemo(() => {
    const programs: { name: string; tag: string; fit: string }[] = []
    const risks: { level: 'fail' | 'warn' | 'pass'; text: string }[] = []
    const docsToPrepare: string[] = [
      'Cégkivonat vagy egyéni vállalkozói / őstermelői igazolás + tevékenységi kör (TEÁOR) ellenőrzése',
      'Utolsó 1–2 lezárt év beszámolója és köztartozásmentes NAV-státusz',
      '2–3 db független, összehasonlítható piaci árajánlat (benyújtás előtti megrendelés nélkül!)',
    ]

    const hasGoal = (g: GoalChoice) => goals.includes(g)

    // 1. Financial disqualifier check
    if (finance === 'ISSUE') {
      risks.push({
        level: 'fail',
        text: 'Kizáró kockázat: a negatív saját tőke vagy a lejárt köztartozás szinte minden hazai és EU-s pályázatnál azonnali kizáró ok. Először a mérleget és a NAV-egyenleget kell rendezni.',
      })
    } else {
      risks.push({
        level: 'pass',
        text: 'Pénzügyi alapstátusz rendben: pozitív saját tőke és rendezett, köztartozásmentes státusz.',
      })
    }

    // 2. Operating history check
    if (years === '0') {
      risks.push({
        level: 'warn',
        text: '0 lezárt üzleti év (induló vállalkozás): a legtöbb GINOP Plusz és DIMOP Plusz beruházási pályázat min. 1–2 lezárt teljes üzleti évet kér. Indulóként célzott induló/fiatal gazda vagy kedvezményes hitelkonstrukció jöhet szóba.',
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

    // 3. Multi-Goal & Program Matching
    if (hasGoal('AGRI') || applicant === 'OSTERMELO') {
      programs.push({
        name: 'KAP (Agrár- és élelmiszeripari támogatások)',
        tag: '50–85% vissza nem térítendő',
        fit: 'Mezőgazdasági kisüzemek, gépbeszerzés, állattartó telep és élelmiszeripari beruházások.',
      })
      docsToPrepare.push(
        'Agrár-nyilvántartási szám (KNYR), üzemméret-számítás (STÉ), Egységes Kérelem és mezőgazdasági árbevétel arány igazolása',
      )
      risks.push({
        level: 'warn',
        text: 'Agrár szabály: kötelező az agrár-nyilvántartási szám, az előírt üzemméret, és a döntéstől számított 12 hónapon belül a támogatás >10%-ával el kell számolni.',
      })
    }

    if (hasGoal('DIGITAL')) {
      programs.push({
        name: 'DIMOP Plusz (Digitális fejlesztés)',
        tag: 'Szoftver, felhő, MI & adatbiztonság',
        fit: 'KKV-k digitális rendszereinek, vállalatirányításának és kiberbiztonságának fejlesztése.',
      })
      docsToPrepare.push(
        'Előzetes digitális érettségi felmérés és szoftver/felhő specifikáció',
      )
      risks.push({
        level: 'warn',
        text: 'DIMOP Plusz szabály: önálló hardvercsere nem elegendő — valódi digitális szintlépést (vállalatirányítás, felhő, MI, adatbiztonság) kell igazolni.',
      })
    }

    if (hasGoal('TECH') || hasGoal('ENERGY')) {
      if (region === 'BP_PEST') {
        programs.push({
          name: 'MFB Pont Plusz / Széchenyi Kártya MAX+',
          tag: 'Kamattámogatott KKV finanszírozás',
          fit: 'Budapest és Pest régióban megvalósuló beruházásokhoz elérhető kedvezményes finanszírozás.',
        })
        programs.push({
          name: 'Országos energetikai és technológiai kiírások',
          tag: 'Országos hatályú konstrukciók',
          fit: 'Budapest és Pest régióban is elérhető energetikai, e-mobilitási vagy zöld átállási programok.',
        })
        risks.push({
          level: 'warn',
          text: 'Területi figyelem: a klasszikus GINOP Plusz vissza nem térítendő felhívások jelentős része csak a Közép-Magyarországon kívüli (vidéki) régiókban érhető el!',
        })
      } else {
        programs.push({
          name: 'GINOP Plusz',
          tag: 'Technológia, gép & energetika',
          fit: 'Vidéki KKV-k technológiai korszerűsítése, gépbeszerzése és energiahatékonysági fejlesztése.',
        })
        if (region === 'FALU') {
          programs.push({
            name: 'Magyar Falu Program / Kistelepülési alapok',
            tag: 'Kistelepülési többlet-támogatás',
            fit: '5000 fő alatti településeken megvalósuló mikrovállalkozói beruházások.',
          })
        }
      }
    }

    if (hasGoal('RDI')) {
      programs.push({
        name: 'NKFIH (Innovációs és K+F támogatások)',
        tag: 'Vissza nem térítendő K+F támogatás',
        fit: 'Új termék, prototípus vagy technológiai megoldás fejlesztése és piacra vitele (országosan elérhető).',
      })
      docsToPrepare.push(
        'Fejlesztési terv / újdonságtartalom leírása és fejlesztői munkaidő-nyilvántartás',
      )
    }

    const overallStatus =
      finance === 'ISSUE'
        ? {
            label: 'Kizáró kockázat — pénzügyi rendezés szükséges',
            tone: 'red' as const,
            Icon: XCircle,
          }
        : years === '0' || (region === 'BP_PEST' && hasGoal('TECH') && goals.length === 1)
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
  }, [applicant, years, region, goals, finance])

  function handleContinueToPlatform(e: React.FormEvent) {
    e.preventDefault()

    const combinedSectors = Array.from(
      new Set(goals.flatMap((g) => GOAL_SECTOR_MAP[g] || [])),
    )

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
          ? ['Budapest / Pest régió (Közép-Magyarország)']
          : region === 'FALU'
            ? [
                'Kevésbé fejlett régió (Észak-Magyarország, Észak-Alföld, Dél-Alföld, Dél-Dunántúl)',
                '5000 fő alatti település (Magyar Falu / vidéki előny)',
              ]
            : ['Kevésbé fejlett régió (Észak-Magyarország, Észak-Alföld, Dél-Alföld, Dél-Dunántúl)'],
      isAgriProducer: goals.includes('AGRI') || applicant === 'OSTERMELO',
      sectorPrefs: combinedSectors,
    }

    try {
      localStorage.setItem(PRESCREEN_STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // ignore storage errors
    }

    router.push('/register?from=prescreen')
  }

  return (
    <div className="card p-6 md:p-8" style={{ borderColor: 'var(--gr-primary)' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <span className="pill pill-blue mb-2 inline-flex">
            <Sparkles className="w-3.5 h-3.5" />
            Gyors, 2 perces előszűrés
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Érdemes-e egyáltalán elindulnod? Ellenőrizd 30 másodperc alatt.
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--gr-text-2)' }}>
            A 2021–2027-es GINOP Plusz, DIMOP Plusz, KAP és NKFIH jogosultsági szabályok alapján — regisztráció nélkül is kipróbálható.
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
                { value: 'OSTERMELO', label: 'Őstermelő / Családi gazdaság / Agrár' },
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
                { value: '0', label: '0 év (induló cég)' },
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
                { value: 'VIDEK', label: 'Vidéki régió (Közép-Mo.-on kívül)' },
                { value: 'FALU', label: '5000 fő alatti település' },
                { value: 'BP_PEST', label: 'Budapest vagy Pest régió' },
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

          {/* Q4: Goal (MULTI-SELECT!) */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              4. Mire szeretnél támogatást igényelni? (Több is választható)
            </legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { value: 'TECH', label: 'Gépbeszerzés, technológia, építés' },
                { value: 'DIGITAL', label: 'Szoftver, felhő, adatbiztonság, MI' },
                { value: 'AGRI', label: 'Mezőgazdaság, élelmiszeripar (KAP)' },
                { value: 'ENERGY', label: 'Napelem, energiatárolás, energetika' },
                { value: 'RDI', label: 'Új termék, prototípus és innováció' },
              ].map((opt) => {
                const checked = goals.includes(opt.value as GoalChoice)
                return (
                  <label key={opt.value} className="prescreen-option justify-between">
                    <input
                      type="checkbox"
                      name="goal"
                      value={opt.value}
                      checked={checked}
                      onChange={() => toggleGoal(opt.value as GoalChoice)}
                      className="sr-only"
                    />
                    <span>{opt.label}</span>
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                      style={
                        checked
                          ? { background: 'var(--gr-primary)', borderColor: 'var(--gr-primary)', color: 'var(--gr-on-primary)' }
                          : { background: 'var(--gr-bg-raised)', borderColor: 'var(--gr-border-strong)' }
                      }
                      aria-hidden="true"
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Q5: Equity & Tax status */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              5. Saját tőke és adótartozás (NAV státusz)
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
            borderColor: 'var(--gr-border)',
          }}
        >
          <div className="space-y-4">
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
                <div className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--gr-text-3)' }}>
                  Előszűrési diagnózis
                </div>
                <div className="text-sm font-bold" style={{ color: 'var(--gr-text)' }}>
                  {analysis.overallStatus.label}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--gr-primary)' }}>
                Ajánlott pályázati irányok ({analysis.programs.length}):
              </div>
              <div className="space-y-2">
                {analysis.programs.map((prog) => (
                  <div
                    key={prog.name}
                    className="p-3 rounded-lg border"
                    style={{ background: 'var(--gr-bg-raised)', borderColor: 'var(--gr-border)' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: 'var(--gr-text)' }}>
                        {prog.name}
                      </span>
                      <span className="pill pill-gold text-[11px]">{prog.tag}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                      {prog.fit}
                    </p>
                  </div>
                ))}
              </div>
            </div>

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

            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Mit érdemes előkészíteni?
              </div>
              <ul className="space-y-1">
                {analysis.docsToPrepare.map((doc, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--gr-text-2)' }}>
                    <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--gr-primary)' }} />
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
            <p className="text-xs text-center mt-2" style={{ color: 'var(--gr-text-3)' }}>
              A válaszaidat elmentjük, így az ingyenes regisztráció után azonnal szűrve látod a cégedre illő pályázatokat.
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
