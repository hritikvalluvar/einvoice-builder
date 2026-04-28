import { useState } from 'react'
import { useStore } from '../store'
import { AddCompanyModal } from './AddCompanyModal'

export function CompanySwitcher() {
  const company = useStore((s) => s.company)
  const companies = useStore((s) => s.companies)
  const loadCompanyData = useStore((s) => s.loadCompanyData)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  if (!company) return null

  const pick = (id: string) => {
    setOpen(false)
    if (id !== company.id) loadCompanyData(id)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-500">
            {companies.length > 1 ? `${companies.length} companies` : 'Company'}
          </div>
          <div className="text-sm font-semibold text-slate-900 truncate">{company.name}</div>
        </div>
        <span className="text-slate-400 text-lg leading-none ml-2">⌄</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-1 text-xs font-medium text-slate-500">
              {companies.length > 1 ? 'Switch company' : 'Company'}
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {companies.map((c) => {
                const active = c.id === company.id
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => pick(c.id)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left ${active ? 'bg-slate-100' : 'active:bg-slate-50'}`}
                    >
                      <span className="text-sm font-medium text-slate-900 truncate pr-2">{c.name}</span>
                      {active && <span className="text-[11px] text-slate-500 shrink-0">Active</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              onClick={() => { setOpen(false); setAdding(true) }}
              className="w-full px-3 py-3 mt-1 rounded-lg text-sm font-medium text-slate-900 border border-dashed border-slate-300 active:bg-slate-50"
            >
              + Add company
            </button>
          </div>
        </div>
      )}

      {adding && <AddCompanyModal onClose={() => setAdding(false)} />}
    </>
  )
}
