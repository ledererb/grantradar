'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Sparkles, Calendar, Euro, Building2, ArrowRight, Loader2, X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { formatHuf, formatRelativeDate, getStatusLabel, getStatusColor, getFundingTypeLabel, getFundingTypeColor, getCompanySizeLabel, getDifficultyInfo, truncate } from '@/lib/utils'

interface Grant {
  id: string; titleHu: string | null; titleEn: string | null; code: string | null
  program: string | null; status: string; fundingType: string; deadline: string | null
  maxAmountHuf: string | null; maxAmountEur: number | null; eligibleSizes: string[]
  aiSummaryHu: string | null; aiDifficultyScore: number | null; aiSectors: string[]
  sourceUrl: string; source: { name: string; country: string }; similarity?: number
}

const FILTERS = {
  status: [{ value: '', label: 'Mind' }, { value: 'OPEN', label: 'Nyitott' }, { value: 'FORTHCOMING', label: 'Hamarosan' }, { value: 'CLOSED', label: 'Lezárt' }],
  type: [{ value: '', label: 'Mind' }, { value: 'GRANT', label: 'Vissza nem térítendő' }, { value: 'LOAN', label: 'Hitel' }, { value: 'GUARANTEE', label: 'Garancia' }],
  size: [{ value: '', label: 'Mind' }, { value: 'MICRO', label: 'Mikro' }, { value: 'SMALL', label: 'Kis' }, { value: 'MEDIUM', label: 'Közép' }],
  country: [{ value: '', label: 'Mind' }, { value: 'HU', label: '🇭🇺 Magyar' }, { value: 'EU', label: '🇪🇺 EU' }],
  sort: [{ value: 'deadline', label: 'Határidő' }, { value: 'date', label: 'Legújabb' }, { value: 'amount', label: 'Összeg' }],
}

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [semanticQuery, setSemanticQuery] = useState('')
  const [isSemanticMode, setIsSemanticMode] = useState(false)
  const [status, setStatus] = useState('')
  const [fundingType, setFundingType] = useState('')
  const [size, setSize] = useState('')
  const [country, setCountry] = useState('')
  const [sortBy, setSortBy] = useState('deadline')
  const [showFilters, setShowFilters] = useState(false)

  const fetchGrants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15', sort: sortBy })
      if (isSemanticMode && semanticQuery) params.set('semantic', semanticQuery)
      else if (searchQuery) params.set('q', searchQuery)
      if (status) params.set('status', status)
      if (fundingType) params.set('fundingType', fundingType)
      if (size) params.set('size', size)
      if (country) params.set('country', country)
      const res = await fetch(`/api/grants?${params}`)
      const data = await res.json()
      setGrants(data.grants || [])
      setTotal(data.total || data.grants?.length || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) { console.error('Error fetching grants:', err) }
    finally { setLoading(false) }
  }, [page, searchQuery, semanticQuery, isSemanticMode, status, fundingType, size, country, sortBy])

  useEffect(() => { fetchGrants() }, [fetchGrants])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setPage(1)
    if (isSemanticMode) setSemanticQuery(searchQuery)
    fetchGrants()
  }

  const hasActiveFilters = status || fundingType || size || country

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Pályázatok</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-secondary)' }}>
          {total > 0 ? `${total} pályázat találva` : 'Keresés a pályázatok között'}
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            {isSemanticMode
              ? <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--gr-accent)' }} />
              : <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--gr-text-muted)' }} />}
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              placeholder={isSemanticMode ? 'Pl. "napelem telepítés mikrovállalkozásnak"' : 'Keresés cím, kód, program alapján...'}
              style={isSemanticMode ? { borderColor: 'var(--gr-accent)', boxShadow: '0 0 0 3px rgba(6, 214, 160, 0.1)' } : {}} />
          </div>
          <button type="button" onClick={() => setIsSemanticMode(!isSemanticMode)} className="btn-secondary px-4"
            style={isSemanticMode ? { background: 'rgba(6, 214, 160, 0.1)', borderColor: 'var(--gr-accent)', color: 'var(--gr-accent)' } : {}}>
            <Sparkles className="w-4 h-4" /><span className="hidden sm:inline">AI</span>
          </button>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="btn-secondary px-4"
            style={hasActiveFilters ? { background: 'rgba(99, 102, 241, 0.1)', borderColor: 'var(--gr-primary)', color: 'var(--gr-primary-light)' } : {}}>
            <SlidersHorizontal className="w-4 h-4" /><span className="hidden sm:inline">Szűrők</span>
          </button>
          <button type="submit" className="btn-primary px-6">Keresés</button>
        </div>
      </form>

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Szűrők</h3>
            {hasActiveFilters && <button onClick={() => { setStatus(''); setFundingType(''); setSize(''); setCountry(''); setPage(1) }}
              className="text-xs flex items-center gap-1" style={{ color: 'var(--gr-text-muted)' }}><X className="w-3 h-3" />Törlés</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Státusz', value: status, set: setStatus, opts: FILTERS.status },
              { label: 'Típus', value: fundingType, set: setFundingType, opts: FILTERS.type },
              { label: 'Cégméret', value: size, set: setSize, opts: FILTERS.size },
              { label: 'Ország', value: country, set: setCountry, opts: FILTERS.country },
              { label: 'Rendezés', value: sortBy, set: setSortBy, opts: FILTERS.sort },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-secondary)' }}>{f.label}</label>
                <select value={f.value} onChange={(e) => { f.set(e.target.value); setPage(1) }} className="input text-sm">
                  {f.opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gr-primary)' }} />
        </div>
      ) : grants.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Search className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--gr-text-muted)' }} />
          <h3 className="text-lg font-semibold mb-2">Nincs találat</h3>
          <p className="text-sm" style={{ color: 'var(--gr-text-secondary)' }}>Próbálj más keresési feltételeket.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {grants.map((grant) => {
              const diff = getDifficultyInfo(grant.aiDifficultyScore)
              return (
                <Link key={grant.id} href={`/dashboard/grants/${grant.id}`} className="glass-card p-5 block no-underline group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {grant.code && <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--gr-bg-elevated)', color: 'var(--gr-primary-light)' }}>{grant.code}</span>}
                        <span className={`badge ${getStatusColor(grant.status)}`}>{getStatusLabel(grant.status)}</span>
                        <span className={`badge ${getFundingTypeColor(grant.fundingType)}`}>{getFundingTypeLabel(grant.fundingType)}</span>
                        {grant.aiDifficultyScore && <span className="text-xs font-medium" style={{ color: diff.color }}>{diff.label}</span>}
                        {grant.similarity !== undefined && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(6, 214, 160, 0.1)', color: 'var(--gr-accent)' }}>{Math.round(grant.similarity * 100)}% egyezés</span>}
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-white transition-colors" style={{ color: 'var(--gr-text-primary)' }}>{grant.titleHu || grant.titleEn || 'N/A'}</h3>
                      {grant.aiSummaryHu && <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--gr-text-secondary)' }}>{truncate(grant.aiSummaryHu, 200)}</p>}
                      {grant.aiSectors?.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{grant.aiSectors.slice(0, 4).map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--gr-bg-elevated)', color: 'var(--gr-text-muted)' }}>{s}</span>)}</div>}
                      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--gr-text-muted)' }}>
                        {grant.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatRelativeDate(grant.deadline)}</span>}
                        {(grant.maxAmountHuf || grant.maxAmountEur) && <span className="flex items-center gap-1"><Euro className="w-3 h-3" />{grant.maxAmountHuf ? formatHuf(BigInt(grant.maxAmountHuf)) : `€${grant.maxAmountEur?.toLocaleString('hu-HU')}`}</span>}
                        <span className="flex items-center gap-1">{grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 mt-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gr-primary-light)' }} />
                  </div>
                </Link>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary px-3 py-2" style={{ opacity: page === 1 ? 0.5 : 1 }}><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm" style={{ color: 'var(--gr-text-secondary)' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-secondary px-3 py-2" style={{ opacity: page === totalPages ? 0.5 : 1 }}><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
