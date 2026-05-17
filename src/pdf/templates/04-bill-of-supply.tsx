// Bill of Supply — for composition dealers and exempt supplies.
// No tax columns. Mandatory composition disclosure text. Header reads
// "Bill of Supply" (not "Tax Invoice"). Mirrors Modern Minimal otherwise.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { amountInWords } from '../../amountWords'
import { PartyBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt, inr } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const ACCENT = '#475569' // slate

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Roboto', color: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  brand: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  brandSub: { fontSize: 9, color: '#666', marginTop: 2 },
  docMeta: { textAlign: 'right' },
  docTitle: { fontSize: 11, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 'bold' },
  docNo: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  docDt: { fontSize: 9, color: '#666', marginTop: 2 },
  cornerLabel: { position: 'absolute', top: 32, right: 32 },

  banner: { backgroundColor: '#fef3c7', padding: 8, marginBottom: 18, fontSize: 9, color: '#78350f', borderLeftWidth: 3, borderLeftColor: '#d97706' },

  parties: { marginBottom: 22 },

  table: { marginTop: 4, marginBottom: 18 },
  th: { flexDirection: 'row', paddingVertical: 8, borderBottom: 1, borderColor: '#000', fontSize: 8, color: '#444', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottom: 1, borderColor: '#e5e7eb' },
  cNo: { width: 24 },
  cDesc: { flex: 3 },
  cHsn: { width: 60, textAlign: 'center' },
  cQty: { width: 50, textAlign: 'right' },
  cRate: { width: 70, textAlign: 'right' },
  cTotal: { width: 90, textAlign: 'right' },

  bottom: { flexDirection: 'row', marginTop: 18 },
  words: { flex: 1, paddingRight: 20 },
  wordsLbl: { fontSize: 7, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  wordsTxt: { fontSize: 10, fontWeight: 'bold' },

  totalsCard: { width: 200, padding: 12, backgroundColor: '#f8fafc' },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: 1, borderColor: '#000', fontWeight: 'bold', fontSize: 12 },

  disclosure: { marginTop: 26, padding: 8, border: 1, borderColor: '#000', fontSize: 8.5, fontStyle: 'italic', textAlign: 'center' },

  footer: { marginTop: 18, paddingTop: 12, borderTop: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#666' },
})

export function BillOfSupply({ seller, invoice, copyLabel = 'none' }: TemplateProps) {
  const subtotal = invoice.items.reduce((a, it) => a + it.qty * it.unitPrice, 0)

  return (
    <Document title={`Bill of Supply ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.header}>
          <View>
            <Text style={s.brand}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(' · ')}</Text>
            <Text style={s.brandSub}>GSTIN {seller.gstin}{seller.ph ? `  ·  ${seller.ph}` : ''}</Text>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>Bill of Supply</Text>
            <Text style={s.docNo}>{invoice.docNo}</Text>
            <Text style={s.docDt}>{invoice.docDt}</Text>
            <Text style={s.docDt}>Place of supply: {stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text>
          </View>
        </View>

        <View style={s.banner}>
          <Text>Composition Scheme — Tax is not collected on this supply. This is a Bill of Supply, not a Tax Invoice.</Text>
        </View>

        <View style={s.parties}>
          <PartyBlock title="Issued to" party={invoice.billTo} />
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={s.cNo}>#</Text>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cHsn}>HSN</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cRate}>Rate</Text>
            <Text style={s.cTotal}>Amount</Text>
          </View>
          {invoice.items.map((it, i) => (
            <View key={i} style={s.row}>
              <Text style={s.cNo}>{i + 1}</Text>
              <View style={s.cDesc}>
                <Text style={{ fontWeight: 'bold' }}>{it.prdDesc}</Text>
              </View>
              <Text style={s.cHsn}>{it.hsnCd}</Text>
              <Text style={s.cQty}>{it.qty} {it.unit}</Text>
              <Text style={s.cRate}>{fmt(it.unitPrice)}</Text>
              <Text style={s.cTotal}>{fmt(it.qty * it.unitPrice)}</Text>
            </View>
          ))}
        </View>

        <View style={s.bottom}>
          <View style={s.words}>
            <Text style={s.wordsLbl}>Amount in words</Text>
            <Text style={s.wordsTxt}>{amountInWords(subtotal)}</Text>
          </View>
          <View style={s.totalsCard}>
            <View style={s.tLine}><Text>Subtotal</Text><Text>{inr(subtotal)}</Text></View>
            <View style={s.tFinal}><Text>Total</Text><Text>{inr(subtotal)}</Text></View>
          </View>
        </View>

        <View style={s.disclosure}>
          <Text>Composition Taxable Person, not eligible to collect tax on supplies.</Text>
        </View>

        <View style={s.footer}>
          <Text>Subject to {seller.loc} jurisdiction</Text>
          <Text>For {seller.lglNm}</Text>
        </View>
      </Page>
    </Document>
  )
}
