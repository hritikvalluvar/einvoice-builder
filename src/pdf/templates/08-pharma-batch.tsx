// Pharma Batch — bordered, with batch / expiry / manufacturer columns.
// Target: pharma distributors, chemists. Multi-copy ready (Drug Cosmetics Act).

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { amountInWords } from '../../amountWords'
import { PartyBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt, panFromGstin } from '../shared/format'
import type { TemplateProps } from '../shared/types'

type PharmaItem = {
  prdDesc: string
  hsnCd: string
  qty: number
  unit: string
  unitPrice: number
  gstRt: number
  batch: string
  expiry: string
  mfr: string
}

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 8, fontFamily: 'Roboto', color: '#000' },
  outer: { border: 1, borderColor: '#0c4a6e' },
  title: { textAlign: 'center', backgroundColor: '#e0f2fe', color: '#0c4a6e', fontSize: 12, fontWeight: 'bold', padding: 4, letterSpacing: 2, borderBottom: 1, borderColor: '#0c4a6e' },
  cornerLabel: { position: 'absolute', top: 22, right: 22 },

  sellerBlock: { padding: 6, borderBottom: 1, borderColor: '#0c4a6e' },
  brandName: { fontSize: 12, fontWeight: 'bold', color: '#0c4a6e' },
  brandSub: { fontSize: 8 },
  dlNo: { fontSize: 7.5, color: '#444' },

  meta: { flexDirection: 'row', borderBottom: 1, borderColor: '#0c4a6e' },
  metaCell: { flex: 1, padding: 4, borderRight: 1, borderColor: '#0c4a6e' },
  metaCellLast: { flex: 1, padding: 4 },
  metaLbl: { fontSize: 7, color: '#555' },
  metaVal: { fontWeight: 'bold' },

  parties: { flexDirection: 'row', borderBottom: 1, borderColor: '#0c4a6e' },
  party: { flex: 1, padding: 6 },
  partyDiv: { borderLeft: 1, borderColor: '#0c4a6e' },

  th: { flexDirection: 'row', backgroundColor: '#e0f2fe', fontWeight: 'bold', paddingVertical: 4, fontSize: 7.5 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottom: 1, borderColor: '#e5e7eb', fontSize: 8 },
  bordR: { borderRight: 1, borderColor: '#cbd5e1', paddingHorizontal: 3 },
  cNo: { width: 18, textAlign: 'center' },
  cDesc: { flex: 2 },
  cBatch: { width: 60 },
  cExp: { width: 42, textAlign: 'center' },
  cMfr: { width: 70 },
  cHsn: { width: 50, textAlign: 'center' },
  cQty: { width: 30, textAlign: 'right' },
  cRate: { width: 42, textAlign: 'right' },
  cGstR: { width: 30, textAlign: 'right' },
  cTotal: { width: 56, textAlign: 'right', paddingRight: 3 },

  totalRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', fontWeight: 'bold', paddingVertical: 4, borderTop: 1, borderColor: '#0c4a6e' },

  bottom: { flexDirection: 'row', borderTop: 1, borderColor: '#0c4a6e' },
  bLeft: { flex: 1, padding: 6, borderRight: 1, borderColor: '#0c4a6e' },
  bRight: { width: 180, padding: 6 },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: 1, borderColor: '#000', fontWeight: 'bold' },
})

export function PharmaBatch({ seller, invoice, copyLabel = 'none', extras }: TemplateProps) {
  // Pharma uses extras.items with batch/expiry/mfr (mock fixture provides this)
  const items = (extras?.items as PharmaItem[]) ?? invoice.items.map((it) => ({ ...it, batch: '—', expiry: '—', mfr: '—' }))
  const isIntra = seller.stcd === invoice.billTo.pos

  // Tax math from these enriched items
  const enriched = items.map((it) => {
    const assAmt = +(it.qty * it.unitPrice).toFixed(2)
    const gst = +(assAmt * it.gstRt / 100).toFixed(2)
    const cgst = isIntra ? +(gst / 2).toFixed(2) : 0
    const sgst = isIntra ? +(gst / 2).toFixed(2) : 0
    const igst = isIntra ? 0 : gst
    return { ...it, assAmt, total: assAmt + gst, cgst, sgst, igst }
  })
  const assVal = enriched.reduce((a, l) => a + l.assAmt, 0)
  const cgstVal = enriched.reduce((a, l) => a + l.cgst, 0)
  const sgstVal = enriched.reduce((a, l) => a + l.sgst, 0)
  const igstVal = enriched.reduce((a, l) => a + l.igst, 0)
  const total = enriched.reduce((a, l) => a + l.total, 0)
  const totRounded = Math.round(total)
  const rndOff = +(totRounded - total).toFixed(2)

  return (
    <Document title={`Pharma Invoice ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.outer}>
          <Text style={s.title}>TAX INVOICE — PHARMACEUTICALS</Text>

          <View style={s.sellerBlock}>
            <Text style={s.brandName}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.addr2, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(', ')}</Text>
            <Text style={s.brandSub}>GSTIN: {seller.gstin} · PAN: {panFromGstin(seller.gstin)}</Text>
            <Text style={s.dlNo}>Drug Licence No.: MH-MUM-20A-1234 / 21B-1234 (Sample)</Text>
          </View>

          <View style={s.meta}>
            <View style={s.metaCell}><Text style={s.metaLbl}>Invoice No.</Text><Text style={s.metaVal}>{invoice.docNo}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Date</Text><Text style={s.metaVal}>{invoice.docDt}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Place of Supply</Text><Text style={s.metaVal}>{stcdName(invoice.billTo.pos)}</Text></View>
            <View style={s.metaCellLast}><Text style={s.metaLbl}>Reverse Charge</Text><Text style={s.metaVal}>No</Text></View>
          </View>

          <View style={s.parties}>
            <View style={s.party}><PartyBlock title="Buyer (Chemist / Hospital)" party={invoice.billTo} /></View>
          </View>

          <View style={s.th}>
            <Text style={[s.bordR, s.cNo]}>#</Text>
            <Text style={[s.bordR, s.cDesc]}>Product</Text>
            <Text style={[s.bordR, s.cBatch]}>Batch</Text>
            <Text style={[s.bordR, s.cExp]}>Expiry</Text>
            <Text style={[s.bordR, s.cMfr]}>Mfr.</Text>
            <Text style={[s.bordR, s.cHsn]}>HSN</Text>
            <Text style={[s.bordR, s.cQty]}>Qty</Text>
            <Text style={[s.bordR, s.cRate]}>MRP/Rate</Text>
            <Text style={[s.bordR, s.cGstR]}>GST%</Text>
            <Text style={s.cTotal}>Amount</Text>
          </View>
          {enriched.map((it, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.bordR, s.cNo]}>{i + 1}</Text>
              <Text style={[s.bordR, s.cDesc, { fontWeight: 'bold' }]}>{it.prdDesc}</Text>
              <Text style={[s.bordR, s.cBatch]}>{it.batch}</Text>
              <Text style={[s.bordR, s.cExp]}>{it.expiry}</Text>
              <Text style={[s.bordR, s.cMfr]}>{it.mfr}</Text>
              <Text style={[s.bordR, s.cHsn]}>{it.hsnCd}</Text>
              <Text style={[s.bordR, s.cQty]}>{it.qty}</Text>
              <Text style={[s.bordR, s.cRate]}>{fmt(it.unitPrice)}</Text>
              <Text style={[s.bordR, s.cGstR]}>{it.gstRt}%</Text>
              <Text style={s.cTotal}>{fmt(it.total)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.bordR, s.cNo]}></Text>
            <Text style={[s.bordR, s.cDesc]}>Total</Text>
            <Text style={[s.bordR, s.cBatch]}></Text>
            <Text style={[s.bordR, s.cExp]}></Text>
            <Text style={[s.bordR, s.cMfr]}></Text>
            <Text style={[s.bordR, s.cHsn]}></Text>
            <Text style={[s.bordR, s.cQty]}>{enriched.reduce((a, l) => a + l.qty, 0)}</Text>
            <Text style={[s.bordR, s.cRate]}></Text>
            <Text style={[s.bordR, s.cGstR]}></Text>
            <Text style={s.cTotal}>{fmt(total)}</Text>
          </View>

          <View style={s.bottom}>
            <View style={s.bLeft}>
              <Text style={{ fontSize: 7, color: '#666' }}>Amount in words</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 9, marginTop: 2 }}>{amountInWords(totRounded)}</Text>
              <Text style={{ fontSize: 7.5, color: '#b91c1c', marginTop: 8, fontStyle: 'italic' }}>
                * Schedule H drugs to be sold against prescription only.{'\n'}
                * Goods once sold will be taken back / exchanged only against original invoice within 7 days.
              </Text>
            </View>
            <View style={s.bRight}>
              <View style={s.tLine}><Text>Taxable</Text><Text>{fmt(assVal)}</Text></View>
              {isIntra ? (
                <>
                  <View style={s.tLine}><Text>CGST</Text><Text>{fmt(cgstVal)}</Text></View>
                  <View style={s.tLine}><Text>SGST</Text><Text>{fmt(sgstVal)}</Text></View>
                </>
              ) : (
                <View style={s.tLine}><Text>IGST</Text><Text>{fmt(igstVal)}</Text></View>
              )}
              <View style={s.tLine}><Text>Round Off</Text><Text>{fmt(rndOff)}</Text></View>
              <View style={s.tFinal}><Text>Net Payable</Text><Text>₹ {fmt(totRounded)}</Text></View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
