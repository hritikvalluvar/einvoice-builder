// Reusable PDF blocks shared across templates.

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Seller, Invoice, BillTo, ShipAddress } from '../../types'
import { stcdName } from '../../validators'
import { fmt, panFromGstin } from './format'
import type { MultiCopyMode } from './types'

export type HsnRow = {
  hsnCd: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

const s = StyleSheet.create({
  partyName: { fontWeight: 'bold', fontSize: 10, marginBottom: 2 },
  partyLine: { fontSize: 9, marginBottom: 1 },
  label: { color: '#666', fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },

  watermark: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 60,
    color: 'rgba(0,0,0,0.06)',
    fontWeight: 'bold',
    transform: 'rotate(-20deg)',
    letterSpacing: 4,
  },
  copyLabel: {
    fontSize: 7,
    padding: 3,
    border: 1,
    borderColor: '#000',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  irnBlock: { marginTop: 10, padding: 8, borderTop: 1, borderBottom: 1, borderColor: '#000', flexDirection: 'row', gap: 10 },
  irnMeta: { flex: 1, fontSize: 8 },
  irnTitle: { fontWeight: 'bold', fontSize: 10, marginBottom: 4 },
  irnLabel: { color: '#666', fontSize: 8 },
  qrImg: { width: 70, height: 70 },

  ewbBlock: { marginTop: 10, padding: 6, borderTop: 1, borderColor: '#000' },
  ewbTitle: { fontWeight: 'bold', fontSize: 9, marginBottom: 2 },

  hsnHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: 8, paddingVertical: 3 },
  hsnRow: { flexDirection: 'row', paddingVertical: 3, borderTop: 1, borderColor: '#e5e7eb' },
  hsnFoot: { flexDirection: 'row', paddingVertical: 3, borderTop: 1, borderColor: '#000', fontWeight: 'bold' },
  hsnHsnCol: { width: 70, paddingHorizontal: 3 },
  hsnNumCol: { flex: 1, paddingHorizontal: 3, textAlign: 'right' },
})

// ------ Party blocks ------

export function PartyBlock({
  title,
  party,
  showGstin = true,
}: {
  title: string
  party: BillTo | ShipAddress | Seller
  showGstin?: boolean
}) {
  const lglNm = (party as Seller).lglNm
  const gstin = (party as Seller).gstin
  const addr = [party.addr1, party.addr2, party.loc, party.pin && `PIN ${party.pin}`]
    .filter(Boolean)
    .join(', ')
  return (
    <View>
      <Text style={s.label}>{title}</Text>
      <Text style={s.partyName}>{lglNm}</Text>
      <Text style={s.partyLine}>{addr}</Text>
      {showGstin && gstin && gstin !== 'URP' && (
        <Text style={s.partyLine}>GSTIN: {gstin}</Text>
      )}
      {showGstin && gstin && gstin !== 'URP' && (
        <Text style={s.partyLine}>PAN: {panFromGstin(gstin)}</Text>
      )}
      {gstin === 'URP' && <Text style={s.partyLine}>Unregistered</Text>}
    </View>
  )
}

// ------ Multi-copy overlays ------

export function CopyWatermark({ copy }: { copy: MultiCopyMode }) {
  if (!copy || copy === 'none') return null
  return <Text style={s.watermark}>{copy.toUpperCase()}</Text>
}

export function CopyCornerLabel({ copy, forGoods = true }: { copy: MultiCopyMode; forGoods?: boolean }) {
  if (!copy || copy === 'none') return null
  const label =
    copy === 'original'
      ? 'ORIGINAL FOR RECIPIENT'
      : copy === 'duplicate'
      ? forGoods
        ? 'DUPLICATE FOR TRANSPORTER'
        : 'DUPLICATE FOR SUPPLIER'
      : 'TRIPLICATE FOR SUPPLIER'
  return <Text style={s.copyLabel}>{label}</Text>
}

// ------ IRN + QR ------

export function IrnQrBlock({ invoice, qrDataUrl }: { invoice: Invoice; qrDataUrl?: string | null }) {
  if (!invoice.irn) return null
  return (
    <View style={s.irnBlock}>
      <View style={s.irnMeta}>
        <Text style={s.irnTitle}>E-Invoice (NIC)</Text>
        <Text style={s.irnLabel}>IRN</Text>
        <Text style={{ fontSize: 7, fontFamily: 'RobotoMono' }}>{invoice.irn}</Text>
        <Text style={[s.irnLabel, { marginTop: 4 }]}>Ack No</Text>
        <Text>{invoice.ackNo}</Text>
        <Text style={[s.irnLabel, { marginTop: 4 }]}>Ack Date</Text>
        <Text>{invoice.ackDt}</Text>
      </View>
      {qrDataUrl && <Image src={qrDataUrl} style={s.qrImg} />}
    </View>
  )
}

// ------ E-Way Bill ------

export function EwbBlock({ invoice }: { invoice: Invoice }) {
  if (!invoice.ewb || !invoice.ewb.vehNo) return null
  const e = invoice.ewb
  return (
    <View style={s.ewbBlock}>
      <Text style={s.ewbTitle}>E-Way Bill Details</Text>
      <Text style={{ fontSize: 8 }}>
        Vehicle: {e.vehNo} · Mode: {e.transMode} · Distance: {e.distance} km
        {e.transName ? ` · Transporter: ${e.transName}` : ''}
      </Text>
    </View>
  )
}

// ------ HSN-wise summary ------

export function HsnSummary({ rows }: { rows: HsnRow[] }) {
  const total = rows.reduce(
    (a, r) => ({
      taxable: a.taxable + r.taxable,
      cgst: a.cgst + r.cgst,
      sgst: a.sgst + r.sgst,
      igst: a.igst + r.igst,
      total: a.total + r.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[s.label, { marginBottom: 3 }]}>HSN-wise tax summary</Text>
      <View style={{ borderTop: 1, borderBottom: 1, borderColor: '#000' }}>
        <View style={s.hsnHeader}>
          <Text style={s.hsnHsnCol}>HSN</Text>
          <Text style={s.hsnNumCol}>Taxable</Text>
          <Text style={s.hsnNumCol}>CGST</Text>
          <Text style={s.hsnNumCol}>SGST</Text>
          <Text style={s.hsnNumCol}>IGST</Text>
          <Text style={s.hsnNumCol}>Total</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={s.hsnRow}>
            <Text style={s.hsnHsnCol}>{r.hsnCd}</Text>
            <Text style={s.hsnNumCol}>{fmt(r.taxable)}</Text>
            <Text style={s.hsnNumCol}>{fmt(r.cgst)}</Text>
            <Text style={s.hsnNumCol}>{fmt(r.sgst)}</Text>
            <Text style={s.hsnNumCol}>{fmt(r.igst)}</Text>
            <Text style={s.hsnNumCol}>{fmt(r.total)}</Text>
          </View>
        ))}
        <View style={s.hsnFoot}>
          <Text style={s.hsnHsnCol}>Total</Text>
          <Text style={s.hsnNumCol}>{fmt(total.taxable)}</Text>
          <Text style={s.hsnNumCol}>{fmt(total.cgst)}</Text>
          <Text style={s.hsnNumCol}>{fmt(total.sgst)}</Text>
          <Text style={s.hsnNumCol}>{fmt(total.igst)}</Text>
          <Text style={s.hsnNumCol}>{fmt(total.total)}</Text>
        </View>
      </View>
    </View>
  )
}

export { stcdName }
