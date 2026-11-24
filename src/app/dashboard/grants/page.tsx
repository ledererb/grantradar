'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Sparkles,
  Calendar,
  Banknote,
  ArrowRight,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Bookmark,
  Lock,
  ShieldCheck,
  Archive,
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
  effectiveStatus?: string
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
  eligibilityVerdict?: {
    label: string
    tone: 'green' | 'amber' | 'red' | 'muted'
    failCount: number
  } | null
}

const FILTERS = {
  status: [
    { value: 'ACTIVE', label: 'Aktív (Nyitott + Hamarosan)' },
    { value: 'OPEN', label: 'Csak nyitott' },
    { value: 'FORTHCOMING', label: 'Hamarosan nyílik' },
    { value: 'CLOSED', label: 'Lezárult / felfüggesztett' },
    { value: 'ALL', label: 'Minden státusz' },
  ],
  type: [
    { value: '', label: 'Minden forma' },
    { value: 'GRANT', label: 'Vissza nem térítendő' },
    { value: 'LOAN', label: 'Kedvezményes hitel' },
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
  target: [
    { value: '', label: 'Minden pályázó' },
    { value: 'KKV', label: 'KKV / Vállalkozás' },
    { value: 'AGRI', label: 'Mezőgazdaság / Őstermelő' },
    { value: 'STARTUP', label: 'Innováció / Kutatás' },
    { value: 'MUNICIPAL', label: 'Önkormányzat / Közszféra' },
  ],
  size: [
    { value: '', label: 'Mind' },
    { value: 'MICRO', label: 'Mikro (0–9 fő)' },
    { value: 'SMALL', label: 'Kis (10–49 fő)' },
    { value: 'MEDIUM', label: 'Közép (50–249 fő)' },
  ],
  country: [
    { value: 'HU', label: '🇭🇺 Magyar pályázatok' },
    { value: 'EU', label: '🇪🇺 Közvetlen EU' },
    { value: 'ALL', label: 'Mind (HU + EU)' },
  ],
  sort: [
    { value: 'relevance', label: 'Fontosság és relevancia' },
    { value: 'deadline', label: 'Határidő' },
    { value: 'date', label: 'Legújabb' },
    { value: 'amount', label: 'Támogatási összeg' },
  ],
}

function GrantsPageContent() {
  const urlParams = useSearchParams()

  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [closedMatchCount, setClosedMatchCount] = useState(0)
  const [profileConfigured, setProfileConfigured] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [searchQuery, setSearchQuery] = useState(() => urlParams.get('q') || '')
  const [submittedSearch, setSubmittedSearch] = useState(() => urlParams.get('q') || '')
  const [semanticQuery, setSemanticQuery] = useState('')
  const [isSemanticMode, setIsSemanticMode] = useState(false)

  const [status, setStatus] = useState(() => urlParams.get('status') || 'ACTIVE')
  const [fundingType, setFundingType] = useState(() => urlParams.get('fundingType') || '')
  const [program, setProgram] = useState(() => urlParams.get('program') || '')
  const [target, setTarget] = useState(() => urlParams.get('target') || '')
  const [size, setSize] = useState(() => urlParams.get('size') || '')
  const [country, setCountry] = useState(() => urlParams.get('country') || 'HU')
  const [forMe, setForMe] = useState(() => urlParams.get('forMe') === '1')
  const [sortBy, setSortBy] = useState(() => urlParams.get('sort') || 'relevance')

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
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        sort: sortBy,
        status,
        country,
      })
      if (isSemanticMode && semanticQuery) params.set('semantic', semanticQuery)
      else if (submittedSearch) params.set('q', submittedSearch)
      if (fundingType) params.set('fundingType', fundingType)
      if (program) params.set('program', program)
      if (target) params.set('target', target)
      if (size) params.set('size', size)
      if (forMe) params.set('forMe', '1')

      const res = await fetch(`/api/grants?${params}`)
      const data = await res.json()

      if (res.status === 403 && data.code === 'PLAN_REQUIRED') {
        setPlanRequiredError(true)
        setGrants([])
        setTotal(0)
        return
      }

      setGrants(data.grants || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setClosedMatchCount(data.closedMatchCount || 0)
      setProfileConfigured(Boolean(data.profileConfigured))
    } catch (err) {
      console.error('Error fetching grants:', err)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    submittedSearch,
    semanticQuery,
    isSemanticMode,
    status,
    fundingType,
    program,
    target,
    size,
    country,
    forMe,
    sortBy,
  ])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!active) return
      await fetchGrants()
    }
    void Promise.resolve().then(run)
    return () => {
      active = false
    }
  }, [fetchGrants])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    if (isSemanticMode) {
      setSemanticQuery(searchQuery)
    } else {
      setSubmittedSearch(searchQuery)
    }
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

  const hasActiveFilters = Boolean(
    status !== 'ACTIVE' ||
      country !== 'HU' ||
      fundingType ||
      program ||
      target ||
      size ||
      forMe,
  )

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pályázatkereső</h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            {total > 0
              ? `${total} pályázat a szűrésed alapján`
              : 'Aktuális magyar (és külön fülön uniós) pályázatok fontossági sorrendben'}
          </p>
        </div>

        {/* Region / Source Scope Tabs + Personalization Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.country.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCountry(c.value)
                setPage(1)
              }}
              className={`pill cursor-pointer py-1.5 px-3 ${
                country === c.value ? 'pill-blue' : 'pill-muted'
              }`}
            >
              {c.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setForMe(!forMe)
              setPage(1)
            }}
            className={`pill cursor-pointer py-1.5 px-3 ${
              forMe ? 'pill-green' : 'pill-muted'
            }`}
            style={
              forMe
                ? { borderColor: 'var(--gr-green)', borderWidth: '1px' }
                : {}
            }
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Cégemre szabva
          </button>
        </div>
      </div>

      {/* Quick Program Pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {FILTERS.program.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              setProgram(p.value)
              setPage(1)
            }}
            className={`pill cursor-pointer py-1 px-2.5 ${
              program === p.value ? 'pill-gold' : 'pill-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-5">
        <div className="flex flex-wrap gap-2.5">
          <div className="flex-1 min-w-[240px] relative">
            {isSemanticMode ? (
              <Sparkles
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--gr-primary)' }}
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
              className="input"
              placeholder={
                isSemanticMode
                  ? 'Írd le saját szavaiddal: pl. „napelem és hőszivattyú vidéki üzemnek”'
                  : 'Keresés cím, kód (pl. GINOP, DIMOP Plusz-1.2.6/C, KAP) alapján...'
              }
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSemanticMode(!isSemanticMode)
              setPlanRequiredError(false)
            }}
            className="btn-secondary px-3.5"
            style={
              isSemanticMode
                ? {
                    background: 'var(--gr-blue-bg)',
                    borderColor: 'var(--gr-primary)',
                    color: 'var(--gr-primary)',
                  }
                : {}
            }
          >
            <Sparkles className="w-4 h-4" />
            <span>AI okoskereső</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary px-3.5"
            style={
              hasActiveFilters
                ? {
                    background: 'var(--gr-blue-bg)',
                    borderColor: 'var(--gr-primary)',
                    color: 'var(--gr-primary)',
                  }
                : {}
            }
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Szűrők</span>
          </button>
          <button type="submit" className="btn-primary px-6">
            Keresés
          </button>
        </div>
      </form>

      {/* Personalization Prompt Banner when `forMe` is active without configured profile */}
      {forMe && !profileConfigured && !loading && (
        <div
          className="card p-4 mb-5 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'var(--gr-primary)', background: 'var(--gr-blue-bg)' }}
        >
          <div className="text-sm" style={{ color: 'var(--gr-text)' }}>
            Még nem adtad meg a céged adatait — töltsd ki a Cégprofilt, hogy valóban csak a vállalkozásodra illő pályázatokat mutassuk!
          </div>
          <Link href="/dashboard/settings" className="btn-primary text-xs py-2 px-4 shrink-0">
            Cégprofil kitöltése
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {saveError && (
        <div
          className="card p-3.5 mb-5 flex items-center justify-between gap-3 text-xs"
          style={{ borderColor: 'var(--gr-amber)' }}
        >
          <span style={{ color: 'var(--gr-text)' }}>{saveError}</span>
          <Link href="/dashboard/billing" className="underline font-semibold" style={{ color: 'var(--gr-primary)' }}>
            Váltás PRO csomagra
          </Link>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Részletes szűrők</h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setStatus('ACTIVE')
                  setFundingType('')
                  setProgram('')
                  setTarget('')
                  setSize('')
                  setCountry('HU')
                  setForMe(false)
                  setSortBy('relevance')
                  setPage(1)
                }}
                className="text-xs flex items-center gap-1 cursor-pointer font-medium"
                style={{ color: 'var(--gr-primary)' }}
              >
                <X className="w-3 h-3" />
                Alapértelmezés visszaállítása
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Státusz', value: status, set: setStatus, opts: FILTERS.status },
              { label: 'Célcsoport', value: target, set: setTarget, opts: FILTERS.target },
              { label: 'Támogatás típusa', value: fundingType, set: setFundingType, opts: FILTERS.type },
              { label: 'Cégméret', value: size, set: setSize, opts: FILTERS.size },
              { label: 'Forrás', value: country, set: setCountry, opts: FILTERS.country },
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
        <div className="card p-10 text-center" style={{ borderColor: 'var(--gr-primary)' }}>
          <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--gr-primary)' }} />
          <h3 className="text-lg font-bold mb-2">A szabadszavas AI okoskereső PRO funkció</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--gr-text-2)' }}>
            A PRO csomaggal saját szavaiddal írhatod le a tervezett beruházást (pl. „gépbeszerzés és napelem vidéki üzemnek”), és a rendszer megkeresi a tartalmilag legjobban illő pályázatokat.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <UpgradeButton plan="PRO" label="Váltás PRO csomagra (11 900 Ft + ÁFA / hó)" />
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
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gr-primary)' }} />
        </div>
      ) : grants.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <Search className="w-10 h-10 mx-auto" style={{ color: 'var(--gr-text-3)' }} />
          <div>
            <h3 className="text-lg font-semibold mb-1">Nincs találat a jelenlegi szűrőkkel</h3>
            <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
              {closedMatchCount > 0
                ? `Aktív státuszban nem található, de az adatbázisban találtunk ${closedMatchCount} lezárult vagy felfüggesztett felhívást erre a keresésre.`
                : 'Próbálj más kulcsszót, vagy kapcsold ki a szűrők egy részét.'}
            </p>
          </div>
          {closedMatchCount > 0 && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setStatus('CLOSED')
                  setCountry('ALL')
                  setPage(1)
                }}
                className="btn-primary text-sm"
              >
                <Archive className="w-4 h-4" />
                Lezárult találatok megjelenítése ({closedMatchCount} db)
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {grants.map((grant) => {
              const effStatus = grant.effectiveStatus || grant.status
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
                            className="mono text-xs px-2 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-text)' }}
                          >
                            {grant.code}
                          </span>
                        )}
                        <span className={`pill ${getStatusColor(effStatus)}`}>
                          {getStatusLabel(effStatus)}
                        </span>
                        <span className={`pill ${getFundingTypeColor(grant.fundingType)}`}>
                          {getFundingTypeLabel(grant.fundingType)}
                        </span>
                        <span className="pill pill-muted">
                          {progProfile.name.split(' (')[0]}
                        </span>
                        {grant.eligibilityVerdict && effStatus !== 'CLOSED' && (
                          <span
                            className={`pill ${
                              grant.eligibilityVerdict.tone === 'green'
                                ? 'pill-green'
                                : grant.eligibilityVerdict.tone === 'amber'
                                  ? 'pill-amber'
                                  : grant.eligibilityVerdict.tone === 'red'
                                    ? 'pill-red'
                                    : 'pill-muted'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            {grant.eligibilityVerdict.label}
                          </span>
                        )}
                        {grant.aiDifficultyScore && (
                          <span className="text-xs font-medium" style={{ color: diff.color }}>
                            {diff.label}
                          </span>
                        )}
                        {grant.similarity !== undefined && (
                          <span className="pill pill-blue">
                            {Math.round(grant.similarity * 100)}% egyezés
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
                          <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--gr-gold)' }}>
                            <Banknote className="w-3 h-3" />
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
                          background: isSaved ? 'var(--gr-blue-bg)' : 'var(--gr-bg-surface)',
                          borderColor: isSaved ? 'var(--gr-primary)' : 'var(--gr-border)',
                        }}
                      >
                        <Bookmark
                          className="w-4 h-4"
                          style={{
                            color: isSaved ? 'var(--gr-primary)' : 'var(--gr-text-2)',
                            fill: isSaved ? 'var(--gr-primary)' : 'none',
                          }}
                        />
                      </button>
                      <ArrowRight
                        className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--gr-primary)' }}
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
              <span className="text-sm font-medium" style={{ color: 'var(--gr-text-2)' }}>
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

export default function GrantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gr-primary)' }} />
        </div>
      }
    >
      <GrantsPageContent />
    </Suspense>
  )
}
