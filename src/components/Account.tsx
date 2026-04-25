import { useEffect, useState } from 'react'
import { useStore, type Member } from '../store'
import { supabase } from '../supabase'
import type { Seller } from '../types'
import { validateGstin, validatePin, validatePhone, validateEmail, requireText, validateStcd, pinToStcd, stcdName, onlyDigits } from '../validators'
import { fetchCityFromPin } from '../pincode'
import { lookupGstin } from '../gstinLookup'

export function Account() {
  const { userEmail, company, seller, setSeller, listMembers, removeMember } = useStore()
  const [s, setS] = useState<Seller>(seller)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [savingMsg, setSavingMsg] = useState('')
  const [gstinFetch, setGstinFetch] = useState<{ loading: boolean; error: string | null; cached: boolean }>(
    { loading: false, error: null, cached: false },
  )

  const set = <K extends keyof Seller>(k: K, v: Seller[K]) => setS((x) => ({ ...x, [k]: v }))

  const sellerGstinOk = validateGstin(s.gstin, { required: true }) === null
  const fetchSellerGstin = async () => {
    const g = s.gstin.trim().toUpperCase()
    if (!sellerGstinOk) return
    setGstinFetch({ loading: true, error: null, cached: false })
    const r = await lookupGstin(g)
    if (!r.ok) { setGstinFetch({ loading: false, error: r.error, cached: false }); return }
    setGstinFetch({ loading: false, error: null, cached: r.cached })
    const d = r.data
    setS((prev) => ({
      ...prev,
      gstin: g,
      lglNm: d.lglNm || prev.lglNm,
      addr1: d.addr1 || prev.addr1,
      addr2: d.addr2 ?? prev.addr2,
      loc: d.loc || prev.loc,
      pin: d.pin || prev.pin,
      stcd: d.stcd || prev.stcd,
    }))
  }
  const setPin = (raw: string) => {
    const d = onlyDigits(raw, 6)
    const pin = d ? Number(d) : 0
    const stcd = pinToStcd(d)
    setS((x) => ({ ...x, pin, ...(stcd ? { stcd } : {}) }))
    if (d.length === 6) {
      fetchCityFromPin(d).then((city) => {
        if (!city) return
        setS((x) => (x.pin === pin ? { ...x, loc: city } : x))
      })
    }
  }
  const myRole = members.find((m) => m.email === userEmail)?.role
  const isOwner = myRole === 'owner'

  useEffect(() => {
    listMembers().then((list) => {
      setMembers(list)
      setLoading(false)
    })
  }, [listMembers])

  const saveSeller = async () => {
    await setSeller(s)
    setSavingMsg('Saved')
    setTimeout(() => setSavingMsg(''), 1200)
  }

  const copyInvite = async () => {
    if (!company) return
    await navigator.clipboard.writeText(company.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleRemove = async (m: Member) => {
    if (!confirm(`Remove ${m.email} from the company?`)) return
    const res = await removeMember(m.userId)
    if (!res.ok) { alert(res.error); return }
    setMembers((prev) => prev.filter((x) => x.userId !== m.userId))
  }

  const signOut = async () => {
    if (!confirm('Sign out?')) return
    await supabase.auth.signOut()
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 pt-5 pb-3 bg-slate-900 text-white">
        <h1 className="text-xl font-semibold">Account</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card title="Signed in as">
          <div className="text-sm font-medium text-slate-900">{userEmail ?? '—'}</div>
        </Card>

        {company && (
          <Card title="Company">
            <div className="text-base font-semibold text-slate-900">{company.name}</div>
            <div className="text-xs text-slate-500 mt-3">Invite code (share with teammates)</div>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono">{company.inviteCode}</code>
              <button onClick={copyInvite} className="text-xs px-3 py-1 rounded-lg bg-slate-900 text-white">
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Card>
        )}

        <Card title={`Members ${members.length ? `(${members.length})` : ''}`}>
          {loading ? (
            <div className="text-sm text-slate-500 py-2">Loading…</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => {
                const isMe = m.email === userEmail
                return (
                  <li key={m.userId} className="flex items-center gap-2 py-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{m.email}{isMe && <span className="text-slate-400"> (you)</span>}</div>
                      <div className="text-xs text-slate-500 capitalize">{m.role}</div>
                    </div>
                    {isOwner && !isMe && m.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(m)}
                        className="text-xs text-red-600 px-2 py-1 rounded border border-red-200"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                )
              })}
              {members.length === 0 && <li className="text-sm text-slate-500 py-2">No members.</li>}
            </ul>
          )}
        </Card>

        <Card title="Seller details (for invoices)">
          <div className="space-y-2">
            <Field label="Legal name" error={requireText(s.lglNm)}>
              <input className={inp} value={s.lglNm} onChange={(e) => set('lglNm', e.target.value)} />
            </Field>
            <Field label="GSTIN" error={gstinFetch.error ?? validateGstin(s.gstin, { required: true })} hint={gstinFetch.cached ? 'Auto-filled (cached)' : null}>
              <div className="flex gap-2">
                <input
                  className={`${inp} flex-1`}
                  value={s.gstin}
                  onChange={(e) => { set('gstin', e.target.value.toUpperCase()); if (gstinFetch.error) setGstinFetch({ loading: false, error: null, cached: false }) }}
                  maxLength={15}
                />
                <button
                  type="button"
                  onClick={fetchSellerGstin}
                  disabled={!sellerGstinOk || gstinFetch.loading}
                  className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
                >
                  {gstinFetch.loading ? '…' : 'Fetch'}
                </button>
              </div>
            </Field>
            <Field label="Address line 1" error={requireText(s.addr1)}>
              <input className={inp} value={s.addr1} onChange={(e) => set('addr1', e.target.value)} />
            </Field>
            <Field label="Address line 2 (optional)"><input className={inp} value={s.addr2 ?? ''} onChange={(e) => set('addr2', e.target.value || undefined)} /></Field>
            <Field label="Location" error={requireText(s.loc)}>
              <input className={inp} value={s.loc} onChange={(e) => set('loc', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="PIN" error={validatePin(s.pin, { required: true })}>
                <input
                  className={inp}
                  inputMode="numeric"
                  maxLength={6}
                  value={s.pin ? String(s.pin) : ''}
                  onChange={(e) => setPin(e.target.value)}
                />
              </Field>
              <Field label="State code" error={validateStcd(s.stcd)} hint={stcdName(s.stcd)}>
                <input className={inp} value={s.stcd} onChange={(e) => set('stcd', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone (optional)" error={validatePhone(s.ph)}>
                <input className={inp} inputMode="tel" value={s.ph ?? ''} onChange={(e) => set('ph', e.target.value || undefined)} />
              </Field>
              <Field label="Email (optional)" error={validateEmail(s.em)}>
                <input className={inp} inputMode="email" value={s.em ?? ''} onChange={(e) => set('em', e.target.value || undefined)} />
              </Field>
            </div>
            <button
              onClick={saveSeller}
              className="w-full mt-2 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium"
            >
              {savingMsg || 'Save seller details'}
            </button>
          </div>
        </Card>

        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-medium active:bg-red-50"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
      {children}
    </section>
  )
}

function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-red-600 mt-0.5">{error}</span>}
      {!error && hint && <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  )
}

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'
