// Edge function: submit a NIC-schema invoice JSON to Sandbox's e-invoice endpoint
// and return the IRN, AckNo, AckDt, SignedInvoice, SignedQRCode.
// The client is expected to persist these on the invoice row after receiving them.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Cached Sandbox auth token; reused across warm invocations.
let tokenCache: { token: string; exp: number } | null = null

async function getSandboxToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 3600_000) return tokenCache.token
  const r = await fetch(`${Deno.env.get('SANDBOX_API_BASE')}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('SANDBOX_API_KEY')!,
      'x-api-secret': Deno.env.get('SANDBOX_API_SECRET')!,
    },
  })
  if (!r.ok) throw new Error(`Sandbox auth failed (${r.status})`)
  const j = await r.json()
  const token = j?.data?.access_token ?? j?.access_token
  if (!token) throw new Error('Sandbox auth returned no token')
  tokenCache = { token, exp: Date.now() + 23 * 3600_000 }
  return token
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  // Auth gate
  const authHeader = req.headers.get('authorization') ?? ''
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401)

  let body: { nicJson?: any } = {}
  try { body = await req.json() } catch { /* fallthrough */ }
  const nicJson = body?.nicJson
  if (!nicJson || typeof nicJson !== 'object') {
    return json({ ok: false, error: 'Missing nicJson body' }, 400)
  }

  try {
    const token = await getSandboxToken()
    const r = await fetch(
      `${Deno.env.get('SANDBOX_API_BASE')}/gst/compliance/e-invoice/tax-payer/invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': token,
          'x-api-key': Deno.env.get('SANDBOX_API_KEY')!,
          'x-api-version': '1.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nicJson),
      },
    )
    const j = await r.json()

    // Sandbox wraps NIC's response as { code, data: { Data: {...}, Status }, ... }
    const sandboxStatus = j?.data?.Status ?? j?.code
    const raw = j?.data?.Data
    if (!raw || sandboxStatus !== 1) {
      const msg = j?.message
        || j?.data?.ErrorDetails?.[0]?.ErrorMessage
        || j?.data?.InfoDtls?.[0]?.Desc
        || `Submission failed (code ${j?.code ?? '?'})`
      return json({ ok: false, error: msg, raw: j }, 422)
    }

    return json({
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
    return json({ ok: false, error: e?.message ?? String(e) }, 502)
  }
})
