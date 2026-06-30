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
 * Map grant status to Hungarian label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    OPEN: 'Nyitott',
    FORTHCOMING: 'Hamarosan',
    CLOSED: 'Lezárt',
    ARCHIVED: 'Archivált',
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
