'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'

type SchemePreference = 'light' | 'dark' | 'light dark'

function getStoredScheme(): SchemePreference | null {
  try {
    const raw = localStorage.getItem('color-scheme')
    if (raw === 'light' || raw === 'dark' || raw === 'light dark') return raw
  } catch {
    // ignore storage access issues
  }
  return null
}

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applySchemeToDocument(scheme: SchemePreference) {
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) {
    meta.setAttribute('content', scheme)
  }
}

export function ThemeToggle({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const [stored, setStored] = useState<SchemePreference | null>(() => {
    if (typeof window === 'undefined') return null
    return getStoredScheme()
  })
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return getSystemIsDark()
  })

  useEffect(() => {
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null

    const onMediaChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq?.addEventListener?.('change', onMediaChange)

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const next = getStoredScheme()
        setStored(next)
        applySchemeToDocument(next ?? 'light')
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      mq?.removeEventListener?.('change', onMediaChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const effectiveDark =
    stored === 'dark' || (stored === 'light dark' && systemDark)

  function setChoice(next: SchemePreference) {
    setStored(next)
    try {
      localStorage.setItem('color-scheme', next)
    } catch {
      // ignore storage errors
    }
    applySchemeToDocument(next)
  }

  function handleCompactToggle() {
    const next: SchemePreference = effectiveDark ? 'light' : 'dark'
    setChoice(next)
  }

  if (variant === 'full') {
    const options: { value: SchemePreference; label: string; Icon: typeof Sun }[] = [
      { value: 'light', label: 'Világos (Ajánlott)', Icon: Sun },
      { value: 'dark', label: 'Sötét mód', Icon: Moon },
      { value: 'light dark', label: 'Rendszer beállítása', Icon: Monitor },
    ]
    const activeValue: SchemePreference = stored ?? 'light'

    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = activeValue === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChoice(opt.value)}
              className="btn-secondary text-xs py-2 px-3"
              style={
                isActive
                  ? {
                      borderColor: 'var(--gr-primary)',
                      background: 'var(--gr-blue-bg)',
                      color: 'var(--gr-text)',
                    }
                  : {}
              }
            >
              <opt.Icon className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleCompactToggle}
      title={effectiveDark ? 'Váltás világos megjelenésre' : 'Váltás sötét megjelenésre'}
      aria-label={effectiveDark ? 'Váltás világos megjelenésre' : 'Váltás sötét megjelenésre'}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors"
      style={{
        background: 'var(--gr-bg-raised)',
        borderColor: 'var(--gr-border)',
        color: 'var(--gr-text-2)',
      }}
    >
      <span className="theme-icon-for-light items-center gap-1.5">
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Világos</span>
      </span>
      <span className="theme-icon-for-dark items-center gap-1.5">
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sötét</span>
      </span>
    </button>
  )
}
