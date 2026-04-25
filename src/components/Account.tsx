import { useEffect, useState } from 'react'
import { useStore, type Member } from '../store'
import { supabase } from '../supabase'
import type { Seller } from '../types'
import { validateGstin, validatePin, validatePhone, validateEmail, requireText, validateStcd, stcdName } from '../validators'
import { Field, inp, useGstinFetch, FetchButton, PinInput } from './fields'

export function Account() {
  const { userEmail, company, seller, setSeller, listMembers, removeMember } = useStore()
  const [s, setS] = useState<Seller>(seller)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [savingMsg, setSavingMsg] = useState('')

  const set = <K extends keyof Seller>(k: K, v: Seller[K]) => setS((x) => ({ ...x, [k]: v }))

  const sellerFetch = useGstinFetch(s.gstin, (data) => {
    setS((prev) => ({
      ...prev,
      gstin: s.gstin.trim().toUpperCase(),
      lglNm: data.lglNm || prev.lglNm,
      addr1: data.addr1 || prev.addr1,
      addr2: data.addr2 ?? prev.addr2,
      loc: data.loc || prev.loc,
      pin: data.pin || prev.pin,
      stcd: data.stcd || prev.stcd,
    }))
  })

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
            <Field label="GSTIN" error={sellerFetch.error ?? validateGstin(s.gstin, { required: true })} hint={sellerFetch.hint}>
              <div className="flex gap-2">
                <input
                  className={`${inp} flex-1`}
                  value={s.gstin}
                  onChange={(e) => { set('gstin', e.target.value.toUpperCase()); if (sellerFetch.error) sellerFetch.clearError() }}
                  maxLength={15}
                />
                <FetchButton onClick={sellerFetch.fetch} loading={sellerFetch.loading} disabled={sellerFetch.fetchDisabled} />
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
                <PinInput
                  value={s.pin}
                  onPinChange={(pin, stcd) => setS((x) => ({ ...x, pin, ...(stcd ? { stcd } : {}) }))}
                  onCityResolved={(pin, city) => setS((prev) => prev.pin === pin ? { ...prev, loc: city } : prev)}
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

