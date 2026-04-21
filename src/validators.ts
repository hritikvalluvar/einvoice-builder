// Field validators for GSTIN, PIN, HSN, phone, email.
// Each returns `null` when valid, error string otherwise.

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/
const PIN_RE = /^[1-9][0-9]{5}$/
const HSN_RE = /^([0-9]{6}|[0-9]{8})$/
const PHONE_RE = /^(\+?91[-\s]?)?[6-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onlyDigits = (s: string, max?: number): string => {
  const d = (s ?? '').replace(/\D/g, '')
  return max != null ? d.slice(0, max) : d
}

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
  if (!PIN_RE.test(String(n))) return 'Must be exactly 6 digits'
  return null
}

export function validateHsn(s: string | undefined, opts: { required?: boolean } = {}): string | null {
  const v = (s ?? '').trim()
  if (!v) return opts.required ? 'Required' : null
  if (!/^[0-9]+$/.test(v)) return 'Only digits'
  if (!HSN_RE.test(v)) return 'Must be 6 or 8 digits'
  return null
}

// Approximate PIN → state code mapping (GSTIN state codes).
// 3-digit prefixes override 2-digit defaults to capture states that share a zone with a larger neighbour.
// Returns null when unknown (e.g. 79xxxx NE without further digits, or unmapped ranges).

const PIN3_OVERRIDE: Record<number, string> = {
  160: '04', // Chandigarh (inside Punjab zone)
  194: '38', // Ladakh (split off from J&K)
  248: '05', 249: '05', 263: '05', // Uttarakhand (inside UP zone)
  396: '26', // Dadra & Nagar Haveli and Daman & Diu (inside Gujarat zone)
  403: '30', // Goa (inside Maharashtra zone)
  605: '34', // Puducherry — Pondicherry town (inside TN zone)
  737: '11', // Sikkim (inside NE zone)
  744: '35', // Andaman & Nicobar (inside NE zone)
  790: '12', 791: '12', 792: '12', // Arunachal Pradesh
  793: '17', 794: '17', // Meghalaya
  795: '14', // Manipur
  796: '15', // Mizoram
  797: '13', 798: '13', // Nagaland
  799: '16', // Tripura
  // Jharkhand (inside Bihar zone)
  814: '20', 815: '20', 816: '20', 822: '20',
  825: '20', 826: '20', 827: '20', 828: '20', 829: '20',
  831: '20', 832: '20', 833: '20', 834: '20', 835: '20',
}

const PIN2_DEFAULT: Record<number, string> = {
  11: '07', // Delhi
  12: '06', 13: '06', // Haryana
  14: '03', 15: '03', 16: '03', // Punjab
  17: '02', // Himachal Pradesh
  18: '01', 19: '01', // Jammu & Kashmir
  20: '09', 21: '09', 22: '09', 23: '09', 24: '09', 25: '09', 26: '09', 27: '09', 28: '09', // Uttar Pradesh
  30: '08', 31: '08', 32: '08', 33: '08', 34: '08', // Rajasthan
  36: '24', 37: '24', 38: '24', 39: '24', // Gujarat
  40: '27', 41: '27', 42: '27', 43: '27', 44: '27', // Maharashtra
  45: '23', 46: '23', 47: '23', 48: '23', // Madhya Pradesh
  49: '22', // Chhattisgarh
  50: '36', // Telangana
  51: '37', 52: '37', 53: '37', // Andhra Pradesh
  56: '29', 57: '29', 58: '29', 59: '29', // Karnataka
  60: '33', 61: '33', 62: '33', 63: '33', 64: '33', // Tamil Nadu
  67: '32', 68: '32', 69: '32', // Kerala (includes Lakshadweep 682 — not disambiguable at 3 digits)
  70: '19', 71: '19', 72: '19', 73: '19', 74: '19', // West Bengal
  75: '21', 76: '21', 77: '21', // Odisha
  78: '18', // Assam
  80: '10', 81: '10', 82: '10', 83: '10', 84: '10', 85: '10', // Bihar (Jharkhand handled in 3-digit overrides)
}

export const STATE_NAMES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
}

export function stcdName(stcd: string | undefined | null): string | null {
  if (!stcd) return null
  const key = String(stcd).padStart(2, '0')
  return STATE_NAMES[key] ?? null
}

export function pinToStcd(pin: number | string | undefined | null): string | null {
  if (pin == null) return null
  const s = String(pin)
  if (s.length >= 3) {
    const pfx3 = Number(s.slice(0, 3))
    if (Number.isFinite(pfx3) && PIN3_OVERRIDE[pfx3]) return PIN3_OVERRIDE[pfx3]
  }
  if (s.length < 2) return null
  const pfx2 = Number(s.slice(0, 2))
  if (!Number.isFinite(pfx2)) return null
  return PIN2_DEFAULT[pfx2] ?? null
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
