import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { HsnPack, HsnPackItem } from '../store'

export function HsnPackModal({ onClose }: { onClose: () => void }) {
  const listHsnPacks = useStore((s) => s.listHsnPacks)
  const listHsnPackItems = useStore((s) => s.listHsnPackItems)
  const importHsnPack = useStore((s) => s.importHsnPack)

  const [packs, setPacks] = useState<HsnPack[] | null>(null)
  const [selected, setSelected] = useState<HsnPack | null>(null)
  const [items, setItems] = useState<HsnPackItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ count: number; name: string } | null>(null)

  useEffect(() => {
    listHsnPacks().then(setPacks)
  }, [listHsnPacks])

  useEffect(() => {
    if (!selected) { setItems(null); return }
    setItems(null)
    listHsnPackItems(selected.id).then(setItems)
  }, [selected, listHsnPackItems])

  const doImport = async () => {
    if (!selected) return
    setBusy(true)
    setErr(null)
    const r = await importHsnPack(selected.id)
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? 'Could not import pack'); return }
    setDone({ count: r.count ?? 0, name: selected.name })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-12" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 space-y-3 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {done ? 'Imported' : selected ? selected.name : 'HSN packs'}
          </h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none px-2">×</button>
        </div>

        {done && (
          <div className="space-y-3 py-4">
            <div className="text-sm text-slate-700">
              Added <span className="font-semibold">{done.count}</span> products from <span className="font-semibold">{done.name}</span>.
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-95 transition"
            >
              Done
            </button>
          </div>
        )}

        {!done && !selected && (
          <>
            {packs === null && <p className="text-sm text-slate-500 py-4">Loading…</p>}
            {packs !== null && packs.length === 0 && (
              <p className="text-sm text-slate-500 py-4">No packs available yet.</p>
            )}
            {packs !== null && packs.length > 0 && (
              <ul className="overflow-y-auto -mx-1 px-1">
                {packs.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className="w-full text-left px-3 py-3 rounded-lg active:bg-slate-50 border-b border-slate-100"
                    >
                      <div className="text-sm font-medium text-slate-900">{p.name}</div>
                      {p.description && <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>}
                      <div className="text-[11px] text-slate-400 mt-1">
                        {p.itemCount} items{p.vertical ? ` · ${p.vertical}` : ''}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {!done && selected && (
          <>
            {items === null && <p className="text-sm text-slate-500 py-4">Loading items…</p>}
            {items !== null && (
              <>
                <p className="text-xs text-slate-500">{items.length} items will be added to your products. Existing products are not modified.</p>
                <ul className="overflow-y-auto -mx-1 px-1 border-t border-slate-100">
                  {items.map((it) => (
                    <li key={it.id} className="px-3 py-2 border-b border-slate-100">
                      <div className="text-sm text-slate-900">{it.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">HSN {it.hsnCd} · {it.unit} · {it.gstRt}%{it.defaultPrice > 0 ? ` · ₹${it.defaultPrice}` : ''}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setSelected(null); setErr(null) }}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-medium active:scale-95 transition"
              >
                Back
              </button>
              <button
                onClick={doImport}
                disabled={busy || items === null || items.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
              >
                {busy ? 'Importing…' : `Import ${items?.length ?? ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
