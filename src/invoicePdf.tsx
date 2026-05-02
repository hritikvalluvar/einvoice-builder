// Tax-invoice PDF template using @react-pdf/renderer.
// This module is code-split via dynamic import at the call site, so the
// ~150KB PDF library only loads when a user actually downloads a PDF.

import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { Seller, Invoice } from './types'
import { computeLines, summarize } from './einvoice'
import { stcdName } from './validators'
import { amountInWords } from './amountWords'

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rs = (n: number) => `Rs. ${fmt(n)}`

// PAN is embedded in GSTIN at chars 3..12 (e.g. 09AINPB0043P4Z1 → AINPB0043P).
const pan = (gstin: string) => (gstin && gstin.length >= 12 ? gstin.slice(2, 12) : '')

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#111' },
  title: { fontSize: 16, textAlign: 'center', fontFamily: 'Helvetica-Bold', marginBottom: 10, letterSpacing: 2 },
  metaRow: { flexDirection: 'row', borderTop: 1, borderColor: '#000', borderBottom: 1, marginBottom: 0 },
  metaCell: { flex: 1, padding: 5, fontSize: 9, borderRight: 1, borderColor: '#000' },
  metaCellLast: { flex: 1, padding: 5, fontSize: 9 },
  metaLabel: { color: '#666', fontSize: 7, marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontFamily: 'Helvetica-Bold' },

  partiesRow: { flexDirection: 'row', borderTop: 1, borderBottom: 1, borderColor: '#000' },
  partyBox: { flex: 1, padding: 6 },
  partyBoxDivider: { borderLeft: 1, borderColor: '#000' },
  boxTitle: { fontSize: 8, color: '#666', marginBottom: 2, fontFamily: 'Helvetica-Bold' },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  partyLine: { fontSize: 9, marginBottom: 1 },

  shipRow: { borderBottom: 1, borderColor: '#000', padding: 6 },

  table: { borderBottom: 1, borderColor: '#000' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingVertical: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderTop: 1, borderColor: '#e5e7eb' },
  th: { paddingHorizontal: 3 },
  td: { paddingHorizontal: 3 },
  colNo: { width: 22, textAlign: 'center' },
  colDesc: { flex: 3 },
  colHsn: { width: 40, textAlign: 'center' },
  colQty: { width: 36, textAlign: 'right' },
  colUnit: { width: 30, textAlign: 'center' },
  colRate: { width: 48, textAlign: 'right' },
  colTaxable: { width: 54, textAlign: 'right' },
  colGstRt: { width: 30, textAlign: 'right' },
  colGstAmt: { width: 48, textAlign: 'right' },
  colTotal: { width: 60, textAlign: 'right' },

  itemDesc: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  itemSubdesc: { fontSize: 8, color: '#555', marginTop: 1 },

  summaryRow: { flexDirection: 'row', marginTop: 8 },
  words: { flex: 2, fontSize: 9, paddingRight: 10 },
  wordsLabel: { color: '#666', fontSize: 8, marginBottom: 2 },
  totals: { flex: 1, fontSize: 9 },
  totalsLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totalsLabel: { color: '#444' },
  totalsValue: { textAlign: 'right' },
  totalsFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: 1, borderColor: '#000', fontFamily: 'Helvetica-Bold' },

  hsnTitle: { fontSize: 8, color: '#666', marginTop: 12, marginBottom: 3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  hsnTable: { borderTop: 1, borderBottom: 1, borderColor: '#000' },
  hsnHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingVertical: 3 },
  hsnRow: { flexDirection: 'row', paddingVertical: 3, borderTop: 1, borderColor: '#e5e7eb' },
  hsnFoot: { flexDirection: 'row', paddingVertical: 3, borderTop: 1, borderColor: '#000', fontFamily: 'Helvetica-Bold' },
  hsnHsn: { width: 70, paddingHorizontal: 3 },
  hsnNum: { flex: 1, paddingHorizontal: 3, textAlign: 'right' },

  decl: { marginTop: 10, fontSize: 8, color: '#444', fontStyle: 'italic' },

  ewbBlock: { marginTop: 10, padding: 6, borderTop: 1, borderColor: '#000' },
  ewbTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },

  irnBlock: { marginTop: 10, padding: 8, borderTop: 1, borderBottom: 1, borderColor: '#000', flexDirection: 'row', gap: 10 },
  irnMeta: { flex: 1, fontSize: 8 },
  irnTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  irnLabel: { color: '#666', fontSize: 8 },
  irnValue: { fontFamily: 'Courier', fontSize: 8, marginBottom: 3 },
  qrBox: { width: 95, height: 95 },
  cancelled: { color: '#b91c1c', fontFamily: 'Helvetica-Bold' },

  footer: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' },
  sigBox: { width: 180, textAlign: 'right' },
  sigLabel: { fontSize: 8, color: '#666' },
  sigName: { fontFamily: 'Helvetica-Bold', marginTop: 18 },

  meta2: { fontSize: 8, color: '#555', marginTop: 14, textAlign: 'center' },
})

function Party({ title, name, gstin, lines, extras }: {
  title: string
  name: string
  gstin: string
  lines: string[]
  extras?: string[]
}) {
  const panNum = pan(gstin)
  return (
    <View>
      <Text style={styles.boxTitle}>{title}</Text>
      <Text style={styles.partyName}>{name}</Text>
      <Text style={styles.partyLine}>GSTIN: {gstin}{panNum ? `   ·   PAN: ${panNum}` : ''}</Text>
      {lines.filter(Boolean).map((l, i) => (<Text key={i} style={styles.partyLine}>{l}</Text>))}
      {extras?.filter(Boolean).map((l, i) => (<Text key={`x${i}`} style={styles.partyLine}>{l}</Text>))}
    </View>
  )
}

// HSN-wise tax summary — required disclosure on tax invoices for ₹5Cr+ filers
// (CGST notification 78/2020), and good practice generally.
type HsnSummary = {
  hsn: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}
function summariseByHsn(lines: ReturnType<typeof computeLines>): HsnSummary[] {
  const map = new Map<string, HsnSummary>()
  for (const l of lines) {
    const r = map.get(l.hsnCd) ?? { hsn: l.hsnCd, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    r.taxable += l.assAmt
    r.cgst += l.cgstAmt
    r.sgst += l.sgstAmt
    r.igst += l.igstAmt
    r.total = r.taxable + r.cgst + r.sgst + r.igst
    map.set(l.hsnCd, r)
  }
  return Array.from(map.values())
}

export function InvoicePdf({ seller, invoice, qrDataUrl }: { seller: Seller; invoice: Invoice; qrDataUrl?: string | null }) {
  const billTo = invoice.billTo
  const isIntra = seller.stcd === billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)
  const totalGstPerLine = (i: number) => lines[i].igstAmt + lines[i].cgstAmt + lines[i].sgstAmt

  const sellerAddr = [seller.addr1, seller.addr2, seller.loc, seller.pin ? `PIN ${seller.pin}` : '']
    .filter(Boolean).join(', ')
  const buyerAddr = [billTo.addr1, billTo.addr2, billTo.loc, billTo.pin ? `PIN ${billTo.pin}` : '']
    .filter(Boolean).join(', ')
  const ship = invoice.shipTo
  const shipAddr = ship && [ship.addr1, ship.addr2, ship.loc, ship.pin ? `PIN ${ship.pin}` : '']
    .filter(Boolean).join(', ')

  const isEInvoice = !!invoice.irn

  return (
    <Document title={`Invoice ${invoice.docNo}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{isEInvoice ? 'E-INVOICE' : 'TAX INVOICE'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={styles.metaValue}>{invoice.docNo}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{invoice.docDt}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Place of Supply</Text>
            <Text style={styles.metaValue}>{stcdName(billTo.pos) || billTo.pos} ({billTo.pos})</Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.metaLabel}>Reverse Charge</Text>
            <Text style={styles.metaValue}>No</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Party
              title="SELLER"
              name={seller.lglNm || '—'}
              gstin={seller.gstin || '—'}
              lines={[sellerAddr, `State: ${stcdName(seller.stcd) || seller.stcd} (${seller.stcd})`]}
              extras={[seller.ph ? `Ph: ${seller.ph}` : '', seller.em ? `Em: ${seller.em}` : '']}
            />
          </View>
          <View style={[styles.partyBox, styles.partyBoxDivider]}>
            <Party
              title="BILL TO"
              name={billTo.lglNm || '—'}
              gstin={billTo.gstin || '—'}
              lines={[buyerAddr, `State: ${stcdName(billTo.stcd) || billTo.stcd} (${billTo.stcd})`]}
              extras={[billTo.ph ? `Ph: ${billTo.ph}` : '', billTo.em ? `Em: ${billTo.em}` : '']}
            />
          </View>
        </View>

        {ship && shipAddr && (
          <View style={styles.shipRow}>
            <Text style={styles.boxTitle}>SHIP TO</Text>
            <Text style={styles.partyName}>{ship.lglNm || '—'}</Text>
            <Text style={styles.partyLine}>GSTIN: {ship.gstin}</Text>
            <Text style={styles.partyLine}>{shipAddr}</Text>
            <Text style={styles.partyLine}>State: {stcdName(ship.stcd) || ship.stcd} ({ship.stcd})</Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colNo]}>#</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colHsn]}>HSN</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colTaxable]}>Taxable</Text>
            <Text style={[styles.th, styles.colGstRt]}>GST%</Text>
            <Text style={[styles.th, styles.colGstAmt]}>GST</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {lines.map((line, i) => {
            const item = invoice.items[i]
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.td, styles.colNo]}>{line.slNo}</Text>
                <View style={[styles.td, styles.colDesc]}>
                  <Text style={styles.itemDesc}>{item.prdDesc}</Text>
                  {item.description ? <Text style={styles.itemSubdesc}>{item.description}</Text> : null}
                </View>
                <Text style={[styles.td, styles.colHsn]}>{line.hsnCd}</Text>
                <Text style={[styles.td, styles.colQty]}>{line.qty}</Text>
                <Text style={[styles.td, styles.colUnit]}>{line.unit}</Text>
                <Text style={[styles.td, styles.colRate]}>{fmt(line.unitPrice)}</Text>
                <Text style={[styles.td, styles.colTaxable]}>{fmt(line.assAmt)}</Text>
                <Text style={[styles.td, styles.colGstRt]}>{line.gstRt}%</Text>
                <Text style={[styles.td, styles.colGstAmt]}>{fmt(totalGstPerLine(i))}</Text>
                <Text style={[styles.td, styles.colTotal]}>{fmt(line.totItemVal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.words}>
            <Text style={styles.wordsLabel}>Amount chargeable (in words)</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{amountInWords(sum.totInvVal)}</Text>
          </View>
          <View style={styles.totals}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Total qty</Text>
              <Text style={styles.totalsValue}>{lines.reduce((s, l) => s + l.qty, 0)}</Text>
            </View>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Taxable value</Text>
              <Text style={styles.totalsValue}>{rs(sum.assVal)}</Text>
            </View>
            {isIntra ? (
              <>
                <View style={styles.totalsLine}>
                  <Text style={styles.totalsLabel}>CGST</Text>
                  <Text style={styles.totalsValue}>{rs(sum.cgstVal)}</Text>
                </View>
                <View style={styles.totalsLine}>
                  <Text style={styles.totalsLabel}>SGST</Text>
                  <Text style={styles.totalsValue}>{rs(sum.sgstVal)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLabel}>IGST</Text>
                <Text style={styles.totalsValue}>{rs(sum.igstVal)}</Text>
              </View>
            )}
            {sum.rndOffAmt !== 0 && (
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLabel}>Round off</Text>
                <Text style={styles.totalsValue}>{rs(sum.rndOffAmt)}</Text>
              </View>
            )}
            <View style={styles.totalsFinal}>
              <Text>TOTAL</Text>
              <Text>{rs(sum.totInvVal)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.hsnTitle}>HSN-wise tax summary</Text>
        <View style={styles.hsnTable}>
          <View style={styles.hsnHeader}>
            <Text style={styles.hsnHsn}>HSN</Text>
            <Text style={styles.hsnNum}>Taxable</Text>
            {isIntra ? (
              <>
                <Text style={styles.hsnNum}>CGST</Text>
                <Text style={styles.hsnNum}>SGST</Text>
              </>
            ) : (
              <Text style={styles.hsnNum}>IGST</Text>
            )}
            <Text style={styles.hsnNum}>Total</Text>
          </View>
          {summariseByHsn(lines).map((h) => (
            <View key={h.hsn} style={styles.hsnRow}>
              <Text style={styles.hsnHsn}>{h.hsn}</Text>
              <Text style={styles.hsnNum}>{fmt(h.taxable)}</Text>
              {isIntra ? (
                <>
                  <Text style={styles.hsnNum}>{fmt(h.cgst)}</Text>
                  <Text style={styles.hsnNum}>{fmt(h.sgst)}</Text>
                </>
              ) : (
                <Text style={styles.hsnNum}>{fmt(h.igst)}</Text>
              )}
              <Text style={styles.hsnNum}>{fmt(h.total)}</Text>
            </View>
          ))}
          <View style={styles.hsnFoot}>
            <Text style={styles.hsnHsn}>Total</Text>
            <Text style={styles.hsnNum}>{fmt(sum.assVal)}</Text>
            {isIntra ? (
              <>
                <Text style={styles.hsnNum}>{fmt(sum.cgstVal)}</Text>
                <Text style={styles.hsnNum}>{fmt(sum.sgstVal)}</Text>
              </>
            ) : (
              <Text style={styles.hsnNum}>{fmt(sum.igstVal)}</Text>
            )}
            <Text style={styles.hsnNum}>{fmt(sum.assVal + sum.cgstVal + sum.sgstVal + sum.igstVal)}</Text>
          </View>
        </View>

        {isEInvoice && (
          <View style={styles.irnBlock}>
            <View style={styles.irnMeta}>
              <Text style={styles.irnTitle}>
                e-Invoice {invoice.irnCancelledAt ? <Text style={styles.cancelled}>(CANCELLED)</Text> : null}
              </Text>
              <Text style={styles.irnLabel}>IRN</Text>
              <Text style={styles.irnValue}>{invoice.irn}</Text>
              <Text style={styles.irnLabel}>Ack No.</Text>
              <Text style={styles.irnValue}>{invoice.ackNo}</Text>
              <Text style={styles.irnLabel}>Ack Date</Text>
              <Text style={styles.irnValue}>{invoice.ackDt}</Text>
            </View>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrBox} />
            ) : (
              <View style={[styles.qrBox, { border: 1, borderColor: '#ccc' }]} />
            )}
          </View>
        )}

        {invoice.ewb && (
          <View style={styles.ewbBlock}>
            <Text style={styles.ewbTitle}>E-Way Bill details</Text>
            <Text style={styles.partyLine}>
              Mode: {({ '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' } as any)[invoice.ewb.transMode] || invoice.ewb.transMode}
              {' · '}Distance: {invoice.ewb.distance} km
              {invoice.ewb.vehNo ? ` · Vehicle: ${invoice.ewb.vehNo}` : ''}
            </Text>
            {(invoice.ewb.transId || invoice.ewb.transName) && (
              <Text style={styles.partyLine}>
                Transporter: {[invoice.ewb.transName, invoice.ewb.transId].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
        )}

        {invoice.notes && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.wordsLabel}>Notes</Text>
            <Text style={{ fontSize: 9 }}>{invoice.notes}</Text>
          </View>
        )}

        <Text style={styles.decl}>
          Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </Text>

        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sigLabel}>This is a computer-generated invoice.</Text>
            <Text style={[styles.sigLabel, { marginTop: 2 }]}>Subject to {stcdName(seller.stcd) || seller.stcd} jurisdiction.</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>For {seller.lglNm || '—'}</Text>
            <Text style={styles.sigName}>Authorised signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function downloadInvoicePdf(seller: Seller, invoice: Invoice) {
  // Encode NIC's SignedQRCode JWT into a scannable PNG data URL.
  // @react-pdf/renderer <Image> renders data URLs directly.
  const qrDataUrl = invoice.signedQr
    ? await QRCode.toDataURL(invoice.signedQr, { margin: 0, width: 320, errorCorrectionLevel: 'M' })
    : null

  const blob = await pdf(<InvoicePdf seller={seller} invoice={invoice} qrDataUrl={qrDataUrl} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-${invoice.docNo || 'draft'}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
