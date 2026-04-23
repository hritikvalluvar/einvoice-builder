// Client wrapper around the GSTIN lookup.
// In dev, calls Vite middleware at /api/lookup-gstin (keeps Sandbox creds in Node).
// In prod, calls the Supabase `lookup-gstin` edge function.

import { supabase } from './supabase'
import type { BillTo } from './types'

type LookupOk = {
  ok: true
  cached: boolean
  data: Partial<BillTo> & { tradeNam?: string | null; status?: string | null }
}
type LookupErr = { ok: false; error: string }
type GstinLookupResult = LookupOk | LookupErr

const mem = new Map<string, GstinLookupResult>()

async function callDev(gstin: string): Promise<GstinLookupResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in required' }
  const r = await fetch('/api/lookup-gstin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ gstin }),
  })
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
  return j as GstinLookupResult
}

async function callProd(gstin: string): Promise<GstinLookupResult> {
  const { data, error } = await supabase.functions.invoke('lookup-gstin', { body: { gstin } })
  if (error) return { ok: false, error: error.message || 'Network error' }
  return data as GstinLookupResult
}

export async function lookupGstin(gstin: string): Promise<GstinLookupResult> {
  const key = gstin.toUpperCase().trim()
  const hit = mem.get(key)
  if (hit) return hit
  try {
    const r = import.meta.env.DEV ? await callDev(key) : await callProd(key)
    if (r.ok) mem.set(key, r)
    return r
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' }
  }
}
