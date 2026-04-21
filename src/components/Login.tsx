import { useState } from 'react'
import { supabase } from '../supabase'

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setInfo('')
    setBusy(true)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setErr(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) setErr(error.message)
      else if (data.session) setInfo('') // auto-signed-in
      else setInfo('Check your email to confirm, then sign in.')
    }
    setBusy(false)
  }

  return (
    <div className="h-full max-w-md mx-auto bg-white flex flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Bill Builder</h1>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Email</span>
          <input
            type="email"
            required
            className={inp}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(''); setInfo('') }}
            autoComplete="email"
            autoCapitalize="off"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Password</span>
          <input
            type="password"
            required
            minLength={6}
            className={inp}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErr(''); setInfo('') }}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {info && <p className="text-sm text-slate-600">{info}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium active:scale-95 transition disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <button
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); setInfo('') }}
        className="mt-4 text-sm text-slate-500 underline text-center"
      >
        {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-base'
