'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Sparkles,
  Calendar,
  Euro,
  ArrowRight,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Bookmark,
  Lock,
} from 'lucide-react'
import {
  formatHuf,
  formatRelativeDate,
  getStatusLabel,
  getStatusColor,
  getFundingTypeLabel,
  getFundingTypeColor,
  getDifficultyInfo,
  truncate,
} from '@/lib/utils'
import { classifyGrantProgram } from '@/lib/grant-handbook'
import { UpgradeButton } from '@/components/UpgradeButton'

interface Grant {
  id: string
  titleHu: string | null
  titleEn: string | null
  code: string | null
  program: string | null
  status: string
  fundingType: string
  deadline: string | null
  maxAmountHuf: string | null
  maxAmountEur: number | null
  eligibleSizes: string[]
  aiSummaryHu: string | null
  aiDifficultyScore: number | null
  aiSectors: string[]
  sourceUrl: string
  source: { name: string; country: string }
  similarity?: number
}

const FILTERS = {
  status: [
    { value: '', label: 'Mind' },
    { value: 'OPEN', label: 'Nyitott' },
    { value: 'FORTHCOMING', label: 'Hamarosan' },
    { value: 'CLOSED', label: 'Lezárt' },
  ],
  type: [
    { value: '', label: 'Mind' },
    { value: 'GRANT', label: 'Vissza nem térítendő' },
    { value: 'LOAN', label: 'Hitel' },
    { value: 'GUARANTEE', label: 'Garancia' },
    { value: 'MIXED', label: 'Kombinált' },
  ],
  program: [
    { value: '', label: 'Minden program' },
    { value: 'GINOP', label: 'GINOP Plusz' },
    { value: 'DIMOP', label: 'DIMOP Plusz' },
    { value: 'KAP', label: 'KAP (Agrár)' },
    { value: 'NKFI', label: 'NKFIH / K+F+I' },
    { value: 'Széchenyi', label: 'Széchenyi Kártya / MFB' },
  ],
  size: [
    { value: '', label: 'Mind' },
    { value: 'MICRO', label: 'Mikro (0–9 fő)' },
    { value: 'SMALL', label: 'Kis (10–49 fő)' },
    { value: 'MEDIUM', label: 'Közép (50–249 fő)' },
  ],
  country: [
    { value: '', label: 'Mind' },
    { value: 'HU', label: '🇭🇺 Magyar' },
    { value: 'EU', label: '🇪🇺 EU' },
  ],
  sort: [
    { value: 'deadline', label: 'Határidő' },
    { value: 'date', label: 'Legújabb' },
    { value: 'amount', label: 'Összeg' },
  ],
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
  const [program, setProgram] = useState('')
  const [size, setSize] = useState('')
  const [country, setCountry] = useState('')
  const [sortBy, setSortBy] = useState('deadline')
  const [showFilters, setShowFilters] = useState(false)
  const [planRequiredError, setPlanRequiredError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/grants/save')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.savedIds) setSavedIds(new Set(data.savedIds))
      })
      .catch(() => {})
  }, [])

  const fetchGrants = useCallback(async () => {
    setLoading(true)
    setPlanRequiredError(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15', sort: sortBy })
      if (isSemanticMode && semanticQuery) params.set('semantic', semanticQuery)
      else if (searchQuery) params.set('q', searchQuery)
      if (status) params.set('status', status)
      if (fundingType) params.set('fundingType', fundingType)
      if (program) params.set('program', program)
      if (size) params.set('size', size)
      if (country) params.set('country', country)

      const res = await fetch(`/api/grants?${params}`)
      const data = await res.json()

      if (res.status === 403 && data.code === 'PLAN_REQUIRED') {
        setPlanRequiredError(true)
        setGrants([])
        setTotal(0)
        return
      }

      setGrants(data.grants || [])
      setTotal(data.total || data.grants?.length || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error('Error fetching grants:', err)
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, semanticQuery, isSemanticMode, status, fundingType, program, size, country, sortBy])

  useEffect(() => {
    fetchGrants()
  }, [fetchGrants])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    if (isSemanticMode) setSemanticQuery(searchQuery)
    fetchGrants()
  }

  async function toggleSave(e: React.MouseEvent, grantId: string) {
    e.preventDefault()
    e.stopPropagation()
    setSaveError(null)

    const wasSaved = savedIds.has(grantId)
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (wasSaved) next.delete(grantId)
      else next.add(grantId)
      return next
    })

    try {
      const res = await fetch('/api/grants/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Revert optimistic update
        setSavedIds((prev) => {
          const next = new Set(prev)
          if (wasSaved) next.add(grantId)
          else next.delete(grantId)
          return next
        })
        setSaveError(data.error || 'Nem sikerült menteni a pályázatot.')
      }
    } catch {
      setSaveError('Hálózati hiba történt.')
    }
  }

  const hasActiveFilters = Boolean(status || fundingType || program || size || country)

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pályázatok</h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            {total > 0 ? `${total} pályázat találva` : 'Keresés a GINOP Plusz, DIMOP Plusz, KAP és EU pályázatok között'}
          </p>
        </div>

        {/* Quick Program Pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.program.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setProgram(p.value)
                setPage(1)
              }}
              className={`pill text-xs cursor-pointer py-1 px-2.5 ${
                program === p.value ? 'pill-gold' : 'pill-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            {isSemanticMode ? (
              <Sparkles
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--gr-gold)' }}
              />
            ) : (
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--gr-text-3)' }}
              />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              placeholder={
                isSemanticMode
                  ? 'AI szemantikus keresés: pl. "napelem és hőszivattyú telepítés vidéki KKV-nak"'
                  : 'Keresés cím, kód (pl. GINOP, DIMOP, KAP), program alapján...'
              }
              style={
                isSemanticMode
                  ? { borderColor: 'var(--gr-gold)', boxShadow: '0 0 0 3px var(--gr-gold-muted)' }
                  : {}
              }
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSemanticMode(!isSemanticMode)
              setPlanRequiredError(false)
            }}
            className="btn-secondary px-4"
            style={
              isSemanticMode
                ? {
                    background: 'var(--gr-gold-muted)',
                    borderColor: 'var(--gr-gold)',
                    color: 'var(--gr-gold)',
                  }
                : {}
            }
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI kereső</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary px-4"
            style={
              hasActiveFilters
                ? {
                    background: 'var(--gr-gold-muted)',
                    borderColor: 'var(--gr-gold)',
                    color: 'var(--gr-gold)',
                  }
                : {}
            }
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Szűrők</span>
          </button>
          <button type="submit" className="btn-primary px-6">
            Keresés
          </button>
        </div>
      </form>

      {saveError && (
        <div
          className="card p-3.5 mb-5 flex items-center justify-between gap-3 text-xs"
          style={{ borderColor: 'var(--gr-gold)' }}
        >
          <span style={{ color: 'var(--gr-text)' }}>{saveError}</span>
          <Link href="/dashboard/billing" className="underline font-semibold" style={{ color: 'var(--gr-gold)' }}>
            Váltás PRO csomagra
          </Link>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Részletes szűrők</h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setStatus('')
                  setFundingType('')
                  setProgram('')
                  setSize('')
                  setCountry('')
                  setPage(1)
                }}
                className="text-xs flex items-center gap-1 cursor-pointer"
                style={{ color: 'var(--gr-text-2)' }}
              >
                <X className="w-3 h-3" />
                Szűrők törlése
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Státusz', value: status, set: setStatus, opts: FILTERS.status },
              { label: 'Támogatás típusa', value: fundingType, set: setFundingType, opts: FILTERS.type },
              { label: 'Cégméret', value: size, set: setSize, opts: FILTERS.size },
              { label: 'Forrás ország', value: country, set: setCountry, opts: FILTERS.country },
              { label: 'Rendezés', value: sortBy, set: setSortBy, opts: FILTERS.sort },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  {f.label}
                </label>
                <select
                  value={f.value}
                  onChange={(e) => {
                    f.set(e.target.value)
                    setPage(1)
                  }}
                  className="input text-sm"
                >
                  {f.opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Required Banner for Semantic Search */}
      {planRequiredError ? (
        <div className="card p-10 text-center" style={{ borderColor: 'var(--gr-gold)' }}>
          <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--gr-gold)' }} />
          <h3 className="text-lg font-bold mb-2">Az AI szemantikus keresés PRO funkció</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--gr-text-2)' }}>
            A PRO csomaggal szabadszavasan írhatod le a tervezett beruházást (pl. „gépbeszerzés és napelem vidéki fémmegmunkáló üzemnek”), és az AI vektoros hasonlóság alapján megkeresi a legrelevánsabb kiírásokat.
          </p>
          <div className="flex items-center justify-center gap-3">
            <UpgradeButton plan="PRO" label="Váltás PRO csomagra (€29/hó)" />
            <button
              type="button"
              onClick={() => {
                setIsSemanticMode(false)
                setPlanRequiredError(false)
              }}
              className="btn-secondary text-sm"
            >
              Normál keresés használata
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gr-gold)' }} />
        </div>
      ) : grants.length === 0 ? (
        <div className="card p-16 text-center">
          <Search className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--gr-text-3)' }} />
          <h3 className="text-lg font-semibold mb-2">Nincs találat</h3>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            Próbálj más keresési kifejezést vagy töröld a szűrőket.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {grants.map((grant) => {
              const diff = getDifficultyInfo(grant.aiDifficultyScore)
              const progProfile = classifyGrantProgram(grant)
              const isSaved = savedIds.has(grant.id)

              return (
                <Link
                  key={grant.id}
                  href={`/dashboard/grants/${grant.id}`}
                  className="card card-interactive p-5 block no-underline group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {grant.code && (
                          <span
                            className="mono text-xs px-2 py-0.5 rounded"
                            style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}
                          >
                            {grant.code}
                          </span>
                        )}
                        <span className={`pill ${getStatusColor(grant.status)}`}>
                          {getStatusLabel(grant.status)}
                        </span>
                        <span className={`pill ${getFundingTypeColor(grant.fundingType)}`}>
                          {getFundingTypeLabel(grant.fundingType)}
                        </span>
                        <span className="pill pill-muted">
                          {progProfile.name.split(' (')[0]}
                        </span>
                        {grant.aiDifficultyScore && (
                          <span className="text-xs font-medium" style={{ color: diff.color }}>
                            {diff.label}
                          </span>
                        )}
                        {grant.similarity !== undefined && (
                          <span className="pill pill-gold">
                            {Math.round(grant.similarity * 100)}% AI egyezés
                          </span>
                        )}
                      </div>

                      <h3
                        className="font-semibold mb-1 transition-colors"
                        style={{ color: 'var(--gr-text)' }}
                      >
                        {grant.titleHu || grant.titleEn || 'N/A'}
                      </h3>

                      {grant.aiSummaryHu && (
                        <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--gr-text-2)' }}>
                          {truncate(grant.aiSummaryHu, 200)}
                        </p>
                      )}

                      {grant.aiSectors?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {grant.aiSectors.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-text-2)' }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--gr-text-3)' }}>
                        {grant.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatRelativeDate(grant.deadline)}
                          </span>
                        )}
                        {(grant.maxAmountHuf || grant.maxAmountEur) && (
                          <span className="flex items-center gap-1" style={{ color: 'var(--gr-gold)' }}>
                            <Euro className="w-3 h-3" />
                            {grant.maxAmountHuf
                              ? formatHuf(BigInt(grant.maxAmountHuf))
                              : `€${grant.maxAmountEur?.toLocaleString('hu-HU')}`}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => toggleSave(e, grant.id)}
                        title={isSaved ? 'Eltávolítás a mentettek közül' : 'Pályázat mentése'}
                        className="p-2 rounded-lg border transition-colors cursor-pointer"
                        style={{
                          background: isSaved ? 'var(--gr-gold-muted)' : 'var(--gr-bg-surface)',
                          borderColor: isSaved ? 'var(--gr-gold-dim)' : 'var(--gr-border)',
                        }}
                      >
                        <Bookmark
                          className="w-4 h-4"
                          style={{
                            color: isSaved ? 'var(--gr-gold)' : 'var(--gr-text-2)',
                            fill: isSaved ? 'var(--gr-gold)' : 'none',
                          }}
                        />
                      </button>
                      <ArrowRight
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--gr-gold)' }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary px-3 py-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-secondary px-3 py-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
