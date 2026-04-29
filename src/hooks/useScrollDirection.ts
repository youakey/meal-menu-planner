import React from 'react'

export function useScrollDirection(threshold = 10): 'up' | 'down' {
  const [direction, setDirection] = React.useState<'up' | 'down'>('up')
  const lastY = React.useRef(0)
  const rafId = React.useRef<number>(0)

  React.useEffect(() => {
    lastY.current = window.scrollY

    function onScroll() {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current
        if (Math.abs(delta) < threshold) return
        setDirection(delta > 0 ? 'down' : 'up')
        lastY.current = y
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId.current)
    }
  }, [threshold])

  return direction
}
