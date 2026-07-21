import React from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved'

export function useSavedState(timeoutMs = 1500) {
  const [status, setStatus] = React.useState<SaveStatus>('idle')
  const timerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const markSaving = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setStatus('saving')
  }, [])

  const markSaved = React.useCallback(() => {
    setStatus('saved')
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setStatus('idle'), timeoutMs)
  }, [timeoutMs])

  const markIdle = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setStatus('idle')
  }, [])

  return { status, markSaving, markSaved, markIdle }
}
