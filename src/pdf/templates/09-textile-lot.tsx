// Textile / Lot — landscape, lot / design / shade columns, dual-unit qty.
// Target: cloth, garment wholesale.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { amountInWords } from '../../amountWords'
import { PartyBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt } from '../shared/format'
import type { TemplateProps } from '../shared/types'

type TextileItem = {
  prdDesc: string
  hsnCd: string
  qty: number
  unit: string
  unitPrice: number
  gstRt: number
  design: string
  lot: string
  shade: string
}

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 8.5, fontFamily: 'Roboto', color: '#000' },
  outer: { border: 1, borderColor: '#000' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottom: 2, borderColor: '#000' },
  brand: { fontSize: 14, fontWeight: 'bold' },
  brandSub: { fontSize: 8, color: '#555' },
  cornerLabel: { position: 'absolute', top: 22, right: 22 },

  metaTitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  meta: { textAlign: 'right', fontSize: 8 },

  parties: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  party: { flex: 1, padding: 6 },
  partyDiv: { borderLeft: 1, borderColor: '#000' },

  th: { flexDirection: 'row', backgroundColor: '#fef3c7', fontWeight: 'bold', paddingVertical: 4, fontSize: 8 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottom: 1, borderColor: '#e5e7eb', fontSize: 8.5 },
  bordR: { borderRight: 1, borderColor: '#cbd5e1', paddingHorizontal: 4 },
  cNo: { width: 22, textAlign: 'center' },
  cDesc: { flex: 2 },
  cDesign: { width: 60 },
  cLot: { width: 60 },
  cShade: { width: 60 },
  cHsn: { width: 50, textAlign: 'center' },
  cQty: { width: 60, textAlign: 'right' },
  cRate: { width: 50, textAlign: 'right' },
  cTax: { width: 70, textAlign: 'right' },
  cGstR: { width: 40, textAlign: 'right' },
  cTotal: { width: 80, textAlign: 'right', paddingRight: 4 },

  totRow: { flexDirection: 'row', fontWeight: 'bold', backgroundColor: '#fef3c7', paddingVertical: 4, borderTop: 1, borderColor: '#000' },

  bottom: { flexDirection: 'row', borderTop: 1, borderColor: '#000' },
  bLeft: { flex: 1, padding: 6, borderRight: 1, borderColor: '#000' },
  bRight: { width: 220, padding: 6 },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: 1, borderColor: '#000', fontWeight: 'bold', fontSize: 10 },
})

export function TextileLot({ seller, invoice, copyLabel = 'none', extras }: TemplateProps) {
  const items = (extras?.items as TextileItem[]) ?? []
  const isIntra = seller.stcd === invoice.billTo.pos

  const enriched = items.map((it) => {
    const assAmt = +(it.qty * it.unitPrice).toFixed(2)
    const gst = +(assAmt * it.gstRt / 100).toFixed(2)
    const cgst = isIntra ? +(gst / 2).toFixed(2) : 0
    const sgst = isIntra ? +(gst / 2).toFixed(2) : 0
    const igst = isIntra ? 0 : gst
    return { ...it, assAmt, total: assAmt + gst, cgst, sgst, igst, gst }
  })
  const assVal = enriched.reduce((a, l) => a + l.assAmt, 0)
  const cgstVal = enriched.reduce((a, l) => a + l.cgst, 0)
  const sgstVal = enriched.reduce((a, l) => a + l.sgst, 0)
  const igstVal = enriched.reduce((a, l) => a + l.igst, 0)
  const totalSum = enriched.reduce((a, l) => a + l.total, 0)
  const totQty = enriched.reduce((a, l) => a + l.qty, 0)

  return (
    <Document title={`Tax Invoice ${invoice.docNo}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.outer}>
          <View style={s.hdr}>
            <View>
              <Text style={s.brand}>{seller.lglNm}</Text>
              <Text style={s.brandSub}>{[seller.addr1, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(', ')}</Text>
              <Text style={s.brandSub}>GSTIN {seller.gstin}</Text>
            </View>
            <View>
              <Text style={s.metaTitle}>TAX INVOICE</Text>
              <Text style={s.meta}>{invoice.docNo}  ·  {invoice.docDt}</Text>
              <Text style={s.meta}>POS: {stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text>
            </View>
          </View>

          <View style={s.parties}>
            <View style={s.party}><PartyBlock title="Buyer (Bill to)" party={invoice.billTo} /></View>
          </View>

          <View style={s.th}>
            <Text style={[s.bordR, s.cNo]}>#</Text>
            <Text style={[s.bordR, s.cDesc]}>Fabric</Text>
            <Text style={[s.bordR, s.cDesign]}>Design</Text>
            <Text style={[s.bordR, s.cLot]}>Lot</Text>
            <Text style={[s.bordR, s.cShade]}>Shade</Text>
            <Text style={[s.bordR, s.cHsn]}>HSN</Text>
            <Text style={[s.bordR, s.cQty]}>Qty</Text>
            <Text style={[s.bordR, s.cRate]}>Rate</Text>
            <Text style={[s.bordR, s.cTax]}>Taxable</Text>
            <Text style={[s.bordR, s.cGstR]}>GST%</Text>
            <Text style={s.cTotal}>Amount</Text>
          </View>
          {enriched.map((it, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.bordR, s.cNo]}>{i + 1}</Text>
              <Text style={[s.bordR, s.cDesc, { fontWeight: 'bold' }]}>{it.prdDesc}</Text>
              <Text style={[s.bordR, s.cDesign]}>{it.design}</Text>
              <Text style={[s.bordR, s.cLot]}>{it.lot}</Text>
              <Text style={[s.bordR, s.cShade]}>{it.shade}</Text>
              <Text style={[s.bordR, s.cHsn]}>{it.hsnCd}</Text>
              <Text style={[s.bordR, s.cQty]}>{it.qty} {it.unit}</Text>
              <Text style={[s.bordR, s.cRate]}>{fmt(it.unitPrice)}</Text>
              <Text style={[s.bordR, s.cTax]}>{fmt(it.assAmt)}</Text>
              <Text style={[s.bordR, s.cGstR]}>{it.gstRt}%</Text>
              <Text style={s.cTotal}>{fmt(it.total)}</Text>
            </View>
          ))}
          <View style={s.totRow}>
            <Text style={[s.bordR, s.cNo]}></Text>
            <Text style={[s.bordR, s.cDesc]}>Total</Text>
            <Text style={[s.bordR, s.cDesign]}></Text>
            <Text style={[s.bordR, s.cLot]}></Text>
            <Text style={[s.bordR, s.cShade]}></Text>
            <Text style={[s.bordR, s.cHsn]}></Text>
            <Text style={[s.bordR, s.cQty]}>{totQty}</Text>
            <Text style={[s.bordR, s.cRate]}></Text>
            <Text style={[s.bordR, s.cTax]}>{fmt(assVal)}</Text>
            <Text style={[s.bordR, s.cGstR]}></Text>
            <Text style={s.cTotal}>{fmt(totalSum)}</Text>
          </View>

          <View style={s.bottom}>
            <View style={s.bLeft}>
              <Text style={{ fontSize: 7.5, color: '#555' }}>Amount in words</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 9, marginTop: 2 }}>{amountInWords(Math.round(totalSum))}</Text>
              <Text style={{ fontSize: 7.5, color: '#555', marginTop: 6 }}>
                Each lot represents a single dyeing batch; shade matching across lots is not guaranteed.
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
              <View style={s.tFinal}><Text>Total</Text><Text>₹ {fmt(totalSum)}</Text></View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
