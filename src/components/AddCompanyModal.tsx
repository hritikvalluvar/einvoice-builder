import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../supabase'
import { lookupGstin } from '../gstinLookup'
import { validateGstin, stcdName } from '../validators'
import type { Seller } from '../types'

type Mode = 'gstin' | 'invite' | 'manual'
type Fetched = Seller & { tradeNam?: string | null; status?: string | null }

export function AddCompanyModal({ onClose }: { onClose: () => void }) {
  const { createCompany, joinCompany, setSeller } = useStore()

  const [mode, setMode] = useState<Mode>('gstin')
  const [gstin, setGstin] = useState('')
  const [name, setName] = useState('')
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const [claimedName, setClaimedName] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const gstinValid = validateGstin(gstin, { required: true }) === null

  const doFetch = async () => {
    setErr(null)
    setClaimedName(null)
    setBusy(true)
    const g = gstin.trim().toUpperCase()
    const { data: claimName, error: claimErr } = await supabase.rpc('gstin_claim_info', { p_gstin: g })
    if (claimErr) console.error('[gstin_claim_info]', claimErr)
    if (claimName) {
      setBusy(false)
      setClaimedName(claimName as string)
      return
    }
    const r = await lookupGstin(g)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    const d = r.data
    setFetched({
      gstin: d.gstin ?? g,
      lglNm: d.lglNm ?? '',
      addr1: d.addr1 ?? '',
      addr2: d.addr2 ?? undefined,
      loc: d.loc ?? '',
      pin: d.pin ?? 0,
      stcd: d.stcd ?? '09',
      tradeNam: (d as any).tradeNam ?? null,
      status: (d as any).status ?? null,
    })
  }

  const createFromFetched = async () => {
    if (!fetched) return
    setBusy(true)
    setErr(null)
    const res = await createCompany(fetched.lglNm || fetched.tradeNam || 'Untitled')
    if (!res.ok) { setBusy(false); setErr(res.error ?? 'Could not create company'); return }
    const { tradeNam: _omit, status: _omitStatus, ...sellerData } = fetched
    await setSeller(sellerData)
    setBusy(false)
    onClose()
  }

  const createBlank = async () => {
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    const res = await createCompany(name)
    setBusy(false)
    if (!res.ok) { setErr(res.error ?? 'Could not create company'); return }
    onClose()
  }

  const doJoin = async () => {
    if (!inviteCode.trim()) return
    setBusy(true)
    setErr(null)
    const res = await joinCompany(inviteCode.trim())
    setBusy(false)
    if (!res.ok) { setErr(res.error ?? 'Invalid invite code'); return }
    onClose()
  }

  const reset = () => { setFetched(null); setClaimedName(null); setErr(null); setInviteCode('') }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-16" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add company</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none px-2">×</button>
        </div>

        {/* ── mode tabs ── */}
        {!fetched && !claimedName && (
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['gstin', 'invite', 'manual'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); reset() }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {m === 'gstin' ? 'Register GSTIN' : m === 'invite' ? 'Join with code' : 'No GSTIN'}
              </button>
            ))}
          </div>
        )}

        {/* ── gstin: enter + fetch ── */}
        {mode === 'gstin' && !fetched && !claimedName && (
          <>
            <label className="block">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">GSTIN</span>
              <input
                className={inp}
                value={gstin}
                onChange={(e) => { setGstin(e.target.value.toUpperCase()); setErr(null) }}
                maxLength={15}
                placeholder="e.g. 09KINGB1234K1Z5"
                autoFocus
              />
            </label>
            <button
              onClick={doFetch}
              disabled={!gstinValid || busy}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
            >
              {busy ? 'Looking up…' : 'Fetch details'}
            </button>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </>
        )}

        {/* ── gstin: already claimed → prompt to join ── */}
        {mode === 'gstin' && claimedName && (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-sm font-medium text-amber-900">Already registered</p>
              <p className="text-xs text-amber-700">
                <span className="font-semibold">{claimedName}</span> is already on einvoice-builder.
                Ask the owner for an invite code to join.
              </p>
            </div>
            <label className="block">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Invite code</span>
              <input
                className={inp}
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setErr(null) }}
                placeholder="Paste invite code here"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { reset(); setGstin('') }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-medium active:scale-95 transition"
              >
                Back
              </button>
              <button
                onClick={doJoin}
                disabled={!inviteCode.trim() || busy}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
              >
                {busy ? 'Joining…' : 'Join company'}
              </button>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </>
        )}

        {/* ── gstin: preview before create ── */}
        {mode === 'gstin' && fetched && (
          <>
            <div className="rounded-xl border border-slate-200 p-3 space-y-1 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900 truncate">{fetched.lglNm || fetched.tradeNam || 'Unnamed'}</div>
                {fetched.status && (
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${fetched.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {fetched.status}
                  </span>
                )}
              </div>
              {fetched.tradeNam && fetched.tradeNam !== fetched.lglNm && (
                <div className="text-xs text-slate-500">{fetched.tradeNam}</div>
              )}
              <div className="text-xs text-slate-600">{fetched.addr1}{fetched.addr2 ? `, ${fetched.addr2}` : ''}</div>
              <div className="text-xs text-slate-600">{fetched.loc}{fetched.pin ? ` – ${fetched.pin}` : ''}{stcdName(fetched.stcd) ? ` · ${stcdName(fetched.stcd)}` : ''}</div>
              <div className="text-[11px] text-slate-500 font-mono pt-1">{fetched.gstin}</div>
            </div>
            {fetched.status && fetched.status !== 'Active' && (
              <p className="text-xs text-red-600">This GSTIN is {fetched.status}. You can still create the company, but you will not be able to issue valid invoices until it is reactivated.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setFetched(null); setErr(null) }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-medium active:scale-95 transition"
              >
                Back
              </button>
              <button
                onClick={createFromFetched}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
              >
                {busy ? 'Creating…' : 'Create company'}
              </button>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </>
        )}

        {/* ── invite code mode ── */}
        {mode === 'invite' && (
          <>
            <label className="block">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Invite code</span>
              <input
                className={inp}
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setErr(null) }}
                placeholder="Paste invite code here"
                autoFocus
              />
            </label>
            <p className="text-[11px] text-slate-500">
              Ask the company owner for their invite code from the Account tab.
            </p>
            <button
              onClick={doJoin}
              disabled={!inviteCode.trim() || busy}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
            >
              {busy ? 'Joining…' : 'Join company'}
            </button>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </>
        )}

        {/* ── manual (no GSTIN) ── */}
        {mode === 'manual' && (
          <>
            <label className="block">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Company name</span>
              <input
                className={inp}
                value={name}
                onChange={(e) => { setName(e.target.value); setErr(null) }}
                placeholder="e.g. Rohit Enterprises"
                autoFocus
              />
            </label>
            <p className="text-[11px] text-slate-500">
              Seller details can be filled later from the Account tab.
            </p>
            <button
              onClick={createBlank}
              disabled={!name.trim() || busy}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
            >
              {busy ? 'Creating…' : 'Create company'}
            </button>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'
