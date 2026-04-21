import { useEffect, useState } from 'react'
import { InvoiceEditor } from './components/InvoiceEditor'
import { OrderHistory } from './components/OrderHistory'
import { ClientList } from './components/ClientList'
import { ProductList } from './components/ProductList'
import { Account } from './components/Account'
import { Login } from './components/Login'
import { Onboarding } from './components/Onboarding'
import { useStore } from './store'
import { supabase } from './supabase'

type Tab = 'create' | 'orders' | 'clients' | 'products' | 'account'

export default function App() {
  const ready = useStore((s) => s.ready)
  const loading = useStore((s) => s.loading)
  const userId = useStore((s) => s.userId)
  const companyId = useStore((s) => s.companyId)
  const bootstrap = useStore((s) => s.bootstrap)
  const setUserEmail = useStore((s) => s.setUserEmail)
  const clear = useStore((s) => s.clear)

  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<{ userId: string; email: string | null } | null>(null)
  const [tab, setTab] = useState<Tab>('create')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [createKey, setCreateKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? { userId: data.session.user.id, email: data.session.user.email ?? null } : null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ? { userId: s.user.id, email: s.user.email ?? null } : null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session && session.userId !== userId) {
      setUserEmail(session.email)
      bootstrap(session.userId)
    } else if (!session && userId) {
      clear()
    }
  }, [session, userId, bootstrap, clear, setUserEmail])

  if (!authReady) return <Splash text="Loading…" />
  if (!session) return <Login />
  if (!ready || loading) return <Splash text="Loading…" />
  if (!companyId) return <Onboarding />

  if (editingId) {
    return (
      <div className="h-full max-w-md mx-auto bg-white shadow-xl">
        <InvoiceEditor invoiceId={editingId} onDone={() => setEditingId(undefined)} />
      </div>
    )
  }

  return (
    <div className="h-full max-w-md mx-auto bg-white shadow-xl flex flex-col">
      <div className="flex-1 overflow-hidden">
        {tab === 'create' && (
          <InvoiceEditor key={createKey} onDone={() => setCreateKey((k) => k + 1)} />
        )}
        {tab === 'orders' && (
          <OrderHistory onEdit={(id) => setEditingId(id)} />
        )}
        {tab === 'clients' && <ClientList />}
        {tab === 'products' && <ProductList />}
        {tab === 'account' && <Account />}
      </div>
      <BottomNav tab={tab} onTab={setTab} />
    </div>
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div className="h-full max-w-md mx-auto bg-white flex items-center justify-center">
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'create', label: 'Create', icon: '＋' },
    { id: 'orders', label: 'Orders', icon: '☰' },
    { id: 'clients', label: 'Clients', icon: '◉' },
    { id: 'products', label: 'Products', icon: '◧' },
    { id: 'account', label: 'Account', icon: '⚙' },
  ]
  return (
    <nav className="flex border-t border-slate-200 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      {items.map((it) => {
        const active = it.id === tab
        return (
          <button
            key={it.id}
            onClick={() => onTab(it.id)}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 ${
              active ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <span className={`text-lg ${active ? 'font-bold' : ''}`}>{it.icon}</span>
            <span className="text-[11px] font-medium">{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
