import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Euro, Building2, ExternalLink, FileText, Sparkles, Clock, Target, ChevronRight } from 'lucide-react'
import { formatHuf, formatDate, formatRelativeDate, getStatusLabel, getStatusColor, getFundingTypeLabel, getFundingTypeColor, getCompanySizeLabel, getDifficultyInfo } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const grant = await prisma.grant.findUnique({
    where: { id },
    include: { source: { select: { name: true, country: true, url: true } } },
  })

  if (!grant) notFound()

  const difficulty = getDifficultyInfo(grant.aiDifficultyScore)

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <Link href="/dashboard/grants" className="inline-flex items-center gap-1.5 text-sm mb-6 no-underline" style={{ color: 'var(--gr-text-secondary)' }}>
        <ArrowLeft className="w-4 h-4" />Vissza a pályázatokhoz
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {grant.code && <span className="text-sm font-mono px-3 py-1 rounded" style={{ background: 'var(--gr-bg-elevated)', color: 'var(--gr-primary-light)' }}>{grant.code}</span>}
          <span className={`badge ${getStatusColor(grant.status)}`}>{getStatusLabel(grant.status)}</span>
          <span className={`badge ${getFundingTypeColor(grant.fundingType)}`}>{getFundingTypeLabel(grant.fundingType)}</span>
          {grant.aiDifficultyScore && <span className="text-sm font-medium" style={{ color: difficulty.color }}>Nehézség: {difficulty.label}</span>}
        </div>
        <h1 className="text-2xl font-bold mb-2">{grant.titleHu || grant.titleEn || 'N/A'}</h1>
        {grant.program && <p className="text-sm" style={{ color: 'var(--gr-text-secondary)' }}>Program: {grant.program}</p>}
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Calendar, label: 'Határidő', value: grant.deadline ? formatDate(grant.deadline) : 'N/A', sub: grant.deadline ? formatRelativeDate(grant.deadline) : undefined, color: grant.deadline && new Date(grant.deadline) < new Date(Date.now() + 14*24*60*60*1000) ? '#ef4444' : 'var(--gr-text-primary)' },
          { icon: Euro, label: 'Támogatás összege', value: grant.maxAmountHuf ? formatHuf(grant.maxAmountHuf) : grant.maxAmountEur ? `€${grant.maxAmountEur.toLocaleString('hu-HU')}` : 'N/A', sub: grant.supportIntensityPct ? `${grant.supportIntensityPct}% intenzitás` : undefined, color: 'var(--gr-text-primary)' },
          { icon: Building2, label: 'Cégméret', value: grant.eligibleSizes.length > 0 ? grant.eligibleSizes.map(getCompanySizeLabel).join(', ') : 'Minden méret', color: 'var(--gr-text-primary)' },
          { icon: Target, label: 'Forrás', value: grant.source.name, sub: grant.source.country === 'HU' ? '🇭🇺 Magyar' : '🇪🇺 EU', color: 'var(--gr-text-primary)' },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4" style={{ color: 'var(--gr-text-muted)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--gr-text-secondary)' }}>{card.label}</span>
            </div>
            <div className="text-sm font-semibold" style={{ color: card.color }}>{card.value}</div>
            {card.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--gr-text-muted)' }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* AI Summary */}
      {grant.aiSummaryHu && (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--gr-accent)' }} />
            <h2 className="text-sm font-semibold">AI Összefoglaló</h2>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--gr-text-secondary)' }}>{grant.aiSummaryHu}</p>
        </div>
      )}

      {/* AI Key Points */}
      {grant.aiKeyPoints?.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-3">Legfontosabb tudnivalók</h2>
          <ul className="space-y-2">
            {grant.aiKeyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--gr-text-secondary)' }}>
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--gr-primary-light)' }} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Sectors */}
      {grant.aiSectors?.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-3">Releváns ágazatok</h2>
          <div className="flex flex-wrap gap-2">
            {grant.aiSectors.map((sector) => (
              <span key={sector} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--gr-bg-elevated)', border: '1px solid var(--gr-border)', color: 'var(--gr-text-secondary)' }}>{sector}</span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {grant.descriptionHu && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-3">Részletes leírás</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--gr-text-secondary)' }}>{grant.descriptionHu}</p>
        </div>
      )}

      {/* Documents & Links */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-3">Linkek</h2>
        <div className="space-y-2">
          <a href={grant.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm no-underline p-2 rounded-lg transition-colors" style={{ color: 'var(--gr-primary-light)' }}>
            <ExternalLink className="w-4 h-4" />Eredeti pályázati felhívás
          </a>
          {grant.documentUrls?.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm no-underline p-2 rounded-lg" style={{ color: 'var(--gr-primary-light)' }}>
              <FileText className="w-4 h-4" />Dokumentum {i + 1}
            </a>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs space-y-1" style={{ color: 'var(--gr-text-muted)' }}>
        <p>Először észlelve: {formatDate(grant.firstSeenAt)}</p>
        <p>Utoljára frissítve: {formatDate(grant.lastScrapedAt)}</p>
      </div>
    </div>
  )
}