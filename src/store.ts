import { create } from 'zustand'
import { supabase } from './supabase'
import type { Seller, Buyer, Product, Invoice, Company } from './types'

export type Member = {
  userId: string
  email: string
  role: string
  createdAt: string
}

type State = {
  userId: string | null
  userEmail: string | null
  companyId: string | null
  company: Company | null
  companies: Company[]
  ready: boolean
  loading: boolean
  seller: Seller
  buyers: Buyer[]
  products: Product[]
  invoices: Invoice[]

  setUserEmail: (email: string | null) => void
  bootstrap: (userId: string) => Promise<void>
  loadCompanyData: (companyId: string) => Promise<void>
  createCompany: (name: string) => Promise<{ ok: boolean; error?: string; companyId?: string }>
  joinCompany: (code: string) => Promise<{ ok: boolean; error?: string; companyId?: string }>
  listMembers: () => Promise<Member[]>
  removeMember: (userId: string) => Promise<{ ok: boolean; error?: string }>
  clear: () => void

  setSeller: (s: Seller) => Promise<void>
  upsertBuyer: (b: Buyer) => Promise<void>
  deleteBuyer: (id: string) => Promise<void>
  upsertProduct: (p: Product) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  upsertInvoice: (i: Invoice) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
}

const emptySeller: Seller = { gstin: '', lglNm: '', addr1: '', loc: '', pin: 0, stcd: '09' }

const LAST_COMPANY_KEY = 'einvoice:lastCompanyId'

const readLastCompanyId = (): string | null => {
  try { return localStorage.getItem(LAST_COMPANY_KEY) } catch { return null }
}

const writeLastCompanyId = (id: string) => {
  try { localStorage.setItem(LAST_COMPANY_KEY, id) } catch { /* ignore */ }
}

export const useStore = create<State>()((set, get) => ({
  userId: null,
  userEmail: null,
  companyId: null,
  company: null,
  companies: [],
  ready: false,
  loading: false,
  seller: emptySeller,
  buyers: [],
  products: [],
  invoices: [],

  setUserEmail: (email) => set({ userEmail: email }),

  bootstrap: async (userId) => {
    set({ loading: true, userId })

    const { data, error } = await supabase
      .from('memberships')
      .select('company_id, companies!inner(id, name, invite_code)')
      .eq('user_id', userId)

    if (error) {
      console.error('[memberships load]', error)
      set({ loading: false, ready: true })
      return
    }

    const companies: Company[] = (data ?? []).map((m: any) => ({
      id: m.companies.id,
      name: m.companies.name,
      inviteCode: m.companies.invite_code,
    }))

    set({ companies })

    if (companies.length === 0) {
      set({ loading: false, ready: true, companyId: null, company: null })
      return
    }

    const lastId = readLastCompanyId()
    const target = companies.find((c) => c.id === lastId) ?? companies[0]
    await get().loadCompanyData(target.id)
  },

  loadCompanyData: async (companyId) => {
    set({ loading: true, companyId })
    writeLastCompanyId(companyId)

    const co = get().companies.find((c) => c.id === companyId) ?? null

    const [sellerRes, buyersRes, productsRes, invoicesRes] = await Promise.all([
      supabase.from('sellers').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('buyers').select('*').eq('company_id', companyId).order('lgl_nm'),
      supabase.from('products').select('*').eq('company_id', companyId).order('prd_desc'),
      supabase.from('invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    ])
    if (sellerRes.error) console.error('[seller load]', sellerRes.error)
    if (buyersRes.error) console.error('[buyers load]', buyersRes.error)
    if (productsRes.error) console.error('[products load]', productsRes.error)
    if (invoicesRes.error) console.error('[invoices load]', invoicesRes.error)

    const seller: Seller = sellerRes.data ? dbToSeller(sellerRes.data) : emptySeller
    const buyers = (buyersRes.data ?? []).map(dbToBuyer)
    const products = (productsRes.data ?? []).map(dbToProduct)
    const invoices = (invoicesRes.data ?? []).map(dbToInvoice)

    set({
      company: co,
      seller,
      buyers,
      products,
      invoices,
      loading: false,
      ready: true,
    })
  },

  createCompany: async (name) => {
    const { data, error } = await supabase.rpc('create_company', { p_name: name.trim() })
    if (error) {
      console.error('[create_company]', error)
      return { ok: false, error: error.message }
    }
    const userId = get().userId
    if (!userId || !data) return { ok: false, error: 'Missing user or company' }
    writeLastCompanyId(data)
    await get().bootstrap(userId)
    return { ok: true, companyId: data }
  },

  joinCompany: async (code) => {
    const { data, error } = await supabase.rpc('join_company', { p_code: code.trim() })
    if (error) {
      console.error('[join_company]', error)
      return { ok: false, error: error.message }
    }
    const userId = get().userId
    if (!userId || !data) return { ok: false, error: 'Missing user or company' }
    writeLastCompanyId(data)
    await get().bootstrap(userId)
    return { ok: true, companyId: data }
  },

  listMembers: async () => {
    const companyId = get().companyId
    if (!companyId) return []
    const { data, error } = await supabase.rpc('list_members', { p_company_id: companyId })
    if (error) { console.error('[list_members]', error); return [] }
    return (data ?? []).map((m: any) => ({
      userId: m.user_id, email: m.email, role: m.role, createdAt: m.created_at,
    }))
  },

  removeMember: async (userId) => {
    const companyId = get().companyId
    if (!companyId) return { ok: false, error: 'No active company' }
    const { error } = await supabase.rpc('remove_member', { p_company_id: companyId, p_user_id: userId })
    if (error) { console.error('[remove_member]', error); return { ok: false, error: error.message } }
    return { ok: true }
  },

  clear: () => {
    try { localStorage.removeItem(LAST_COMPANY_KEY) } catch { /* ignore */ }
    set({
      userId: null,
      userEmail: null,
      companyId: null,
      company: null,
      companies: [],
      ready: false,
      loading: false,
      seller: emptySeller,
      buyers: [],
      products: [],
      invoices: [],
    })
  },

  setSeller: async (s) => {
    const companyId = get().companyId
    if (!companyId) return
    set({ seller: s })
    const { error } = await supabase.from('sellers').upsert({ ...sellerToDb(s), company_id: companyId })
    if (error) console.error('[seller upsert]', error)
  },

  upsertBuyer: async (b) => {
    const companyId = get().companyId
    if (!companyId) return
    const { buyers } = get()
    const idx = buyers.findIndex((x) => x.id === b.id)
    const next = [...buyers]
    if (idx >= 0) next[idx] = b; else next.unshift(b)
    set({ buyers: next })
    const { error } = await supabase.from('buyers').upsert({ ...buyerToDb(b), company_id: companyId, id: b.id })
    if (error) console.error('[buyer upsert]', error)
  },

  deleteBuyer: async (id) => {
    set({ buyers: get().buyers.filter((b) => b.id !== id) })
    const { error } = await supabase.from('buyers').delete().eq('id', id)
    if (error) console.error('[buyer delete]', error)
  },

  upsertProduct: async (p) => {
    const companyId = get().companyId
    if (!companyId) return
    const { products } = get()
    const idx = products.findIndex((x) => x.id === p.id)
    const next = [...products]
    if (idx >= 0) next[idx] = p; else next.unshift(p)
    set({ products: next })
    const { error } = await supabase.from('products').upsert({ ...productToDb(p), company_id: companyId, id: p.id })
    if (error) console.error('[product upsert]', error)
  },

  deleteProduct: async (id) => {
    set({ products: get().products.filter((p) => p.id !== id) })
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) console.error('[product delete]', error)
  },

  upsertInvoice: async (i) => {
    const companyId = get().companyId
    if (!companyId) return
    const { invoices } = get()
    const idx = invoices.findIndex((x) => x.id === i.id)
    const next = [...invoices]
    if (idx >= 0) next[idx] = i; else next.unshift(i)
    set({ invoices: next })
    const { error } = await supabase.from('invoices').upsert({ ...invoiceToDb(i), company_id: companyId, id: i.id })
    if (error) console.error('[invoice upsert]', error)
  },

  deleteInvoice: async (id) => {
    set({ invoices: get().invoices.filter((i) => i.id !== id) })
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) console.error('[invoice delete]', error)
  },
}))

export const newId = () => crypto.randomUUID()

// ============ DB <-> LOCAL MAPPERS ============

function sellerToDb(s: Seller) {
  return {
    gstin: s.gstin,
    lgl_nm: s.lglNm,
    addr1: s.addr1,
    addr2: s.addr2 ?? null,
    loc: s.loc,
    pin: s.pin,
    stcd: s.stcd,
    ph: s.ph ?? null,
    em: s.em ?? null,
  }
}

function dbToSeller(r: any): Seller {
  return {
    gstin: r.gstin ?? '',
    lglNm: r.lgl_nm ?? '',
    addr1: r.addr1 ?? '',
    addr2: r.addr2 ?? undefined,
    loc: r.loc ?? '',
    pin: r.pin ?? 0,
    stcd: r.stcd ?? '09',
    ph: r.ph ?? undefined,
    em: r.em ?? undefined,
  }
}

function buyerToDb(b: Buyer) {
  return {
    gstin: b.gstin,
    lgl_nm: b.lglNm,
    addr1: b.addr1,
    addr2: b.addr2 ?? null,
    loc: b.loc,
    pin: b.pin,
    pos: b.pos,
    stcd: b.stcd,
    ph: b.ph ?? null,
    em: b.em ?? null,
  }
}

function dbToBuyer(r: any): Buyer {
  return {
    id: r.id,
    gstin: r.gstin,
    lglNm: r.lgl_nm,
    addr1: r.addr1,
    addr2: r.addr2 ?? undefined,
    loc: r.loc,
    pin: r.pin,
    pos: r.pos,
    stcd: r.stcd,
    ph: r.ph ?? undefined,
    em: r.em ?? undefined,
  }
}

function productToDb(p: Product) {
  return {
    prd_desc: p.prdDesc,
    description: p.description ?? null,
    hsn_cd: p.hsnCd,
    unit: p.unit,
    default_price: p.defaultPrice,
    gst_rt: p.gstRt,
  }
}

function dbToProduct(r: any): Product {
  return {
    id: r.id,
    prdDesc: r.prd_desc,
    description: r.description ?? undefined,
    hsnCd: r.hsn_cd,
    unit: r.unit,
    defaultPrice: Number(r.default_price),
    gstRt: Number(r.gst_rt),
  }
}

function invoiceToDb(i: Invoice) {
  return {
    doc_no: i.docNo,
    doc_dt: i.docDt,
    buyer_id: i.buyerId || null,
    bill_to: i.billTo,
    items: i.items,
    ship_to: i.shipTo ?? null,
    ewb: i.ewb ?? null,
    force_total: i.forceTotal ?? null,
    notes: i.notes ?? null,
  }
}

function dbToInvoice(r: any): Invoice {
  return {
    id: r.id,
    docNo: r.doc_no,
    docDt: r.doc_dt,
    buyerId: r.buyer_id ?? undefined,
    billTo: r.bill_to ?? emptyBillTo(),
    items: r.items ?? [],
    shipTo: r.ship_to ?? undefined,
    ewb: r.ewb ?? undefined,
    forceTotal: r.force_total != null ? Number(r.force_total) : undefined,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    notes: r.notes ?? undefined,
  }
}

function emptyBillTo() {
  return { gstin: '', lglNm: '', addr1: '', loc: '', pin: 0, pos: '09', stcd: '09' }
}
