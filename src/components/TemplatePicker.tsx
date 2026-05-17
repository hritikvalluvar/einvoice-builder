// Reusable PDF template picker. Used in Account (company default) and
// InvoiceEditor (per-invoice override). Renders a styled native <select>
// — available templates grouped by document type, with unavailable
// (vertical-specific) templates disabled and explained.

import { TEMPLATES } from '../pdf/registry'

type Props = {
  value: string
  onChange: (id: string) => void
  className?: string
  // Show templates whose available=false, but disabled. If false, omit entirely.
  showUnavailable?: boolean
  // Hide the option "Use company default" — used when the picker IS the
  // company default setter (Account screen).
  hideUseDefault?: boolean
  // Optional label for the "use default" option (e.g., "Use company default").
  useDefaultLabel?: string
  // If provided and value === '' (empty), the "use default" option is rendered.
  // Otherwise the value matches a template id.
}

const DOC_TYPE_LABELS: Record<string, string> = {
  tax_invoice: 'Tax Invoice',
  bill_of_supply: 'Bill of Supply',
  proforma: 'Proforma',
  delivery_challan: 'Delivery Challan',
  export_invoice: 'Export Invoice',
}

export function TemplatePicker({
  value,
  onChange,
  className = '',
  showUnavailable = true,
  hideUseDefault = false,
  useDefaultLabel = 'Use company default',
}: Props) {
  const groups = new Map<string, typeof TEMPLATES>()
  for (const t of TEMPLATES) {
    if (!showUnavailable && !t.available) continue
    const k = t.docType
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(t)
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white ${className}`}
    >
      {!hideUseDefault && <option value="">{useDefaultLabel}</option>}
      {Array.from(groups.entries()).map(([docType, items]) => (
        <optgroup key={docType} label={DOC_TYPE_LABELS[docType] ?? docType}>
          {items.map((t) => (
            <option
              key={t.id}
              value={t.id}
              disabled={!t.available}
              title={t.available ? t.vertical : `Coming soon — needs ${t.requires}`}
            >
              {t.name}{!t.available ? ' (coming soon)' : ''} — {t.vertical}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
