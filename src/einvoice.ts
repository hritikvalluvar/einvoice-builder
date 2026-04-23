import type { Seller, Buyer, Invoice, InvoiceItem, ShipAddress, BillTo } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

type ComputedLine = {
  slNo: string
  prdDesc: string
  isServc: 'N'
  hsnCd: string
  qty: number
  freeQty: number
  unit: string
  unitPrice: number
  totAmt: number
  discount: number
  preTaxVal: number
  assAmt: number
  gstRt: number
  igstAmt: number
  cgstAmt: number
  sgstAmt: number
  cesRt: 0
  cesAmt: 0
  cesNonAdvlAmt: 0
  stateCesRt: 0
  stateCesAmt: 0
  stateCesNonAdvlAmt: 0
  othChrg: 0
  totItemVal: number
}

export function computeLines(items: InvoiceItem[], isIntra: boolean): ComputedLine[] {
  return items.map((it, idx) => {
    const discount = it.discount ?? 0
    const totAmt = round2(it.qty * it.unitPrice)
    const assAmt = round2(totAmt - discount)
    const gstVal = round2((assAmt * it.gstRt) / 100)
    const cgst = isIntra ? round2(gstVal / 2) : 0
    const sgst = isIntra ? round2(gstVal / 2) : 0
    const igst = isIntra ? 0 : gstVal
    const prdDesc = it.description?.trim()
      ? `${it.prdDesc} - ${it.description.trim()}`
      : it.prdDesc
    return {
      slNo: String(idx + 1),
      prdDesc,
      isServc: 'N',
      hsnCd: it.hsnCd,
      qty: it.qty,
      freeQty: 0,
      unit: it.unit,
      unitPrice: it.unitPrice,
      totAmt,
      discount,
      preTaxVal: 0,
      assAmt,
      gstRt: it.gstRt,
      igstAmt: igst,
      cgstAmt: cgst,
      sgstAmt: sgst,
      cesRt: 0,
      cesAmt: 0,
      cesNonAdvlAmt: 0,
      stateCesRt: 0,
      stateCesAmt: 0,
      stateCesNonAdvlAmt: 0,
      othChrg: 0,
      totItemVal: round2(assAmt + cgst + sgst + igst),
    }
  })
}

type InvoiceSummary = {
  assVal: number
  cgstVal: number
  sgstVal: number
  igstVal: number
  rawTotal: number
  rndOffAmt: number
  totInvVal: number
}

export function summarize(lines: ComputedLine[], forceTotal?: number): InvoiceSummary {
  const assVal = round2(lines.reduce((s, l) => s + l.assAmt, 0))
  const cgstVal = round2(lines.reduce((s, l) => s + l.cgstAmt, 0))
  const sgstVal = round2(lines.reduce((s, l) => s + l.sgstAmt, 0))
  const igstVal = round2(lines.reduce((s, l) => s + l.igstAmt, 0))
  const rawTotal = round2(assVal + cgstVal + sgstVal + igstVal)
  const totInvVal = forceTotal != null ? round2(forceTotal) : rawTotal
  const rndOffAmt = round2(totInvVal - rawTotal)
  return { assVal, cgstVal, sgstVal, igstVal, rawTotal, rndOffAmt, totInvVal }
}

export function toNicJson(seller: Seller, invoice: Invoice) {
  const billTo = invoice.billTo
  const isIntra = seller.stcd === billTo.pos
  const lines = computeLines(invoice.items, isIntra)
  const sum = summarize(lines, invoice.forceTotal)

  const json: Record<string, unknown> = {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      IgstOnIntra: 'N',
      RegRev: 'N',
      EcmGstin: null,
    },
    DocDtls: {
      Typ: 'INV',
      No: invoice.docNo,
      Dt: invoice.docDt,
    },
    SellerDtls: {
      Gstin: seller.gstin,
      LglNm: seller.lglNm,
      Addr1: seller.addr1,
      Addr2: seller.addr2 ?? null,
      Loc: seller.loc,
      Pin: seller.pin,
      Stcd: seller.stcd,
      Ph: seller.ph ?? null,
      Em: seller.em ?? null,
    },
    BuyerDtls: {
      Gstin: billTo.gstin,
      LglNm: billTo.lglNm,
      Addr1: billTo.addr1,
      Addr2: billTo.addr2 ?? null,
      Loc: billTo.loc,
      Pin: billTo.pin,
      Pos: billTo.pos,
      Stcd: billTo.stcd,
      Ph: billTo.ph ?? null,
      Em: billTo.em ?? null,
    },
  }

  if (invoice.shipTo) {
    json.ShipDtls = {
      Gstin: invoice.shipTo.gstin,
      LglNm: invoice.shipTo.lglNm,
      Addr1: invoice.shipTo.addr1,
      Addr2: invoice.shipTo.addr2 ?? null,
      Loc: invoice.shipTo.loc,
      Pin: invoice.shipTo.pin,
      Stcd: invoice.shipTo.stcd,
    }
  }

  json.ValDtls = {
    AssVal: sum.assVal,
    IgstVal: sum.igstVal,
    CgstVal: sum.cgstVal,
    SgstVal: sum.sgstVal,
    CesVal: 0,
    StCesVal: 0,
    Discount: 0,
    OthChrg: 0,
    RndOffAmt: sum.rndOffAmt,
    TotInvVal: sum.totInvVal,
  }

  if (invoice.ewb) {
    json.EwbDtls = {
      TransId: invoice.ewb.transId || null,
      TransName: invoice.ewb.transName || null,
      TransMode: invoice.ewb.transMode,
      Distance: invoice.ewb.distance,
      TransDocNo: invoice.ewb.transDocNo || null,
      TransDocDt: invoice.ewb.transDocDt || invoice.docDt,
      VehNo: invoice.ewb.vehNo || null,
      VehType: invoice.ewb.vehType,
    }
  }

  json.RefDtls = { InvRm: 'NICGEPP2.0' }
  json.ItemList = lines.map(toNicItem)

  return json
}

function toNicItem(line: ComputedLine) {
  return {
    SlNo: line.slNo,
    PrdDesc: line.prdDesc,
    IsServc: line.isServc,
    HsnCd: line.hsnCd,
    Qty: line.qty,
    FreeQty: line.freeQty,
    Unit: line.unit,
    UnitPrice: line.unitPrice,
    TotAmt: line.totAmt,
    Discount: line.discount,
    PreTaxVal: line.preTaxVal,
    AssAmt: line.assAmt,
    GstRt: line.gstRt,
    IgstAmt: line.igstAmt,
    CgstAmt: line.cgstAmt,
    SgstAmt: line.sgstAmt,
    CesRt: line.cesRt,
    CesAmt: line.cesAmt,
    CesNonAdvlAmt: line.cesNonAdvlAmt,
    StateCesRt: line.stateCesRt,
    StateCesAmt: line.stateCesAmt,
    StateCesNonAdvlAmt: line.stateCesNonAdvlAmt,
    OthChrg: line.othChrg,
    TotItemVal: line.totItemVal,
  }
}

export function toDateInput(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m}-${d}`
}

export function fromDateInput(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}/${m}/${y}`
}

export function shipFromBillTo(b: BillTo): ShipAddress {
  return {
    gstin: b.gstin,
    lglNm: b.lglNm,
    addr1: b.addr1,
    addr2: b.addr2,
    loc: b.loc,
    pin: b.pin,
    stcd: b.stcd,
  }
}

export function billFromBuyer(b: Buyer): BillTo {
  return {
    gstin: b.gstin,
    lglNm: b.lglNm,
    addr1: b.addr1,
    addr2: b.addr2,
    loc: b.loc,
    pin: b.pin,
    pos: b.pos,
    stcd: b.stcd,
    ph: b.ph,
    em: b.em,
  }
}
