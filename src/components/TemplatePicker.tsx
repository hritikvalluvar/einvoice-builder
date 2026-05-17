// Reusable PDF template picker. Used in Account (company default) and
// InvoiceEditor (per-invoice override). Renders a styled native <select>
// grouped by document type.

import { TEMPLATES } from '../pdf/registry'

type Props = {
  value: string
  onChange: (id: string) => void
  className?: string
  // Hide the "Use company default" option — used when this picker IS the
  // company default setter (Account screen).
  hideUseDefault?: boolean
  // Label for the "use default" option.
  useDefaultLabel?: string
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
  hideUseDefault = false,
  useDefaultLabel = 'Use company default',
}: Props) {
  const groups = new Map<string, typeof TEMPLATES>()
  for (const t of TEMPLATES) {
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
            <option key={t.id} value={t.id} title={t.vertical}>
              {t.name} — {t.vertical}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
