// Construction RA Bill — landscape BOQ table with cumulative columns.
// Tracks contract qty, cumulative-to-date, previous bill, this bill, retention.
// Target: contractors, civil / infra.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { amountInWords } from '../../amountWords'
import { PartyBlock, CopyCornerLabel, CopyWatermark, stcdName } from '../shared/blocks'
import { fmt, inr } from '../shared/format'
import type { TemplateProps } from '../shared/types'

type RAItem = {
  boqRef: string
  prdDesc: string
  hsnCd: string
  unit: string
  rate: number
  contractQty: number
  cumulativeQty: number
  previousQty: number
  thisBillQty: number
}

const s = StyleSheet.create({
  page: { padding: 18, fontSize: 8, fontFamily: 'Roboto', color: '#000' },
  outer: { border: 1, borderColor: '#000' },
  title: { textAlign: 'center', backgroundColor: '#1f2937', color: '#fff', padding: 5, fontSize: 11, fontWeight: 'bold', letterSpacing: 3 },
  cornerLabel: { position: 'absolute', top: 18, right: 18 },

  contractBlock: { padding: 6, borderBottom: 1, borderColor: '#000' },
  contractTitle: { fontSize: 9.5, fontWeight: 'bold' },
  contractMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, fontSize: 8 },

  parties: { flexDirection: 'row', borderBottom: 1, borderColor: '#000' },
  party: { flex: 1, padding: 6 },
  partyDiv: { borderLeft: 1, borderColor: '#000' },

  th: { flexDirection: 'row', backgroundColor: '#e5e7eb', fontWeight: 'bold', paddingVertical: 3, fontSize: 7 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottom: 1, borderColor: '#e5e7eb', fontSize: 7.5 },
  bordR: { borderRight: 1, borderColor: '#cbd5e1', paddingHorizontal: 2 },
  cBoq: { width: 36 },
  cDesc: { flex: 2 },
  cHsn: { width: 38, textAlign: 'center' },
  cUnit: { width: 28, textAlign: 'center' },
  cRate: { width: 42, textAlign: 'right' },
  cContract: { width: 50, textAlign: 'right' },
  cPrev: { width: 50, textAlign: 'right' },
  cThis: { width: 50, textAlign: 'right' },
  cCum: { width: 50, textAlign: 'right' },
  cThisAmt: { width: 60, textAlign: 'right' },
  cCumAmt: { width: 65, textAlign: 'right', paddingRight: 2 },

  bottom: { flexDirection: 'row', borderTop: 1, borderColor: '#000' },
  bLeft: { flex: 1, padding: 6, borderRight: 1, borderColor: '#000', fontSize: 8 },
  bRight: { width: 240, padding: 6, fontSize: 8 },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tFinal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: 1, borderColor: '#000', fontWeight: 'bold', fontSize: 10 },

  approval: { flexDirection: 'row', borderTop: 1, borderColor: '#000', minHeight: 50 },
  approvalBox: { flex: 1, padding: 5, borderRight: 1, borderColor: '#000', alignItems: 'center' },
  approvalBoxLast: { flex: 1, padding: 5, alignItems: 'center' },
  approvalLbl: { fontSize: 7, color: '#555', marginBottom: 24 },
})

export function ConstructionRABill({ seller, invoice, copyLabel = 'none', extras }: TemplateProps) {
  const items = (extras?.items as RAItem[]) ?? []
  const contractName = (extras?.contractName as string) ?? ''
  const contractValue = (extras?.contractValue as number) ?? 0
  const raBillNo = (extras?.raBillNo as number) ?? 1
  const previousBillTotal = (extras?.previousBillTotal as number) ?? 0
  const retentionPct = (extras?.retentionPct as number) ?? 5

  const isIntra = seller.stcd === invoice.billTo.pos
  const gstRt = 18 // services

  const enriched = items.map((it) => {
    const thisBillAmt = +(it.thisBillQty * it.rate).toFixed(2)
    const cumulativeAmt = +(it.cumulativeQty * it.rate).toFixed(2)
    return { ...it, thisBillAmt, cumulativeAmt }
  })

  const thisBillSum = enriched.reduce((a, l) => a + l.thisBillAmt, 0)
  const cumulativeSum = enriched.reduce((a, l) => a + l.cumulativeAmt, 0)
  const gst = +(thisBillSum * gstRt / 100).toFixed(2)
  const cgst = isIntra ? +(gst / 2).toFixed(2) : 0
  const sgst = isIntra ? +(gst / 2).toFixed(2) : 0
  const igst = isIntra ? 0 : gst
  const gross = thisBillSum + gst
  const retention = +(thisBillSum * retentionPct / 100).toFixed(2)
  const net = gross - retention

  return (
    <Document title={`RA Bill ${invoice.docNo}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <CopyWatermark copy={copyLabel} />
        <View style={s.cornerLabel}><CopyCornerLabel copy={copyLabel} forGoods={false} /></View>

        <View style={s.outer}>
          <Text style={s.title}>RUNNING ACCOUNT (RA) BILL — TAX INVOICE</Text>

          <View style={s.contractBlock}>
            <Text style={s.contractTitle}>{contractName}</Text>
            <View style={s.contractMeta}>
              <Text>Bill No.: {invoice.docNo}  ·  RA Bill #{raBillNo}  ·  Date: {invoice.docDt}</Text>
              <Text>Contract Value: {inr(contractValue)}  ·  Previous bill total: {inr(previousBillTotal)}</Text>
              <Text>POS: {stcdName(invoice.billTo.pos)} ({invoice.billTo.pos})</Text>
            </View>
          </View>

          <View style={s.parties}>
            <View style={s.party}><PartyBlock title="Contractor (Supplier)" party={seller} /></View>
            <View style={[s.party, s.partyDiv]}><PartyBlock title="Client (Bill to)" party={invoice.billTo} /></View>
          </View>

          <View style={s.th}>
            <Text style={[s.bordR, s.cBoq]}>BOQ Ref</Text>
            <Text style={[s.bordR, s.cDesc]}>Item of work</Text>
            <Text style={[s.bordR, s.cHsn]}>SAC</Text>
            <Text style={[s.bordR, s.cUnit]}>Unit</Text>
            <Text style={[s.bordR, s.cRate]}>Rate</Text>
            <Text style={[s.bordR, s.cContract]}>Contract Qty</Text>
            <Text style={[s.bordR, s.cPrev]}>Prev Qty</Text>
            <Text style={[s.bordR, s.cThis]}>This Bill Qty</Text>
            <Text style={[s.bordR, s.cCum]}>Cum. Qty</Text>
            <Text style={[s.bordR, s.cThisAmt]}>This Bill Amt</Text>
            <Text style={s.cCumAmt}>Cum. Amt</Text>
          </View>
          {enriched.map((it, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.bordR, s.cBoq]}>{it.boqRef}</Text>
              <Text style={[s.bordR, s.cDesc, { fontWeight: 'bold' }]}>{it.prdDesc}</Text>
              <Text style={[s.bordR, s.cHsn]}>{it.hsnCd}</Text>
              <Text style={[s.bordR, s.cUnit]}>{it.unit}</Text>
              <Text style={[s.bordR, s.cRate]}>{fmt(it.rate)}</Text>
              <Text style={[s.bordR, s.cContract]}>{it.contractQty}</Text>
              <Text style={[s.bordR, s.cPrev]}>{it.previousQty}</Text>
              <Text style={[s.bordR, s.cThis]}>{it.thisBillQty}</Text>
              <Text style={[s.bordR, s.cCum]}>{it.cumulativeQty}</Text>
              <Text style={[s.bordR, s.cThisAmt]}>{fmt(it.thisBillAmt)}</Text>
              <Text style={s.cCumAmt}>{fmt(it.cumulativeAmt)}</Text>
            </View>
          ))}

          <View style={s.bottom}>
            <View style={s.bLeft}>
              <Text style={{ fontSize: 7.5, color: '#555' }}>This bill (in words)</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 9, marginTop: 2 }}>{amountInWords(Math.round(net))}</Text>
              <Text style={{ fontSize: 7.5, color: '#555', marginTop: 8 }}>
                Cumulative work done to date: {inr(cumulativeSum)} ({((cumulativeSum / contractValue) * 100).toFixed(1)}% of contract value)
              </Text>
              <Text style={{ fontSize: 7, color: '#b91c1c', marginTop: 4 }}>
                Retention @ {retentionPct}% withheld; released after defect liability period as per contract.
              </Text>
            </View>
            <View style={s.bRight}>
              <View style={s.tLine}><Text>This bill (services)</Text><Text>{fmt(thisBillSum)}</Text></View>
              {isIntra ? (
                <>
                  <View style={s.tLine}><Text>CGST @ 9%</Text><Text>{fmt(cgst)}</Text></View>
                  <View style={s.tLine}><Text>SGST @ 9%</Text><Text>{fmt(sgst)}</Text></View>
                </>
              ) : (
                <View style={s.tLine}><Text>IGST @ 18%</Text><Text>{fmt(igst)}</Text></View>
              )}
              <View style={s.tLine}><Text>Gross payable</Text><Text>{fmt(gross)}</Text></View>
              <View style={s.tLine}><Text>Less: Retention @ {retentionPct}%</Text><Text>({fmt(retention)})</Text></View>
              <View style={s.tFinal}><Text>Net Payable</Text><Text>₹ {fmt(net)}</Text></View>
            </View>
          </View>

          <View style={s.approval}>
            <View style={s.approvalBox}>
              <Text style={s.approvalLbl}>Measured & verified by Site Engineer</Text>
              <Text style={{ fontSize: 7 }}>Sign / Date</Text>
            </View>
            <View style={s.approvalBox}>
              <Text style={s.approvalLbl}>Certified by Project Manager</Text>
              <Text style={{ fontSize: 7 }}>Sign / Date</Text>
            </View>
            <View style={s.approvalBox}>
              <Text style={s.approvalLbl}>Approved by Client Engineer</Text>
              <Text style={{ fontSize: 7 }}>Sign / Date</Text>
            </View>
            <View style={s.approvalBoxLast}>
              <Text style={s.approvalLbl}>For {seller.lglNm}</Text>
              <Text style={{ fontSize: 7 }}>Authorised Signatory</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
