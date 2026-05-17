// Metadata-only registry. No template component imports here — including
// them statically would pull @react-pdf/renderer into the main bundle and
// defeat the lazy-load optimization. The actual components are loaded by
// the dispatcher in ./index.ts via dynamic import.
//
// "available: true" templates render correctly with the current Invoice/
// Product schema. "available: false" templates need additional vertical-
// specific fields (batch/expiry, lot/design, BOQ cumulative, IEC/LUT)
// that aren't on the model yet — they show in the picker grayed out
// with "Coming soon" and are skipped by downloadPdf.

import type { TemplateMeta } from './shared/types'

export type RegistryEntry = TemplateMeta & {
  available: boolean
  // Reason shown in picker tooltip when available=false.
  requires?: string
}

export const TEMPLATES: RegistryEntry[] = [
  { id: '01-modern-minimal',      name: 'Modern Minimal',        docType: 'tax_invoice',       style: 'modern',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Default · D2C, agencies',                          available: true },
  { id: '02-tally-classic',       name: 'Tally Classic',         docType: 'tax_invoice',       style: 'traditional',  orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Hardware, pipe, traditional wholesale',            available: true },
  { id: '03-service-letterhead',  name: 'Service Letterhead',    docType: 'tax_invoice',       style: 'service',      orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Freelancers, consultants, agencies, coaching',     available: true },
  { id: '04-bill-of-supply',      name: 'Bill of Supply',        docType: 'bill_of_supply',    style: 'modern',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: false, vertical: 'Composition dealers, exempt suppliers',            available: true },
  { id: '05-compact-retail',      name: 'Compact Retail',        docType: 'tax_invoice',       style: 'compact',      orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Electronics, convenience, multi-SKU retail',       available: true },
  { id: '06-thermal-80mm',        name: 'Thermal 80mm',          docType: 'tax_invoice',       style: 'thermal',      orientation: 'portrait',  pageSize: { width: 227, height: 700 }, supportsMultiCopy: false, supportsIrn: true,  vertical: 'Restaurants, kirana, cafes, salons',               available: true },
  { id: '07-product-catalogue',   name: 'Product Catalogue',     docType: 'tax_invoice',       style: 'product',      orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'D2C, e-commerce, furniture',                       available: true },
  { id: '08-pharma-batch',        name: 'Pharma / Batch',        docType: 'tax_invoice',       style: 'pharma',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Pharma distributors, chemists',                    available: false, requires: 'Batch / expiry / manufacturer fields on products' },
  { id: '09-textile-lot',         name: 'Textile / Lot',         docType: 'tax_invoice',       style: 'textile',      orientation: 'landscape', pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Cloth, garment wholesale',                         available: false, requires: 'Lot / design / shade fields on items' },
  { id: '10-construction-ra-bill',name: 'Construction RA Bill',  docType: 'tax_invoice',       style: 'construction', orientation: 'landscape', pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Contractors, civil, infra',                        available: false, requires: 'BOQ contract + cumulative qty fields' },
  { id: '11-export-invoice',      name: 'Export Invoice',        docType: 'export_invoice',    style: 'export',       orientation: 'landscape', pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Exporters',                                        available: false, requires: 'IEC, LUT, shipping bill, dual-currency fields' },
  { id: '12-proforma',            name: 'Proforma',              docType: 'proforma',          style: 'modern',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: false, supportsIrn: false, vertical: 'Pre-sale across all SMEs',                         available: true },
  { id: '13-delivery-challan',    name: 'Delivery Challan',      docType: 'delivery_challan',  style: 'traditional',  orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: false, vertical: 'Job work, branch transfer',                        available: true },
]

export const DEFAULT_TEMPLATE_ID = '01-modern-minimal'

export function templateById(id: string | undefined | null): RegistryEntry {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!
}
