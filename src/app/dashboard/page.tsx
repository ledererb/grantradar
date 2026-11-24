import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  TrendingUp,
  Database,
  Sparkles,
  ShieldCheck,
  Settings,
  Banknote,
} from 'lucide-react'
import {
  formatHuf,
  formatRelativeDate,
  getEffectiveStatus,
  getStatusColor,
  getStatusLabel,
  isTechnicalGrantCall,
} from '@/lib/utils'
import { evaluateGrantEligibility, parseUserProfile } from '@/lib/grant-handbook'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const now = new Date()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const dbUser = user
    ? await prisma.user.findUnique({
        where: { supabaseId: user.id },
        include: { profile: true },
      })
    : null

  const companyProfile = parseUserProfile(dbUser?.profile)
  const profileConfigured = Boolean(
    companyProfile.companySizePref.length > 0 ||
      companyProfile.legalForm ||
      companyProfile.closedFiscalYears !== null ||
      companyProfile.annualRevenueM !== null ||
      companyProfile.regions.length > 0 ||
      companyProfile.sectorPrefs.length > 0,
  )

  const [totalCount, activeHuGrants] = await Promise.all([
    prisma.grant.count(),
    prisma.grant.findMany({
      where: {
        status: { in: ['OPEN', 'FORTHCOMING'] },
        OR: [{ deadline: null }, { deadline: { gte: now } }],
        source: { country: 'HU' },
      },
      include: { source: { select: { name: true, country: true, slug: true } } },
      orderBy: [{ deadline: 'asc' }, { firstSeenAt: 'desc' }],
    }),
  ])

  const cleanActiveGrants = activeHuGrants.filter(
    (g) => !isTechnicalGrantCall(g.titleHu, g.code),
  )

  const openHuCount = cleanActiveGrants.filter(
    (g) => getEffectiveStatus(g, now) === 'OPEN',
  ).length
  const forthcomingHuCount = cleanActiveGrants.filter(
    (g) => getEffectiveStatus(g, now) === 'FORTHCOMING',
  ).length

  // Compute personalized matches (available to all registered plans including FREE)
  const personalizedGrants = profileConfigured
    ? cleanActiveGrants
        .map((grant) => ({
          grant,
          evaluation: evaluateGrantEligibility(grant, companyProfile),
        }))
        .filter(({ grant, evaluation }) => {
          if (evaluation.failCount > 0) return false
          if (companyProfile.sectorPrefs.length > 0) {
            const grantSectors = [...(grant.eligibleSectors || []), ...(grant.aiSectors || [])]
              .join(' ')
              .toLowerCase()
            const sectorMatch = companyProfile.sectorPrefs.some((s) =>
              grantSectors.includes(s.toLowerCase().split(' ')[0]),
            )
            if (!sectorMatch && grantSectors.length > 0) return false
          }
          return true
        })
        .sort((a, b) => a.evaluation.warnCount - b.evaluation.warnCount)
    : []

  // Top Hungarian opportunities sorted by importance & status
  const prioritizedGrants = [...cleanActiveGrants]
    .sort((a, b) => {
      const statusRank = (g: typeof a) => (getEffectiveStatus(g, now) === 'OPEN' ? 100 : 60)
      const progRank = (g: typeof a) =>
        /(ginop|dimop|kap|nkfi|széchenyi|mfb|kavosz)/i.test(
          `${g.code || ''} ${g.program || ''} ${g.titleHu || ''}`,
        )
          ? 40
          : 0
      const scoreB = statusRank(b) + progRank(b)
      const scoreA = statusRank(a) + progRank(a)
      if (scoreB !== scoreA) return scoreB - scoreA
      return (a.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER)
    })
    .slice(0, 8)

  const statCards = [
    {
      href: '/dashboard/grants?status=OPEN&country=HU',
      icon: TrendingUp,
      label: 'Nyitott magyar pályázat',
      value: openHuCount,
      hint: 'Kattints a listához →',
      color: 'var(--gr-green)',
    },
    {
      href: '/dashboard/grants?status=FORTHCOMING&country=HU',
      icon: Calendar,
      label: 'Hamarosan nyílik',
      value: forthcomingHuCount,
      hint: 'Tervezett kiírások →',
      color: 'var(--gr-amber)',
    },
    {
      href: profileConfigured ? '/dashboard/grants?forMe=1' : '/dashboard/settings',
      icon: Sparkles,
      label: 'Cégemre szabott találat',
      value: profileConfigured ? personalizedGrants.length : 'Beállítás',
      hint: profileConfigured ? 'Saját találatok →' : 'Cégprofil kitöltése →',
      color: 'var(--gr-primary)',
    },
    {
      href: '/dashboard/grants?status=ALL&country=ALL',
      icon: Database,
      label: 'Teljes adatbázis (EU is)',
      value: totalCount,
      hint: 'Minden forrás →',
      color: 'var(--gr-text)',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Áttekintés</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Aktuális magyar és uniós pályázati helyzetkép — kattints bármelyik kártyára a szűrt lista megnyitásához
        </p>
      </div>

      {/* Clickable Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="stat-card card-interactive block no-underline group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--gr-text-2)' }}>
                  {stat.label}
                </span>
              </div>
              <ArrowRight
                className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--gr-primary)' }}
              />
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-xs font-medium" style={{ color: 'var(--gr-text-3)' }}>
              {stat.hint}
            </div>
          </Link>
        ))}
      </div>

      {/* Personalized Company Matches */}
      <section className="card p-6" style={{ borderColor: 'var(--gr-primary)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--gr-primary)' }} />
            <div>
              <h2 className="text-base font-bold">Cégemre szabott pályázati lehetőségek</h2>
              <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                {profileConfigured
                  ? 'A Cégprofilod adatai alapján előszűrt, kizáró ok nélküli aktív magyar pályázatok'
                  : 'Töltsd ki a vállalkozásod alapadatait, és automatikusan kilistázzuk a számodra releváns kiírásokat.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/settings" className="btn-secondary text-xs py-2 px-3">
              <Settings className="w-3.5 h-3.5" />
              {profileConfigured ? 'Cégprofil módosítása' : 'Cégprofil kitöltése'}
            </Link>
            {profileConfigured && personalizedGrants.length > 0 && (
              <Link href="/dashboard/grants?forMe=1" className="btn-primary text-xs py-2 px-3.5">
                Összes találat ({personalizedGrants.length})
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {!profileConfigured ? (
          <div
            className="p-5 rounded-lg border flex flex-wrap items-center justify-between gap-4"
            style={{ background: 'var(--gr-bg-surface)', borderColor: 'var(--gr-border)' }}
          >
            <div className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
              Még nincs beállítva a cégméreted, telephelyed és ágazatod. A kitöltés után a{' '}
              <strong>Pályázatok</strong> menüben a <strong>„Cégemre szabva”</strong> gombbal is bármikor szűrhetsz.
            </div>
            <Link href="/dashboard/settings" className="btn-primary text-xs py-2.5 px-4 shrink-0">
              Cégadatok megadása (2 perc)
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : personalizedGrants.length === 0 ? (
          <div
            className="p-5 rounded-lg border text-sm"
            style={{ background: 'var(--gr-bg-surface)', borderColor: 'var(--gr-border)', color: 'var(--gr-text-2)' }}
          >
            Jelenleg nem találtunk a szigorú szűrőidre pontosan illeszkedő aktív magyar pályázatot. Nézd meg az{' '}
            <Link href="/dashboard/grants" className="font-semibold underline" style={{ color: 'var(--gr-primary)' }}>
              összes nyitott magyar kiírást
            </Link>
            , vagy finomítsd az ágazati beállításaidat.
          </div>
        ) : (
          <div className="space-y-2">
            {personalizedGrants.slice(0, 5).map(({ grant, evaluation }) => {
              const eff = getEffectiveStatus(grant, now)
              return (
                <Link
                  key={grant.id}
                  href={`/dashboard/grants/${grant.id}`}
                  className="card card-interactive p-4 block no-underline group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {grant.code && (
                          <span
                            className="mono text-xs px-2 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-text)' }}
                          >
                            {grant.code}
                          </span>
                        )}
                        <span className={`pill ${getStatusColor(eff)}`}>
                          {getStatusLabel(eff)}
                        </span>
                        <span
                          className={`pill ${
                            evaluation.verdictTone === 'green' ? 'pill-green' : 'pill-amber'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {evaluation.verdictLabel}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold mb-1 truncate" style={{ color: 'var(--gr-text)' }}>
                        {grant.titleHu || grant.titleEn || 'N/A'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--gr-text-3)' }}>
                        {grant.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatRelativeDate(grant.deadline)}
                          </span>
                        )}
                        {grant.maxAmountHuf && (
                          <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--gr-gold)' }}>
                            <Banknote className="w-3 h-3" />
                            Max. {formatHuf(grant.maxAmountHuf)}
                          </span>
                        )}
                        <span>🇭🇺 {grant.source.name}</span>
                      </div>
                    </div>
                    <ArrowRight
                      className="w-4 h-4 mt-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--gr-primary)' }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Top Prioritized Hungarian Grants */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold tracking-tight">Kiemelt nyitott magyar pályázatok</h2>
          <Link
            href="/dashboard/grants?status=OPEN&country=HU"
            className="text-xs font-semibold no-underline flex items-center gap-1"
            style={{ color: 'var(--gr-primary)' }}
          >
            Összes megtekintése <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2">
          {prioritizedGrants.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
                Jelenleg nincs nyitott magyar pályázat az adatbázisban.
              </p>
            </div>
          ) : (
            prioritizedGrants.map((grant) => {
              const eff = getEffectiveStatus(grant, now)
              return (
                <Link
                  key={grant.id}
                  href={`/dashboard/grants/${grant.id}`}
                  className="card card-interactive p-4 block no-underline group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {grant.code && (
                          <span
                            className="mono text-xs px-2 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-text)' }}
                          >
                            {grant.code}
                          </span>
                        )}
                        <span className={`pill ${getStatusColor(eff)}`}>
                          {getStatusLabel(eff)}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold mb-1 truncate" style={{ color: 'var(--gr-text)' }}>
                        {grant.titleHu || grant.titleEn || 'N/A'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--gr-text-3)' }}>
                        {grant.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatRelativeDate(grant.deadline)}
                          </span>
                        )}
                        {grant.maxAmountHuf && (
                          <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--gr-gold)' }}>
                            <Banknote className="w-3 h-3" />
                            Max. {formatHuf(grant.maxAmountHuf)}
                          </span>
                        )}
                        <span>
                          {grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}
                        </span>
                      </div>
                    </div>
                    <ArrowRight
                      className="w-4 h-4 mt-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--gr-primary)' }}
                    />
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
