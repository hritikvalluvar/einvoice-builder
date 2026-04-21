import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../supabase'

export function Onboarding() {
  const createCompany = useStore((s) => s.createCompany)
  const joinCompany = useStore((s) => s.joinCompany)
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const res =
      mode === 'create'
        ? await createCompany(name)
        : await joinCompany(code)
    if (!res.ok) setErr(res.error ?? 'Something went wrong')
    setBusy(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="h-full max-w-md mx-auto bg-white flex flex-col px-6 pt-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome</h1>
        <p className="text-sm text-slate-500 mt-1">Create a company or join one with an invite code.</p>
      </div>

      <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          onClick={() => { setMode('create'); setErr('') }}
        >
          Create new
        </button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'join' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          onClick={() => { setMode('join'); setErr('') }}
        >
          Join existing
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'create' ? (
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 mb-1">Company name</span>
            <input
              required
              className={inp}
              value={name}
              onChange={(e) => { setName(e.target.value); setErr('') }}
              placeholder="e.g. Aggarwal Industries"
            />
            <p className="text-xs text-slate-400 mt-2">
              You become the owner. You'll get an invite code you can share with teammates.
            </p>
          </label>
        ) : (
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 mb-1">Invite code</span>
            <input
              required
              className={inp}
              value={code}
              onChange={(e) => { setCode(e.target.value); setErr('') }}
              placeholder="e.g. 7b9f1c8a4d23"
              autoCapitalize="off"
            />
            <p className="text-xs text-slate-400 mt-2">
              Get this from someone already in the company (check Settings).
            </p>
          </label>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={busy || (mode === 'create' ? !name.trim() : !code.trim())}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium disabled:opacity-50 active:scale-95 transition"
        >
          {busy ? 'Please wait…' : mode === 'create' ? 'Create company' : 'Join'}
        </button>
      </form>

      <button
        onClick={signOut}
        className="mt-auto mb-8 py-3 text-sm text-slate-500 underline"
      >
        Sign out
      </button>
    </div>
  )
}

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'
