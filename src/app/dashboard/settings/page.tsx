'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Save,
  Loader2,
  Building2,
  ShieldCheck,
  MapPin,
  Sprout,
  Coins,
  Bell,
  ArrowRight,
  Palette,
} from 'lucide-react'
import {
  DEFAULT_PRE_SCREEN_PROFILE,
  type CompanyPreScreenProfile,
  type LegalForm,
  type TriState,
  type LocationRight,
  type AlertFrequency,
} from '@/lib/grant-handbook'
import { ThemeToggle } from '@/components/ThemeToggle'

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
  'Budapest / Pest régió (Közép-Magyarország)',
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
        setTimeout(() => setSaved(false), 5000)
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
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="pill pill-blue mb-2 inline-flex">Személyre szabás</span>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Cégprofil, Szűrők és Értesítések
          </h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            Add meg a vállalkozásod adatait: ez alapján szűrjük a „Cégemre szabott” pályázati listát az Áttekintés és a Pályázatok menüben, valamint az e-mail értesítőket.
          </p>
        </div>

        <Link href="/dashboard/grants?forMe=1" className="btn-secondary text-xs py-2 px-3.5 shrink-0">
          Saját találatok megtekintése
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Cégadatok és Pályázói kör */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
            <h2 className="text-sm font-bold">1. Alapadatok, cégforma és vállalkozási méret</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Cégnév / Vállalkozás neve
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
                <option value="OSTERMELO">Mezőgazdasági őstermelő / Családi gazdaság</option>
                <option value="SZOVETKEZET">Szövetkezet</option>
                <option value="EGYEB">Egyéb szervezet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--gr-text-2)' }}>
              Cégméret (a kapcsolt és partnervállalkozásokkal együtt)
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
                  className={`pill cursor-pointer py-1.5 px-3 ${
                    profile.companySizePref.includes(size.value) ? 'pill-blue' : 'pill-muted'
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
            <Coins className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
            <h2 className="text-sm font-bold">
              2. Működési múlt, létszám és pénzügyi adatok
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
                Alkalmazotti létszám (fő)
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
                Köztartozásmentes (NAV egyenleg rendben)?
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
                <option value="NO">Nem (lejárt adótartozás)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                Korábbi csekély összegű (De minimis) támogatás (EUR)
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
            <MapPin className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
            <h2 className="text-sm font-bold">
              3. Fejlesztés helyszíne (telephely) és használati jog
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
                  className={`pill cursor-pointer py-1.5 px-3 ${
                    profile.regions.includes(region) ? 'pill-blue' : 'pill-muted'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
              Bejegyzett telephely állapota
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4" style={{ color: 'var(--gr-green)' }} />
              <div>
                <h2 className="text-sm font-bold">
                  4. Mezőgazdasági és vidéki beruházási adatok (KAP)
                </h2>
                <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                  Kapcsold be, ha mezőgazdasági termelőként, őstermelőként vagy élelmiszeripari vállalkozásként agrárpályázatokra is szűrnél
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setProfile((p) => ({ ...p, isAgriProducer: !p.isAgriProducer }))}
              className={`pill cursor-pointer py-1.5 px-3 ${
                profile.isAgriProducer ? 'pill-green' : 'pill-muted'
              }`}
            >
              {profile.isAgriProducer ? '✓ Agrár profil aktív' : 'Agrár profil bekapcsolása'}
            </button>
          </div>

          {profile.isAgriProducer && (
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t" style={{ borderColor: 'var(--gr-border)' }}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--gr-text-2)' }}>
                  Agrár-nyilvántartás (KNYR szám)
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
                  Gazdasági üzemméret (STÉ, EUR)
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
                  Egységes Kérelem (területalapú támogatás)
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
                  <option value="NO">Nincs beadva</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 5. Szektorok */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
            <h2 className="text-sm font-bold">5. Fejlesztendő ágazatok és tevékenységek</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--gr-text-2)' }}>
            Jelöld meg a vállalkozásod területeit a pontosabb találatokhoz és értesítésekhez
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => toggleSector(sector)}
                className={`pill cursor-pointer py-1.5 px-3 ${
                  profile.sectorPrefs.includes(sector) ? 'pill-blue' : 'pill-muted'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        {/* 6. E-mail értesítések és leiratkozás */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
            <h2 className="text-sm font-bold">6. E-mail értesítések, gyakoriság és leiratkozás</h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
            Személyre szabott hírlevelet csak akkor küldünk (Pro / Agency csomagban), ha új, a cégedre illeszkedő pályázat nyílt, vagy egy mentett pályázatod határideje 14 napon belül lejár. Bármikor leiratkozhatsz itt vagy a levelek alján található linkkel.
          </p>

          <div className="grid sm:grid-cols-3 gap-2.5">
            {(
              [
                {
                  value: 'DAILY',
                  title: 'Napi értesítő',
                  desc: 'Reggelente csak akkor írunk, ha van új releváns pályázat vagy közeli határidő.',
                },
                {
                  value: 'WEEKLY',
                  title: 'Heti összefoglaló',
                  desc: 'Minden hétfő reggel egyetlen áttekintő e-mail a legfontosabb változásokról.',
                },
                {
                  value: 'OFF',
                  title: 'Leiratkozva (Kikapcsolva)',
                  desc: 'Nem küldünk e-mail értesítőket; a találatokat bármikor megnézheted a felületen.',
                },
              ] as { value: AlertFrequency; title: string; desc: string }[]
            ).map((opt) => {
              const active = (profile.alertFrequency || 'DAILY') === opt.value
              return (
                <label
                  key={opt.value}
                  className="prescreen-option flex-col items-start gap-1 p-3.5"
                >
                  <input
                    type="radio"
                    name="alertFrequency"
                    value={opt.value}
                    checked={active}
                    onChange={() =>
                      setProfile((p) => ({ ...p, alertFrequency: opt.value }))
                    }
                    className="sr-only"
                  />
                  <span className="text-xs font-bold" style={{ color: 'var(--gr-text)' }}>
                    {opt.title}
                  </span>
                  <span className="text-[11px] font-normal leading-snug" style={{ color: 'var(--gr-text-2)' }}>
                    {opt.desc}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* 7. Megjelenés beállítása */}
        <div className="card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
            <h2 className="text-sm font-bold">7. Felület megjelenése (Világos / Sötét mód)</h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
            Alapértelmezésben a könnyen olvasható világos B2B felület aktív, de igény esetén bármikor átválthatsz sötét vagy rendszerkövető nézetre.
          </p>
          <ThemeToggle variant="full" />
        </div>

        {/* Save Button */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary py-2.5 px-6" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Beállítások mentése
              </>
            )}
          </button>
          {saved && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: 'var(--gr-green)' }}>
                ✓ Mentve! Frissült a cégedre szabott pályázati lista.
              </span>
              <Link href="/dashboard/grants?forMe=1" className="text-xs font-semibold underline" style={{ color: 'var(--gr-primary)' }}>
                Cégemre szabott pályázatok megtekintése →
              </Link>
            </div>
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
