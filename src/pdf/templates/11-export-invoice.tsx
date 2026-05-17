// Export Invoice — landscape, dual currency, LUT clause, IEC code, shipping bill block.
// Target: exporters, freelancers with foreign clients.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { amountInWords } from '../../amountWords'
import { PartyBlock, CopyCornerLabel, CopyWatermark } from '../shared/blocks'
import { fmt, panFromGstin } from '../shared/format'

const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
import type { TemplateProps } from '../shared/types'

const FX = 84.62 // INR per USD (mock)

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 9, fontFamily: 'Roboto', color: '#111' },
  outer: { border: 1, borderColor: '#000' },
  banner: { backgroundColor: '#0c4a6e', color: '#fff', padding: 6, textAlign: 'center', fontSize: 11, fontWeight: 'bold', letterSpacing: 2 },
  cornerLabel: { position: 'absolute', top: 22, right: 22 },

  sellerBlock: { padding: 8, borderBottom: 1, borderColor: '#000' },
  brandName: { fontSize: 14, fontWeight: 'bold' },
  brandSub: { fontSize: 8.5, color: '#444' },
  iecLine: { fontSize: 8, marginTop: 2 },

  meta: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  metaCell: { flex: 1, padding: 5, borderRight: 1, borderColor: '#000' },
  metaCellLast: { flex: 1, padding: 5 },
  metaLbl: { fontSize: 7, color: '#555' },
  metaVal: { fontWeight: 'bold' },

  parties: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  party: { flex: 1, padding: 6 },
  partyDiv: { borderLeft: 1, borderColor: '#000' },

  shipBlock: { padding: 6, borderBottom: 1, borderColor: '#000', flexDirection: 'row', gap: 24 },
  shipCol: { flex: 1, fontSize: 8 },
  shipLbl: { color: '#666', fontSize: 7 },

  th: { flexDirection: 'row', backgroundColor: '#e5e7eb', fontWeight: 'bold', paddingVertical: 4, fontSize: 8 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottom: 1, borderColor: '#e5e7eb', fontSize: 8.5 },
  bordR: { borderRight: 1, borderColor: '#cbd5e1', paddingHorizontal: 4 },
  cNo: { width: 22, textAlign: 'center' },
  cDesc: { flex: 2 },
  cHsn: { width: 60, textAlign: 'center' },
  cQty: { width: 50, textAlign: 'right' },
  cRateInr: { width: 60, textAlign: 'right' },
  cRateUsd: { width: 60, textAlign: 'right' },
  cAmtInr: { width: 80, textAlign: 'right' },
  cAmtUsd: { width: 80, textAlign: 'right', paddingRight: 4 },

  totRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', fontWeight: 'bold', paddingVertical: 4, borderTop: 1, borderColor: '#000' },

  bottom: { flexDirection: 'row', borderTop: 1, borderColor: '#000' },
  bLeft: { flex: 1, padding: 6, borderRight: 1, borderColor: '#000', fontSize: 8 },
  bRight: { width: 220, padding: 6, fontSize: 8 },

  lutBox: { padding: 6, border: 1, borderColor: '#b91c1c', backgroundColor: '#fef2f2', marginTop: 6, fontSize: 7.5 },
  lutTitle: { fontWeight: 'bold', color: '#b91c1c' },

  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: 1, borderColor: '#000', fontWeight: 'bold', fontSize: 10 },
})

export function ExportInvoice({ seller, invoice, copyLabel = 'none' }: TemplateProps) {
  const items = invoice.items
  const enriched = items.map((it) => {
    const inrTotal = +(it.qty * it.unitPrice).toFixed(2)
    const usdRate = +(it.unitPrice / FX).toFixed(2)
    const usdTotal = +(it.qty * usdRate).toFixed(2)
    return { ...it, inrTotal, usdRate, usdTotal }
  })
  const sumInr = enriched.reduce((a, l) => a + l.inrTotal, 0)
  const sumUsd = enriched.reduce((a, l) => a + l.usdTotal, 0)

  return (
    <Document title={`Export Invoice ${invoice.docNo}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.outer}>
          <Text style={s.banner}>EXPORT INVOICE — UNDER LUT, ZERO RATED</Text>

          <View style={s.sellerBlock}>
            <Text style={s.brandName}>{seller.lglNm}</Text>
            <Text style={s.brandSub}>{[seller.addr1, seller.addr2, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(', ')}</Text>
            <Text style={s.brandSub}>GSTIN: {seller.gstin}  ·  PAN: {panFromGstin(seller.gstin)}</Text>
            <Text style={s.iecLine}>IEC: 0304078912 (Sample)  ·  Authorised Dealer Code: 0023901  ·  LUT ARN: AD330425000123Q (FY 2025-26)</Text>
          </View>

          <View style={s.meta}>
            <View style={s.metaCell}><Text style={s.metaLbl}>Invoice No.</Text><Text style={s.metaVal}>{invoice.docNo}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Invoice Date</Text><Text style={s.metaVal}>{invoice.docDt}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Currency</Text><Text style={s.metaVal}>USD (₹{FX}/USD)</Text></View>
            <View style={s.metaCellLast}><Text style={s.metaLbl}>Place of Supply</Text><Text style={s.metaVal}>Other Country (96)</Text></View>
          </View>

          <View style={s.parties}>
            <View style={s.party}><PartyBlock title="Exporter" party={seller} showGstin={false} /></View>
            <View style={[s.party, s.partyDiv]}><PartyBlock title="Consignee / Buyer" party={invoice.billTo} showGstin={false} /></View>
          </View>

          <View style={s.shipBlock}>
            <View style={s.shipCol}>
              <Text style={s.shipLbl}>Shipping Bill No. / Date</Text>
              <Text>SB-7821456 / 16/05/2026</Text>
            </View>
            <View style={s.shipCol}>
              <Text style={s.shipLbl}>Port of Loading</Text>
              <Text>INMAA1 — Chennai Port</Text>
            </View>
            <View style={s.shipCol}>
              <Text style={s.shipLbl}>Port of Discharge / Country</Text>
              <Text>FRMRS — Marseille, France</Text>
            </View>
            <View style={s.shipCol}>
              <Text style={s.shipLbl}>Incoterms</Text>
              <Text>FOB Chennai</Text>
            </View>
            <View style={s.shipCol}>
              <Text style={s.shipLbl}>Terms of Payment</Text>
              <Text>30% advance, 70% against BL</Text>
            </View>
          </View>

          <View style={s.th}>
            <Text style={[s.bordR, s.cNo]}>#</Text>
            <Text style={[s.bordR, s.cDesc]}>Description</Text>
            <Text style={[s.bordR, s.cHsn]}>HSN (8d)</Text>
            <Text style={[s.bordR, s.cQty]}>Qty</Text>
            <Text style={[s.bordR, s.cRateInr]}>Rate (INR)</Text>
            <Text style={[s.bordR, s.cRateUsd]}>Rate (USD)</Text>
            <Text style={[s.bordR, s.cAmtInr]}>Amount (INR)</Text>
            <Text style={s.cAmtUsd}>Amount (USD)</Text>
          </View>
          {enriched.map((it, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.bordR, s.cNo]}>{i + 1}</Text>
              <Text style={[s.bordR, s.cDesc, { fontWeight: 'bold' }]}>{it.prdDesc}</Text>
              <Text style={[s.bordR, s.cHsn]}>{it.hsnCd}</Text>
              <Text style={[s.bordR, s.cQty]}>{it.qty} {it.unit}</Text>
              <Text style={[s.bordR, s.cRateInr]}>{fmt(it.unitPrice)}</Text>
              <Text style={[s.bordR, s.cRateUsd]}>{fmtUsd(it.usdRate)}</Text>
              <Text style={[s.bordR, s.cAmtInr]}>{fmt(it.inrTotal)}</Text>
              <Text style={s.cAmtUsd}>{fmtUsd(it.usdTotal)}</Text>
            </View>
          ))}
          <View style={s.totRow}>
            <Text style={[s.bordR, s.cNo]}></Text>
            <Text style={[s.bordR, s.cDesc]}>Total</Text>
            <Text style={[s.bordR, s.cHsn]}></Text>
            <Text style={[s.bordR, s.cQty]}>{enriched.reduce((a, l) => a + l.qty, 0)}</Text>
            <Text style={[s.bordR, s.cRateInr]}></Text>
            <Text style={[s.bordR, s.cRateUsd]}></Text>
            <Text style={[s.bordR, s.cAmtInr]}>{fmt(sumInr)}</Text>
            <Text style={s.cAmtUsd}>{fmtUsd(sumUsd)}</Text>
          </View>

          <View style={s.bottom}>
            <View style={s.bLeft}>
              <Text style={{ fontSize: 7.5, color: '#555' }}>Amount in words (INR)</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 9, marginTop: 2 }}>{amountInWords(Math.round(sumInr))}</Text>
              <View style={s.lutBox}>
                <Text style={s.lutTitle}>LEGAL DECLARATION</Text>
                <Text style={{ marginTop: 2 }}>
                  SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX.
                </Text>
              </View>
            </View>
            <View style={s.bRight}>
              <View style={s.tLine}><Text>Subtotal (INR)</Text><Text>₹ {fmt(sumInr)}</Text></View>
              <View style={s.tLine}><Text>Subtotal (USD)</Text><Text>$ {fmtUsd(sumUsd)}</Text></View>
              <View style={s.tLine}><Text>IGST (zero-rated)</Text><Text>0.00</Text></View>
              <View style={s.tFinal}><Text>Total (USD)</Text><Text>$ {fmtUsd(sumUsd)}</Text></View>
              <Text style={{ fontSize: 7, color: '#666', marginTop: 6 }}>Country of Origin: India</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
