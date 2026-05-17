// Service Letterhead — no qty column, wide description, modern minimal, accent rail.
// Target: freelancers, consultants, agencies, coaching.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { summarize, computeLines } from '../../einvoice'
import { amountInWords } from '../../amountWords'
import { PartyBlock, IrnQrBlock, CopyCornerLabel, CopyWatermark } from '../shared/blocks'
import { inr } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const ACCENT = '#1e3a8a' // navy

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: 'Roboto', color: '#111' },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, backgroundColor: ACCENT },
  body: { padding: 40, paddingLeft: 48 },
  cornerLabel: { position: 'absolute', top: 32, right: 32 },

  header: { marginBottom: 40 },
  brand: { fontSize: 28, fontWeight: 'bold', color: ACCENT, letterSpacing: -0.5, fontFamily: 'PlayfairDisplay' },
  brandSub: { fontSize: 9, color: '#666', marginTop: 4 },
  brandLine: { fontSize: 9, color: '#888' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 },
  metaLeft: { flex: 1 },
  metaRight: { textAlign: 'right' },
  invHeading: { fontSize: 13, fontWeight: 'bold', color: '#444', textTransform: 'uppercase', letterSpacing: 6, marginBottom: 8 },
  invNo: { fontSize: 16, fontWeight: 'bold' },
  metaLbl: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },

  table: { marginTop: 16, marginBottom: 24 },
  tHead: { flexDirection: 'row', paddingBottom: 8, borderBottom: 1, borderColor: '#111' },
  thLbl: { fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  thDesc: { flex: 1 },
  thSac: { width: 60, textAlign: 'right' },
  thAmt: { width: 80, textAlign: 'right' },

  row: { flexDirection: 'row', paddingVertical: 14, borderBottom: 1, borderColor: '#e5e7eb' },
  rDesc: { flex: 1, paddingRight: 16 },
  rTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  rSub: { fontSize: 9, color: '#555', lineHeight: 1.5 },
  rSac: { width: 60, textAlign: 'right', fontSize: 9, color: '#666' },
  rAmt: { width: 80, textAlign: 'right', fontSize: 11 },

  totals: { alignItems: 'flex-end', marginTop: 16 },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', width: 240, paddingVertical: 4, fontSize: 9.5 },
  tLineLbl: { color: '#555' },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', width: 240, paddingTop: 10, marginTop: 6, borderTop: 2, borderColor: ACCENT, fontWeight: 'bold', fontSize: 13, color: ACCENT },

  words: { marginTop: 28, fontSize: 9, color: '#555', fontStyle: 'italic' },

  payBlock: { marginTop: 28, padding: 16, backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: ACCENT },
  payTitle: { fontSize: 9, color: ACCENT, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  payLine: { fontSize: 9, marginBottom: 2 },

  footer: { position: 'absolute', bottom: 32, left: 48, right: 32, paddingTop: 12, borderTop: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#888' },
})

export function ServiceLetterhead({ seller, invoice, qrDataUrl, copyLabel = 'none' }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  return (
    <Document title={`Invoice ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <View style={s.rail} />
        <View style={s.body}>
          <CopyWatermark copy={copyLabel} />
          <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} forGoods={false} /></View>

          <View style={s.header}>
            <Text style={s.brand}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(' · ')}</Text>
            <Text style={s.brandLine}>GSTIN {seller.gstin} · {seller.em} · {seller.ph}</Text>
          </View>

          <View style={s.metaRow}>
            <View style={s.metaLeft}>
              <PartyBlock title="Billed to" party={invoice.billTo} />
            </View>
            <View style={s.metaRight}>
              <Text style={s.invHeading}>Invoice</Text>
              <Text style={s.invNo}>{invoice.docNo}</Text>
              <Text style={[s.metaLbl, { marginTop: 8 }]}>Issue date</Text>
              <Text style={{ fontSize: 10 }}>{invoice.docDt}</Text>
            </View>
          </View>

          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.thLbl, s.thDesc]}>Description</Text>
              <Text style={[s.thLbl, s.thSac]}>SAC</Text>
              <Text style={[s.thLbl, s.thAmt]}>Amount</Text>
            </View>
            {lines.map((line, i) => {
              const it = invoice.items[i]
              return (
                <View key={i} style={s.row}>
                  <View style={s.rDesc}>
                    <Text style={s.rTitle}>{it.prdDesc}</Text>
                    {it.description && <Text style={s.rSub}>{it.description}</Text>}
                  </View>
                  <Text style={s.rSac}>{line.hsnCd}</Text>
                  <Text style={s.rAmt}>{inr(line.assAmt)}</Text>
                </View>
              )
            })}
          </View>

          <View style={s.totals}>
            <View style={s.tLine}><Text style={s.tLineLbl}>Subtotal</Text><Text>{inr(sum.assVal)}</Text></View>
            {isIntra ? (
              <>
                <View style={s.tLine}><Text style={s.tLineLbl}>CGST</Text><Text>{inr(sum.cgstVal)}</Text></View>
                <View style={s.tLine}><Text style={s.tLineLbl}>SGST</Text><Text>{inr(sum.sgstVal)}</Text></View>
              </>
            ) : (
              <View style={s.tLine}><Text style={s.tLineLbl}>IGST</Text><Text>{inr(sum.igstVal)}</Text></View>
            )}
            <View style={s.tFinal}><Text>Amount due</Text><Text>{inr(sum.totInvVal)}</Text></View>
          </View>

          <Text style={s.words}>{amountInWords(sum.totInvVal)}</Text>

          <View style={s.payBlock}>
            <Text style={s.payTitle}>Payment</Text>
            <Text style={s.payLine}>UPI: {seller.em?.split('@')[0]}@axisbank</Text>
            <Text style={s.payLine}>Bank: HDFC Bank · A/C 50100123456789 · IFSC HDFC0001234</Text>
            <Text style={[s.payLine, { marginTop: 4, color: '#888' }]}>Due in 15 days. Thank you for the engagement.</Text>
          </View>

          <IrnQrBlock invoice={invoice} qrDataUrl={qrDataUrl} />

          <View style={s.footer}>
            <Text>{seller.lglNm} · PAN auto-derived</Text>
            <Text>Page 1 of 1</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
