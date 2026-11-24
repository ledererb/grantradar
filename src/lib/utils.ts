import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format HUF currency amount
 */
export function formatHuf(amount: bigint | number | null | undefined): string {
  if (amount == null) return 'N/A'
  const num = typeof amount === 'bigint' ? Number(amount) : amount
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format EUR currency amount
 */
export function formatEur(amount: number | null | undefined): string {
  if (amount == null) return 'N/A'
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date in Hungarian format
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Format relative date (e.g. "3 nap múlva")
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} napja lejárt`
  if (diffDays === 0) return 'Ma jár le'
  if (diffDays === 1) return 'Holnap jár le'
  if (diffDays <= 7) return `${diffDays} nap múlva jár le`
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} hét múlva jár le`
  return `${Math.ceil(diffDays / 30)} hónap múlva jár le`
}

/**
 * Derive effective grant status taking deadline and openDate into account.
 */
export function getEffectiveStatus(
  grant: { status: string; deadline?: Date | string | null; openDate?: Date | string | null },
  now = new Date(),
): 'OPEN' | 'FORTHCOMING' | 'CLOSED' {
  if (grant.status === 'CLOSED' || grant.status === 'ARCHIVED') return 'CLOSED'
  if (grant.deadline) {
    const d = typeof grant.deadline === 'string' ? new Date(grant.deadline) : grant.deadline
    if (!Number.isNaN(d.getTime()) && d.getTime() < now.getTime()) return 'CLOSED'
  }
  if (grant.openDate) {
    const o = typeof grant.openDate === 'string' ? new Date(grant.openDate) : grant.openDate
    if (!Number.isNaN(o.getTime()) && o.getTime() > now.getTime()) return 'FORTHCOMING'
  }
  return grant.status === 'FORTHCOMING' ? 'FORTHCOMING' : 'OPEN'
}

/**
 * Generate code-friendly search query variants (e.g. "DIMOP Plusz-1.2.6/C" -> "DIMOP_PLUSZ-1.2.6/C")
 */
export function normalizeGrantCodeQuery(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const variants = new Set<string>([trimmed])
  const withoutYear = trimmed.replace(/-\d{2}$/, '')

  const normalizedUpper = trimmed
    .toUpperCase()
    .replace(/\b(GINOP|DIMOP|KEHOP|IKOP|TOP|EFOP|VP)\s+PLUSZ\b/g, '$1_PLUSZ')
    .replace(/\s+/g, '_')
  variants.add(normalizedUpper)

  const spaced = trimmed.replace(/_/g, ' ')
  variants.add(spaced)

  const hyphenated = normalizedUpper.replace(/_/g, '-')
  variants.add(hyphenated)

  const spacePlusz = normalizedUpper.replace(/_PLUSZ/g, ' Plusz')
  variants.add(spacePlusz)

  const collapsed = normalizedUpper.replace(/[-_/]+/g, '')
  if (collapsed.length >= 6 && collapsed !== normalizedUpper) {
    // Also match prefix like DIMOP_PLUSZ-1.2.6 when user searches DIMOP Plusz-1.2.6/C-26 or vice versa
    const basePart = normalizedUpper.replace(/\/[A-Z0-9-]+$/, '')
    if (basePart.length >= 6) {
      variants.add(basePart)
      variants.add(basePart.replace(/_PLUSZ/g, ' Plusz'))
    }
  }

  if (withoutYear !== trimmed && withoutYear.length >= 4) {
    variants.add(withoutYear)
  }

  return Array.from(variants)
}

/**
 * Identify internal intermediary/technical calls (e.g. MFB HVSZ költségtérítés) that are not SME grants.
 */
export function isTechnicalGrantCall(title?: string | null, code?: string | null): boolean {
  const combined = `${title || ''} ${code || ''}`.toLowerCase()
  return /technikai felhívás|hvsz.*költségtérítés|közvetítők költségtérítése|hitelkeret.*technika|kombinált keret.*technika|-tech\b|- technika/i.test(
    combined,
  )
}

/**
 * Map grant status to Hungarian label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    OPEN: 'Nyitott',
    FORTHCOMING: 'Hamarosan nyílik',
    CLOSED: 'Lezárult',
    ARCHIVED: 'Lezárult',
  }
  return labels[status] || status
}

/**
 * Map funding type to Hungarian label
 */
export function getFundingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    GRANT: 'Vissza nem térítendő',
    LOAN: 'Kedvezményes hitel',
    GUARANTEE: 'Garancia',
    MIXED: 'Vegyes',
  }
  return labels[type] || type
}

/**
 * Map company size to Hungarian label
 */
export function getCompanySizeLabel(size: string): string {
  const labels: Record<string, string> = {
    MICRO: 'Mikrovállalkozás',
    SMALL: 'Kisvállalkozás',
    MEDIUM: 'Középvállalkozás',
  }
  return labels[size] || size
}

/**
 * Status badge color mapping
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'pill-green',
    FORTHCOMING: 'pill-amber',
    CLOSED: 'pill-red',
    ARCHIVED: 'pill-muted',
  }
  return colors[status] || 'pill-muted'
}

/**
 * Funding type badge color mapping
 */
export function getFundingTypeColor(type: string): string {
  const colors: Record<string, string> = {
    GRANT: 'pill-blue',
    LOAN: 'pill-gold',
    GUARANTEE: 'pill-muted',
    MIXED: 'pill-amber',
  }
  return colors[type] || 'pill-muted'
}

/**
 * Difficulty score to label and color
 */
export function getDifficultyInfo(score: number | null | undefined): {
  label: string
  color: string
} {
  if (score == null) return { label: 'N/A', color: 'var(--gr-text-3)' }
  if (score <= 1) return { label: 'Könnyű', color: 'var(--gr-green)' }
  if (score <= 2) return { label: 'Egyszerű', color: 'var(--gr-green)' }
  if (score <= 3) return { label: 'Közepes', color: 'var(--gr-amber)' }
  if (score <= 4) return { label: 'Nehéz', color: 'var(--gr-red)' }
  return { label: 'Nagyon nehéz', color: 'var(--gr-red)' }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}
