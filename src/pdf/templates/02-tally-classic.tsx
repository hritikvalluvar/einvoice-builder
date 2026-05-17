// Tally Classic — dense, bordered, serif numerals, B/W. The format traders
// expect because it matches Tally's print output that they've used for 25 years.
// Target: hardware, pipe, traditional wholesale.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { computeLines, summarize } from '../../einvoice'
import { amountInWords } from '../../amountWords'
import { PartyBlock, IrnQrBlock, EwbBlock, CopyCornerLabel, CopyWatermark, stcdName, HsnSummary } from '../shared/blocks'
import { fmt, panFromGstin } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 8, fontFamily: 'Roboto', color: '#000' },
  outer: { border: 1, borderColor: '#000' },
  title: { textAlign: 'center', fontSize: 12, fontWeight: 'bold', paddingVertical: 4, borderBottom: 1, borderColor: '#000', letterSpacing: 3 },
  cornerLabel: { position: 'absolute', top: 22, right: 22 },

  metaGrid: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  metaCell: { flex: 1, padding: 4, borderRight: 1, borderColor: '#000' },
  metaCellLast: { flex: 1, padding: 4 },
  metaLbl: { fontSize: 7, color: '#000' },
  metaVal: { fontWeight: 'bold' },

  parties: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  party: { flex: 1, padding: 6 },
  partyDiv: { borderLeft: 1, borderColor: '#000' },

  tHead: { flexDirection: 'row', backgroundColor: '#e5e7eb', fontWeight: 'bold', paddingVertical: 3, borderBottom: 1, borderColor: '#000' },
  tRow: { flexDirection: 'row', paddingVertical: 3, borderBottom: 1, borderColor: '#e5e7eb', minHeight: 22 },
  tCellBordered: { borderRight: 1, borderColor: '#e5e7eb', paddingHorizontal: 3 },
  cNo: { width: 20, textAlign: 'center' },
  cDesc: { flex: 3 },
  cHsn: { width: 50, textAlign: 'center' },
  cQty: { width: 36, textAlign: 'right' },
  cUnit: { width: 30, textAlign: 'center' },
  cRate: { width: 52, textAlign: 'right' },
  cTax: { width: 60, textAlign: 'right' },
  cGstR: { width: 32, textAlign: 'right' },
  cGstA: { width: 50, textAlign: 'right' },
  cTotal: { width: 64, textAlign: 'right' },

  totRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', fontWeight: 'bold', paddingVertical: 3, borderTop: 1, borderColor: '#000' },

  bottomGrid: { flexDirection: 'row', borderTop: 1, borderColor: '#000' },
  bottomLeft: { flex: 1, padding: 6, borderRight: 1, borderColor: '#000' },
  bottomRight: { width: 180, padding: 6 },
  bSec: { marginBottom: 6 },
  bLbl: { fontSize: 7, marginBottom: 1 },
  bVal: { fontWeight: 'bold', fontSize: 9 },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: 1, borderColor: '#000', fontWeight: 'bold' },

  decl: { padding: 6, fontSize: 7.5, borderTop: 1, borderColor: '#000' },
  declTitle: { fontWeight: 'bold', marginBottom: 2 },

  sigGrid: { flexDirection: 'row', borderTop: 1, borderColor: '#000', minHeight: 60 },
  sigBox: { flex: 1, padding: 6, borderRight: 1, borderColor: '#000' },
  sigBoxLast: { flex: 1, padding: 6 },
  sigLbl: { fontSize: 7, marginBottom: 28 },
})

export function TallyClassic({ seller, invoice, qrDataUrl, copyLabel = 'none' }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  const hsnRows = Array.from(
    lines.reduce((m, l) => {
      const r = m.get(l.hsnCd) ?? { hsnCd: l.hsnCd, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
      r.taxable += l.assAmt
      r.cgst += l.cgstAmt
      r.sgst += l.sgstAmt
      r.igst += l.igstAmt
      r.total = r.taxable + r.cgst + r.sgst + r.igst
      m.set(l.hsnCd, r)
      return m
    }, new Map<string, { hsnCd: string; taxable: number; cgst: number; sgst: number; igst: number; total: number }>())
      .values()
  )

  return (
    <Document title={`Tax Invoice ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.outer}>
          <Text style={s.title}>TAX INVOICE</Text>

          {/* Seller block (full width) */}
          <View style={{ padding: 6, borderBottom: 1, borderColor: '#000' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{seller.lglNm}</Text>
            <Text>{[seller.addr1, seller.addr2, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(', ')}</Text>
            <Text>GSTIN: {seller.gstin} · PAN: {panFromGstin(seller.gstin)} · State: {stcdName(seller.stcd)} ({seller.stcd})</Text>
            {seller.ph && <Text>Phone: {seller.ph}{seller.em ? `   Email: ${seller.em}` : ''}</Text>}
          </View>

          <View style={s.metaGrid}>
            <View style={s.metaCell}><Text style={s.metaLbl}>Invoice No.</Text><Text style={s.metaVal}>{invoice.docNo}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Date</Text><Text style={s.metaVal}>{invoice.docDt}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Place of Supply</Text><Text style={s.metaVal}>{stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text></View>
            <View style={s.metaCellLast}><Text style={s.metaLbl}>Reverse Charge</Text><Text style={s.metaVal}>No</Text></View>
          </View>

          <View style={s.parties}>
            <View style={s.party}><PartyBlock title="Buyer (Bill to)" party={invoice.billTo} /></View>
            {invoice.shipTo && <View style={[s.party, s.partyDiv]}><PartyBlock title="Consignee (Ship to)" party={invoice.shipTo} /></View>}
          </View>

          <View style={s.tHead}>
            <Text style={[s.tCellBordered, s.cNo]}>Sl</Text>
            <Text style={[s.tCellBordered, s.cDesc]}>Particulars</Text>
            <Text style={[s.tCellBordered, s.cHsn]}>HSN</Text>
            <Text style={[s.tCellBordered, s.cQty]}>Qty</Text>
            <Text style={[s.tCellBordered, s.cUnit]}>Unit</Text>
            <Text style={[s.tCellBordered, s.cRate]}>Rate</Text>
            <Text style={[s.tCellBordered, s.cTax]}>Taxable</Text>
            <Text style={[s.tCellBordered, s.cGstR]}>GST%</Text>
            <Text style={[s.tCellBordered, s.cGstA]}>Tax Amt</Text>
            <Text style={s.cTotal}>Total</Text>
          </View>
          {lines.map((line, i) => {
            const gst = line.igstAmt + line.cgstAmt + line.sgstAmt
            return (
              <View key={i} style={s.tRow}>
                <Text style={[s.tCellBordered, s.cNo]}>{line.slNo}</Text>
                <Text style={[s.tCellBordered, s.cDesc, { fontWeight: 'bold' }]}>{invoice.items[i].prdDesc}</Text>
                <Text style={[s.tCellBordered, s.cHsn]}>{line.hsnCd}</Text>
                <Text style={[s.tCellBordered, s.cQty]}>{line.qty}</Text>
                <Text style={[s.tCellBordered, s.cUnit]}>{line.unit}</Text>
                <Text style={[s.tCellBordered, s.cRate]}>{fmt(line.unitPrice)}</Text>
                <Text style={[s.tCellBordered, s.cTax]}>{fmt(line.assAmt)}</Text>
                <Text style={[s.tCellBordered, s.cGstR]}>{line.gstRt}%</Text>
                <Text style={[s.tCellBordered, s.cGstA]}>{fmt(gst)}</Text>
                <Text style={s.cTotal}>{fmt(line.totItemVal)}</Text>
              </View>
            )
          })}
          <View style={s.totRow}>
            <Text style={[s.tCellBordered, s.cNo]}></Text>
            <Text style={[s.tCellBordered, s.cDesc]}>Total</Text>
            <Text style={[s.tCellBordered, s.cHsn]}></Text>
            <Text style={[s.tCellBordered, s.cQty]}>{lines.reduce((a, l) => a + l.qty, 0)}</Text>
            <Text style={[s.tCellBordered, s.cUnit]}></Text>
            <Text style={[s.tCellBordered, s.cRate]}></Text>
            <Text style={[s.tCellBordered, s.cTax]}>{fmt(sum.assVal)}</Text>
            <Text style={[s.tCellBordered, s.cGstR]}></Text>
            <Text style={[s.tCellBordered, s.cGstA]}>{fmt(sum.cgstVal + sum.sgstVal + sum.igstVal)}</Text>
            <Text style={s.cTotal}>{fmt(sum.totInvVal)}</Text>
          </View>

          <View style={s.bottomGrid}>
            <View style={s.bottomLeft}>
              <View style={s.bSec}>
                <Text style={s.bLbl}>Amount chargeable (in words)</Text>
                <Text style={s.bVal}>INR {amountInWords(sum.totInvVal)}</Text>
              </View>
              <HsnSummary rows={hsnRows} />
            </View>
            <View style={s.bottomRight}>
              <View style={s.tLine}><Text>Taxable Value</Text><Text>{fmt(sum.assVal)}</Text></View>
              {isIntra ? (
                <>
                  <View style={s.tLine}><Text>CGST</Text><Text>{fmt(sum.cgstVal)}</Text></View>
                  <View style={s.tLine}><Text>SGST</Text><Text>{fmt(sum.sgstVal)}</Text></View>
                </>
              ) : (
                <View style={s.tLine}><Text>IGST</Text><Text>{fmt(sum.igstVal)}</Text></View>
              )}
              {sum.rndOffAmt !== 0 && <View style={s.tLine}><Text>Round Off</Text><Text>{fmt(sum.rndOffAmt)}</Text></View>}
              <View style={s.tFinal}><Text>Grand Total</Text><Text>₹ {fmt(sum.totInvVal)}</Text></View>
            </View>
          </View>

          <EwbBlock invoice={invoice} />
          <IrnQrBlock invoice={invoice} qrDataUrl={qrDataUrl} />

          <View style={s.decl}>
            <Text style={s.declTitle}>Declaration</Text>
            <Text>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</Text>
          </View>

          <View style={s.sigGrid}>
            <View style={s.sigBox}>
              <Text style={s.sigLbl}>Receiver's Signature</Text>
              <Text>—</Text>
            </View>
            <View style={s.sigBoxLast}>
              <Text style={[s.sigLbl, { textAlign: 'right' }]}>For {seller.lglNm}</Text>
              <Text style={{ textAlign: 'right' }}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        <Text style={{ textAlign: 'center', marginTop: 6, fontSize: 7, color: '#444' }}>
          Subject to {seller.loc} jurisdiction. E. & O.E.
        </Text>
      </Page>
    </Document>
  )
}
