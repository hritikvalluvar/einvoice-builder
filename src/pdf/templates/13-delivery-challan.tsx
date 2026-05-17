// Delivery Challan — goods movement without sale (job work, branch transfer,
// sale-on-approval). NO tax block, NO total payable. Vehicle/transport
// prominent, "Purpose of Movement" field, multi-copy ready.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { PartyBlock, EwbBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt, panFromGstin } from '../shared/format'
import type { TemplateProps } from '../shared/types'

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: 'Roboto', color: '#000' },
  outer: { border: 1, borderColor: '#000' },
  title: { backgroundColor: '#f59e0b', color: '#1f2937', textAlign: 'center', padding: 5, fontSize: 12, fontWeight: 'bold', letterSpacing: 3 },
  cornerLabel: { position: 'absolute', top: 24, right: 24 },

  sellerBlock: { padding: 6, borderBottom: 1, borderColor: '#000' },
  brandName: { fontSize: 12, fontWeight: 'bold' },

  meta: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  metaCell: { flex: 1, padding: 5, borderRight: 1, borderColor: '#000' },
  metaCellLast: { flex: 1, padding: 5 },
  metaLbl: { fontSize: 7, color: '#555' },
  metaVal: { fontWeight: 'bold' },

  purpose: { padding: 6, backgroundColor: '#fef3c7', borderBottom: 1, borderColor: '#000' },
  purposeTitle: { fontSize: 8, color: '#92400e', fontWeight: 'bold', marginBottom: 2 },

  parties: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  party: { flex: 1, padding: 6 },
  partyDiv: { borderLeft: 1, borderColor: '#000' },

  th: { flexDirection: 'row', backgroundColor: '#e5e7eb', fontWeight: 'bold', paddingVertical: 3 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottom: 1, borderColor: '#e5e7eb' },
  bordR: { borderRight: 1, borderColor: '#cbd5e1', paddingHorizontal: 4 },
  cNo: { width: 22, textAlign: 'center' },
  cDesc: { flex: 3 },
  cHsn: { width: 60, textAlign: 'center' },
  cQty: { width: 50, textAlign: 'right' },
  cUnit: { width: 40, textAlign: 'center' },
  cValue: { width: 80, textAlign: 'right', paddingRight: 4 },

  notesBlock: { padding: 6, borderTop: 1, borderColor: '#000', fontSize: 8 },
  notesTitle: { fontSize: 7.5, color: '#555', marginBottom: 2 },

  sigGrid: { flexDirection: 'row', borderTop: 1, borderColor: '#000', minHeight: 60 },
  sigBox: { flex: 1, padding: 6, borderRight: 1, borderColor: '#000' },
  sigBoxLast: { flex: 1, padding: 6 },
  sigLbl: { fontSize: 7, marginBottom: 32, color: '#555' },
})

export function DeliveryChallan({ seller, invoice, copyLabel = 'none' }: TemplateProps) {
  // For delivery challans, item value is for reference (insurance/EWB), NOT for sale.
  return (
    <Document title={`Delivery Challan ${invoice.docNo}`}>
      <Page size="A4" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} /></View>

        <View style={s.outer}>
          <Text style={s.title}>DELIVERY CHALLAN</Text>

          <View style={s.sellerBlock}>
            <Text style={s.brandName}>{seller.lglNm}</Text>
            <Text>{[seller.addr1, seller.addr2, seller.loc, `PIN ${seller.pin}`].filter(Boolean).join(', ')}</Text>
            <Text>GSTIN: {seller.gstin} · PAN: {panFromGstin(seller.gstin)} · State: {stcdName(seller.stcd)} ({seller.stcd})</Text>
          </View>

          <View style={s.meta}>
            <View style={s.metaCell}><Text style={s.metaLbl}>Challan No.</Text><Text style={s.metaVal}>{invoice.docNo}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Date</Text><Text style={s.metaVal}>{invoice.docDt}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLbl}>Place of Supply</Text><Text style={s.metaVal}>{stcdName(invoice.billTo.pos)}</Text></View>
            <View style={s.metaCellLast}><Text style={s.metaLbl}>Rule</Text><Text style={s.metaVal}>Rule 55 CGST</Text></View>
          </View>

          <View style={s.purpose}>
            <Text style={s.purposeTitle}>PURPOSE OF MOVEMENT</Text>
            <Text>{invoice.notes ?? 'Goods sent for processing — to be returned within 180 days.'}</Text>
          </View>

          <View style={s.parties}>
            <View style={s.party}><PartyBlock title="Consigner (From)" party={seller} /></View>
            <View style={[s.party, s.partyDiv]}><PartyBlock title="Consignee (To)" party={invoice.billTo} /></View>
          </View>

          <View style={s.th}>
            <Text style={[s.bordR, s.cNo]}>#</Text>
            <Text style={[s.bordR, s.cDesc]}>Description of Goods</Text>
            <Text style={[s.bordR, s.cHsn]}>HSN</Text>
            <Text style={[s.bordR, s.cQty]}>Quantity</Text>
            <Text style={[s.bordR, s.cUnit]}>Unit</Text>
            <Text style={s.cValue}>Value (Ref.)</Text>
          </View>
          {invoice.items.map((it, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.bordR, s.cNo]}>{i + 1}</Text>
              <Text style={[s.bordR, s.cDesc, { fontWeight: 'bold' }]}>{it.prdDesc}</Text>
              <Text style={[s.bordR, s.cHsn]}>{it.hsnCd}</Text>
              <Text style={[s.bordR, s.cQty]}>{it.qty}</Text>
              <Text style={[s.bordR, s.cUnit]}>{it.unit}</Text>
              <Text style={s.cValue}>{it.unitPrice > 0 ? fmt(it.qty * it.unitPrice) : '—'}</Text>
            </View>
          ))}

          <View style={s.notesBlock}>
            <Text style={s.notesTitle}>Important</Text>
            <Text>• This is NOT a tax invoice. No GST is being collected against this challan.</Text>
            <Text>• Goods are moving for {invoice.notes?.toLowerCase().includes('job work') ? 'job work' : 'the purpose stated above'} and remain the property of the consigner until returned.</Text>
            <Text>• To be returned within 180 days (capital goods: 3 years) per Section 143 CGST.</Text>
          </View>

          <EwbBlock invoice={invoice} />

          <View style={s.sigGrid}>
            <View style={s.sigBox}>
              <Text style={s.sigLbl}>Received in good condition</Text>
              <Text>Sign / Date</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLbl}>Driver / Transporter</Text>
              <Text>Sign / Date</Text>
            </View>
            <View style={s.sigBoxLast}>
              <Text style={[s.sigLbl, { textAlign: 'right' }]}>For {seller.lglNm}</Text>
              <Text style={{ textAlign: 'right' }}>Authorised Signatory</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
