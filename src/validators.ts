// Field validators for GSTIN, PIN, phone, email.
// Each returns `null` when valid, error string otherwise.

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/
const PIN_RE = /^[1-9][0-9]{5}$/
const PHONE_RE = /^(\+?91[-\s]?)?[6-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateGstin(s: string | undefined, opts: { required?: boolean; allowURP?: boolean } = {}): string | null {
  const v = (s ?? '').trim()
  if (!v) return opts.required ? 'Required' : null
  if (opts.allowURP && v.toUpperCase() === 'URP') return null
  if (v.length !== 15) return 'Must be 15 characters'
  if (!GSTIN_RE.test(v)) return 'Invalid format'
  return null
}

export function validatePin(n: number | undefined | null, opts: { required?: boolean } = {}): string | null {
  if (n == null || n === 0) return opts.required ? 'Required' : null
  if (!Number.isInteger(n)) return 'Must be a whole number'
  if (!PIN_RE.test(String(n))) return 'Must be 6 digits (1xxxxx–9xxxxx)'
  return null
}

export function validatePhone(s: string | undefined): string | null {
  const v = (s ?? '').trim()
  if (!v) return null // optional everywhere
  if (!PHONE_RE.test(v)) return 'Must be 10 digits starting 6–9 (e.g. 9876543210)'
  return null
}

export function validateEmail(s: string | undefined): string | null {
  const v = (s ?? '').trim()
  if (!v) return null // optional everywhere
  if (!EMAIL_RE.test(v)) return 'Invalid email'
  return null
}

export function requireText(s: string | undefined | null): string | null {
  return (s ?? '').trim() ? null : 'Required'
}

export function validateStcd(s: string | undefined | null): string | null {
  const v = (s ?? '').trim()
  if (!v) return 'Required'
  if (!/^[0-9]{1,2}$/.test(v)) return 'Must be a state code (1–2 digits)'
  return null
}
