'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bookmark, CheckSquare, Square, Save, Loader2, Lock, AlertCircle, Download, Printer } from 'lucide-react'
import { PREPARATION_CHECKLIST_ITEMS, type EligibilityMatrixRow } from '@/lib/grant-handbook'

interface GrantPrepChecklistProps {
  grantId: string
  grantCode?: string | null
  grantTitle?: string | null
  matrixRows?: EligibilityMatrixRow[]
  initialSaved: boolean
  initialCheckedDocs: string[]
  initialNotes: string
  isKap: boolean
  isAuthenticated: boolean
}

export function GrantPrepChecklist({
  grantId,
  grantCode,
  grantTitle,
  matrixRows = [],
  initialSaved,
  initialCheckedDocs,
  initialNotes,
  isKap,
  isAuthenticated,
}: GrantPrepChecklistProps) {
  const [saved, setSaved] = useState(initialSaved)
  const [checkedDocs, setCheckedDocs] = useState<string[]>(initialCheckedDocs)
  const [notes, setNotes] = useState(initialNotes)
  const [savingBookmark, setSavingBookmark] = useState(false)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const items = PREPARATION_CHECKLIST_ITEMS.filter(item => !item.kapOnly || isKap)
  const completedCount = items.filter(i => checkedDocs.includes(i.id)).length
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

  async function handleToggleBookmark() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setSavingBookmark(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/grants/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Nem sikerült menteni a pályázatot.')
      } else {
        setSaved(Boolean(data.saved))
        if (!data.saved) {
          setCheckedDocs([])
          setNotes('')
        }
      }
    } catch {
      setErrorMsg('Hálózati hiba történt.')
    } finally {
      setSavingBookmark(false)
    }
  }

  async function persistChecklist(nextDocs: string[], nextNotes: string) {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setSavingChecklist(true)
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/grants/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantId,
          checkedDocs: nextDocs,
          notes: nextNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Nem sikerült menteni az előkészítő listát.')
      } else {
        setSaved(true)
        setStatusMsg('✓ Előkészítési állapot mentve')
        setTimeout(() => setStatusMsg(null), 2500)
      }
    } catch {
      setErrorMsg('Hálózati hiba történt.')
    } finally {
      setSavingChecklist(false)
    }
  }

  function handleToggleDoc(docId: string) {
    const next = checkedDocs.includes(docId)
      ? checkedDocs.filter(id => id !== docId)
      : [...checkedDocs, docId]
    setCheckedDocs(next)
    persistChecklist(next, notes)
  }

  function handleExportCsv() {
    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`
    const lines: string[] = [
      ['Pályázat kódja', grantCode || 'N/A', 'Pályázat címe', grantTitle || 'N/A'].map(escapeCsv).join(';'),
      '',
      ['JOGOSULTSÁGI MÁTRIX', 'Elvárás', 'Cég állapota', 'Előkészítendő dokumentum', 'Státusz', 'Kockázat / Megjegyzés'].map(escapeCsv).join(';'),
      ...matrixRows.map(r =>
        [r.checkpoint, r.expectation, r.companyState, r.documentToPrepare, r.status, r.riskNote]
          .map(escapeCsv)
          .join(';'),
      ),
      '',
      ['ELŐKÉSZÍTÉSI DOKUMENTUMLISTA', 'Terület', 'Dokumentum', 'Státusz', 'Útmutató'].map(escapeCsv).join(';'),
      ...items.map(i =>
        [
          i.id,
          i.area,
          i.document,
          checkedDocs.includes(i.id) ? 'Kész (☑)' : 'Hiányzik (☐)',
          i.hint,
        ]
          .map(escapeCsv)
          .join(';'),
      ),
    ]

    if (notes) {
      lines.push('', ['Saját jegyzetek', notes].map(escapeCsv).join(';'))
    }

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grantradar-eloszuro-${(grantCode || grantId).replace(/[^a-zA-Z0-9-_]/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrintReport() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar: Save Grant */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bookmark
            className="w-5 h-5"
            style={{
              color: saved ? 'var(--gr-gold)' : 'var(--gr-text-2)',
              fill: saved ? 'var(--gr-gold)' : 'none',
            }}
          />
          <div>
            <div className="text-sm font-semibold">
              {saved ? 'Mentett pályázat' : 'Mentsd el a pályázatot az előkészítés követéséhez'}
            </div>
            <div className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
              Előkészítési dokumentumlista: {completedCount} / {items.length} kész ({progressPct}%)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-secondary text-xs py-2 px-3.5"
          >
            <Download className="w-3.5 h-3.5" />
            Mátrix & Checklist CSV
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            className="btn-secondary text-xs py-2 px-3.5"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF / Nyomtatás
          </button>
          <button
            type="button"
            onClick={handleToggleBookmark}
            disabled={savingBookmark}
            className={saved ? 'btn-secondary text-xs py-2 px-4' : 'btn-primary text-xs py-2 px-4'}
          >
            {savingBookmark ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" style={saved ? { fill: 'var(--gr-gold)', color: 'var(--gr-gold)' } : {}} />
                {saved ? 'Mentve (Eltávolítás)' : 'Pályázat mentése'}
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="card p-4 flex items-center gap-3" style={{ borderColor: 'var(--gr-red)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--gr-red)' }} />
          <div className="text-xs flex-1" style={{ color: 'var(--gr-red)' }}>
            {errorMsg}{' '}
            <Link href="/dashboard/billing" className="underline font-semibold" style={{ color: 'var(--gr-gold)' }}>
              Csomagváltás
            </Link>
          </div>
        </div>
      )}

      {/* Section 12: Pályázat-előkészítési dokumentumlista */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold">Pályázat-előkészítési dokumentumlista</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gr-text-2)' }}>
              Pipáld ki a már rendelkezésre álló iratokat és igazolásokat (automatikusan mentődik a fiókodba)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="pill pill-gold">{completedCount} / {items.length} kész</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full overflow-hidden mb-5" style={{ background: 'var(--gr-bg-surface)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progressPct}%`, background: 'var(--gr-gold)' }}
          />
        </div>

        <div className="space-y-2.5">
          {items.map((item) => {
            const checked = checkedDocs.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleToggleDoc(item.id)}
                className="w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer"
                style={{
                  background: checked ? 'var(--gr-gold-muted)' : 'var(--gr-bg-surface)',
                  borderColor: checked ? 'var(--gr-gold-dim)' : 'var(--gr-border)',
                }}
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--gr-gold)' }} />
                ) : (
                  <Square className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--gr-text-3)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="pill pill-muted text-[10px]">{item.area}</span>
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: checked ? 'var(--gr-gold-light)' : 'var(--gr-text)',
                        textDecoration: checked ? 'line-through' : 'none',
                      }}
                    >
                      {item.document}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                    {item.hint}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Notes area */}
        <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--gr-border)' }}>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--gr-text-2)' }}>
            Saját jegyzetek a pályázathoz (pl. árajánlatkérések állapota, pályázatíró, kérdések)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Írd ide a projekttel kapcsolatos feljegyzéseidet..."
            className="input text-sm mb-3"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => persistChecklist(checkedDocs, notes)}
              disabled={savingChecklist}
              className="btn-secondary text-xs py-2 px-4"
            >
              {savingChecklist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Jegyzet mentése
            </button>
            {statusMsg && (
              <span className="text-xs font-medium" style={{ color: 'var(--gr-green)' }}>
                {statusMsg}
              </span>
            )}
            {!isAuthenticated && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--gr-text-3)' }}>
                <Lock className="w-3 h-3" /> A mentéshez bejelentkezés szükséges
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
