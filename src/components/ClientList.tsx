import { useMemo, useState } from 'react'
import { useStore, newId } from '../store'
import type { Buyer } from '../types'
import { validateGstin, validatePin, validatePhone, validateEmail, requireText, validateStcd, pinToStcd, stcdName, onlyDigits } from '../validators'
import { fetchCityFromPin } from '../pincode'
import { lookupGstin } from '../gstinLookup'

export function ClientList() {
  const { buyers, upsertBuyer, deleteBuyer } = useStore()
  const [editing, setEditing] = useState<Buyer | null>(null)
  const [q, setQ] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return buyers
    return buyers.filter(
      (b) =>
        b.lglNm.toLowerCase().includes(s) ||
        b.gstin.toLowerCase().includes(s) ||
        b.loc.toLowerCase().includes(s),
    )
  }, [buyers, q])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  const cancelSelect = () => { setSelectMode(false); setSelected(new Set()) }
  const selectAll = () => setSelected(new Set(filtered.map((b) => b.id)))
  const deleteSelected = () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} client${selected.size === 1 ? '' : 's'}?`)) return
    for (const id of selected) deleteBuyer(id)
    cancelSelect()
  }

  if (editing) {
    return (
      <BuyerForm
        buyer={editing}
        onSave={(b) => { upsertBuyer(b); setEditing(null) }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-5 pb-3 bg-slate-900 text-white flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-xs text-slate-300">{buyers.length} saved</p>
        </div>
        {buyers.length > 0 && (
          selectMode ? (
            <button onClick={cancelSelect} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-white">Cancel</button>
          ) : (
            <button onClick={() => setSelectMode(true)} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-white">Select</button>
          )
        )}
      </header>

      {selectMode ? (
        <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 bg-slate-100">
          <button onClick={selectAll} className="text-sm text-slate-700 underline">Select all</button>
          <span className="text-sm text-slate-600">{selected.size} selected</span>
        </div>
      ) : (
        <div className="p-3 bg-white border-b border-slate-200 flex gap-2">
          <input
            placeholder="Search name, GSTIN, location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-base"
          />
          <button
            onClick={() => setEditing({
              id: newId(), gstin: '', lglNm: '', addr1: '', loc: '', pin: 0, pos: '09', stcd: '09',
            })}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
          >
            +
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-200 bg-white">
          {filtered.map((b) => {
            const isChecked = selected.has(b.id)
            return (
              <li key={b.id} className="px-4 py-3 flex items-center gap-2">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(b.id)}
                    className="w-5 h-5 accent-slate-900"
                  />
                )}
                <button
                  onClick={() => (selectMode ? toggle(b.id) : setEditing(b))}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-slate-900 text-sm">{b.lglNm}</div>
                  <div className="text-xs text-slate-500">{b.gstin} · {b.loc}</div>
                </button>
                {!selectMode && (
                  <button
                    onClick={() => { if (confirm('Delete client?')) deleteBuyer(b.id) }}
                    className="text-slate-400 px-2 text-lg"
                  >×</button>
                )}
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="p-8 text-center text-sm text-slate-500">No clients match.</li>
          )}
        </ul>
      </div>

      {selectMode && (
        <div className="p-3 bg-white border-t border-slate-200">
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-medium disabled:opacity-50 active:scale-95 transition"
          >
            Delete {selected.size} client{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>
  )
}

function BuyerForm({ buyer, onSave, onCancel }: { buyer: Buyer; onSave: (b: Buyer) => void; onCancel: () => void }) {
  const [b, setB] = useState<Buyer>(buyer)
  const [gstinFetch, setGstinFetch] = useState<{ loading: boolean; error: string | null; cached: boolean }>(
    { loading: false, error: null, cached: false },
  )
  const set = <K extends keyof Buyer>(k: K, v: Buyer[K]) => setB((x) => ({ ...x, [k]: v }))
  const setPin = (raw: string) => {
    const d = onlyDigits(raw, 6)
    const pin = d ? Number(d) : 0
    const stcd = pinToStcd(d)
    setB((x) => ({ ...x, pin, ...(stcd ? { stcd, pos: stcd } : {}) }))
    if (d.length === 6) {
      fetchCityFromPin(d).then((city) => {
        if (!city) return
        setB((x) => (x.pin === pin ? { ...x, loc: city } : x))
      })
    }
  }

  const gstinFormatOk = validateGstin(b.gstin, { required: true }) === null
  const fetchGstinDetails = async () => {
    const g = b.gstin.trim().toUpperCase()
    if (!gstinFormatOk) return
    setGstinFetch({ loading: true, error: null, cached: false })
    const r = await lookupGstin(g)
    if (!r.ok) { setGstinFetch({ loading: false, error: r.error, cached: false }); return }
    setGstinFetch({ loading: false, error: null, cached: r.cached })
    const d = r.data
    setB((x) => ({
      ...x,
      gstin: g,
      lglNm: d.lglNm || x.lglNm,
      addr1: d.addr1 || x.addr1,
      addr2: d.addr2 ?? x.addr2,
      loc: d.loc || x.loc,
      pin: d.pin || x.pin,
      stcd: d.stcd || x.stcd,
      pos: d.stcd || x.pos,
    }))
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 py-3 bg-slate-900 text-white flex items-center gap-3">
        <button onClick={onCancel} className="text-2xl leading-none -ml-1 px-2">‹</button>
        <h1 className="text-lg font-semibold">{buyer.lglNm ? 'Edit client' : 'New client'}</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        <Field
          label="GSTIN"
          error={gstinFetch.error ?? validateGstin(b.gstin, { required: true })}
          hint={gstinFetch.loading ? 'Looking up…' : gstinFetch.cached ? 'Auto-filled (cached)' : null}
        >
          <div className="flex gap-2">
            <input
              className={`${inp} flex-1 min-w-0`}
              value={b.gstin}
              onChange={(e) => {
                if (gstinFetch.error) setGstinFetch({ loading: false, error: null, cached: false })
                set('gstin', e.target.value.toUpperCase())
              }}
              maxLength={15}
            />
            <button
              type="button"
              onClick={fetchGstinDetails}
              disabled={!gstinFormatOk || gstinFetch.loading}
              className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
            >
              {gstinFetch.loading ? '…' : 'Fetch'}
            </button>
          </div>
        </Field>
        <Field label="Legal name" error={requireText(b.lglNm)}>
          <input className={inp} value={b.lglNm} onChange={(e) => set('lglNm', e.target.value)} />
        </Field>
        <Field label="Address line 1" error={requireText(b.addr1)}>
          <input className={inp} value={b.addr1} onChange={(e) => set('addr1', e.target.value)} />
        </Field>
        <Field label="Address line 2 (optional)"><input className={inp} value={b.addr2 ?? ''} onChange={(e) => set('addr2', e.target.value || undefined)} /></Field>
        <Field label="Location" error={requireText(b.loc)}>
          <input className={inp} value={b.loc} onChange={(e) => set('loc', e.target.value)} />
        </Field>
        <Field label="PIN" error={validatePin(b.pin, { required: true })}>
          <input
            className={inp}
            inputMode="numeric"
            maxLength={6}
            value={b.pin ? String(b.pin) : ''}
            onChange={(e) => setPin(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State code (Stcd)" error={validateStcd(b.stcd)} hint={stcdName(b.stcd)}>
            <input className={inp} value={b.stcd} onChange={(e) => set('stcd', e.target.value)} />
          </Field>
          <Field label="Place of supply (Pos)" error={validateStcd(b.pos)} hint={stcdName(b.pos)}>
            <input className={inp} value={b.pos} onChange={(e) => set('pos', e.target.value)} />
          </Field>
        </div>
        <Field label="Phone (optional)" error={validatePhone(b.ph)}>
          <input className={inp} inputMode="tel" value={b.ph ?? ''} onChange={(e) => set('ph', e.target.value || undefined)} />
        </Field>
        <Field label="Email (optional)" error={validateEmail(b.em)}>
          <input className={inp} inputMode="email" value={b.em ?? ''} onChange={(e) => set('em', e.target.value || undefined)} />
        </Field>
      </div>
      <footer className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-900 font-medium">Cancel</button>
        <button onClick={() => onSave(b)} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-medium">Save</button>
      </footer>
    </div>
  )
}

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'

function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-red-600 mt-0.5">{error}</span>}
      {!error && hint && <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  )
}
