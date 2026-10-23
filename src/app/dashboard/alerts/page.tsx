import { Bell, Lock, Calendar, ArrowRight, ShieldCheck, AlertTriangle, Settings } from 'lucide-react'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUserPlan, planLimits } from '@/lib/plan-limits'
import { formatRelativeDate, formatHuf, getStatusLabel } from '@/lib/utils'
import { parseUserProfile, evaluateGrantEligibility } from '@/lib/grant-handbook'
import { UpgradeButton } from '@/components/UpgradeButton'

export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  const { dbUser, plan } = await getCurrentUserPlan()
  const alertsEnabled = planLimits(plan).alerts

  if (!alertsEnabled || !dbUser) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Értesítések</h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            Cégprofilra szabott pályázati riasztások és határidő-figyelmeztetések
          </p>
        </div>

        <div className="card p-12 text-center" style={{ borderColor: 'var(--gr-gold-dim)' }}>
          <Lock className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--gr-gold)' }} />
          <h3 className="font-semibold mb-2">Az értesítések PRO csomagot igényelnek</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--gr-text-2)', maxWidth: '420px', margin: '0 auto' }}>
            Az automatikus cégprofil-illesztés, a határidő-figyelmeztetések és az előszűrt riasztások a PRO csomag részei.
          </p>
          <UpgradeButton plan="PRO" label="Váltás PRO csomagra (€29/hó)" />
        </div>
      </div>
    )
  }

  const [rawProfile, savedGrants, activeGrants] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: dbUser.id } }),
    prisma.savedGrant.findMany({
      where: { userId: dbUser.id },
      include: {
        grant: {
          include: { source: { select: { name: true, country: true } } },
        },
      },
    }),
    prisma.grant.findMany({
      where: { status: { in: ['OPEN', 'FORTHCOMING'] } },
      include: { source: { select: { name: true, country: true } } },
      orderBy: { firstSeenAt: 'desc' },
      take: 25,
    }),
  ])

  const companyProfile = parseUserProfile(rawProfile)
  const now = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  // 1. Approaching deadlines on saved grants (closing within 30 days)
  const closingSoonSaved = savedGrants
    .filter(({ grant }) => {
      if (!grant.deadline) return false
      const diff = new Date(grant.deadline).getTime() - now
      return diff >= 0 && diff <= thirtyDaysMs
    })
    .sort(
      (a, b) =>
        new Date(a.grant.deadline!).getTime() - new Date(b.grant.deadline!).getTime(),
    )

  // 2. Grants matching company profile & passing 2-minute pre-screen without disqualifiers
  const matchedGrants = activeGrants
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
    .slice(0, 10)

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Értesítések & Pályázati Radar</h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            Közelgő beadási határidők és a 2 perces előszűrőd alapján releváns felhívások
          </p>
        </div>
        <Link href="/dashboard/settings" className="btn-secondary text-xs py-2 px-3.5">
          <Settings className="w-3.5 h-3.5" />
          Előszűrő szűrők módosítása
        </Link>
      </div>

      {/* Section 1: Closing soon saved grants */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--gr-amber)' }} />
          <h2 className="text-sm font-bold">
            Közelgő határidők a mentett pályázataidnál (30 napon belül)
          </h2>
        </div>

        {closingSoonSaved.length === 0 ? (
          <div className="card p-6 text-xs" style={{ color: 'var(--gr-text-2)' }}>
            Jelenleg nincs 30 napon belül lejáró mentett pályázatod.
          </div>
        ) : (
          <div className="space-y-2">
            {closingSoonSaved.map(({ grant }) => (
              <Link
                key={grant.id}
                href={`/dashboard/grants/${grant.id}`}
                className="card card-interactive p-4 block no-underline"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {grant.code && (
                        <span
                          className="mono text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}
                        >
                          {grant.code}
                        </span>
                      )}
                      <span className="pill pill-amber">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeDate(grant.deadline)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold truncate">
                      {grant.titleHu || grant.titleEn || 'N/A'}
                    </h3>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: 'var(--gr-gold)' }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Matched Grants */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
          <h2 className="text-sm font-bold">
            Cégprofilodra illeszkedő aktív pályázatok ({matchedGrants.length})
          </h2>
        </div>

        {matchedGrants.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--gr-text-2)' }}>
              Még nincsenek a szűrőidre illeszkedő aktív pályázatok.
            </p>
            <Link href="/dashboard/settings" className="btn-secondary text-xs py-2 px-4">
              Cégprofil beállítása
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {matchedGrants.map(({ grant, evaluation }) => (
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
                          className="mono text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}
                        >
                          {grant.code}
                        </span>
                      )}
                      <span className={`pill ${grant.status === 'OPEN' ? 'pill-green' : 'pill-amber'}`}>
                        {getStatusLabel(grant.status)}
                      </span>
                      <span
                        className={`pill ${
                          evaluation.verdictTone === 'green'
                            ? 'pill-green'
                            : evaluation.verdictTone === 'amber'
                              ? 'pill-amber'
                              : 'pill-gold'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {evaluation.verdictLabel}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold mb-1 truncate">
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
                        <span style={{ color: 'var(--gr-gold)' }}>
                          Max. {formatHuf(grant.maxAmountHuf)}
                        </span>
                      )}
                      <span>
                        {grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}
                      </span>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 mt-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--gr-gold)' }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
