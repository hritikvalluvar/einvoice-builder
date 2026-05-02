import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Dev-only middleware that emulates the `lookup-gstin` Supabase edge function.
// Provider-agnostic: GSTIN_PROVIDER env picks one of PROVIDERS below.
// Adding a new provider = write a `Provider` object + register it. Nothing else changes.
function devGstinLookup(env: Record<string, string>): PluginOption {
  const SB_URL = env.VITE_SUPABASE_URL
  const SB_ANON = env.VITE_SUPABASE_ANON_KEY

  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/
  const CACHE_TTL_MS = 30 * 24 * 3600 * 1000

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
    configured: () => !!env.SWIPE_AUTH_TOKEN,
    async fetch(gstin) {
      const base = env.SWIPE_API_BASE || 'https://app.getswipe.in/api/partner'
      const token = env.SWIPE_AUTH_TOKEN
      const r = await fetch(`${base}/v2/utils/gstin/${encodeURIComponent(gstin)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const j: any = await r.json().catch(() => ({}))
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
    configured: () => !!env.SANDBOX_API_KEY && !!env.SANDBOX_API_SECRET,
    async fetch(gstin) {
      const base = env.SANDBOX_API_BASE || 'https://api.sandbox.co.in'
      const authR = await fetch(`${base}/authenticate`, {
        method: 'POST',
        headers: {
          'x-api-key': env.SANDBOX_API_KEY,
          'x-api-secret': env.SANDBOX_API_SECRET,
        },
      })
      if (!authR.ok) return { ok: false, error: `Sandbox auth failed (HTTP ${authR.status})` }
      const authJ: any = await authR.json().catch(() => ({}))
      const token = authJ?.data?.access_token ?? authJ?.access_token
      if (!token) return { ok: false, error: 'Sandbox auth returned no token' }

      const r = await fetch(`${base}/gst/compliance/public/gstin/search`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'x-api-key': env.SANDBOX_API_KEY,
          'x-api-version': '1.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gstin }),
      })
      const j: any = await r.json().catch(() => ({}))
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

  const PROVIDERS: Record<string, Provider> = { swipe, sandbox }

  function pickProvider(): { ok: true; provider: Provider } | { ok: false; error: string } {
    const wanted = (env.GSTIN_PROVIDER ?? 'swipe').toLowerCase()
    const p = PROVIDERS[wanted]
    if (!p) {
      return { ok: false, error: `Unknown GSTIN_PROVIDER="${wanted}". Known: ${Object.keys(PROVIDERS).join(', ')}` }
    }
    if (!p.configured()) {
      return { ok: false, error: `Provider "${p.name}" not configured. ${p.missingEnvHint}.` }
    }
    return { ok: true, provider: p }
  }

  const memCache = new Map<string, { data: any; at: number }>()

  function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }

  async function readJson(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  }

  return {
    name: 'dev-api-lookup-gstin',
    configureServer(server) {
      const preview = pickProvider()
      if (!preview.ok) {
        server.config.logger.warn(`[dev-api] /api/lookup-gstin will 500: ${preview.error}`)
      } else {
        server.config.logger.info(`[dev-api] /api/lookup-gstin active, provider=${preview.provider.name}`)
      }

      server.middlewares.use('/api/lookup-gstin', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') return next()

        const authHeader = (req.headers['authorization'] as string) ?? ''
        if (!authHeader) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
        try {
          const sb = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: authHeader } } })
          const { data: { user } } = await sb.auth.getUser()
          if (!user) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
        } catch {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
        }

        let body: any = {}
        try { body = await readJson(req) } catch { return sendJson(res, 400, { ok: false, error: 'Bad JSON' }) }
        const gstin = String(body.gstin ?? '').toUpperCase().trim()
        if (!GSTIN_RE.test(gstin)) return sendJson(res, 400, { ok: false, error: 'Invalid GSTIN format' })
        const maxAgeMs = typeof body.max_age_ms === 'number' ? body.max_age_ms : CACHE_TTL_MS

        const hit = memCache.get(gstin)
        if (hit && Date.now() - hit.at < maxAgeMs) {
          return sendJson(res, 200, { ok: true, cached: true, fetched_at: new Date(hit.at).toISOString(), data: hit.data })
        }

        const picked = pickProvider()
        if (!picked.ok) return sendJson(res, 500, { ok: false, error: picked.error })

        try {
          const r = await picked.provider.fetch(gstin)
          if (!r.ok) return sendJson(res, 502, { ok: false, error: r.error })
          const at = Date.now()
          memCache.set(gstin, { data: r.data, at })
          sendJson(res, 200, { ok: true, cached: false, fetched_at: new Date(at).toISOString(), data: r.data })
        } catch (e: any) {
          sendJson(res, 502, { ok: false, error: e?.message ?? String(e) })
        }
      })
    },
  }
}

// Dev-only middleware that emulates the `generate-irn` Supabase edge function.
// Submits a NIC-schema invoice JSON to Sandbox and returns IRN/AckNo/SignedQRCode.
// Sandbox creds stay server-side (Node), never shipped to the browser.
function devIrnGenerate(env: Record<string, string>): PluginOption {
  const API_BASE = env.SANDBOX_API_BASE || 'https://api.sandbox.co.in'
  const API_KEY = env.SANDBOX_API_KEY
  const API_SECRET = env.SANDBOX_API_SECRET
  const SB_URL = env.VITE_SUPABASE_URL
  const SB_ANON = env.VITE_SUPABASE_ANON_KEY

  let tokenCache: { token: string; exp: number } | null = null

  async function getSandboxToken(): Promise<string> {
    if (tokenCache && tokenCache.exp > Date.now() + 3600_000) return tokenCache.token
    const r = await fetch(`${API_BASE}/authenticate`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'x-api-secret': API_SECRET },
    })
    if (!r.ok) throw new Error(`Sandbox auth failed (${r.status})`)
    const j = await r.json()
    const token = j?.data?.access_token ?? j?.access_token
    if (!token) throw new Error('Sandbox auth returned no token')
    tokenCache = { token, exp: Date.now() + 23 * 3600_000 }
    return token
  }

  function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.statusCode = status
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }

  async function readJson(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  }

  return {
    name: 'dev-api-generate-irn',
    configureServer(server) {
      if (!API_KEY || !API_SECRET) {
        server.config.logger.warn('[dev-api] /api/generate-irn will 500: SANDBOX_API_KEY/SECRET not set')
      } else {
        server.config.logger.info('[dev-api] /api/generate-irn active (Sandbox)')
      }

      server.middlewares.use('/api/generate-irn', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') return next()

        const authHeader = (req.headers['authorization'] as string) ?? ''
        if (!authHeader) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
        try {
          const sb = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: authHeader } } })
          const { data: { user } } = await sb.auth.getUser()
          if (!user) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
        } catch {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
        }

        let body: any = {}
        try { body = await readJson(req) } catch { return sendJson(res, 400, { ok: false, error: 'Bad JSON' }) }
        const nicJson = body?.nicJson
        if (!nicJson || typeof nicJson !== 'object') {
          return sendJson(res, 400, { ok: false, error: 'Missing nicJson body' })
        }

        try {
          const token = await getSandboxToken()
          const r = await fetch(`${API_BASE}/gst/compliance/e-invoice/tax-payer/invoice`, {
            method: 'POST',
            headers: {
              'Authorization': token,
              'x-api-key': API_KEY,
              'x-api-version': '1.0.0',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(nicJson),
          })
          const j = await r.json()
          const sandboxStatus = j?.data?.Status ?? j?.code
          const raw = j?.data?.Data
          if (!raw || sandboxStatus !== 1) {
            const msg = j?.message
              || j?.data?.ErrorDetails?.[0]?.ErrorMessage
              || j?.data?.InfoDtls?.[0]?.Desc
              || `Submission failed (code ${j?.code ?? '?'})`
            return sendJson(res, 422, { ok: false, error: msg, raw: j })
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              irn: raw.Irn,
              ackNo: String(raw.AckNo ?? ''),
              ackDt: raw.AckDt,
              signedInvoice: raw.SignedInvoice,
              signedQr: raw.SignedQRCode,
              status: raw.Status,
              ewbNo: raw.EwbNo ?? null,
              ewbDt: raw.EwbDt ?? null,
              ewbValidTill: raw.EwbValidTill ?? null,
            },
          })
        } catch (e: any) {
          sendJson(res, 502, { ok: false, error: e?.message ?? String(e) })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devGstinLookup(env), devIrnGenerate(env)],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
    },
  }
})
