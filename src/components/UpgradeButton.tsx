'use client'

import { useState } from 'react'
import { ArrowUpRight, Loader2 } from 'lucide-react'

interface UpgradeButtonProps {
  plan: 'PRO' | 'AGENCY'
  label?: string
  variant?: 'primary' | 'secondary'
  className?: string
}

export function UpgradeButton({
  plan,
  label = 'Előfizetés indítása',
  variant = 'primary',
  className = '',
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (res.status === 401) {
        window.location.href = `/register?plan=${plan.toLowerCase()}`
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {label}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </>
      )}
    </button>
  )
}
