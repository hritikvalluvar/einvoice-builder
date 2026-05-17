// Compact Retail — very dense, many SKUs on one page, B/W, sans-serif.
// Target: electronics, convenience, multi-SKU retail.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { computeLines, summarize } from '../../einvoice'
import { amountInWords } from '../../amountWords'
import { PartyBlock, IrnQrBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const s = StyleSheet.create({
  page: { padding: 18, fontSize: 7.5, fontFamily: 'Roboto', color: '#000' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: 2, borderColor: '#000', paddingBottom: 4, marginBottom: 4 },
  brand: { fontSize: 13, fontWeight: 'bold' },
  brandSub: { fontSize: 7, color: '#555' },
  meta: { textAlign: 'right' },
  metaTitle: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  cornerLabel: { position: 'absolute', top: 18, right: 18 },

  twoCol: { flexDirection: 'row', gap: 12, paddingVertical: 4, borderBottom: 1, borderColor: '#000' },
  col: { flex: 1 },

  th: { flexDirection: 'row', backgroundColor: '#000', color: '#fff', fontSize: 7, fontWeight: 'bold', paddingVertical: 3 },
  row: { flexDirection: 'row', paddingVertical: 2, borderBottom: 1, borderColor: '#e5e7eb', fontSize: 7.5 },
  cNo: { width: 16, paddingLeft: 3 },
  cDesc: { flex: 3 },
  cHsn: { width: 40 },
  cQty: { width: 28, textAlign: 'right' },
  cRate: { width: 44, textAlign: 'right' },
  cTax: { width: 50, textAlign: 'right' },
  cGstR: { width: 26, textAlign: 'right' },
  cGstA: { width: 44, textAlign: 'right' },
  cTotal: { width: 54, textAlign: 'right', paddingRight: 3 },

  totalRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', fontWeight: 'bold', paddingVertical: 3 },
  bottom: { flexDirection: 'row', marginTop: 6 },
  words: { flex: 1, paddingRight: 8, fontSize: 7.5 },
  wordsLbl: { fontSize: 6.5, color: '#555' },
  totalBox: { width: 160, padding: 5, border: 1, borderColor: '#000' },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, paddingTop: 3, borderTop: 1, borderColor: '#000', fontWeight: 'bold', fontSize: 9 },
})

export function CompactRetail({ seller, invoice, qrDataUrl, copyLabel = 'none' }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  return (
    <Document title={`Tax Invoice ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.hdr}>
          <View>
            <Text style={s.brand}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(', ')}</Text>
            <Text style={s.brandSub}>GSTIN {seller.gstin}{seller.ph ? `  Ph: ${seller.ph}` : ''}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaTitle}>Tax Invoice</Text>
            <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{invoice.docNo}</Text>
            <Text style={{ fontSize: 7.5 }}>Date: {invoice.docDt}</Text>
            <Text style={{ fontSize: 7.5 }}>POS: {stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text>
          </View>
        </View>

        <View style={s.twoCol}>
          <View style={s.col}><PartyBlock title="Bill To" party={invoice.billTo} /></View>
          {invoice.shipTo && <View style={s.col}><PartyBlock title="Ship To" party={invoice.shipTo} /></View>}
        </View>

        <View style={s.th}>
          <Text style={s.cNo}>#</Text>
          <Text style={s.cDesc}>Item</Text>
          <Text style={s.cHsn}>HSN</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cRate}>Rate</Text>
          <Text style={s.cTax}>Taxable</Text>
          <Text style={s.cGstR}>%</Text>
          <Text style={s.cGstA}>GST</Text>
          <Text style={s.cTotal}>Total</Text>
        </View>
        {lines.map((line, i) => {
          const gst = line.igstAmt + line.cgstAmt + line.sgstAmt
          return (
            <View key={i} style={s.row}>
              <Text style={s.cNo}>{line.slNo}</Text>
              <Text style={s.cDesc}>{invoice.items[i].prdDesc}</Text>
              <Text style={s.cHsn}>{line.hsnCd}</Text>
              <Text style={s.cQty}>{line.qty}</Text>
              <Text style={s.cRate}>{fmt(line.unitPrice)}</Text>
              <Text style={s.cTax}>{fmt(line.assAmt)}</Text>
              <Text style={s.cGstR}>{line.gstRt}%</Text>
              <Text style={s.cGstA}>{fmt(gst)}</Text>
              <Text style={s.cTotal}>{fmt(line.totItemVal)}</Text>
            </View>
          )
        })}
        <View style={s.totalRow}>
          <Text style={s.cNo}></Text>
          <Text style={s.cDesc}>TOTAL</Text>
          <Text style={s.cHsn}></Text>
          <Text style={s.cQty}>{lines.reduce((a, l) => a + l.qty, 0)}</Text>
          <Text style={s.cRate}></Text>
          <Text style={s.cTax}>{fmt(sum.assVal)}</Text>
          <Text style={s.cGstR}></Text>
          <Text style={s.cGstA}>{fmt(sum.cgstVal + sum.sgstVal + sum.igstVal)}</Text>
          <Text style={s.cTotal}>{fmt(sum.totInvVal)}</Text>
        </View>

        <View style={s.bottom}>
          <View style={s.words}>
            <Text style={s.wordsLbl}>Amount in words</Text>
            <Text style={{ fontWeight: 'bold' }}>{amountInWords(sum.totInvVal)}</Text>
          </View>
          <View style={s.totalBox}>
            <View style={s.tLine}><Text>Taxable</Text><Text>{fmt(sum.assVal)}</Text></View>
            {isIntra ? (
              <>
                <View style={s.tLine}><Text>CGST</Text><Text>{fmt(sum.cgstVal)}</Text></View>
                <View style={s.tLine}><Text>SGST</Text><Text>{fmt(sum.sgstVal)}</Text></View>
              </>
            ) : (
              <View style={s.tLine}><Text>IGST</Text><Text>{fmt(sum.igstVal)}</Text></View>
            )}
            <View style={s.tFinal}><Text>Total</Text><Text>₹{fmt(sum.totInvVal)}</Text></View>
          </View>
        </View>

        <IrnQrBlock invoice={invoice} qrDataUrl={qrDataUrl} />
      </Page>
    </Document>
  )
}
