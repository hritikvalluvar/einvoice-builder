import { useEffect, useRef, useState } from 'react'
import type { BillTo } from '../types'
import { validateGstin, pinToStcd, onlyDigits } from '../validators'
import { lookupGstin } from '../gstinLookup'
import { fetchCityFromPin } from '../pincode'

// ── Shared input class ──────────────────────────────────────────────────────
export const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'

// ── Field wrapper ────────────────────────────────────────────────────────────
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string | null
  hint?: string | null
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-red-600 mt-0.5">{error}</span>}
      {!error && hint && <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  )
}

// ── useGstinFetch hook ───────────────────────────────────────────────────────
export function useGstinFetch(
  gstin: string,
  onSuccess: (
    data: Partial<BillTo> & { tradeNam?: string | null; status?: string | null },
    cached: boolean,
  ) => void,
): {
  loading: boolean
  error: string | null
  hint: string | null
  fetchDisabled: boolean
  fetch: () => Promise<void>
  clearError: () => void
} {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  const fetchDisabled = validateGstin(gstin, { required: true }) !== null

  const hint = loading ? 'Looking up…' : cached ? 'Auto-filled (cached)' : null

  const doFetch = async () => {
    const g = gstin.trim().toUpperCase()
    if (validateGstin(g, { required: true }) !== null) return
    setLoading(true)
    setError(null)
    setCached(false)
    const r = await lookupGstin(g)
    if (!r.ok) {
      setLoading(false)
      setError(r.error)
      return
    }
    setLoading(false)
    setCached(r.cached)
    onSuccess(r.data, r.cached)
  }

  const clearError = () => setError(null)

  return { loading, error, hint, fetchDisabled, fetch: doFetch, clearError }
}

// ── FetchButton ──────────────────────────────────────────────────────────────
export function FetchButton({
  onClick,
  loading,
  disabled,
}: {
  onClick: () => void
  loading: boolean
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
    >
      {loading ? '…' : 'Fetch'}
    </button>
  )
}

// ── PinInput ─────────────────────────────────────────────────────────────────
export function PinInput({
  value,
  onPinChange,
  onCityResolved,
  className,
}: {
  value: number
  /** Fires immediately on input change with new pin + derived stcd (null if not mappable) */
  onPinChange: (pin: number, stcd: string | null) => void
  /** Fires async when India Post resolves the city; only called if pin hasn't changed */
  onCityResolved: (pin: number, city: string) => void
  className?: string
}) {
  const pinRef = useRef(value)
  useEffect(() => {
    pinRef.current = value
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = onlyDigits(e.target.value, 6)
    const pin = d ? Number(d) : 0
    const stcd = pinToStcd(d)
    onPinChange(pin, stcd)
    if (d.length === 6) {
      const pinAtTime = pin
      fetchCityFromPin(d).then((city) => {
        if (!city) return
        if (pinRef.current !== pinAtTime) return
        onCityResolved(pinAtTime, city)
      })
    }
  }

  return (
    <input
      inputMode="numeric"
      maxLength={6}
      value={value ? String(value) : ''}
      onChange={handleChange}
      className={className ?? inp}
    />
  )
}
