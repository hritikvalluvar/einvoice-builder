// Global error banner. Reads lastError from the store; renders a dismissible
// red strip near the top. Set by any mutation that fails its Supabase write.
// Auto-dismisses after 7s so it doesn't linger; user can also dismiss manually.

import { useEffect } from 'react'
import { useStore } from '../store'

const AUTO_DISMISS_MS = 7000

export function ErrorBanner() {
  const lastError = useStore((s) => s.lastError)
  const clearLastError = useStore((s) => s.clearLastError)

  useEffect(() => {
    if (!lastError) return
    const t = setTimeout(() => clearLastError(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [lastError, clearLastError])

  if (!lastError) return null

  return (
    <div
      role="alert"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-1rem)] bg-red-600 text-white rounded-lg shadow-lg px-3 py-2.5 flex items-start gap-2 text-sm"
    >
      <span className="font-bold leading-tight">!</span>
      <span className="flex-1 leading-snug">{lastError}</span>
      <button
        onClick={clearLastError}
        aria-label="Dismiss"
        className="text-white/80 hover:text-white text-lg leading-none -mt-0.5"
      >
        ×
      </button>
    </div>
  )
}
