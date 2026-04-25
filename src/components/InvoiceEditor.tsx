import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, newId } from '../store'
import type { Invoice, InvoiceItem, Buyer, Product, ShipAddress, BillTo, EwbDtls } from '../types'
import { computeLines, summarize, toNicJson, fromDateInput, toDateInput, shipFromBillTo, billFromBuyer } from '../einvoice'
import { UQC_CODES } from '../uqc'
import { validateGstin, validatePin, validatePhone, validateEmail, requireText, validateStcd, validateHsn, stcdName, onlyDigits } from '../validators'
import { normGstin } from '../normalize'
import { checkGstinStatus } from '../gstinLookup'
import { suggestNextDocNo } from '../invoiceNumber'
import { Field, inp, useGstinFetch, FetchButton, PinInput } from './fields'

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

  const [docNo, setDocNo] = useState(existing?.docNo ?? suggestNextDocNo(invoices))
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

  // ── Snapshot tracking if user changes GST details after fetching ──
  const [billToSnapshot, setBillToSnapshot] = useState<Partial<BillTo> | null>(null)
  const [shipToSnapshot, setShipToSnapshot] = useState<Partial<ShipAddress> | null>(null)
  const [pendingAction, setPendingAction] = useState<'save' | 'export' | null>(null)
  const [statusWarn, setStatusWarn] = useState<string | null>(null)
  const [statusWarnAction, setStatusWarnAction] = useState<'save' | 'export'>('export')
  const [reviewAction, setReviewAction] = useState<'save' | 'export' | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const billToFetch = useGstinFetch(billTo.gstin, (data) => {
    const g = billTo.gstin.trim().toUpperCase()
    const next: BillTo = {
      gstin: g,
      lglNm: data.lglNm || billTo.lglNm,
      addr1: data.addr1 || billTo.addr1,
      addr2: data.addr2 ?? billTo.addr2,
      loc: data.loc || billTo.loc,
      pin: data.pin || billTo.pin,
      stcd: data.stcd || billTo.stcd,
      pos: data.pos || data.stcd || billTo.pos,
      ph: billTo.ph,
      em: billTo.em,
    }
    setBillTo(next)
    setBuyerId(undefined)
    if (shipSame) setShipTo(shipFromBillTo(next))
    setBillToSnapshot({
      lglNm: next.lglNm,
      addr1: next.addr1,
      addr2: next.addr2,
      loc: next.loc,
      pin: next.pin,
      stcd: next.stcd,
    })
  })

  const isIntra = seller.stcd === billTo.pos
  const lines = useMemo(() => computeLines(items, isIntra), [items, isIntra])
  const forceTotal = forceTotalStr.trim() ? Number(forceTotalStr) : undefined
  const summary = useMemo(() => summarize(lines, forceTotal), [lines, forceTotal])

  const handleBuyerSelected = (b: Buyer) => {
    setBuyerId(b.id)
    const bill = billFromBuyer(b)
    setBillTo(bill)
    if (shipSame) setShipTo(shipFromBillTo(bill))
    // ── record snapshot so edits after picking trigger the dialog ──
    setBillToSnapshot({
      lglNm: bill.lglNm,
      addr1: bill.addr1,
      addr2: bill.addr2,
      loc: bill.loc,
      pin: bill.pin,
      stcd: bill.stcd,
    })
  }

  const updateBillTo = (patch: Partial<BillTo>) => {
    if (patch.gstin != null && billToFetch.error) billToFetch.clearError()
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

  const billToValid = !!billTo.lglNm.trim() && !!billTo.gstin.trim() && !!billTo.addr1.trim() && !!billTo.loc.trim() && billTo.pin > 0 && !validateStcd(billTo.stcd)
  // EWB is optional, but if provided, it must be valid
  const ewbValid = !ewb || (
    (!!ewb.vehNo?.trim() || !!ewb.transId?.trim()) &&
    (!ewb.transId?.trim() || !!ewb.transName?.trim()) &&
    (!ewb.transId?.trim() || ewb.transId.trim().length === 15)
  )

  const canSave =
    billToValid && items.length > 0 && !!docNo.trim() && !!docDt && ewbValid &&
    items.every((it) => it.prdDesc.trim() && validateHsn(it.hsnCd, { required: true }) == null && it.qty > 0 && it.unitPrice > 0)

  // ── detect if user edited auto-filled fields after fetch ──
  const snapshotKeys: (keyof BillTo)[] = ['lglNm', 'addr1', 'addr2', 'loc', 'pin', 'stcd']
  const billToChanged = billToSnapshot !== null && snapshotKeys.some(
    (k) => String(billTo[k] ?? '') !== String(billToSnapshot[k] ?? '')
  )
  const shipToChanged = shipToSnapshot !== null && snapshotKeys.some(
    (k) => String((shipTo as any)[k] ?? '') !== String((shipToSnapshot as any)[k] ?? '')
  )
  const hasFetchChanges = billToChanged || shipToChanged

  const validationIssues: string[] = []
  if (!docNo.trim()) validationIssues.push('Invoice #')
  if (!billTo.lglNm.trim()) validationIssues.push('Buyer name')
  if (!billTo.gstin.trim()) validationIssues.push('Buyer GSTIN')
  if (!billTo.addr1.trim()) validationIssues.push('Buyer address')
  if (!billTo.loc.trim()) validationIssues.push('Buyer location')
  if (!(billTo.pin > 0)) validationIssues.push('Buyer PIN')
  if (validateStcd(billTo.stcd)) validationIssues.push('Buyer state code')
  if (items.length === 0) {
    validationIssues.push('No items added')
  } else {
    items.forEach((it, i) => {
      if (!it.prdDesc.trim()) validationIssues.push(`Item ${i + 1} · name`)
      if (validateHsn(it.hsnCd, { required: true })) validationIssues.push(`Item ${i + 1} · HSN invalid`)
      if (!(it.qty > 0)) validationIssues.push(`Item ${i + 1} · qty`)
      if (!(it.unitPrice > 0)) validationIssues.push(`Item ${i + 1} · price`)
    })
  }
  if (ewb) {
    if (!ewb.vehNo?.trim() && !ewb.transId?.trim()) validationIssues.push('E-way · vehicle or transporter ID')
    if (ewb.transId?.trim() && !ewb.transName?.trim()) validationIssues.push('E-way · transporter name')
    if (ewb.transId?.trim() && ewb.transId.trim().length !== 15) validationIssues.push('E-way · transporter ID (15 chars)')
  }

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

  // ── split actual save/export logic out so dialog can call them ──
  const doSave = () => {
    // on save, if GSTIN doesn't match any existing buyer, create a new buyer record so it shows up in suggestions later
    const inv = buildInvoice()
    const gstinKey = normGstin(billTo.gstin)
    const matched = buyers.find((b) => normGstin(b.gstin) === gstinKey)
    if (!matched && gstinKey) {
      const newBuyer: Buyer = {
        id: newId(),
        gstin: billTo.gstin,
        lglNm: billTo.lglNm,
        addr1: billTo.addr1,
        addr2: billTo.addr2,
        loc: billTo.loc,
        pin: billTo.pin,
        pos: billTo.pos,
        stcd: billTo.stcd,
        ph: billTo.ph,
        em: billTo.em,
      }
      upsertBuyer(newBuyer)
      inv.buyerId = newBuyer.id
    } else if (matched && !inv.buyerId) {
      inv.buyerId = matched.id
    }
    upsertInvoice(inv)
    onDone()
  }

  const doExport = () => {
    const inv = buildInvoice()
    const gstinKey = normGstin(billTo.gstin)
    const matched = buyers.find((b) => normGstin(b.gstin) === gstinKey)
    if (!matched && gstinKey) {
      const newBuyer: Buyer = {
        id: newId(),
        gstin: billTo.gstin,
        lglNm: billTo.lglNm,
        addr1: billTo.addr1,
        addr2: billTo.addr2,
        loc: billTo.loc,
        pin: billTo.pin,
        pos: billTo.pos,
        stcd: billTo.stcd,
        ph: billTo.ph,
        em: billTo.em,
      }
      upsertBuyer(newBuyer)
      inv.buyerId = newBuyer.id
    } else if (matched && !inv.buyerId) {
      inv.buyerId = matched.id
    }
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

  // ── GSTIN status check + review gate (both save and export paths) ──
  const triggerReview = async (action: 'save' | 'export') => {
    if (validateGstin(billTo.gstin, { required: true }) === null) {
      const status = await checkGstinStatus(billTo.gstin)
      if (status !== null && status !== 'Active') {
        setStatusWarnAction(action)
        setStatusWarn(status)
        return
      }
    }
    setReviewAction(action)
  }

  // ── save/export gate through fetch-changes dialog → status check → review ──
  const save = () => {
    if (!canSave) return
    if (hasFetchChanges) { setPendingAction('save'); return }
    triggerReview('save')
  }

  const exportJson = async () => {
    if (!canSave) return
    if (hasFetchChanges) { setPendingAction('export'); return }
    await triggerReview('export')
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 pt-5 pb-3 bg-slate-900 text-white flex items-center gap-3">
        {existing && (
          <button onClick={onDone} className="text-2xl leading-none -ml-1 px-2">‹</button>
        )}
        <h1 className="text-xl font-semibold">{existing ? 'Edit Order' : 'Create Order'}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          onFetch={(data) => {
            const g = billTo.gstin.trim().toUpperCase()
            const next: BillTo = {
              gstin: g,
              lglNm: data.lglNm || billTo.lglNm,
              addr1: data.addr1 || billTo.addr1,
              addr2: data.addr2 ?? billTo.addr2,
              loc: data.loc || billTo.loc,
              pin: data.pin || billTo.pin,
              stcd: data.stcd || billTo.stcd,
              pos: data.pos || data.stcd || billTo.pos,
              ph: billTo.ph,
              em: billTo.em,
            }
            setBillTo(next)
            setBuyerId(undefined)
            if (shipSame) setShipTo(shipFromBillTo(next))
            setBillToSnapshot({ lglNm: next.lglNm, addr1: next.addr1, addr2: next.addr2, loc: next.loc, pin: next.pin, stcd: next.stcd })
          }}
          onCityResolved={(pin, city) => {
            setBillTo((prev) => {
              if (prev.pin !== pin) return prev
              const next = { ...prev, loc: city }
              if (shipSame) setShipTo(shipFromBillTo(next))
              return next
            })
          }}
          onClear={() => {
            setBillTo({ gstin: '', lglNm: '', addr1: '', addr2: undefined, loc: '', pin: 0, pos: '09', stcd: '09' })
            setBuyerId(undefined)
            setBillToSnapshot(null)
            if (shipSame) setShipTo({ gstin: '', lglNm: '', addr1: '', addr2: undefined, loc: '', pin: 0, stcd: '09' })
          }}
        />

        <ShipToSection
          shipSame={shipSame}
          shipTo={shipTo}
          onToggleSame={(same) => {
            setShipSame(same)
            if (same) setShipTo(shipFromBillTo(billTo))
            else setShipTo({ gstin: 'URP', lglNm: '', addr1: '', addr2: undefined, loc: '', pin: 0, stcd: '09' })
          }}
          onChange={setShipTo}
          onFetchSuccess={(fetched) => setShipToSnapshot(fetched)}
          onClear={() => {
            setShipTo({ gstin: 'URP', lglNm: '', addr1: '', addr2: undefined, loc: '', pin: 0, stcd: '09' })
            setShipToSnapshot(null)
          }}
          buyers={buyers}
          onPick={(b) => {
            const s: ShipAddress = {
              gstin: b.gstin,
              lglNm: b.lglNm,
              addr1: b.addr1,
              addr2: b.addr2,
              loc: b.loc,
              pin: b.pin,
              stcd: b.stcd,
            }
            setShipTo(s)
            // ── record snapshot so edits after picking trigger the dialog ──
            setShipToSnapshot({
              lglNm: b.lglNm,
              addr1: b.addr1,
              addr2: b.addr2,
              loc: b.loc,
              pin: b.pin,
              stcd: b.stcd,
            })
          }}
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

        {validationIssues.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
            <span className="text-green-600 text-base leading-none">✓</span>
            <span className="text-xs text-green-700 font-medium">Looks good — verify amounts before exporting.</span>
          </div>
        ) : (
          <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[11px] font-medium text-amber-700 mb-1">Fill in before saving:</p>
            <ul className="space-y-0.5">
              {validationIssues.map((msg) => (
                <li key={msg} className="flex items-start gap-1.5 text-xs text-amber-800">
                  <span className="shrink-0 text-amber-400 leading-[1.4]">·</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-medium disabled:opacity-50 active:scale-95 transition"
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
        </div>
      </div>
      {/* ── confirmation dialog ── */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Details changed after fetch</h2>
            <p className="text-sm text-slate-600">
              Auto-filled details
              {billToChanged && shipToChanged
                ? ' in Bill To and Ship To'
                : billToChanged ? ' in Bill To' : ' in Ship To'}
              {' '}were manually edited after fetching from GSTIN. They may no longer match the registered details.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-medium active:scale-95 transition"
              >
                Rectify
              </button>
              <button
                onClick={() => {
                  const action = pendingAction!
                  setPendingAction(null)
                  triggerReview(action)
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-95 transition"
              >
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {statusWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Buyer GSTIN is {statusWarn}</h2>
            <p className="text-sm text-slate-600">
              {billTo.gstin} is currently <span className="font-medium text-red-600">{statusWarn}</span> on the GST portal.
              Issuing an invoice against a {statusWarn.toLowerCase()} GSTIN may be non-compliant and the buyer's ITC claim could be denied.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStatusWarn(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-medium active:scale-95 transition"
              >
                Go back
              </button>
              <button
                onClick={() => { setStatusWarn(null); setReviewAction(statusWarnAction) }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium active:scale-95 transition"
              >
                {statusWarnAction === 'save' ? 'Save anyway' : 'Export anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── pre-save/export review overlay ── */}
      {reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Review before {reviewAction === 'save' ? 'saving' : 'exporting'}</h2>

            <div className="space-y-0.5">
              <div className="text-sm font-medium text-slate-900">#{docNo} · {docDt}</div>
              <div className="text-sm text-slate-500 truncate">{billTo.lglNm || '—'}</div>
              <div className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</div>
            </div>

            <dl className="text-sm border-t border-slate-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <dt>Taxable value</dt>
                <dd>₹{summary.assVal.toFixed(2)}</dd>
              </div>
              {isIntra ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <dt>CGST</dt>
                    <dd>₹{summary.cgstVal.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <dt>SGST</dt>
                    <dd>₹{summary.sgstVal.toFixed(2)}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <dt>IGST</dt>
                  <dd>₹{summary.igstVal.toFixed(2)}</dd>
                </div>
              )}
              {summary.rndOffAmt !== 0 && (
                <div className="flex justify-between font-medium text-amber-600">
                  <dt>Round-off</dt>
                  <dd>{summary.rndOffAmt > 0 ? '+' : ''}₹{summary.rndOffAmt.toFixed(2)}</dd>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-semibold text-base border-t border-slate-200 pt-2 mt-1">
                <dt>Total</dt>
                <dd>₹{summary.totInvVal.toFixed(2)}</dd>
              </div>
            </dl>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setReviewAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-medium active:scale-95 transition"
              >
                Edit
              </button>
              <button
                onClick={() => { const a = reviewAction; setReviewAction(null); a === 'save' ? doSave() : doExport() }}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-95 transition"
              >
                {reviewAction === 'save' ? 'Save' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BillToSection({
  billTo, onChange, buyers, onPick, onFetch, onCityResolved, onClear,
}: {
  billTo: BillTo
  onChange: (patch: Partial<BillTo>) => void
  buyers: Buyer[]
  onPick: (b: Buyer) => void
  onFetch: (data: Partial<BillTo> & { tradeNam?: string | null; status?: string | null }) => void
  onCityResolved: (pin: number, city: string) => void
  onClear: () => void
}) {
  const fetch = useGstinFetch(billTo.gstin, onFetch)
  const [armed, setArmed] = useState(false)
  const hasContent = !!(billTo.gstin || billTo.lglNm || billTo.addr1 || billTo.loc || billTo.pin)
  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500">Bill to</label>
        {hasContent && (
          armed ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setArmed(false)} className="text-[11px] text-slate-500 px-2 py-1">Cancel</button>
              <button type="button" onClick={() => { onClear(); setArmed(false) }} className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">Confirm clear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setArmed(true)} className="text-[11px] text-slate-500 underline">Clear</button>
          )
        )}
      </div>

      <div className="space-y-2">
        <Field label="Legal name" error={requireText(billTo.lglNm)}>
          <ClientSuggest
            value={billTo.lglNm}
            onChange={(v) => onChange({ lglNm: v })}
            buyers={buyers}
            matchOn="lglNm"
            onPick={onPick}
          />
        </Field>
        <Field label="GSTIN" error={fetch.error ?? validateGstin(billTo.gstin, { required: true })} hint={fetch.hint}>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <ClientSuggest
                value={billTo.gstin}
                onChange={(v) => onChange({ gstin: v })}
                buyers={buyers}
                matchOn="gstin"
                onPick={onPick}
                maxLength={15}
                transform={(v) => v.toUpperCase()}
              />
            </div>
            <FetchButton onClick={fetch.fetch} loading={fetch.loading} disabled={fetch.fetchDisabled} />
          </div>
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
            <PinInput
              value={billTo.pin}
              onPinChange={(pin, stcd) => onChange({ pin, ...(stcd ? { stcd, pos: stcd } : {}) })}
              onCityResolved={onCityResolved}
            />
          </Field>
          <Field label="State (Stcd)" error={validateStcd(billTo.stcd)} hint={stcdName(billTo.stcd)}>
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
    </section>
  )
}

function ClientSuggest({
  value, onChange, buyers, matchOn, onPick, maxLength, transform,
}: {
  value: string
  onChange: (v: string) => void
  buyers: Buyer[]
  matchOn: 'lglNm' | 'gstin'
  onPick: (b: Buyer) => void
  maxLength?: number
  transform?: (v: string) => string
}) {
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return buyers
      .filter((b) => b[matchOn].toLowerCase().includes(q))
      .filter((b) => b[matchOn].toLowerCase() !== q)
      .slice(0, 5)
  }, [buyers, value, matchOn])

  useEffect(() => {
    if (!focused) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [focused])

  const open = focused && matches.length > 0

  return (
    <div className="relative" ref={wrapRef}>
      <input
        className={inp}
        value={value}
        onChange={(e) => onChange(transform ? transform(e.target.value) : e.target.value)}
        onFocus={() => setFocused(true)}
        maxLength={maxLength}
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {matches.map((b) => (
            <li key={b.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(b); setFocused(false) }}
                className="w-full text-left px-3 py-2 active:bg-slate-50"
              >
                <div className="font-medium text-slate-900 text-sm">{b.lglNm}</div>
                <div className="text-xs text-slate-500">{b.gstin} · {b.loc}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ShipToSection({
  shipSame, shipTo, onToggleSame, onChange, onFetchSuccess, onClear, buyers, onPick,
}: {
  shipSame: boolean
  shipTo: ShipAddress
  onToggleSame: (same: boolean) => void
  onChange: (s: ShipAddress) => void
  onFetchSuccess: (fetched: Partial<ShipAddress>) => void
  onClear: () => void
  buyers: Buyer[]
  onPick: (b: Buyer) => void
}) {
  const [armed, setArmed] = useState(false)
  const shipToRef = useRef(shipTo)
  useEffect(() => { shipToRef.current = shipTo }, [shipTo])
  const hasContent = !shipSame && !!(
    (shipTo.gstin && shipTo.gstin !== 'URP') || shipTo.lglNm || shipTo.addr1 || shipTo.loc || shipTo.pin
  )
  const set = <K extends keyof ShipAddress>(k: K, v: ShipAddress[K]) => onChange({ ...shipTo, [k]: v })

  const shipFetch = useGstinFetch(
    shipTo.gstin === 'URP' ? '' : shipTo.gstin,
    (data) => {
      const g = shipTo.gstin.trim().toUpperCase()
      const merged = {
        lglNm: data.lglNm || shipTo.lglNm,
        addr1: [data.addr1, data.addr2].filter(Boolean).join(' '),
        addr2: undefined as undefined,
        loc: data.loc || shipTo.loc,
        pin: data.pin || shipTo.pin,
        stcd: data.stcd || shipTo.stcd,
      }
      onChange({ ...shipTo, gstin: g, ...merged })
      onFetchSuccess(merged)
    },
  )

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500">Ship to</label>
        {hasContent && (
          armed ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setArmed(false)} className="text-[11px] text-slate-500 px-2 py-1">Cancel</button>
              <button type="button" onClick={() => { onClear(); setArmed(false) }} className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">Confirm clear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setArmed(true)} className="text-[11px] text-slate-500 underline">Clear</button>
          )
        )}
      </div>
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
          {/* GSTIN full-width with Fetch button */}
          <Field
            label="GSTIN"
            error={shipFetch.error ?? validateGstin(shipTo.gstin, { required: true, allowURP: true })}
            hint={shipFetch.hint ?? (shipTo.gstin === 'URP' ? 'Leave blank if buyer has no GSTIN' : null)}
          >
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <ClientSuggest
                  value={shipTo.gstin === 'URP' ? '' : shipTo.gstin}
                  onChange={(v) => {
                    if (shipFetch.error) shipFetch.clearError()
                    set('gstin', v.toUpperCase() || 'URP')
                  }}
                  buyers={buyers}
                  matchOn="gstin"
                  onPick={onPick}
                  maxLength={15}
                  transform={(v) => v.toUpperCase()}
                />
              </div>
              <FetchButton onClick={shipFetch.fetch} loading={shipFetch.loading} disabled={shipFetch.fetchDisabled} />
            </div>
          </Field>
          <Field label="Legal Name" error={requireText(shipTo.lglNm)}>
            <ClientSuggest
              value={shipTo.lglNm}
              onChange={(v) => set('lglNm', v)}
              buyers={buyers}
              matchOn="lglNm"
              onPick={onPick}
            />
          </Field>

          {/* Merged address: addr1 + addr2 concatenated, single input */}
          <Field label="Address" error={requireText(shipTo.addr1)}>
            <input
              className={inp}
              value={[shipTo.addr1, shipTo.addr2].filter(Boolean).join(' ')}
              onChange={(e) => {
                // Split at first comma or just put everything in addr1
                const val = e.target.value
                set('addr1', val)
                // clear addr2 since we're merging into one field
                onChange({ ...shipTo, addr1: val, addr2: undefined })
              }}
              placeholder="Address line 1 and 2"
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Location" error={requireText(shipTo.loc)}>
              <input className={inp} value={shipTo.loc} onChange={(e) => set('loc', e.target.value)} />
            </Field>
            <Field label="PIN" error={validatePin(shipTo.pin, { required: true })}>
              <PinInput
                value={shipTo.pin}
                onPinChange={(pin, stcd) => onChange({ ...shipTo, pin, ...(stcd ? { stcd } : {}) })}
                onCityResolved={(_pin, city) => onChange({ ...shipToRef.current, loc: city })}
              />
            </Field>
            <Field label="Stcd" error={validateStcd(shipTo.stcd)} hint={stcdName(shipTo.stcd)}>
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
  onAddBlank: (name?: string) => void
  onCreateProduct: (p: Product) => void
  onUpdate: (idx: number, patch: Partial<InvoiceItem>) => void
  onRemove: (idx: number) => void
  lines: ReturnType<typeof computeLines>
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500">Items {items.length > 0 && `(${items.length})`}</label>
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => (
          <ItemRow
            key={idx}
            item={it}
            taxable={lines[idx]?.assAmt ?? 0}
            total={lines[idx]?.totItemVal ?? 0}
            onUpdate={(patch) => onUpdate(idx, patch)}
            onRemove={() => onRemove(idx)}
          />
        ))}
      </div>

      <div className="mt-3">
        {pickerOpen ? (
          <ProductPicker
            products={products}
            onPick={(p) => { onAddProduct(p); setPickerOpen(false) }}
            onCreate={(p) => { onCreateProduct(p); setPickerOpen(false) }}
            onCancel={() => setPickerOpen(false)}
          />
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium"
            >
              + Add from products
            </button>
            <button
              onClick={() => onAddBlank()}
              className="px-3 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm"
            >
              + Blank
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function ItemRow({
  item, taxable, total, onUpdate, onRemove,
}: {
  item: InvoiceItem
  taxable: number
  total: number
  onUpdate: (patch: Partial<InvoiceItem>) => void
  onRemove: () => void
}) {
  const hsnError = validateHsn(item.hsnCd, { required: true })
  return (
    <div className="border border-slate-200 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <input
          value={item.prdDesc}
          onChange={(e) => onUpdate({ prdDesc: e.target.value })}
          placeholder="Item name"
          className="flex-1 font-medium text-sm border border-slate-200 bg-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 min-w-0"
        />
        <button onClick={onRemove} className="text-slate-400 px-2 text-lg">×</button>
      </div>
      <textarea
        value={item.description ?? ''}
        onChange={(e) => onUpdate({ description: e.target.value || undefined })}
        placeholder="Description (optional)"
        rows={2}
        className="w-full text-xs text-slate-600 italic border border-slate-200 rounded px-2 py-1 mt-1 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y min-w-0"
      />
      <div className="grid grid-cols-2 gap-2 mt-1">
        <Mini label="Qty">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={item.qty || ''}
            onChange={(e) => onUpdate({ qty: Number(e.target.value) })}
            className={`${miniInp} ${item.qty > 0 ? '' : 'border-red-400'}`}
          />
        </Mini>
        <Mini label="Unit price">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={item.unitPrice || ''}
            onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) })}
            className={`${miniInp} ${item.unitPrice > 0 ? '' : 'border-red-400'}`}
          />
        </Mini>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <Mini label="HSN">
          <input
            inputMode="numeric"
            maxLength={8}
            value={item.hsnCd}
            onChange={(e) => onUpdate({ hsnCd: onlyDigits(e.target.value, 8) })}
            className={`${miniInp} ${hsnError ? 'border-red-400' : ''}`}
          />
        </Mini>
        <Mini label="GST %">
          <input
            type="number"
            inputMode="decimal"
            value={item.gstRt || ''}
            onChange={(e) => onUpdate({ gstRt: Number(e.target.value) })}
            className={miniInp}
          />
        </Mini>
        <Mini label="Unit">
          <select value={item.unit} onChange={(e) => onUpdate({ unit: e.target.value })} className={miniInp}>
            {UQC_CODES.map((u) => (
              <option key={u.code} value={u.code}>{u.code}</option>
            ))}
          </select>
        </Mini>
      </div>
      {hsnError && (
        <div className="text-[11px] text-red-600 mt-0.5">HSN: {hsnError}</div>
      )}
      {!(item.qty > 0) && (
        <div className="text-[11px] text-red-600 mt-0.5">Qty: Required</div>
      )}
      {!(item.unitPrice > 0) && (
        <div className="text-[11px] text-red-600 mt-0.5">Unit price: Required</div>
      )}
      <div className="flex items-center justify-end gap-3 mt-1.5 text-xs text-slate-600">
        <label className="flex items-center gap-1">
          <span>Taxable ₹</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={Number.isFinite(taxable) ? taxable : 0}
            onChange={(e) => {
              const newTaxable = Number(e.target.value)
              if (!(item.qty > 0)) return
              const gross = item.qty * item.unitPrice
              onUpdate({ discount: Math.round((gross - newTaxable) * 100) / 100 })
            }}
            className="w-24 border border-slate-200 rounded px-2 py-0.5 text-right"
          />
        </label>
        <span className="text-slate-900 font-medium">Total ₹{total.toFixed(2)}</span>
      </div>
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
    <div>
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
  const hsnError = validateHsn(p.hsnCd, { required: true })
  const valid = p.prdDesc.trim() && !hsnError && p.defaultPrice > 0

  return (
    <div className="space-y-2">
      <Field label="Product name"><input className={inp} value={p.prdDesc} onChange={(e) => set('prdDesc', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="HSN code" error={hsnError}>
          <input
            className={inp}
            inputMode="numeric"
            maxLength={8}
            value={p.hsnCd}
            onChange={(e) => set('hsnCd', onlyDigits(e.target.value, 8))}
          />
        </Field>
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
        <Field label="GST %"><input className={inp} type="number" inputMode="decimal" value={p.gstRt || ''} onChange={(e) => set('gstRt', Number(e.target.value))} /></Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[0, 5, 12, 18, 28].map((slab) => (
          <button key={slab} type="button" onClick={() => set('gstRt', slab)}
            className={`px-2.5 py-1 rounded-full text-xs border ${p.gstRt === slab ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
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

      <label className="block text-xs font-medium text-slate-500 mt-4 mb-1">Override total (optional)</label>
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
          className="flex flex-col items-center px-2.5 py-1.5 text-slate-700 bg-slate-100 rounded-lg active:bg-slate-200 leading-tight"
        >
          <span className="text-[10px]">↓</span>
          <span className="text-[11px] font-medium">₹{Math.floor(summary.rawTotal)}</span>
        </button>
        <button
          onClick={() => setForceTotalStr(String(Math.ceil(summary.rawTotal)))}
          className="flex flex-col items-center px-2.5 py-1.5 text-slate-700 bg-slate-100 rounded-lg active:bg-slate-200 leading-tight"
        >
          <span className="text-[10px]">↑</span>
          <span className="text-[11px] font-medium">₹{Math.ceil(summary.rawTotal)}</span>
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex justify-between">
        <span>Round-off: ₹{summary.rndOffAmt.toFixed(2)}</span>
        <span>Final: <strong className="text-slate-900">₹{summary.totInvVal.toFixed(2)}</strong></span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        Leave empty to use the calculated total ₹{summary.rawTotal.toFixed(2)}, or tap a button to round.
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

  const [distanceStr, setDistanceStr] = useState<string>(String(ewb?.distance ?? 0))

  // Validation logic
  const partBMissing = ewb ? (!ewb.vehNo?.trim() && !ewb.transId?.trim()) : false
  const transNameMissing = ewb ? (!!ewb.transId?.trim() && !ewb.transName?.trim()) : false
  const transIdError = ewb?.transId?.trim()
    ? (ewb.transId.trim().length !== 15 ? 'Transporter ID must be exactly 15 characters' : null)
    : null
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
            {/* Distance can be auto-calculated by the system based on the 'From' and 'To' pincodes, but allowing manual override if needed (e.g. for multi-modal transport or specific routes). */}
            <Field label="Distance (km)" hint={ewb.distance === 0 ? 'Distance will be auto-calculated' : null}>
              <input
                className={inp}
                inputMode="numeric"
                pattern="[0-9]*"
                value={distanceStr}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
                  setDistanceStr(raw)
                  set('distance', raw === '' ? 0 : Math.max(0, Math.floor(Number(raw))))
                }}
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
            {/* Either transporter ID or vehicle number is required to generate the E-way bill, but not necessarily both. This allows flexibility for cases where the transporter may not have a registered ID or when the vehicle details are not available at the time of invoice creation. */}
            <Field label="Transporter ID (optional)" error={transIdError}>
              <input
                className={inp}
                value={ewb.transId ?? ''}
                onChange={(e) => set('transId', e.target.value.toUpperCase() || undefined)}
                maxLength={15}
              />
            </Field>
            {/* Transporter name is only required if transporter ID is provided, as the EWB system uses the transporter ID to fetch the name. If no transporter ID is given, the transporter name can be left blank without affecting EWB generation. */}
            <Field label="Transporter name (optional)" error={transNameMissing ? 'Required' : null}>
              <input
                className={inp}
                value={ewb.transName ?? ''}
                onChange={(e) => set('transName', e.target.value || undefined)}
              />
            </Field>
          </div>
          {/* Show a warning if both transporter ID and vehicle number are missing, as at least one is required for EWB generation. */}
          {partBMissing && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <span className="text-red-400 text-base leading-none mt-0.5">⚠</span>
              <span>At least one of Transporter ID or Vehicle Number is required to generate the E-way bill.</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

const miniInp = 'w-full border border-slate-200 rounded px-2 py-1 text-sm'

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-slate-500">{label}</span>
      {children}
    </label>
  )
}
