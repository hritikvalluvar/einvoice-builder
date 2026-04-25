import { useMemo, useState } from 'react'
import { useStore, newId } from '../store'
import type { Product } from '../types'
import { UQC_CODES } from '../uqc'
import { validateHsn, onlyDigits } from '../validators'
import { HsnPackModal } from './HsnPackModal'
import { Field, inp } from './fields'

export function ProductList() {
  const { products, upsertProduct, deleteProduct } = useStore()
  const [editing, setEditing] = useState<Product | null>(null)
  const [q, setQ] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [packsOpen, setPacksOpen] = useState(false)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products
    return products.filter(
      (p) =>
        p.prdDesc.toLowerCase().includes(s) ||
        p.hsnCd.toLowerCase().includes(s),
    )
  }, [products, q])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  const cancelSelect = () => { setSelectMode(false); setSelected(new Set()) }
  const selectAll = () => setSelected(new Set(filtered.map((p) => p.id)))
  const deleteSelected = () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`)) return
    for (const id of selected) deleteProduct(id)
    cancelSelect()
  }

  if (editing) {
    return (
      <ProductForm
        product={editing}
        onSave={(p) => { upsertProduct(p); setEditing(null) }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-5 pb-3 bg-slate-900 text-white flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-xs text-slate-300">{products.length} saved</p>
        </div>
        {products.length > 0 && (
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
            placeholder="Search name or HSN"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-base"
          />
          <button
            onClick={() => setPacksOpen(true)}
            className="px-3 py-2 rounded-lg bg-white text-slate-700 border border-slate-300 text-sm font-medium"
          >
            Packs
          </button>
          <button
            onClick={() => setEditing({ id: newId(), prdDesc: '', hsnCd: '', unit: 'PCS', defaultPrice: 0, gstRt: 18 })}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
          >
            +
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-200 bg-white">
          {filtered.map((p) => {
            const isChecked = selected.has(p.id)
            return (
              <li key={p.id} className="px-4 py-3 flex items-center gap-2">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(p.id)}
                    className="w-5 h-5 accent-slate-900"
                  />
                )}
                <button
                  onClick={() => (selectMode ? toggle(p.id) : setEditing(p))}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-slate-900 text-sm">{p.prdDesc}</div>
                  {p.description && (
                    <div className="text-xs text-slate-600 italic truncate">{p.description}</div>
                  )}
                  <div className="text-xs text-slate-500">HSN {p.hsnCd} · ₹{p.defaultPrice} / {p.unit} · {p.gstRt}%</div>
                </button>
                {!selectMode && (
                  <button
                    onClick={() => { if (confirm('Delete product?')) deleteProduct(p.id) }}
                    className="text-slate-400 px-2 text-lg"
                  >×</button>
                )}
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="p-8 text-center text-sm text-slate-500">No products match.</li>
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
            Delete {selected.size} product{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {packsOpen && <HsnPackModal onClose={() => setPacksOpen(false)} />}
    </div>
  )
}

function ProductForm({ product, onSave, onCancel }: { product: Product; onSave: (p: Product) => void; onCancel: () => void }) {
  const [p, setP] = useState<Product>(product)
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const hsnError = validateHsn(p.hsnCd, { required: true })
  const canSave = !!p.prdDesc.trim() && !hsnError

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 py-3 bg-slate-900 text-white flex items-center gap-3">
        <button onClick={onCancel} className="text-2xl leading-none -ml-1 px-2">‹</button>
        <h1 className="text-lg font-semibold">{product.prdDesc ? 'Edit product' : 'New product'}</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        <Field label="Product name"><input className={inp} value={p.prdDesc} onChange={(e) => set('prdDesc', e.target.value)} /></Field>
        <Field label="HSN code" error={hsnError}>
          <input
            className={inp}
            inputMode="numeric"
            maxLength={8}
            value={p.hsnCd}
            onChange={(e) => set('hsnCd', onlyDigits(e.target.value, 8))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit (UQC)">
            <select className={inp} value={p.unit} onChange={(e) => set('unit', e.target.value)}>
              {UQC_CODES.map((u) => (
                <option key={u.code} value={u.code}>{u.code} — {u.label}</option>
              ))}
            </select>
          </Field>
          <Field label="GST slab %">
            <input className={inp} type="number" inputMode="decimal" value={p.gstRt ?? ''} onChange={(e) => set('gstRt', Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 5, 12, 18, 28].map((slab) => (
            <button
              key={slab}
              type="button"
              onClick={() => set('gstRt', slab)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                p.gstRt === slab ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {slab}%
            </button>
          ))}
        </div>
        <Field label="Default price"><input className={inp} type="number" inputMode="decimal" value={p.defaultPrice || ''} onChange={(e) => set('defaultPrice', Number(e.target.value))} /></Field>
      </div>
      <footer className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-900 font-medium">Cancel</button>
        <button
          onClick={() => canSave && onSave(p)}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-medium disabled:opacity-50"
        >
          Save
        </button>
      </footer>
    </div>
  )
}

