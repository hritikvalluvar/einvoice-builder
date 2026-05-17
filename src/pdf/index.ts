// Public API for downloading invoice PDFs. The browser app calls
// downloadPdf() from the InvoiceEditor; this module is dynamically
// imported so @react-pdf/renderer + all templates only load when a
// user actually downloads a PDF.

import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ComponentType } from 'react'
import QRCode from 'qrcode'

import type { Seller, Invoice } from '../types'
import type { MultiCopyMode, TemplateProps } from './shared/types'
import { registerFonts } from './fonts'
import { templateById, DEFAULT_TEMPLATE_ID } from './registry'

export type CopyMode = 'single' | 'all-copies'

// Lazy template loaders — each one's chunk is pulled in only when picked.
const LOADERS: Record<string, () => Promise<{ Component: ComponentType<TemplateProps> } | null>> = {
  '01-modern-minimal':      () => import('./templates/01-modern-minimal').then((m) => ({ Component: m.ModernMinimal })),
  '02-tally-classic':       () => import('./templates/02-tally-classic').then((m) => ({ Component: m.TallyClassic })),
  '03-service-letterhead':  () => import('./templates/03-service-letterhead').then((m) => ({ Component: m.ServiceLetterhead })),
  '04-bill-of-supply':      () => import('./templates/04-bill-of-supply').then((m) => ({ Component: m.BillOfSupply })),
  '05-compact-retail':      () => import('./templates/05-compact-retail').then((m) => ({ Component: m.CompactRetail })),
  '06-thermal-80mm':        () => import('./templates/06-thermal-80mm').then((m) => ({ Component: m.Thermal80mm })),
  '07-product-catalogue':   () => import('./templates/07-product-catalogue').then((m) => ({ Component: m.ProductCatalogue })),
  '12-proforma':            () => import('./templates/12-proforma').then((m) => ({ Component: m.Proforma })),
  '13-delivery-challan':    () => import('./templates/13-delivery-challan').then((m) => ({ Component: m.DeliveryChallan })),
}

async function qrFor(signedQr?: string | null): Promise<string | null> {
  if (!signedQr) return null
  return QRCode.toDataURL(signedQr, { width: 200, margin: 1 })
}

function openPdf(blob: Blob, filename: string) {
  // Open in a new tab via window.open instead of forcing a download.
  //
  // Why: Chrome Android (and increasingly desktop Chrome) blocks downloads
  // initiated across async boundaries — pdf().toBlob() awaits push the click
  // beyond the user-gesture window, and the browser flags it as "can't
  // download safely". window.open avoids that path entirely; the browser
  // renders the PDF inline and the user saves via the standard browser
  // controls (Cmd+S on desktop, share/save icon on mobile).
  //
  // Filename is set on the anchor's download attribute as a hint for when
  // the user does save from the opened tab.
  const pdfBlob = blob.type === 'application/pdf'
    ? blob
    : new Blob([blob], { type: 'application/pdf' })
  const url = URL.createObjectURL(pdfBlob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    // Popup blocked — fall back to in-page navigation. User loses the current
    // form state on this tab; rare since this is initiated by a user click.
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  // Hold the blob URL for ~60s so the new tab can still load it. Browsers
  // release blob URLs when the tab using them is closed, but if the tab
  // hasn't finished loading by then, revoking too early breaks the open.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadPdf(
  templateId: string | null | undefined,
  seller: Seller,
  invoice: Invoice,
  copyMode: CopyMode = 'single'
): Promise<void> {
  registerFonts()
  const id = templateId ?? DEFAULT_TEMPLATE_ID
  const entry = templateById(id)
  const loader = LOADERS[entry.id]
  if (!loader) throw new Error(`Template "${entry.name}" not found`)
  const loaded = await loader()
  if (!loaded) throw new Error(`Template "${entry.name}" failed to load`)
  const Component = loaded.Component
  const qrDataUrl = await qrFor(invoice.signedQr)
  const docType = entry.docType

  const wantsMultiCopy = copyMode === 'all-copies' && entry.supportsMultiCopy
  const isGoodsInvoice = docType === 'tax_invoice' || docType === 'bill_of_supply' || docType === 'delivery_challan'

  if (!wantsMultiCopy) {
    // Templates return a <Document> at the root; @react-pdf's pdf() signature
    // wants ReactElement<DocumentProps> but TS can't see through the component
    // boundary, so we assert.
    const element = createElement(Component, { seller, invoice, qrDataUrl }) as any
    const blob = await pdf(element).toBlob()
    openPdf(blob, fileName(docType, invoice.docNo, 'single'))
    return
  }

  // Multi-copy: render the template once per copy, download each as a
  // separate file. Future improvement: merge into a single PDF via pdf-lib.
  const copies: MultiCopyMode[] = isGoodsInvoice
    ? ['original', 'duplicate', 'triplicate']
    : ['original', 'duplicate']
  for (const copy of copies) {
    const element = createElement(Component, { seller, invoice, qrDataUrl, copyLabel: copy }) as any
    const blob = await pdf(element).toBlob()
    openPdf(blob, fileName(docType, invoice.docNo, copy))
  }
}

function fileName(docType: string, docNo: string, suffix: string) {
  const safe = docNo.replace(/[^\w.-]+/g, '_')
  const prefix = docType === 'delivery_challan'
    ? 'challan'
    : docType === 'bill_of_supply'
    ? 'bos'
    : docType === 'proforma'
    ? 'proforma'
    : docType === 'export_invoice'
    ? 'export-invoice'
    : 'invoice'
  return suffix === 'single' ? `${prefix}-${safe}.pdf` : `${prefix}-${safe}-${suffix}.pdf`
}
