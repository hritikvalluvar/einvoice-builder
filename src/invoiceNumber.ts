import type { Invoice } from './types'

// Suggest the next invoice number based on the most recently created invoice.
// Increments the trailing numeric segment, preserving its zero-padding and any prefix.
// Examples:
//   "1"               -> "2"
//   "001"             -> "002"
//   "INV/001"         -> "INV/002"
//   "INV-2026-27/001" -> "INV-2026-27/002"
//   ""                -> ""
//   "INV"             -> ""  (no numeric tail to increment)
export function suggestNextDocNo(invoices: Invoice[]): string {
  if (invoices.length === 0) return ''
  const last = [...invoices].sort((a, b) => b.createdAt - a.createdAt)[0]
  const docNo = last?.docNo?.trim() ?? ''
  if (!docNo) return ''
  const m = docNo.match(/^(.*?)(\d+)$/)
  if (!m) return ''
  const prefix = m[1]
  const numStr = m[2]
  const next = (Number(numStr) + 1).toString().padStart(numStr.length, '0')
  return prefix + next
}
