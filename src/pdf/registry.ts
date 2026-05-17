// Metadata-only registry. No template component imports here — including
// them statically would pull @react-pdf/renderer into the main bundle and
// defeat the lazy-load optimization. The actual components are loaded by
// the dispatcher in ./index.ts via dynamic import.
//
// Four vertical-specific templates (Pharma, Textile, Construction RA,
// Export) are archived on archive/phase-2-template-prototypes. They need
// schema additions before they can be wired in — restore from that branch
// when the schema work lands.

import type { TemplateMeta } from './shared/types'

export type RegistryEntry = TemplateMeta

export const TEMPLATES: RegistryEntry[] = [
  { id: '01-modern-minimal',      name: 'Modern Minimal',        docType: 'tax_invoice',       style: 'modern',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Default · D2C, agencies' },
  { id: '02-tally-classic',       name: 'Tally Classic',         docType: 'tax_invoice',       style: 'traditional',  orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Hardware, pipe, traditional wholesale' },
  { id: '03-service-letterhead',  name: 'Service Letterhead',    docType: 'tax_invoice',       style: 'service',      orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Freelancers, consultants, agencies, coaching' },
  { id: '04-bill-of-supply',      name: 'Bill of Supply',        docType: 'bill_of_supply',    style: 'modern',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: false, vertical: 'Composition dealers, exempt suppliers' },
  { id: '05-compact-retail',      name: 'Compact Retail',        docType: 'tax_invoice',       style: 'compact',      orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'Electronics, convenience, multi-SKU retail' },
  { id: '06-thermal-80mm',        name: 'Thermal 80mm',          docType: 'tax_invoice',       style: 'thermal',      orientation: 'portrait',  pageSize: { width: 227, height: 700 }, supportsMultiCopy: false, supportsIrn: true,  vertical: 'Restaurants, kirana, cafes, salons' },
  { id: '07-product-catalogue',   name: 'Product Catalogue',     docType: 'tax_invoice',       style: 'product',      orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: true,  vertical: 'D2C, e-commerce, furniture' },
  { id: '12-proforma',            name: 'Proforma',              docType: 'proforma',          style: 'modern',       orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: false, supportsIrn: false, vertical: 'Pre-sale across all SMEs' },
  { id: '13-delivery-challan',    name: 'Delivery Challan',      docType: 'delivery_challan',  style: 'traditional',  orientation: 'portrait',  pageSize: 'A4',                       supportsMultiCopy: true,  supportsIrn: false, vertical: 'Job work, branch transfer' },
]

export const DEFAULT_TEMPLATE_ID = '01-modern-minimal'

export function templateById(id: string | undefined | null): RegistryEntry {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!
}
