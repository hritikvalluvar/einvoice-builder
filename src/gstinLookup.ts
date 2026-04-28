// Client wrapper around the GSTIN lookup.
// In dev, calls Vite middleware at /api/lookup-gstin (keeps Sandbox creds in Node).
// In prod, calls the Supabase `lookup-gstin` edge function.

import { supabase } from './supabase'
import type { BillTo } from './types'

type LookupOk = {
  ok: true
  cached: boolean
  fetchedAt: number
  data: Partial<BillTo> & { tradeNam?: string | null; status?: string | null }
}
type LookupErr = { ok: false; error: string }
type GstinLookupResult = LookupOk | LookupErr

const STATUS_MAX_AGE_MS = 7 * 24 * 3600 * 1000

// Only successful results are cached; fetchedAt is the ms timestamp of when the server fetched it.
const mem = new Map<string, LookupOk>()

async function callDev(gstin: string, maxAgeMs: number): Promise<GstinLookupResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in required' }
  const r = await fetch('/api/lookup-gstin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ gstin, max_age_ms: maxAgeMs }),
  })
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
  if (j?.ok && j.fetched_at) j.fetchedAt = new Date(j.fetched_at).getTime()
  return j as GstinLookupResult
}

async function callProd(gstin: string, maxAgeMs: number): Promise<GstinLookupResult> {
  const { data, error } = await supabase.functions.invoke('lookup-gstin', {
    body: { gstin, max_age_ms: maxAgeMs },
  })
  if (error) return { ok: false, error: error.message || 'Network error' }
  if (data?.ok && data.fetched_at) data.fetchedAt = new Date(data.fetched_at).getTime()
  return data as GstinLookupResult
}

export async function lookupGstin(
  gstin: string,
  opts: { maxAgeMs?: number } = {},
): Promise<GstinLookupResult> {
  const key = gstin.toUpperCase().trim()
  const maxAgeMs = opts.maxAgeMs ?? 30 * 24 * 3600 * 1000

  const hit = mem.get(key)
  if (hit && Date.now() - hit.fetchedAt < maxAgeMs) return hit

  try {
    const r = import.meta.env.DEV ? await callDev(key, maxAgeMs) : await callProd(key, maxAgeMs)
    if (r.ok) mem.set(key, r)
    return r
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' }
  }
}

// Returns the GSTIN's status string (e.g. "Active", "Cancelled") using a 7-day freshness window.
// Returns null on lookup failure — callers should soft-fail rather than block.
export async function checkGstinStatus(gstin: string): Promise<string | null> {
  const r = await lookupGstin(gstin, { maxAgeMs: STATUS_MAX_AGE_MS })
  if (!r.ok) return null
  return r.data.status ?? null
}
