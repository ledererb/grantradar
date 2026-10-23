'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Building2, ShieldCheck, MapPin, Sprout, Euro } from 'lucide-react'
import {
  DEFAULT_PRE_SCREEN_PROFILE,
  type CompanyPreScreenProfile,
  type LegalForm,
  type TriState,
  type LocationRight,
} from '@/lib/grant-handbook'

const SECTORS = [
  'IT és szoftverfejlesztés',
  'Feldolgozóipar',
  'Mezőgazdaság',
  'Élelmiszeripar',
  'Turizmus',
  'Kereskedelem',
  'Építőipar',
  'Logisztika',
  'Energetika',
  'Egészségügy',
  'Oktatás',
  'Kutatás-fejlesztés',
  'Környezetvédelem',
]

const REGIONS = [
  'Kevésbé fejlett régió (Észak-Magyarország, Észak-Alföld, Dél-Alföld, Dél-Dunántúl)',
  'Fejlettebb vidéki régió (Közép-Dunántúl, Nyugat-Dunántúl)',
  'Budapest / Pest vármegye',
  '5000 fő alatti település (Magyar Falu / vidéki előny)',
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<CompanyPreScreenProfile>({
    ...DEFAULT_PRE_SCREEN_PROFILE,
  })

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile({
              ...DEFAULT_PRE_SCREEN_PROFILE,
              ...data.profile,
            })
            return
          }
        }
        // Fallback: load pre-screening draft from landing page if present
        const rawDraft = localStorage.getItem('grantradar_prescreen_draft')
        if (rawDraft) {
          const draft = JSON.parse(rawDraft)
          const merged = { ...DEFAULT_PRE_SCREEN_PROFILE, ...draft }
          setProfile(merged)
          localStorage.removeItem('grantradar_prescreen_draft')
          await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          })
        }
      } catch {
        // ignore initial load error
      }
    }
    loadProfile()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || 'Nem sikerült menteni a beállításokat.')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Hálózati hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  function toggleSize(size: string) {
    setProfile((p) => ({
      ...p,
      companySizePref: p.companySizePref.includes(size)
        ? p.companySizePref.filter((s) => s !== size)
        : [...p.companySizePref, size],
    }))
  }

  function toggleSector(sector: string) {
    setProfile((p) => ({
      ...p,
      sectorPrefs: p.sectorPrefs.includes(sector)
        ? p.sectorPrefs.filter((s) => s !== sector)
        : [...p.sectorPrefs, sector],
    }))
  }

  function toggleRegion(region: string) {
    setProfile((p) => ({
      ...p,
      regions: p.regions.includes(region)
        ? p.regions.filter((r) => r !== region)
        : [...p.regions, region],
    }))
  }

  const parseNumInput = (val: string): number | null => {
    if (val.trim() === '') return null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="pill pill-gold mb-2 inline-flex">2 perces előszűrés</span>
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          Cégprofil & Pályázati Előszűrő Beállítások
        </h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Add meg a vállalkozásod alapadatait, hogy minden GINOP Plusz, DIMOP Plusz és KAP pályázatnál automatikusan lásd a jogosultsági mátrixot és a lehetséges bukópontokat.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Cégadatok és Pályázói kör */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
            <h2 className="text-sm font-bold">1. Pályázói kör, cégforma és KKV-méret</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Cégnév / Név
              </label>
              <input
                className="input"
                placeholder="Példa Kft."
                value={profile.companyName}
                onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Adószám
              </label>
              <input
                className="input"
                placeholder="12345678-2-42"
                value={profile.taxNumber}
                onChange={(e) => setProfile((p) => ({ ...p, taxNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Szervezeti forma
              </label>
              <select
                className="input"
                value={profile.legalForm}
                onChange={(e) => setProfile((p) => ({ ...p, legalForm: e.target.value as LegalForm }))}
              >
                <option value="">— Válassz formát —</option>
                <option value="KFT_ZRT">Gazdasági társaság (Kft. / Zrt. / Bt.)</option>
                <option value="EV">Egyéni vállalkozó (EV)</option>
                <option value="OSTERMELO">Mezőgazdasági őstermelő / ŐCSG</option>
                <option value="SZOVETKEZET">Szövetkezet</option>
                <option value="EGYEB">Egyéb szervezet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--gr-text-2)' }}>
              KKV-minősítés (kapcsolt és partnervállalkozásokkal együtt)
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'MICRO', label: 'Mikrovállalkozás (0–9 fő)' },
                { value: 'SMALL', label: 'Kisvállalkozás (10–49 fő)' },
                { value: 'MEDIUM', label: 'Középvállalkozás (50–249 fő)' },
              ].map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => toggleSize(size.value)}
                  className={`pill text-xs cursor-pointer py-1.5 px-3 ${
                    profile.companySizePref.includes(size.value) ? 'pill-gold' : 'pill-muted'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Működési múlt, Létszám és Pénzügyi alkalmasság */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Euro className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
            <h2 className="text-sm font-bold">
              2. Működési múlt, létszám és pénzügyi mutatók
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Lezárt teljes üzleti évek
              </label>
              <input
                type="number"
                min={0}
                max={100}
                className="input"
                placeholder="pl. 2"
                value={profile.closedFiscalYears ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, closedFiscalYears: parseNumInput(e.target.value) }))
                }
              />
              <span className="text-[11px]" style={{ color: 'var(--gr-text-3)' }}>
                0 = induló vállalkozás
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Statisztikai létszám (fő)
              </label>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="pl. 8"
                value={profile.headcount ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, headcount: parseNumInput(e.target.value) }))
                }
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Éves nettó árbevétel (M Ft)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                className="input"
                placeholder="pl. 120"
                value={profile.annualRevenueM ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, annualRevenueM: parseNumInput(e.target.value) }))
                }
              />
              <span className="text-[11px]" style={{ color: 'var(--gr-text-3)' }}>
                Millió Ft-ban (pl. 120 = 120M Ft)
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Rendelkezésre álló önerő (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                className="input"
                placeholder="pl. 50"
                value={profile.ownContributionPct ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, ownContributionPct: parseNumInput(e.target.value) }))
                }
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Saját tőke pozitív (jegyzett tőke feletti)?
              </label>
              <select
                className="input"
                value={profile.positiveEquity}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, positiveEquity: e.target.value as TriState }))
                }
              >
                <option value="UNKNOWN">Nem megadott</option>
                <option value="YES">Igen, pozitív és megfelelő</option>
                <option value="NO">Nem (negatív / tőkevesztés)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Köztartozásmentes (NAV KOMA) & rendezett?
              </label>
              <select
                className="input"
                value={profile.noTaxDebt}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, noTaxDebt: e.target.value as TriState }))
                }
              >
                <option value="UNKNOWN">Nem megadott</option>
                <option value="YES">Igen, köztartozásmentes</option>
                <option value="NO">Nem (lejárt tartozás / eljárás)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Felhasznált De minimis keret (3 év, EUR)
              </label>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="pl. 0"
                value={profile.deMinimisUsedEur ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, deMinimisUsedEur: parseNumInput(e.target.value) }))
                }
              />
            </div>
          </div>
        </div>

        {/* 3. Projekt helyszíne és használati jog */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
            <h2 className="text-sm font-bold">
              3. Projekt megvalósítási helyszíne és használati jog
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--gr-text-2)' }}>
              Hol valósul meg a tervezett fejlesztés? (Több is választható)
            </label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={`pill text-xs cursor-pointer py-1.5 px-3 ${
                    profile.regions.includes(region) ? 'pill-gold' : 'pill-muted'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              Bejegyzett telephely és használati jog állapota
            </label>
            <select
              className="input"
              value={profile.locationRight}
              onChange={(e) =>
                setProfile((p) => ({ ...p, locationRight: e.target.value as LocationRight }))
              }
            >
              <option value="UNKNOWN">Nem megadott</option>
              <option value="OWNED">Saját tulajdonú, bejegyzett telephely</option>
              <option value="RENTED">Bérlemény / használati jog (bejegyzett telephely)</option>
              <option value="PLANNED">Még csak tervezett (nincs bejegyezve a cégkivonatba)</option>
            </select>
          </div>
        </div>

        {/* 4. KAP — Mezőgazdasági vállalkozások speciális feltételei */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4" style={{ color: 'var(--gr-green)' }} />
              <div>
                <h2 className="text-sm font-bold">
                  4. KAP — Mezőgazdasági és vidéki beruházási adatok
                </h2>
                <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                  Kapcsold be, ha mezőgazdasági termelőként, őstermelőként vagy élelmiszeripari szereplőként KAP pályázatokra is szűrnél
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setProfile((p) => ({ ...p, isAgriProducer: !p.isAgriProducer }))}
              className={`pill text-xs cursor-pointer py-1.5 px-3 ${
                profile.isAgriProducer ? 'pill-green' : 'pill-muted'
              }`}
            >
              {profile.isAgriProducer ? '✓ Agrár / KAP aktív' : 'Agrár profil bekapcsolása'}
            </button>
          </div>

          {profile.isAgriProducer && (
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t" style={{ borderColor: 'var(--gr-border)' }}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  KNYR regisztráció
                </label>
                <select
                  className="input"
                  value={profile.hasKnyr}
                  onChange={(e) => setProfile((p) => ({ ...p, hasKnyr: e.target.value as TriState }))}
                >
                  <option value="UNKNOWN">Nem megadott</option>
                  <option value="YES">Igen (van KNYR szám)</option>
                  <option value="NO">Nincs még KNYR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  Üzemméret (STÉ, EUR)
                </label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  placeholder="pl. 12000"
                  value={profile.steValue ?? ''}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, steValue: parseNumInput(e.target.value) }))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  Mezőgazdasági árbevétel (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                  placeholder="pl. 55"
                  value={profile.agriRevenuePct ?? ''}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, agriRevenuePct: parseNumInput(e.target.value) }))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  Egységes Kérelem (EK)
                </label>
                <select
                  className="input"
                  value={profile.hasUnifiedApplication}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, hasUnifiedApplication: e.target.value as TriState }))
                  }
                >
                  <option value="UNKNOWN">Nem megadott</option>
                  <option value="YES">Beadva / rendelkezésre áll</option>
                  <option value="NO">Nincs EK</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 5. Szektorok */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
            <h2 className="text-sm font-bold">5. Fejlesztendő ágazatok / szektorok</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--gr-text-3)' }}>
            Válassz szektorokat az értesítésekhez és a személyre szabott pályázati ajánlásokhoz
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => toggleSector(sector)}
                className={`pill text-xs cursor-pointer py-1.5 px-3 ${
                  profile.sectorPrefs.includes(sector) ? 'pill-gold' : 'pill-muted'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary py-2.5 px-6" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Profil és előszűrő mentése
              </>
            )}
          </button>
          {saved && (
            <span className="text-xs font-semibold" style={{ color: 'var(--gr-green)' }}>
              ✓ Cégprofil sikeresen mentve! A pályázati adatlapokon frissült a jogosultsági mátrix.
            </span>
          )}
          {error && (
            <span className="text-xs font-medium" style={{ color: 'var(--gr-red)' }}>
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
