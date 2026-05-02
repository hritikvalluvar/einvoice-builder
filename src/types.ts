export type Company = {
  id: string
  name: string
  inviteCode: string
}

export type Seller = {
  gstin: string
  lglNm: string
  addr1: string
  addr2?: string
  loc: string
  pin: number
  stcd: string
  ph?: string
  em?: string
}

export type Buyer = {
  id: string
  gstin: string
  lglNm: string
  addr1: string
  addr2?: string
  loc: string
  pin: number
  pos: string
  stcd: string
  ph?: string
  em?: string
}

export type Product = {
  id: string
  prdDesc: string
  description?: string
  hsnCd: string
  unit: string
  defaultPrice: number
  gstRt: number
}

export type ShipAddress = {
  gstin: string // "URP" for unregistered
  lglNm: string
  addr1: string
  addr2?: string
  loc: string
  pin: number
  stcd: string
}

export type InvoiceItem = {
  productId?: string
  prdDesc: string
  description?: string
  hsnCd: string
  unit: string
  gstRt: number
  qty: number
  unitPrice: number
  discount?: number
}

export type BillTo = {
  gstin: string
  lglNm: string
  addr1: string
  addr2?: string
  loc: string
  pin: number
  pos: string
  stcd: string
  ph?: string
  em?: string
}

export type EwbDtls = {
  transId?: string
  transName?: string
  transMode: string   // "1" Road, "2" Rail, "3" Air, "4" Ship
  distance: number    // mandatory, km
  transDocNo?: string
  transDocDt?: string // DD/MM/YYYY, defaults to invoice date
  vehNo: string
  vehType: string     // "R" Regular, "O" Over-dimensional cargo
}

export type Invoice = {
  id: string
  docNo: string
  docDt: string
  buyerId?: string
  billTo: BillTo
  items: InvoiceItem[]
  shipTo?: ShipAddress
  ewb?: EwbDtls
  forceTotal?: number
  createdAt: number
  notes?: string
  // NIC e-invoice fields, populated after successful IRN generation
  irn?: string
  ackNo?: string
  ackDt?: string
  signedQr?: string
  signedInvoice?: string
  irnCancelledAt?: string
}
