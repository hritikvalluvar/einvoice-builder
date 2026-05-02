// Client wrapper around IRN generation.
// In dev, calls Vite middleware at /api/generate-irn (Sandbox creds stay in Node).
// In prod, calls the Supabase `generate-irn` edge function.
// Set VITE_SIMULATE_IRN=true in .env.local to short-circuit with a fake response
// (useful when no real GSTIN is registered with Sandbox/NIC yet).

import { supabase } from './supabase'

export type IrnData = {
  irn: string
  ackNo: string
  ackDt: string
  signedInvoice: string
  signedQr: string
  status: string
  ewbNo: string | null
  ewbDt: string | null
  ewbValidTill: string | null
}

export type GenerateIrnResult =
  | { ok: true; data: IrnData }
  | { ok: false; error: string }

// Build a structurally-valid fake IRN response for testing the PDF pipeline.
// The signedQr's payload follows NIC's actual QR schema, so the rendered QR
// would be parseable by NIC's QR-verifier app (signature is fake, but format is real).
function simulateIrn(nicJson: any): IrnData {
  const doc = nicJson?.DocDtls ?? {}
  const seller = nicJson?.SellerDtls ?? {}
  const buyer = nicJson?.BuyerDtls ?? {}
  const valDtls = nicJson?.ValDtls ?? {}
  const items = nicJson?.ItemList ?? []

  // 35-char hex (mimics NIC's IRN length/charset).
  const hex = (n: number) => Array.from({ length: n }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
  const irn = hex(35)

  // 15-digit AckNo, current timestamp.
  const ackNo = String(Date.now()).padStart(15, '0').slice(-15)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ackDt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  // QR payload = exactly what NIC signs into the QR JWT.
  const qrPayload = {
    SellerGstin: seller.Gstin ?? '',
    BuyerGstin: buyer.Gstin ?? '',
    DocNo: doc.No ?? '',
    DocTyp: doc.Typ ?? 'INV',
    DocDt: doc.Dt ?? '',
    TotInvVal: valDtls.TotInvVal ?? 0,
    ItemCnt: items.length,
    MainHsnCode: items[0]?.HsnCd ?? '',
    Irn: irn,
    IrnDt: ackDt,
  }
  // UTF-8-safe base64url. btoa alone throws on non-Latin1 chars (₹, Devanagari, etc.).
  const b64 = (obj: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  }
  const header = b64({ alg: 'RS256', typ: 'JWT' })
  const sig = b64({ note: 'simulated' })
  const signedQr = `${header}.${b64(qrPayload)}.${sig}`
  const signedInvoice = `${header}.${b64({ data: nicJson, Irn: irn })}.${sig}`

  return {
    irn,
    ackNo,
    ackDt,
    signedInvoice,
    signedQr,
    status: 'ACT',
    ewbNo: null,
    ewbDt: null,
    ewbValidTill: null,
  }
}

async function callDev(nicJson: unknown): Promise<GenerateIrnResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in required' }
  const r = await fetch('/api/generate-irn', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ nicJson }),
  })
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
  return j as GenerateIrnResult
}

async function callProd(nicJson: unknown): Promise<GenerateIrnResult> {
  const { data, error } = await supabase.functions.invoke('generate-irn', {
    body: { nicJson },
  })
  if (error) return { ok: false, error: error.message || 'Network error' }
  return data as GenerateIrnResult
}

export async function generateIrn(nicJson: unknown): Promise<GenerateIrnResult> {
  if (import.meta.env.VITE_SIMULATE_IRN === 'true') {
    await new Promise((r) => setTimeout(r, 600)) // mimic network latency
    return { ok: true, data: simulateIrn(nicJson) }
  }
  try {
    return import.meta.env.DEV ? await callDev(nicJson) : await callProd(nicJson)
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' }
  }
}
