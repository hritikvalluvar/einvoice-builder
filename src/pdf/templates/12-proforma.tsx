// Proforma Invoice — pre-sale quote / advance payment request.
// Same shape as Modern Minimal but header reads PROFORMA INVOICE,
// includes a validity field, no GST claim implied. NEVER carries IRN.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { computeLines, summarize } from '../../einvoice'
import { amountInWords } from '../../amountWords'
import { PartyBlock, stcdName } from '../shared/blocks'
import { fmt, inr } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const ACCENT = '#92400e' // amber-800 — distinct from tax invoice templates

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9.5, fontFamily: 'Roboto', color: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  brandSub: { fontSize: 9, color: '#666', marginTop: 2 },
  docMeta: { textAlign: 'right' },
  docTitle: { fontSize: 13, color: ACCENT, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 'bold' },
  docNo: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  docDt: { fontSize: 9, color: '#666', marginTop: 2 },

  banner: { backgroundColor: '#fef3c7', padding: 8, marginBottom: 18, fontSize: 9, color: ACCENT, borderLeftWidth: 3, borderLeftColor: ACCENT },

  parties: { flexDirection: 'row', gap: 24, marginBottom: 22 },
  partyCol: { flex: 1 },

  table: { marginTop: 4 },
  th: { flexDirection: 'row', paddingVertical: 8, borderBottom: 1, borderColor: ACCENT, fontSize: 8, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottom: 1, borderColor: '#e5e7eb' },
  cNo: { width: 22 },
  cDesc: { flex: 3 },
  cHsn: { width: 50, textAlign: 'center' },
  cQty: { width: 40, textAlign: 'right' },
  cRate: { width: 60, textAlign: 'right' },
  cTax: { width: 50, textAlign: 'right' },
  cGst: { width: 40, textAlign: 'right' },
  cTotal: { width: 70, textAlign: 'right' },

  bottom: { flexDirection: 'row', marginTop: 24 },
  words: { flex: 1, paddingRight: 20 },
  wordsLbl: { fontSize: 7, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  totalsCard: { width: 200, padding: 14, backgroundColor: '#fffbeb', borderLeftWidth: 3, borderLeftColor: ACCENT },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, fontSize: 9 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: 1, borderColor: ACCENT, fontWeight: 'bold', fontSize: 12, color: ACCENT },

  terms: { marginTop: 22, padding: 12, border: 1, borderColor: '#e5e7eb', borderRadius: 4 },
  termsTitle: { fontSize: 9, fontWeight: 'bold', color: ACCENT, marginBottom: 4 },
  termLine: { fontSize: 8.5, marginBottom: 2 },

  footer: { marginTop: 18, paddingTop: 12, borderTop: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#666' },
})

export function Proforma({ seller, invoice }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  return (
    <Document title={`Proforma ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(' · ')}</Text>
            <Text style={s.brandSub}>GSTIN {seller.gstin} · {seller.em}</Text>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>Proforma Invoice</Text>
            <Text style={s.docNo}>{invoice.docNo}</Text>
            <Text style={s.docDt}>Issued: {invoice.docDt}</Text>
            <Text style={s.docDt}>Valid until: 30 days from issue</Text>
            <Text style={s.docDt}>Place of supply: {stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text>
          </View>
        </View>

        <View style={s.banner}>
          <Text>This is a proforma invoice — not a tax invoice. Indicative figures for buyer's confirmation / advance payment. A tax invoice will be issued at the time of supply.</Text>
        </View>

        <View style={s.parties}>
          <View style={s.partyCol}><PartyBlock title="Quoted to" party={invoice.billTo} /></View>
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={s.cNo}>#</Text>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cHsn}>HSN</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cRate}>Rate</Text>
            <Text style={s.cTax}>Taxable</Text>
            <Text style={s.cGst}>GST%</Text>
            <Text style={s.cTotal}>Estimated</Text>
          </View>
          {lines.map((line, i) => {
            const it = invoice.items[i]
            return (
              <View key={i} style={s.row}>
                <Text style={s.cNo}>{line.slNo}</Text>
                <View style={s.cDesc}>
                  <Text style={{ fontWeight: 'bold' }}>{it.prdDesc}</Text>
                </View>
                <Text style={s.cHsn}>{line.hsnCd}</Text>
                <Text style={s.cQty}>{line.qty} {line.unit}</Text>
                <Text style={s.cRate}>{fmt(line.unitPrice)}</Text>
                <Text style={s.cTax}>{fmt(line.assAmt)}</Text>
                <Text style={s.cGst}>{line.gstRt}%</Text>
                <Text style={s.cTotal}>{fmt(line.totItemVal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={s.bottom}>
          <View style={s.words}>
            <Text style={s.wordsLbl}>Estimated total (in words)</Text>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{amountInWords(sum.totInvVal)}</Text>
          </View>
          <View style={s.totalsCard}>
            <View style={s.tLine}><Text>Taxable</Text><Text>{inr(sum.assVal)}</Text></View>
            {isIntra ? (
              <>
                <View style={s.tLine}><Text>CGST</Text><Text>{inr(sum.cgstVal)}</Text></View>
                <View style={s.tLine}><Text>SGST</Text><Text>{inr(sum.sgstVal)}</Text></View>
              </>
            ) : (
              <View style={s.tLine}><Text>IGST</Text><Text>{inr(sum.igstVal)}</Text></View>
            )}
            <View style={s.tFinal}><Text>Estimated</Text><Text>{inr(sum.totInvVal)}</Text></View>
          </View>
        </View>

        <View style={s.terms}>
          <Text style={s.termsTitle}>Terms & Conditions</Text>
          <Text style={s.termLine}>• Quote valid for 30 days from the date of issue.</Text>
          <Text style={s.termLine}>• Advance payment: 30% on order confirmation, 70% before dispatch.</Text>
          <Text style={s.termLine}>• Tax invoice will be issued at the time of supply per current GST rates.</Text>
          <Text style={s.termLine}>• Subject to {seller.loc} jurisdiction.</Text>
        </View>

        <View style={s.footer}>
          <Text>Proforma — not for ITC claim</Text>
          <Text>For {seller.lglNm}</Text>
        </View>
      </Page>
    </Document>
  )
}
