import { useState } from 'react'
import { useStore } from '../store'
import { toNicJson } from '../einvoice'

type Props = {
  onEdit: (id: string) => void
}

export function OrderHistory({ onEdit }: Props) {
  const { seller, invoices, deleteInvoice } = useStore()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })

  const cancelSelect = () => { setSelectMode(false); setSelected(new Set()) }
  const selectAll = () => setSelected(new Set(invoices.map((i) => i.id)))

  const exportSelected = () => {
    const picks = invoices.filter((i) => selected.has(i.id))
    if (picks.length === 0) return
    const payload = picks.map((inv) => toNicJson(seller, inv))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `invoices-${stamp}-${picks.length}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    cancelSelect()
  }

  const deleteSelected = () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} order${selected.size === 1 ? '' : 's'}?`)) return
    for (const id of selected) deleteInvoice(id)
    cancelSelect()
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-5 pb-3 bg-slate-900 text-white flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Order History</h1>
          <p className="text-xs text-slate-300">{invoices.length} total</p>
        </div>
        <div className="flex gap-2">
          {invoices.length > 0 && (
            selectMode ? (
              <button onClick={cancelSelect} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-white">Cancel</button>
            ) : (
              <button onClick={() => setSelectMode(true)} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-white">Select</button>
            )
          )}
        </div>
      </header>

      {selectMode && (
        <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 bg-slate-100">
          <button onClick={selectAll} className="text-sm text-slate-700 underline">Select all</button>
          <span className="text-sm text-slate-600">{selected.size} selected</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No orders yet. Create one from the <strong>Create</strong> tab.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {invoices.map((inv) => {
              const isChecked = selected.has(inv.id)
              return (
                <li key={inv.id} className="px-4 py-3 flex items-center gap-3 bg-white">
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(inv.id)}
                      className="w-5 h-5 accent-slate-900"
                    />
                  )}
                  <button
                    onClick={() => (selectMode ? toggle(inv.id) : onEdit(inv.id))}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-slate-900">#{inv.docNo} · {inv.docDt}</div>
                    <div className="text-sm text-slate-600 truncate">{inv.billTo?.lglNm || '—'}</div>
                    <div className="text-xs text-slate-400">
                      {inv.items.length} item{inv.items.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                  {!selectMode && (
                    <button
                      onClick={() => { if (confirm('Delete order?')) deleteInvoice(inv.id) }}
                      className="text-slate-400 px-2 text-lg"
                      aria-label="Delete"
                    >×</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectMode && (
        <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="px-4 py-3 rounded-xl bg-red-600 text-white font-medium disabled:opacity-50 active:scale-95 transition"
          >
            Delete
          </button>
          <button
            onClick={exportSelected}
            disabled={selected.size === 0}
            className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-medium disabled:opacity-50 active:scale-95 transition"
          >
            Export {selected.size} as JSON
          </button>
        </div>
      )}
    </div>
  )
}
