import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Euro,
  Building2,
  ExternalLink,
  FileText,
  Sparkles,
  Target,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  CheckCircle2,
  Scale,
  Settings,
} from 'lucide-react'
import {
  formatHuf,
  formatDate,
  formatRelativeDate,
  getStatusLabel,
  getStatusColor,
  getFundingTypeLabel,
  getFundingTypeColor,
  getCompanySizeLabel,
  getDifficultyInfo,
} from '@/lib/utils'
import {
  parseUserProfile,
  parseSavedGrantState,
  evaluateGrantEligibility,
  TYPICAL_COST_RULES,
  STATE_AID_RULES,
  COMMON_PITFALLS,
  type CheckStatus,
} from '@/lib/grant-handbook'
import { GrantPrepChecklist } from '@/components/GrantPrepChecklist'

export const dynamic = 'force-dynamic'

function getStatusBadge(status: CheckStatus) {
  switch (status) {
    case 'PASS':
      return { label: 'Megfelel', pillClass: 'pill-green', Icon: CheckCircle2 }
    case 'WARN':
      return { label: 'Figyelendő', pillClass: 'pill-amber', Icon: AlertTriangle }
    case 'FAIL':
      return { label: 'Kizáró kockázat', pillClass: 'pill-red', Icon: XCircle }
    default:
      return { label: 'Ellenőrizendő', pillClass: 'pill-muted', Icon: HelpCircle }
  }
}

export default async function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const grant = await prisma.grant.findUnique({
    where: { id },
    include: { source: { select: { name: true, country: true, url: true } } },
  })

  if (!grant) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const dbUser = user
    ? await prisma.user.findUnique({
        where: { supabaseId: user.id },
        include: {
          profile: true,
          savedGrants: { where: { grantId: grant.id } },
        },
      })
    : null

  const companyProfile = parseUserProfile(dbUser?.profile)
  const savedRecord = dbUser?.savedGrants?.[0]
  const savedState = parseSavedGrantState(savedRecord?.notes)

  const evaluation = evaluateGrantEligibility(grant, companyProfile)
  const { programProfile } = evaluation
  const difficulty = getDifficultyInfo(grant.aiDifficultyScore)

  const amountDisplay = (() => {
    if (grant.minAmountHuf && grant.maxAmountHuf && grant.minAmountHuf !== grant.maxAmountHuf) {
      return `${formatHuf(grant.minAmountHuf)} – ${formatHuf(grant.maxAmountHuf)}`
    }
    if (grant.maxAmountHuf) return formatHuf(grant.maxAmountHuf)
    if (grant.minAmountHuf) return `Min. ${formatHuf(grant.minAmountHuf)}`
    if (grant.maxAmountEur) return `€${grant.maxAmountEur.toLocaleString('hu-HU')}`
    return 'N/A'
  })()

  const verdictBorderColor =
    evaluation.verdictTone === 'green'
      ? 'var(--gr-green)'
      : evaluation.verdictTone === 'amber'
        ? 'var(--gr-amber)'
        : evaluation.verdictTone === 'red'
          ? 'var(--gr-red)'
          : 'var(--gr-gold-dim)'

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Back */}
      <div>
        <Link
          href="/dashboard/grants"
          className="inline-flex items-center gap-1.5 text-sm mb-4 no-underline"
          style={{ color: 'var(--gr-text-2)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Vissza a pályázatokhoz
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {grant.code && (
            <span
              className="mono text-xs px-2.5 py-1 rounded"
              style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}
            >
              {grant.code}
            </span>
          )}
          <span className={`pill ${getStatusColor(grant.status)}`}>{getStatusLabel(grant.status)}</span>
          <span className={`pill ${getFundingTypeColor(grant.fundingType)}`}>
            {getFundingTypeLabel(grant.fundingType)}
          </span>
          <span className="pill pill-gold">{programProfile.name.split(' (')[0]}</span>
          {grant.aiDifficultyScore && (
            <span className="text-xs font-semibold px-2 py-0.5" style={{ color: difficulty.color }}>
              Nehézség: {difficulty.label} ({grant.aiDifficultyScore}/5)
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-2">{grant.titleHu || grant.titleEn || 'N/A'}</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Program: <strong style={{ color: 'var(--gr-text)' }}>{grant.program || programProfile.name}</strong>
          {grant.openDate ? ` · Megnyitás: ${formatDate(grant.openDate)}` : ''}
        </p>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: Calendar,
            label: 'Határidő',
            value: grant.deadline ? formatDate(grant.deadline) : 'Folyamatos / N/A',
            sub: grant.deadline ? formatRelativeDate(grant.deadline) : undefined,
            color:
              grant.deadline && new Date(grant.deadline) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                ? 'var(--gr-red)'
                : 'var(--gr-text)',
          },
          {
            icon: Euro,
            label: 'Támogatás összege',
            value: amountDisplay,
            sub: grant.supportIntensityPct
              ? `Max. ${grant.supportIntensityPct}% támogatási intenzitás`
              : programProfile.financingModel,
            color: 'var(--gr-gold)',
          },
          {
            icon: Building2,
            label: 'Pályázói méret',
            value:
              grant.eligibleSizes.length > 0
                ? grant.eligibleSizes.map(getCompanySizeLabel).join(', ')
                : 'Mikro-, kis- és középvállalkozás',
            sub:
              grant.eligibleRegions && grant.eligibleRegions.length > 0
                ? grant.eligibleRegions.join(', ')
                : undefined,
            color: 'var(--gr-text)',
          },
          {
            icon: Target,
            label: 'Forrás',
            value: grant.source.name,
            sub: grant.source.country === 'HU' ? '🇭🇺 Magyar forrás' : '🇪🇺 EU forrás',
            color: 'var(--gr-text)',
          },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4" style={{ color: 'var(--gr-text-3)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--gr-text-2)' }}>
                {card.label}
              </span>
            </div>
            <div className="text-sm font-semibold" style={{ color: card.color }}>
              {card.value}
            </div>
            {card.sub && (
              <div className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--gr-text-2)' }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── 1. 2 PERCES ELŐSZŰRŐ & JOGOSULTSÁGI MÁTRIX ─── */}
      <section className="card p-6" style={{ borderColor: verdictBorderColor }}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5" style={{ color: verdictBorderColor }} />
              <h2 className="text-base font-bold">
                2 perces Előszűrő & Jogosultsági Mátrix
              </h2>
              <span
                className={`pill ${
                  evaluation.verdictTone === 'green'
                    ? 'pill-green'
                    : evaluation.verdictTone === 'amber'
                      ? 'pill-amber'
                      : evaluation.verdictTone === 'red'
                        ? 'pill-red'
                        : 'pill-gold'
                }`}
              >
                {evaluation.verdictLabel}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
              {evaluation.verdictSummary}
            </p>
          </div>

          <Link href="/dashboard/settings" className="btn-secondary text-xs py-2 px-3.5 shrink-0">
            <Settings className="w-3.5 h-3.5" />
            {evaluation.profileConfigured ? 'Cégprofil módosítása' : '2 perces előszűrő kitöltése'}
          </Link>
        </div>

        {/* Responsive Eligibility Matrix Table */}
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="eligibility-matrix-caption"
          className="table-wrapper"
        >
          <table
            style={
              {
                '--label-2': '"Elvárás"',
                '--label-3': '"Céged állapota"',
                '--label-4': '"Előkészítendő dokumentum"',
                '--label-5': '"Státusz és kockázat"',
              } as React.CSSProperties
            }
          >
            <caption id="eligibility-matrix-caption" className="sr-only">
              Pályázati jogosultsági mátrix és előszűrési táblázat
            </caption>
            <thead>
              <tr>
                <th>Ellenőrzési pont</th>
                <th>Tipikus / Felhívás elvárás</th>
                <th>Céged állapota</th>
                <th>Mit érdemes előkészíteni?</th>
                <th>Státusz / Kockázat</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.rows.map((row) => {
                const badge = getStatusBadge(row.status)
                return (
                  <tr key={row.id}>
                    <th>{row.checkpoint}</th>
                    <td style={{ color: 'var(--gr-text-2)' }}>{row.expectation}</td>
                    <td className="font-medium" style={{ color: 'var(--gr-text)' }}>
                      {row.companyState}
                    </td>
                    <td style={{ color: 'var(--gr-text-2)' }}>{row.documentToPrepare}</td>
                    <td>
                      <div className="mb-1">
                        <span className={`pill ${badge.pillClass}`}>
                          <badge.Icon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                        {row.riskNote}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── 2. AI ÖSSZEFOGLALÓ & KULCSPONTOK ─── */}
      {(grant.aiSummaryHu || (grant.aiKeyPoints && grant.aiKeyPoints.length > 0)) && (
        <div className="grid md:grid-cols-2 gap-4">
          {grant.aiSummaryHu && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
                <h2 className="text-sm font-bold">AI Tanácsadói Összefoglaló</h2>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--gr-text-2)' }}>
                {grant.aiSummaryHu}
              </p>
              {grant.aiSectors?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--gr-border)' }}>
                  {grant.aiSectors.map((sector) => (
                    <span key={sector} className="pill pill-muted">
                      {sector}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {grant.aiKeyPoints?.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-bold mb-3">Legfontosabb tudnivalók</h2>
              <ul className="space-y-2">
                {grant.aiKeyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--gr-text-2)' }}>
                    <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--gr-gold)' }} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ─── 3. KONSTRUKCIÓ SAJÁTOSSÁGOK, JOGOSULTSÁG & PÁLYÁZÁSI LÉPÉSEK ─── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-3">
            Ki pályázhat? — Jogosultsági és konstrukciós szabályok
          </h2>
          {grant.eligibilityHu ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4" style={{ color: 'var(--gr-text-2)' }}>
              {grant.eligibilityHu}
            </p>
          ) : null}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gr-gold)' }}>
              {programProfile.name} — Kiemelt szabályok:
            </div>
            <ul className="space-y-2">
              {programProfile.specificRules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--gr-gold)' }} />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-bold mb-3">
            Hogyan kell pályázni? — Előkészítés és megvalósítás menete
          </h2>
          {grant.applicationStepsHu ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4" style={{ color: 'var(--gr-text-2)' }}>
              {grant.applicationStepsHu}
            </p>
          ) : (
            <ol className="space-y-2.5 text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
              <li>
                <strong style={{ color: 'var(--gr-text)' }}>1. Előszűrés (2 perc):</strong> Ellenőrizd a fenti jogosultsági mátrixban a cégméretet, lezárt éveket, saját tőkét, KOMA státuszt és a megvalósítási régiót.
              </li>
              <li>
                <strong style={{ color: 'var(--gr-text)' }}>2. Felhívás tételes ellenőrzése:</strong> Tekintsd át a „Kedvezményezettek köre”, „Projekt műszaki-szakmai tartalma”, „Elszámolható költségek” és „Kiválasztási szempontok” fejezeteket.
              </li>
              <li>
                <strong style={{ color: 'var(--gr-text)' }}>3. Piaci árajánlatok és igazolások bekérése:</strong> Kérj be összehasonlítható, független árajánlatokat (azonos műszaki tartalommal) — de <strong style={{ color: 'var(--gr-red)' }}>ne rendelj meg semmit a benyújtás előtt!</strong>
              </li>
              <li>
                <strong style={{ color: 'var(--gr-text)' }}>4. Üzleti/pénzügyi terv és benyújtás:</strong> Készítsd el a likviditási tervet, önerő-igazolást és nyújtsd be a kérelmet az EPTK / KAP felületen.
              </li>
            </ol>
          )}
        </div>
      </div>

      {/* ─── 4. RÉSZLETES LEÍRÁS ─── */}
      {grant.descriptionHu && (
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-3">Részletes pályázati leírás</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--gr-text-2)' }}>
            {grant.descriptionHu}
          </p>
        </div>
      )}

      {/* ─── 5. TÁMOGATHATÓ KÖLTSÉGEK, ÁRAJÁNLATOK & ÁLLAMI TÁMOGATÁSI JOGCÍMEK ─── */}
      <div className="card p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
            <h2 className="text-base font-bold">
              Támogatható költségek, piaci ár és állami támogatási jogcímek
            </h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
            Tipikus elszámolhatósági logika és korlátozások a 2021–2027-es GINOP Plusz / DIMOP Plusz / KAP konstrukciókban
          </p>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="cost-rules-caption"
          className="table-wrapper"
        >
          <table
            style={
              {
                '--label-2': '"Gyakran támogatható"',
                '--label-3': '"Gyakori korlátozás / kizárás"',
              } as React.CSSProperties
            }
          >
            <caption id="cost-rules-caption" className="sr-only">
              Támogatható és nem támogatható költségek összefoglaló táblázata
            </caption>
            <thead>
              <tr>
                <th>Költségtípus</th>
                <th>Gyakran támogatható</th>
                <th>Gyakori korlátozás / kizárás</th>
              </tr>
            </thead>
            <tbody>
              {TYPICAL_COST_RULES.map((rule) => (
                <tr key={rule.category}>
                  <th>{rule.category}</th>
                  <td style={{ color: 'var(--gr-text)' }}>{rule.eligible}</td>
                  <td style={{ color: 'var(--gr-text-2)' }}>{rule.restriction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* State Aid Categories */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--gr-gold)' }}>
            Állami támogatási jogcímek (befolyásolják a maximális intenzitást)
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {STATE_AID_RULES.map((aid) => (
              <div
                key={aid.title}
                className="p-3.5 rounded-lg border"
                style={{ background: 'var(--gr-bg-surface)', borderColor: 'var(--gr-border)' }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: 'var(--gr-text)' }}>
                  {aid.title}
                </div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  {aid.expectation}
                </p>
                <div className="text-[11px]" style={{ color: 'var(--gr-gold)' }}>
                  Előkészítendő: {aid.preparation}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 6. LEGGYAKORIBB BUKÓPONTOK & FENNTARTÁSI KÖTELEZETTSÉGEK ─── */}
      <div className="card p-6" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--gr-amber)' }} />
          <h2 className="text-base font-bold">
            Leggyakoribb „bukópontok” és megvalósítási kötelezettségek
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-2.5">
          {COMMON_PITFALLS.map((pitfall, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5"
              style={{ background: 'var(--gr-bg-surface)', borderColor: 'var(--gr-border)', color: 'var(--gr-text-2)' }}
            >
              <span className="mono font-bold shrink-0" style={{ color: 'var(--gr-amber)' }}>
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span>{pitfall}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 7. INTERAKTÍV ELŐKÉSZÍTŐ DOKUMENTUMLISTA & MENTÉS ─── */}
      <GrantPrepChecklist
        grantId={grant.id}
        grantCode={grant.code}
        grantTitle={grant.titleHu || grant.titleEn}
        matrixRows={evaluation.rows}
        initialSaved={Boolean(savedRecord)}
        initialCheckedDocs={savedState.checkedDocs}
        initialNotes={savedState.notes}
        isKap={programProfile.family === 'KAP' || companyProfile.isAgriProducer}
        isAuthenticated={Boolean(user)}
      />

      {/* ─── 8. HIVATALOS FORRÁSOK & DOKUMENTUMOK ─── */}
      <div className="card p-6">
        <h2 className="text-sm font-bold mb-3">Hivatalos források és pályázati dokumentáció</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <a
            href={grant.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-medium no-underline p-3 rounded-lg border transition-colors"
            style={{
              background: 'var(--gr-bg-surface)',
              borderColor: 'var(--gr-gold-dim)',
              color: 'var(--gr-gold)',
            }}
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            Eredeti pályázati felhívás megnyitása ({grant.source.name})
          </a>

          {grant.documentUrls?.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs no-underline p-3 rounded-lg border"
              style={{
                background: 'var(--gr-bg-surface)',
                borderColor: 'var(--gr-border)',
                color: 'var(--gr-text)',
              }}
            >
              <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--gr-gold)' }} />
              Melléklet / Dokumentum #{i + 1}
            </a>
          ))}

          <a
            href="https://www.palyazat.gov.hu/programok/szechenyi-terv-plusz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs no-underline p-3 rounded-lg border"
            style={{
              background: 'var(--gr-bg-surface)',
              borderColor: 'var(--gr-border)',
              color: 'var(--gr-text-2)',
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            Pályázati Portál — 2021–2027 dokumentációk és ÁÚF
          </a>

          <a
            href="https://kap.gov.hu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs no-underline p-3 rounded-lg border"
            style={{
              background: 'var(--gr-bg-surface)',
              borderColor: 'var(--gr-border)',
              color: 'var(--gr-text-2)',
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            KAP hivatalos portál és Általános Útmutató
          </a>
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs flex flex-wrap gap-6" style={{ color: 'var(--gr-text-3)' }}>
        <span>Először észlelve: {formatDate(grant.firstSeenAt)}</span>
        <span>Utoljára frissítve: {formatDate(grant.lastScrapedAt)}</span>
        <span>Jogosultsági útmutató: csak tájékoztató jellegű, benyújtás előtt mindig ellenőrizd az aktuális felhívást és mellékleteit.</span>
      </div>
    </div>
  )
}
