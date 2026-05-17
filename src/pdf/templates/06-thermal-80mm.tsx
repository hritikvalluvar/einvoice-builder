// Thermal 80mm — receipt-strip layout for restaurants, kirana, cafes, salons.
// Width fixed at ~80mm (227pt). Monospace numerals, ALL-CAPS items, dashed dividers.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { computeLines, summarize } from '../../einvoice'
import { fmt } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const W = 227 // ~80mm at 72dpi

const s = StyleSheet.create({
  page: { padding: 8, paddingBottom: 24, fontSize: 8, fontFamily: 'RobotoMono', color: '#000' },
  center: { textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  brand: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  sub: { fontSize: 7, textAlign: 'center' },
  div: { borderTop: 1, borderColor: '#000', borderStyle: 'dashed', marginVertical: 4 },
  divSolid: { borderTop: 1, borderColor: '#000', marginVertical: 4 },

  row: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 8 },
  itemLine: { fontSize: 8, textTransform: 'uppercase' },
  itemDetail: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#333' },

  totalLine: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, fontWeight: 'bold' },
})

export function Thermal80mm({ seller, invoice }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  return (
    <Document title={`Receipt ${invoice.docNo}`}>
      <Page size={{ width: W, height: 700 }} style={s.page}>
        <Text style={s.brand}>{seller.lglNm}</Text>
        <Text style={s.sub}>{seller.addr1}</Text>
        <Text style={s.sub}>{seller.loc} - {seller.pin}</Text>
        {seller.ph && <Text style={s.sub}>Ph {seller.ph}</Text>}
        <Text style={s.sub}>GSTIN {seller.gstin}</Text>

        <View style={s.div} />

        <View style={s.row}>
          <Text>Bill #{invoice.docNo}</Text>
          <Text>{invoice.docDt}</Text>
        </View>
        {invoice.billTo.gstin !== 'URP' && (
          <Text style={{ fontSize: 7 }}>Buyer GSTIN: {invoice.billTo.gstin}</Text>
        )}

        <View style={s.div} />

        {lines.map((line, i) => {
          const it = invoice.items[i]
          const gst = line.igstAmt + line.cgstAmt + line.sgstAmt
          return (
            <View key={i} style={{ marginBottom: 2 }}>
              <Text style={s.itemLine}>{it.prdDesc}</Text>
              <View style={s.itemDetail}>
                <Text>{line.qty} {line.unit} x {fmt(line.unitPrice)}</Text>
                <Text>{fmt(line.totItemVal)}</Text>
              </View>
              <Text style={{ fontSize: 6.5, color: '#666' }}>HSN {line.hsnCd} · GST {line.gstRt}% ({fmt(gst)})</Text>
            </View>
          )
        })}

        <View style={s.divSolid} />

        <View style={s.row}><Text>Taxable</Text><Text>{fmt(sum.assVal)}</Text></View>
        {isIntra ? (
          <>
            <View style={s.row}><Text>CGST</Text><Text>{fmt(sum.cgstVal)}</Text></View>
            <View style={s.row}><Text>SGST</Text><Text>{fmt(sum.sgstVal)}</Text></View>
          </>
        ) : (
          <View style={s.row}><Text>IGST</Text><Text>{fmt(sum.igstVal)}</Text></View>
        )}
        {sum.rndOffAmt !== 0 && <View style={s.row}><Text>Round Off</Text><Text>{fmt(sum.rndOffAmt)}</Text></View>}

        <View style={s.divSolid} />

        <View style={s.totalLine}><Text>TOTAL</Text><Text>₹ {fmt(sum.totInvVal)}</Text></View>

        <View style={s.div} />

        <Text style={s.center}>Thank You · Visit Again</Text>
        <Text style={[s.center, { fontSize: 6, marginTop: 6, color: '#666' }]}>
          {invoice.irn ? `IRN ${invoice.irn.slice(0, 16)}…` : ''}
        </Text>
      </Page>
    </Document>
  )
}
