// Company-level default template, stored in localStorage keyed by companyId.
// Per-invoice override (when the user generates a PDF for an existing invoice
// with a different template) is stored on the invoice row itself via templateId.

import { DEFAULT_TEMPLATE_ID } from './registry'

const KEY = (companyId: string) => `einvoice:defaultTemplate:${companyId}`

export function getDefaultTemplate(companyId: string | null | undefined): string {
  if (!companyId) return DEFAULT_TEMPLATE_ID
  try {
    return localStorage.getItem(KEY(companyId)) ?? DEFAULT_TEMPLATE_ID
  } catch {
    return DEFAULT_TEMPLATE_ID
  }
}

export function setDefaultTemplate(companyId: string, templateId: string): void {
  try {
    localStorage.setItem(KEY(companyId), templateId)
  } catch { /* localStorage unavailable; ignore */ }
}
