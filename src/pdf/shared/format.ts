// Number/string utilities shared by templates.

export const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const inr = (n: number) => `₹ ${fmt(n)}`

// PAN is embedded in GSTIN chars 3..12.
export const panFromGstin = (gstin: string) =>
  gstin && gstin.length >= 12 ? gstin.slice(2, 12) : ''
