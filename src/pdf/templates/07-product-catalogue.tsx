// Product Catalogue — per-line image thumbnails, brand color band header.
// Target: D2C, furniture, jewellery showcase, e-commerce.
// Prototype uses placeholder image boxes (no real images).

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { computeLines, summarize } from '../../einvoice'
import { amountInWords } from '../../amountWords'
import { PartyBlock, IrnQrBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { inr } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const ACCENT = '#7c3aed' // violet
const SOFT = '#faf5ff'

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 9.5, fontFamily: 'Roboto', color: '#111' },
  band: { backgroundColor: ACCENT, padding: 18, paddingHorizontal: 32, color: '#fff' },
  brand: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  brandSub: { fontSize: 9, color: '#e9d5ff', marginTop: 2 },

  body: { padding: 28 },
  cornerLabel: { position: 'absolute', top: 32, right: 28 },

  metaCard: { backgroundColor: SOFT, padding: 14, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { },
  metaLbl: { fontSize: 7, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: 1 },
  metaVal: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },

  parties: { flexDirection: 'row', gap: 20, marginBottom: 22 },
  partyCol: { flex: 1 },

  itemCard: { flexDirection: 'row', padding: 12, marginBottom: 10, borderRadius: 6, backgroundColor: SOFT, alignItems: 'center', gap: 14 },
  thumb: { width: 50, height: 50, borderRadius: 4, backgroundColor: '#ddd6fe', justifyContent: 'center', alignItems: 'center' },
  thumbTxt: { fontSize: 7, color: '#6b21a8' },
  itemBody: { flex: 1 },
  itemTitle: { fontWeight: 'bold', fontSize: 11 },
  itemMeta: { fontSize: 8, color: '#6b21a8', marginTop: 2 },
  itemRight: { textAlign: 'right' },
  itemQty: { fontSize: 8, color: '#666' },
  itemAmt: { fontSize: 12, fontWeight: 'bold', marginTop: 2 },

  totals: { marginTop: 14, padding: 14, borderRadius: 6, borderWidth: 2, borderColor: ACCENT },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: 1, borderColor: ACCENT, fontWeight: 'bold', fontSize: 14, color: ACCENT },

  words: { marginTop: 12, fontSize: 8.5, color: '#555' },

  footer: { marginTop: 22, paddingTop: 12, borderTop: 1, borderColor: '#e5e7eb', textAlign: 'center', fontSize: 8, color: '#888' },
})

export function ProductCatalogue({ seller, invoice, qrDataUrl, copyLabel = 'none' }: TemplateProps) {
  const isIntra = seller.stcd === invoice.billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  return (
    <Document title={`Order ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.band}>
          <Text style={s.brand}>{seller.lglNm}</Text>
          <Text style={s.brandSub}>{seller.addr1} · {seller.loc} · GSTIN {seller.gstin}</Text>
        </View>

        <View style={s.body}>
          <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

          <View style={s.metaCard}>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>{invoice.irn ? 'E-Invoice' : 'Tax Invoice'}</Text>
              <Text style={s.metaVal}>{invoice.docNo}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Date</Text>
              <Text style={s.metaVal}>{invoice.docDt}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Place of Supply</Text>
              <Text style={s.metaVal}>{stcdName(invoice.billTo.pos)}</Text>
            </View>
          </View>

          <View style={s.parties}>
            <View style={s.partyCol}><PartyBlock title="Billed to" party={invoice.billTo} /></View>
            {invoice.shipTo && <View style={s.partyCol}><PartyBlock title="Shipped to" party={invoice.shipTo} /></View>}
          </View>

          {lines.map((line, i) => {
            const it = invoice.items[i]
            return (
              <View key={i} style={s.itemCard}>
                <View style={s.thumb}>
                  <Text style={s.thumbTxt}>IMAGE</Text>
                </View>
                <View style={s.itemBody}>
                  <Text style={s.itemTitle}>{it.prdDesc}</Text>
                  <Text style={s.itemMeta}>HSN {line.hsnCd} · GST {line.gstRt}% · {line.qty} {line.unit} × {inr(line.unitPrice)}</Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={s.itemQty}>qty {line.qty}</Text>
                  <Text style={s.itemAmt}>{inr(line.totItemVal)}</Text>
                </View>
              </View>
            )
          })}

          <View style={s.totals}>
            <View style={s.tLine}><Text>Subtotal</Text><Text>{inr(sum.assVal)}</Text></View>
            {isIntra ? (
              <>
                <View style={s.tLine}><Text>CGST</Text><Text>{inr(sum.cgstVal)}</Text></View>
                <View style={s.tLine}><Text>SGST</Text><Text>{inr(sum.sgstVal)}</Text></View>
              </>
            ) : (
              <View style={s.tLine}><Text>IGST</Text><Text>{inr(sum.igstVal)}</Text></View>
            )}
            <View style={s.tFinal}><Text>Grand Total</Text><Text>{inr(sum.totInvVal)}</Text></View>
          </View>

          <Text style={s.words}>{amountInWords(sum.totInvVal)}</Text>

          <IrnQrBlock invoice={invoice} qrDataUrl={qrDataUrl} />

          <Text style={s.footer}>Thank you for shopping with {seller.lglNm}</Text>
        </View>
      </Page>
    </Document>
  )
}
