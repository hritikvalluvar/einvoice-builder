// Modern Minimal — spacious sans-serif, single accent color, totals card.
// Target: D2C, agencies, default for businesses that want to look polished.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { computeLines, summarize } from '../../einvoice'
import { amountInWords } from '../../amountWords'
import { PartyBlock, IrnQrBlock, EwbBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt, inr } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const ACCENT = '#0f766e' // dark teal

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9.5, fontFamily: 'Roboto', color: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  brand: { fontSize: 22, fontWeight: 'bold', color: ACCENT, letterSpacing: -0.5 },
  brandSub: { fontSize: 9, color: '#666', marginTop: 2 },
  docMeta: { textAlign: 'right' },
  docTitle: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2 },
  docNo: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  docDt: { fontSize: 9, color: '#666', marginTop: 2 },
  cornerLabel: { position: 'absolute', top: 32, right: 32 },

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
  desc: { fontWeight: 'bold' },

  bottom: { flexDirection: 'row', marginTop: 24 },
  words: { flex: 1, paddingRight: 20 },
  wordsLbl: { fontSize: 7, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  wordsTxt: { fontSize: 10, fontWeight: 'bold' },

  totalsCard: { width: 200, padding: 14, backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: ACCENT },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, fontSize: 9 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: 1, borderColor: ACCENT, fontWeight: 'bold', fontSize: 12, color: ACCENT },

  footer: { marginTop: 24, paddingTop: 12, borderTop: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#666' },
})

export function ModernMinimal({ seller, invoice, qrDataUrl, copyLabel = 'none' }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  return (
    <Document title={`Invoice ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.header}>
          <View>
            <Text style={s.brand}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(' · ')}</Text>
            <Text style={s.brandSub}>GSTIN {seller.gstin} · {seller.em}</Text>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>{invoice.irn ? 'E-Invoice' : 'Tax Invoice'}</Text>
            <Text style={s.docNo}>{invoice.docNo}</Text>
            <Text style={s.docDt}>{invoice.docDt}</Text>
            <Text style={s.docDt}>Place of supply: {stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text>
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.partyCol}><PartyBlock title="Billed to" party={invoice.billTo} /></View>
          {invoice.shipTo && <View style={s.partyCol}><PartyBlock title="Shipped to" party={invoice.shipTo} /></View>}
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
            <Text style={s.cTotal}>Total</Text>
          </View>
          {lines.map((line, i) => {
            const it = invoice.items[i]
            return (
              <View key={i} style={s.row}>
                <Text style={s.cNo}>{line.slNo}</Text>
                <View style={s.cDesc}>
                  <Text style={s.desc}>{it.prdDesc}</Text>
                  {it.description && <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>{it.description}</Text>}
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
            <Text style={s.wordsLbl}>Amount chargeable (in words)</Text>
            <Text style={s.wordsTxt}>{amountInWords(sum.totInvVal)}</Text>
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
            {sum.rndOffAmt !== 0 && <View style={s.tLine}><Text>Round off</Text><Text>{inr(sum.rndOffAmt)}</Text></View>}
            <View style={s.tFinal}><Text>Total</Text><Text>{inr(sum.totInvVal)}</Text></View>
          </View>
        </View>

        <EwbBlock invoice={invoice} />
        <IrnQrBlock invoice={invoice} qrDataUrl={qrDataUrl} />

        <View style={s.footer}>
          <Text>Subject to {seller.loc} jurisdiction</Text>
          <Text>For {seller.lglNm}</Text>
        </View>
      </Page>
    </Document>
  )
}
