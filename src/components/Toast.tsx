import React from 'react'
import { cn } from '../lib/utils'

type Toast = { id: string; message: string; kind: 'success' | 'error' | 'info' }

const ToastContext = React.createContext<{
  push: (message: string, kind?: Toast['kind']) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const push = React.useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = crypto.randomUUID()
    const t: Toast = { id, message, kind }
    setToasts((s) => [t, ...s])
    window.setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'min-w-[260px] max-w-[360px] rounded-2xl px-4 py-3 shadow-soft border text-sm',
              t.kind === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-900',
              t.kind === 'error' && 'bg-rose-50 border-rose-200 text-rose-900',
              t.kind === 'info' && 'bg-white border-slate-200 text-slate-900'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
