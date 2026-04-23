// Edge function: look up a GSTIN via a configurable provider and return a normalized
// shape the BillTo form can consume. Auth-gated (any signed-in user), results cached
// in `gstin_cache` for 30 days to avoid repeated upstream calls.
//
// Provider selection: GSTIN_PROVIDER env var picks one of the entries in the PROVIDERS
// registry below. Adding a new provider = write a `Provider` object and register it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000

// Shared GST state name → code map (used by every provider's normalizer).
const STATE_CODE: Record<string, string> = {
  'JAMMU & KASHMIR': '01', 'HIMACHAL PRADESH': '02', 'PUNJAB': '03',
  'CHANDIGARH': '04', 'UTTARAKHAND': '05', 'HARYANA': '06', 'DELHI': '07',
  'RAJASTHAN': '08', 'UTTAR PRADESH': '09', 'BIHAR': '10', 'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12', 'NAGALAND': '13', 'MANIPUR': '14', 'MIZORAM': '15',
  'TRIPURA': '16', 'MEGHALAYA': '17', 'ASSAM': '18', 'WEST BENGAL': '19',
  'JHARKHAND': '20', 'ODISHA': '21', 'CHHATTISGARH': '22', 'MADHYA PRADESH': '23',
  'GUJARAT': '24', 'DADRA & NAGAR HAVELI AND DAMAN & DIU': '26', 'MAHARASHTRA': '27',
  'KARNATAKA': '29', 'GOA': '30', 'LAKSHADWEEP': '31', 'KERALA': '32',
  'TAMIL NADU': '33', 'PUDUCHERRY': '34', 'ANDAMAN & NICOBAR': '35',
  'TELANGANA': '36', 'ANDHRA PRADESH': '37', 'LADAKH': '38',
}

// Common shape returned to the client regardless of upstream provider.
type GstinData = {
  gstin: string
  lglNm: string
  tradeNam: string | null
  addr1: string
  addr2: string | null
  loc: string
  pin: number
  stcd: string
  pos: string
  status: string | null
}

type ProviderResult = { ok: true; data: GstinData } | { ok: false; error: string }

type Provider = {
  name: string
  configured: () => boolean
  missingEnvHint: string
  fetch: (gstin: string) => Promise<ProviderResult>
}

// ============ PROVIDERS ============

const swipe: Provider = {
  name: 'swipe',
  missingEnvHint: 'Set SWIPE_AUTH_TOKEN',
  configured: () => !!Deno.env.get('SWIPE_AUTH_TOKEN'),
  async fetch(gstin) {
    const base = Deno.env.get('SWIPE_API_BASE') || 'https://app.getswipe.in/api/partner'
    const token = Deno.env.get('SWIPE_AUTH_TOKEN')!
    const r = await fetch(`${base}/v2/utils/gstin/${encodeURIComponent(gstin)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.success || !j?.data) {
      return { ok: false, error: j?.message || `Lookup failed (HTTP ${r.status})` }
    }
    const d = j.data
    const billing = d.billing ?? {}
    const stateName = String(billing.state ?? '').toUpperCase().trim()
    const stcd = STATE_CODE[stateName] ?? gstin.slice(0, 2)
    return {
      ok: true,
      data: {
        gstin,
        lglNm: d.legal_name || d.company_name || d.trade_name || '',
        tradeNam: d.trade_name ?? null,
        addr1: billing.address_1 ?? '',
        addr2: billing.address_2 || null,
        loc: billing.city ?? '',
        pin: Number(billing.pincode) || 0,
        stcd,
        pos: stcd,
        status: d.status ?? null,
      },
    }
  },
}

const sandbox: Provider = {
  name: 'sandbox',
  missingEnvHint: 'Set SANDBOX_API_KEY and SANDBOX_API_SECRET',
  configured: () => !!Deno.env.get('SANDBOX_API_KEY') && !!Deno.env.get('SANDBOX_API_SECRET'),
  async fetch(gstin) {
    const base = Deno.env.get('SANDBOX_API_BASE') || 'https://api.sandbox.co.in'
    const authR = await fetch(`${base}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('SANDBOX_API_KEY')!,
        'x-api-secret': Deno.env.get('SANDBOX_API_SECRET')!,
      },
    })
    if (!authR.ok) return { ok: false, error: `Sandbox auth failed (HTTP ${authR.status})` }
    const authJ = await authR.json().catch(() => ({}))
    const token = authJ?.data?.access_token ?? authJ?.access_token
    if (!token) return { ok: false, error: 'Sandbox auth returned no token' }

    const r = await fetch(`${base}/gst/compliance/public/gstin/search`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'x-api-key': Deno.env.get('SANDBOX_API_KEY')!,
        'x-api-version': '1.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gstin }),
    })
    const j = await r.json().catch(() => ({}))
    const raw = j?.data?.data
    if (!raw || j?.data?.status_cd !== '1') {
      return { ok: false, error: j?.message || 'GSTIN not found' }
    }
    const a = raw.pradr?.addr ?? {}
    const stateName = String(a.stcd ?? '').toUpperCase().trim()
    const stcd = STATE_CODE[stateName] ?? gstin.slice(0, 2)
    const addr1 = [a.bno, a.bnm, a.flno, a.st]
      .filter((x: any) => x && String(x).trim())
      .join(', ')
    const addr2 = a.loc && String(a.loc).trim() ? String(a.loc) : null
    return {
      ok: true,
      data: {
        gstin,
        lglNm: raw.lgnm || raw.tradeNam || '',
        tradeNam: raw.tradeNam ?? null,
        addr1,
        addr2,
        loc: a.dst ?? '',
        pin: Number(a.pncd) || 0,
        stcd,
        pos: stcd,
        status: raw.sts ?? null,
      },
    }
  },
}

const PROVIDERS: Record<string, Provider> = {
  swipe,
  sandbox,
}

function pickProvider(): { ok: true; provider: Provider } | { ok: false; error: string } {
  const wanted = (Deno.env.get('GSTIN_PROVIDER') ?? 'swipe').toLowerCase()
  const p = PROVIDERS[wanted]
  if (!p) {
    return { ok: false, error: `Unknown GSTIN_PROVIDER="${wanted}". Known: ${Object.keys(PROVIDERS).join(', ')}` }
  }
  if (!p.configured()) {
    return { ok: false, error: `Provider "${p.name}" not configured. ${p.missingEnvHint}.` }
  }
  return { ok: true, provider: p }
}

// ============ HANDLER ============

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('authorization') ?? ''
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401)

  let body: { gstin?: string } = {}
  try { body = await req.json() } catch { /* fallthrough */ }
  const gstin = String(body.gstin ?? '').toUpperCase().trim()
  if (!GSTIN_RE.test(gstin)) return json({ ok: false, error: 'Invalid GSTIN format' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: cached } = await admin
    .from('gstin_cache')
    .select('data, fetched_at')
    .eq('gstin', gstin)
    .maybeSingle()

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return json({ ok: true, cached: true, data: cached.data })
  }

  const picked = pickProvider()
  if (!picked.ok) return json({ ok: false, error: picked.error }, 500)

  try {
    const r = await picked.provider.fetch(gstin)
    if (!r.ok) return json({ ok: false, error: r.error }, 502)
    await admin
      .from('gstin_cache')
      .upsert({ gstin, data: r.data, fetched_at: new Date().toISOString() })
    return json({ ok: true, cached: false, data: r.data })
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? String(e) }, 502)
  }
})
