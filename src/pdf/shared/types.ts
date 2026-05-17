import type { Seller, Invoice } from '../../types'

export type MultiCopyMode = 'none' | 'original' | 'duplicate' | 'triplicate'

export type TemplateProps = {
  seller: Seller
  invoice: Invoice
  qrDataUrl?: string | null
  copyLabel?: MultiCopyMode
  // Doc-type-specific extras carried as opaque payloads on the prototype side.
  extras?: Record<string, unknown>
}

export type TemplateMeta = {
  id: string
  name: string
  docType: 'tax_invoice' | 'bill_of_supply' | 'proforma' | 'delivery_challan' | 'export_invoice'
  style: 'modern' | 'traditional' | 'compact' | 'thermal' | 'product' | 'service' | 'pharma' | 'textile' | 'construction' | 'export'
  orientation: 'portrait' | 'landscape'
  pageSize: 'A4' | 'A5' | { width: number; height: number }
  supportsMultiCopy: boolean
  supportsIrn: boolean
  vertical: string
}
