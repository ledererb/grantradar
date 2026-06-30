import { prisma } from '@/lib/db'
import Link from 'next/link'
import { ArrowRight, Calendar, TrendingUp, Database, Zap } from 'lucide-react'
import { formatRelativeDate, getStatusLabel } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [openCount, forthcomingCount, totalCount, latestGrants] = await Promise.all([
    prisma.grant.count({ where: { status: 'OPEN' } }),
    prisma.grant.count({ where: { status: 'FORTHCOMING' } }),
    prisma.grant.count(),
    prisma.grant.findMany({
      where: { status: { in: ['OPEN', 'FORTHCOMING'] } },
      include: { source: { select: { name: true, country: true } } },
      orderBy: { firstSeenAt: 'desc' },
      take: 8,
    }),
  ])

  const sourceCount = await prisma.source.count()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Áttekintés</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Pályázati radar státusz
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { icon: TrendingUp, label: 'Nyitott pályázat', value: openCount, color: 'var(--gr-green)' },
          { icon: Calendar, label: 'Hamarosan nyílik', value: forthcomingCount, color: 'var(--gr-amber)' },
          { icon: Database, label: 'Összesen', value: totalCount, color: 'var(--gr-text)' },
          { icon: Zap, label: 'Aktív forrás', value: sourceCount, color: 'var(--gr-gold)' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="w-4 h-4" style={{ color: 'var(--gr-text-3)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--gr-text-2)' }}>{stat.label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Grants */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold tracking-tight">Legújabb pályázatok</h2>
        <Link href="/dashboard/grants" className="text-xs font-medium no-underline flex items-center gap-1"
          style={{ color: 'var(--gr-gold)' }}>
          Összes <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {latestGrants.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--gr-text-3)' }}>
              Még nincsenek pályázatok. Indítsd el a szkennelést a cron job segítségével.
            </p>
          </div>
        ) : (
          latestGrants.map((grant) => (
            <Link key={grant.id} href={`/dashboard/grants/${grant.id}`}
              className="card card-interactive p-4 block no-underline group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {grant.code && (
                      <span className="mono text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}>
                        {grant.code}
                      </span>
                    )}
                    <span className={`pill ${grant.status === 'OPEN' ? 'pill-green' : 'pill-amber'}`}>
                      {getStatusLabel(grant.status)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1 truncate">{grant.titleHu || grant.titleEn || 'N/A'}</h3>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--gr-text-3)' }}>
                    {grant.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeDate(grant.deadline)}
                      </span>
                    )}
                    <span>
                      {grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 mt-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--gr-gold)' }} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
