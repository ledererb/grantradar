'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Save, Loader2, Building2 } from 'lucide-react'

const SECTORS = [
  'IT és szoftverfejlesztés', 'Feldolgozóipar', 'Mezőgazdaság', 'Turizmus',
  'Kereskedelem', 'Építőipar', 'Logisztika', 'Energetika', 'Egészségügy',
  'Oktatás', 'Kutatás-fejlesztés', 'Környezetvédelem', 'Pénzügyi szolgáltatások',
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({
    companyName: '',
    taxNumber: '',
    companySizePref: [] as string[],
    sectorPrefs: [] as string[],
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const res = await fetch('/api/profile')
    if (res.ok) {
      const data = await res.json()
      if (data.profile) {
        setProfile({
          companyName: data.profile.companyName || '',
          taxNumber: data.profile.taxNumber || '',
          companySizePref: data.profile.companySizePref || [],
          sectorPrefs: data.profile.sectorPrefs || [],
        })
      }
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)

    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })

    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggleSize(size: string) {
    setProfile(p => ({
      ...p,
      companySizePref: p.companySizePref.includes(size)
        ? p.companySizePref.filter(s => s !== size)
        : [...p.companySizePref, size],
    }))
  }

  function toggleSector(sector: string) {
    setProfile(p => ({
      ...p,
      sectorPrefs: p.sectorPrefs.includes(sector)
        ? p.sectorPrefs.filter(s => s !== sector)
        : [...p.sectorPrefs, sector],
    }))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Beállítások</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Cégadatok és preferenciák
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-8">
        {/* Company Info */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
            <h2 className="text-sm font-bold">Cégadatok</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>Cégnév</label>
              <input className="input" placeholder="Példa Kft."
                value={profile.companyName} onChange={e => setProfile(p => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>Adószám</label>
              <input className="input" placeholder="12345678-2-42"
                value={profile.taxNumber} onChange={e => setProfile(p => ({ ...p, taxNumber: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Company Size */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4">Cégméret</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'MICRO', label: 'Mikro (0-9 fő)' },
              { value: 'SMALL', label: 'Kis (10-49 fő)' },
              { value: 'MEDIUM', label: 'Közép (50-249 fő)' },
            ].map(size => (
              <button key={size.value} type="button" onClick={() => toggleSize(size.value)}
                className={`pill text-xs cursor-pointer ${profile.companySizePref.includes(size.value) ? 'pill-gold' : 'pill-muted'}`}>
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sector Preferences */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4">Szektorok</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--gr-text-3)' }}>
            Válassz szektorokat, hogy releváns pályázatokat kapj
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map(sector => (
              <button key={sector} type="button" onClick={() => toggleSector(sector)}
                className={`pill text-xs cursor-pointer ${profile.sectorPrefs.includes(sector) ? 'pill-gold' : 'pill-muted'}`}>
                {sector}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary py-2.5 px-6" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Mentés</>}
          </button>
          {saved && <span className="text-xs" style={{ color: 'var(--gr-green)' }}>✓ Mentve</span>}
        </div>
      </form>
    </div>
  )
}
