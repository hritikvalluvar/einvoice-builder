import { useMemo, useState } from 'react'
import { useStore, newId } from '../store'
import type { Invoice, InvoiceItem, Buyer, Product, ShipAddress, BillTo, EwbDtls } from '../types'
import { computeLines, summarize, toNicJson, fromDateInput, toDateInput, shipFromBillTo, billFromBuyer } from '../einvoice'
import { UQC_CODES } from '../uqc'
import { validateGstin, validatePin, validatePhone, validateEmail, requireText, validateStcd } from '../validators'

type Props = {
  invoiceId?: string
  onDone: () => void
}

export function InvoiceEditor({ invoiceId, onDone }: Props) {
  const { seller, buyers, products, invoices, upsertBuyer, upsertProduct, upsertInvoice } = useStore()

  const existing = invoiceId ? invoices.find((i) => i.id === invoiceId) : undefined

  const today = useMemo(() => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }, [])

  const [docNo, setDocNo] = useState(existing?.docNo ?? '')
  const [docDt, setDocDt] = useState(existing?.docDt ?? today)
  const [buyerId, setBuyerId] = useState<string | undefined>(existing?.buyerId)
  const [billTo, setBillTo] = useState<BillTo>(
    existing?.billTo ?? { gstin: '', lglNm: '', addr1: '', loc: '', pin: 0, pos: '09', stcd: '09' },
  )
  const [items, setItems] = useState<InvoiceItem[]>(existing?.items ?? [])
  const [forceTotalStr, setForceTotalStr] = useState<string>(
    existing?.forceTotal != null ? String(existing.forceTotal) : '',
  )
  const [shipSame, setShipSame] = useState<boolean>(existing?.shipTo == null)
  const [shipTo, setShipTo] = useState<ShipAddress>(
    existing?.shipTo ?? { gstin: 'URP', lglNm: '', addr1: '', loc: '', pin: 0, stcd: '09' },
  )
  const [ewb, setEwb] = useState<EwbDtls | undefined>(existing?.ewb)

  const isIntra = seller.stcd === billTo.pos
  const lines = useMemo(() => computeLines(items, isIntra), [items, isIntra])
  const forceTotal = forceTotalStr.trim() ? Number(forceTotalStr) : undefined
  const summary = useMemo(() => summarize(lines, forceTotal), [lines, forceTotal])

  const handleBuyerSelected = (b: Buyer) => {
    setBuyerId(b.id)
    const bill = billFromBuyer(b)
    setBillTo(bill)
    if (shipSame) setShipTo(shipFromBillTo(bill))
  }

  const updateBillTo = (patch: Partial<BillTo>) => {
    setBillTo((prev) => {
      const next = { ...prev, ...patch }
      if (shipSame) setShipTo(shipFromBillTo(next))
      return next
    })
  }

  const addItemFromProduct = (p: Product) => {
    setItems((arr) => [
      ...arr,
      {
        productId: p.id,
        prdDesc: p.prdDesc,
        description: p.description,
        hsnCd: p.hsnCd,
        unit: p.unit,
        gstRt: p.gstRt,
        qty: 1,
        unitPrice: p.defaultPrice,
      },
    ])
  }

  const addBlankItem = () => {
    setItems((arr) => [
      ...arr,
      { prdDesc: '', hsnCd: '', unit: 'PCS', gstRt: 18, qty: 1, unitPrice: 0 },
    ])
  }

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const removeItem = (idx: number) => setItems((arr) => arr.filter((_, i) => i !== idx))

  const billToValid = !!billTo.lglNm.trim() && !!billTo.gstin.trim() && !!billTo.addr1.trim() && !!billTo.loc.trim() && billTo.pin > 0
  const canSave =
    billToValid && items.length > 0 && !!docNo.trim() && !!docDt &&
    items.every((it) => it.prdDesc.trim() && it.hsnCd.trim() && it.qty > 0)

  const buildInvoice = (): Invoice => ({
    id: existing?.id ?? newId(),
    docNo: docNo.trim(),
    docDt,
    buyerId,
    billTo,
    items,
    shipTo: shipSame ? undefined : shipTo,
    ewb: ewb ? { ...ewb, transDocDt: ewb.transDocDt || docDt } : undefined,
    forceTotal,
    createdAt: existing?.createdAt ?? Date.now(),
  })

  const save = () => {
    if (!canSave) return
    upsertInvoice(buildInvoice())
    onDone()
  }

  const exportJson = () => {
    if (!canSave) return
    const inv = buildInvoice()
    upsertInvoice(inv)
    const payload = [toNicJson(seller, inv)]
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${inv.docNo}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    onDone()
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 pt-5 pb-3 bg-slate-900 text-white flex items-center gap-3">
        {existing && (
          <button onClick={onDone} className="text-2xl leading-none -ml-1 px-2">‹</button>
        )}
        <h1 className="text-xl font-semibold">{existing ? 'Edit Order' : 'Create Order'}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <Field label="Invoice number" error={requireText(docNo)}>
            <input
              className={inp}
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              placeholder="e.g. 127 or INV-2026/001"
              maxLength={16}
            />
          </Field>
          <label className="block text-xs font-medium text-slate-500 mt-3 mb-1">Date</label>
          <input
            type="date"
            className={inp}
            value={toDateInput(docDt)}
            onChange={(e) => setDocDt(fromDateInput(e.target.value))}
          />
        </section>

        <BillToSection
          billTo={billTo}
          onChange={updateBillTo}
          buyers={buyers}
          onPick={handleBuyerSelected}
          onCreate={(b) => { upsertBuyer(b); handleBuyerSelected(b) }}
        />

        <ShipToSection
          shipSame={shipSame}
          shipTo={shipTo}
          onToggleSame={(same) => {
            setShipSame(same)
            if (same) setShipTo(shipFromBillTo(billTo))
          }}
          onChange={setShipTo}
        />

        <ItemsSection
          items={items}
          products={products}
          onAddProduct={addItemFromProduct}
          onAddBlank={addBlankItem}
          onCreateProduct={(p) => { upsertProduct(p); addItemFromProduct(p) }}
          onUpdate={updateItem}
          onRemove={removeItem}
          lines={lines}
        />

        {items.length > 0 && (
          <SummarySection
            summary={summary}
            isIntra={isIntra}
            forceTotalStr={forceTotalStr}
            setForceTotalStr={setForceTotalStr}
          />
        )}

        <EwbSection
          ewb={ewb}
          invoiceDate={docDt}
          onToggle={(on) => setEwb(on ? defaultEwb(docDt) : undefined)}
          onChange={setEwb}
        />
      </div>

      <footer className="p-3 bg-white border-t border-slate-200 flex gap-2 sticky bottom-0">
        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-900 font-medium disabled:opacity-50 active:scale-95 transition"
        >
          Save draft
        </button>
        <button
          onClick={exportJson}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-medium disabled:opacity-50 active:scale-95 transition"
        >
          Export JSON
        </button>
      </footer>
    </div>
  )
}

function BillToSection({
  billTo, onChange, buyers, onPick, onCreate,
}: {
  billTo: BillTo
  onChange: (patch: Partial<BillTo>) => void
  buyers: Buyer[]
  onPick: (b: Buyer) => void
  onCreate: (b: Buyer) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')

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

  const saveToCatalog = () => {
    const b: Buyer = {
      id: newId(),
      lglNm: billTo.lglNm,
      gstin: billTo.gstin,
      addr1: billTo.addr1,
      addr2: billTo.addr2,
      loc: billTo.loc,
      pin: billTo.pin,
      pos: billTo.pos,
      stcd: billTo.stcd,
      ph: billTo.ph,
      em: billTo.em,
    }
    onCreate(b)
  }

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500">Bill to</label>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="text-xs text-slate-700 underline"
        >
          {pickerOpen ? 'Close' : 'Pick from saved'}
        </button>
      </div>

      {pickerOpen && (
        <div className="mb-3 border border-slate-200 rounded-lg p-2">
          <input
            placeholder="Search name, GSTIN, location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inp + ' mb-2'}
          />
          <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {filtered.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => { onPick(b); setPickerOpen(false); setQ('') }}
                  className="w-full text-left py-2 active:bg-slate-50"
                >
                  <div className="font-medium text-slate-900 text-sm">{b.lglNm}</div>
                  <div className="text-xs text-slate-500">{b.gstin} · {b.loc}</div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-sm text-slate-500 py-3 text-center">No match.</li>
            )}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Field label="Legal name" error={requireText(billTo.lglNm)}>
          <input className={inp} value={billTo.lglNm} onChange={(e) => onChange({ lglNm: e.target.value })} />
        </Field>
        <Field label="GSTIN" error={validateGstin(billTo.gstin, { required: true })}>
          <input className={inp} value={billTo.gstin} onChange={(e) => onChange({ gstin: e.target.value.toUpperCase() })} maxLength={15} />
        </Field>
        <Field label="Address" error={requireText(billTo.addr1)}>
          <input className={inp} value={billTo.addr1} onChange={(e) => onChange({ addr1: e.target.value })} />
        </Field>
        <Field label="Address line 2 (optional)"><input className={inp} value={billTo.addr2 ?? ''} onChange={(e) => onChange({ addr2: e.target.value || undefined })} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Location" error={requireText(billTo.loc)}>
            <input className={inp} value={billTo.loc} onChange={(e) => onChange({ loc: e.target.value })} />
          </Field>
          <Field label="PIN" error={validatePin(billTo.pin, { required: true })}>
            <input className={inp} type="number" inputMode="numeric" value={billTo.pin || ''} onChange={(e) => onChange({ pin: Number(e.target.value) })} />
          </Field>
          <Field label="State (Stcd)" error={validateStcd(billTo.stcd)}>
            <input className={inp} value={billTo.stcd} onChange={(e) => { onChange({ stcd: e.target.value, pos: e.target.value }) }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone (optional)" error={validatePhone(billTo.ph)}>
            <input className={inp} inputMode="tel" value={billTo.ph ?? ''} onChange={(e) => onChange({ ph: e.target.value || undefined })} />
          </Field>
          <Field label="Email (optional)" error={validateEmail(billTo.em)}>
            <input className={inp} inputMode="email" value={billTo.em ?? ''} onChange={(e) => onChange({ em: e.target.value || undefined })} />
          </Field>
        </div>
      </div>

      <button
        onClick={saveToCatalog}
        disabled={!billTo.lglNm.trim() || !billTo.gstin.trim()}
        className="w-full mt-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 text-xs font-medium disabled:opacity-40"
      >
        + Save this client to catalog
      </button>
    </section>
  )
}

function ShipToSection({
  shipSame, shipTo, onToggleSame, onChange,
}: {
  shipSame: boolean
  shipTo: ShipAddress
  onToggleSame: (same: boolean) => void
  onChange: (s: ShipAddress) => void
}) {
  const set = <K extends keyof ShipAddress>(k: K, v: ShipAddress[K]) => onChange({ ...shipTo, [k]: v })

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <label className="text-xs font-medium text-slate-500 block mb-2">Ship to</label>
      <label className="flex items-center gap-2 py-2">
        <input
          type="checkbox"
          checked={shipSame}
          onChange={(e) => onToggleSame(e.target.checked)}
          className="w-5 h-5 accent-slate-900"
        />
        <span className="text-sm text-slate-700">Same as bill to</span>
      </label>
      {!shipSame && (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="GSTIN (or URP)" error={validateGstin(shipTo.gstin, { required: true, allowURP: true })}>
              <input className={inp} value={shipTo.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} />
            </Field>
            <Field label="Name / contact" error={requireText(shipTo.lglNm)}>
              <input className={inp} value={shipTo.lglNm} onChange={(e) => set('lglNm', e.target.value)} />
            </Field>
          </div>
          <Field label="Address" error={requireText(shipTo.addr1)}>
            <input className={inp} value={shipTo.addr1} onChange={(e) => set('addr1', e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Location" error={requireText(shipTo.loc)}>
              <input className={inp} value={shipTo.loc} onChange={(e) => set('loc', e.target.value)} />
            </Field>
            <Field label="PIN" error={validatePin(shipTo.pin, { required: true })}>
              <input className={inp} type="number" inputMode="numeric" value={shipTo.pin || ''} onChange={(e) => set('pin', Number(e.target.value))} />
            </Field>
            <Field label="Stcd" error={validateStcd(shipTo.stcd)}>
              <input className={inp} value={shipTo.stcd} onChange={(e) => set('stcd', e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </section>
  )
}

function ItemsSection({
  items, products, onAddProduct, onAddBlank, onCreateProduct, onUpdate, onRemove, lines,
}: {
  items: InvoiceItem[]
  products: Product[]
  onAddProduct: (p: Product) => void
  onAddBlank: () => void
  onCreateProduct: (p: Product) => void
  onUpdate: (idx: number, patch: Partial<InvoiceItem>) => void
  onRemove: (idx: number) => void
  lines: ReturnType<typeof computeLines>
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <label className="text-xs font-medium text-slate-500">Items</label>
      <div className="mt-2 space-y-2">
        {items.map((it, idx) => (
          <ItemRow
            key={idx}
            item={it}
            total={lines[idx]?.totItemVal ?? 0}
            onUpdate={(patch) => onUpdate(idx, patch)}
            onRemove={() => onRemove(idx)}
          />
        ))}
      </div>

      {pickerOpen ? (
        <ProductPicker
          products={products}
          onPick={(p) => { onAddProduct(p); setPickerOpen(false) }}
          onCreate={(p) => { onCreateProduct(p); setPickerOpen(false) }}
          onCancel={() => setPickerOpen(false)}
        />
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium"
          >
            + Add from products
          </button>
          <button
            onClick={onAddBlank}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm"
          >
            + Blank
          </button>
        </div>
      )}
    </section>
  )
}

function ItemRow({
  item, total, onUpdate, onRemove,
}: {
  item: InvoiceItem
  total: number
  onUpdate: (patch: Partial<InvoiceItem>) => void
  onRemove: () => void
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <input
          value={item.prdDesc}
          onChange={(e) => onUpdate({ prdDesc: e.target.value })}
          placeholder="Item name"
          className="flex-1 font-medium text-sm border-0 bg-transparent focus:outline-none focus:ring-0 p-1 min-w-0"
        />
        <button onClick={onRemove} className="text-slate-400 px-2 text-lg">×</button>
      </div>
      <textarea
        value={item.description ?? ''}
        onChange={(e) => onUpdate({ description: e.target.value || undefined })}
        placeholder="Description (optional)"
        rows={1}
        className="w-full text-xs text-slate-600 italic border-0 bg-transparent focus:outline-none focus:ring-0 p-1 resize-none min-w-0"
      />
      <div className="grid grid-cols-2 gap-2 mt-1">
        <Mini label="Qty">
          <input type="number" inputMode="decimal" step="any" value={item.qty}
            onChange={(e) => onUpdate({ qty: Number(e.target.value) })} className={miniInp} />
        </Mini>
        <Mini label="Unit price">
          <input type="number" inputMode="decimal" step="any" value={item.unitPrice}
            onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) })} className={miniInp} />
        </Mini>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <Mini label="HSN">
          <input value={item.hsnCd} onChange={(e) => onUpdate({ hsnCd: e.target.value })} className={miniInp} />
        </Mini>
        <Mini label="GST %">
          <input type="number" inputMode="decimal" value={item.gstRt}
            onChange={(e) => onUpdate({ gstRt: Number(e.target.value) })} className={miniInp} />
        </Mini>
        <Mini label="Unit">
          <select value={item.unit} onChange={(e) => onUpdate({ unit: e.target.value })} className={miniInp}>
            {UQC_CODES.map((u) => (
              <option key={u.code} value={u.code}>{u.code}</option>
            ))}
          </select>
        </Mini>
      </div>
      <div className="text-xs text-slate-500 mt-1.5 text-right">Line ₹{total.toFixed(2)}</div>
    </div>
  )
}

function ProductPicker({
  products, onPick, onCreate, onCancel,
}: {
  products: Product[]
  onPick: (p: Product) => void
  onCreate: (p: Product) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products
    return products.filter((p) => p.prdDesc.toLowerCase().includes(s) || p.hsnCd.toLowerCase().includes(s))
  }, [products, q])

  if (creating) {
    return (
      <QuickProductForm
        initial={q}
        onSave={(p) => { onCreate(p) }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex gap-2 mb-2">
        <input
          placeholder="Search or type new"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={inp}
          autoFocus
        />
        <button onClick={onCancel} className="px-3 text-slate-500 text-sm">Cancel</button>
      </div>
      <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
        {filtered.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(p)} className="w-full text-left py-2 px-1 active:bg-slate-50">
              <div className="text-sm font-medium text-slate-900">{p.prdDesc}</div>
              {p.description && (
                <div className="text-xs text-slate-600 italic truncate">{p.description}</div>
              )}
              <div className="text-xs text-slate-500">HSN {p.hsnCd} · ₹{p.defaultPrice} / {p.unit} · {p.gstRt}%</div>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => setCreating(true)}
        className="w-full mt-2 py-2.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-700 text-sm font-medium"
      >
        + Create new product{q.trim() ? ` "${q.trim()}"` : ''}
      </button>
    </div>
  )
}

function QuickProductForm({
  initial, onSave, onCancel,
}: { initial: string; onSave: (p: Product) => void; onCancel: () => void }) {
  const [p, setP] = useState<Product>({
    id: newId(), prdDesc: initial, hsnCd: '', unit: 'PCS', defaultPrice: 0, gstRt: 18,
  })
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const valid = p.prdDesc.trim() && p.hsnCd.trim() && p.defaultPrice > 0

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <Field label="Product name"><input className={inp} value={p.prdDesc} onChange={(e) => set('prdDesc', e.target.value)} /></Field>
      <Field label="Description (optional)">
        <textarea
          className={inp}
          rows={2}
          value={p.description ?? ''}
          onChange={(e) => set('description', e.target.value || undefined)}
          placeholder="e.g. model, spec, serial"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="HSN code"><input className={inp} value={p.hsnCd} onChange={(e) => set('hsnCd', e.target.value)} /></Field>
        <Field label="Default price"><input className={inp} type="number" inputMode="decimal" value={p.defaultPrice || ''} onChange={(e) => set('defaultPrice', Number(e.target.value))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Unit (UQC)">
          <select className={inp} value={p.unit} onChange={(e) => set('unit', e.target.value)}>
            {UQC_CODES.map((u) => (
              <option key={u.code} value={u.code}>{u.code} — {u.label}</option>
            ))}
          </select>
        </Field>
        <Field label="GST %"><input className={inp} type="number" inputMode="decimal" value={p.gstRt} onChange={(e) => set('gstRt', Number(e.target.value))} /></Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[0, 5, 12, 18, 28].map((slab) => (
          <button key={slab} type="button" onClick={() => set('gstRt', slab)}
            className={`px-2.5 py-1 rounded-full text-xs border ${
              p.gstRt === slab ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
            }`}>{slab}%</button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-900 text-sm font-medium">Cancel</button>
        <button onClick={() => valid && onSave(p)} disabled={!valid} className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50">
          Save & add
        </button>
      </div>
    </div>
  )
}

function SummarySection({
  summary, isIntra, forceTotalStr, setForceTotalStr,
}: {
  summary: ReturnType<typeof summarize>
  isIntra: boolean
  forceTotalStr: string
  setForceTotalStr: (s: string) => void
}) {
  const forceTotal = forceTotalStr.trim() ? Number(forceTotalStr) : undefined
  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <label className="text-xs font-medium text-slate-500">Summary</label>
      <dl className="mt-2 text-sm grid grid-cols-2 gap-y-1">
        <dt className="text-slate-600">Taxable value</dt>
        <dd className="text-right">₹{summary.assVal.toFixed(2)}</dd>
        {isIntra ? (
          <>
            <dt className="text-slate-600">CGST</dt>
            <dd className="text-right">₹{summary.cgstVal.toFixed(2)}</dd>
            <dt className="text-slate-600">SGST</dt>
            <dd className="text-right">₹{summary.sgstVal.toFixed(2)}</dd>
          </>
        ) : (
          <>
            <dt className="text-slate-600">IGST</dt>
            <dd className="text-right">₹{summary.igstVal.toFixed(2)}</dd>
          </>
        )}
        <dt className="text-slate-600">Raw total</dt>
        <dd className="text-right">₹{summary.rawTotal.toFixed(2)}</dd>
      </dl>

      <label className="block text-xs font-medium text-slate-500 mt-4 mb-1">Final total (editable)</label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder={summary.rawTotal.toFixed(2)}
          value={forceTotalStr}
          onChange={(e) => setForceTotalStr(e.target.value)}
          className={inp}
        />
        <button
          onClick={() => setForceTotalStr(String(Math.floor(summary.rawTotal)))}
          className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg active:bg-slate-200"
          title="Round down"
        >
          ↓
        </button>
        <button
          onClick={() => setForceTotalStr(String(Math.ceil(summary.rawTotal)))}
          className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg active:bg-slate-200"
          title="Round up"
        >
          ↑
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex justify-between">
        <span>Round-off: ₹{summary.rndOffAmt.toFixed(2)}</span>
        <span>Final: <strong className="text-slate-900">₹{summary.totInvVal.toFixed(2)}</strong></span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        Blank = raw ₹{summary.rawTotal.toFixed(2)}. Type any amount to force round-off (e.g. 2000.62 → 2000).
      </p>
    </section>
  )
}

function defaultEwb(invoiceDate: string): EwbDtls {
  return {
    transMode: '1',
    distance: 0,
    vehNo: '',
    vehType: 'R',
    transDocDt: invoiceDate,
  }
}

function EwbSection({
  ewb, invoiceDate, onToggle, onChange,
}: {
  ewb?: EwbDtls
  invoiceDate: string
  onToggle: (on: boolean) => void
  onChange: (e: EwbDtls) => void
}) {
  const enabled = !!ewb
  const set = <K extends keyof EwbDtls>(k: K, v: EwbDtls[K]) =>
    onChange({ ...(ewb ?? defaultEwb(invoiceDate)), [k]: v })

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-5 h-5 accent-slate-900"
        />
        <span className="text-sm font-medium text-slate-700">Include E-way Bill (EWB)</span>
      </label>

      {enabled && ewb && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Distance (km) *">
              <input
                className={inp}
                type="number"
                inputMode="numeric"
                value={ewb.distance || ''}
                onChange={(e) => set('distance', Number(e.target.value))}
              />
            </Field>
            <Field label="Vehicle number (optional)">
              <input
                className={inp}
                value={ewb.vehNo}
                onChange={(e) => set('vehNo', e.target.value.toUpperCase())}
                placeholder="UP78BT4567"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Vehicle type">
              <select className={inp} value={ewb.vehType} onChange={(e) => set('vehType', e.target.value)}>
                <option value="R">R — Regular</option>
                <option value="O">O — Over-dimensional cargo</option>
              </select>
            </Field>
            <Field label="Transport mode">
              <select className={inp} value={ewb.transMode} onChange={(e) => set('transMode', e.target.value)}>
                <option value="1">1 — Road</option>
                <option value="2">2 — Rail</option>
                <option value="3">3 — Air</option>
                <option value="4">4 — Ship</option>
              </select>
            </Field>
          </div>

          <Field label="Transport doc date">
            <input
              type="date"
              className={inp}
              value={toDateInput(ewb.transDocDt || invoiceDate)}
              onChange={(e) => set('transDocDt', fromDateInput(e.target.value))}
            />
          </Field>

          <Field label="Transport doc no. (optional)">
            <input className={inp} value={ewb.transDocNo ?? ''} onChange={(e) => set('transDocNo', e.target.value || undefined)} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Transporter ID (optional)">
              <input className={inp} value={ewb.transId ?? ''} onChange={(e) => set('transId', e.target.value || undefined)} />
            </Field>
            <Field label="Transporter name (optional)">
              <input className={inp} value={ewb.transName ?? ''} onChange={(e) => set('transName', e.target.value || undefined)} />
            </Field>
          </div>
        </div>
      )}
    </section>
  )
}

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'
const miniInp = 'w-full border border-slate-200 rounded px-2 py-1 text-sm'

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-red-600 mt-0.5">{error}</span>}
    </label>
  )
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-slate-500">{label}</span>
      {children}
    </label>
  )
}
