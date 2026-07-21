import React from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { SaveStatus } from '../lib/hooks/useSavedState'

export function SaveButton({
  status,
  onClick,
  children,
  className,
  savedLabel = 'Сохранено',
  variant = 'primary',
  ...rest
}: {
  status: SaveStatus
  onClick: () => void
  children: React.ReactNode
  className?: string
  savedLabel?: string
  variant?: 'primary' | 'secondary'
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'children'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'saving' || rest.disabled}
      className={cn(
        variant === 'primary' ? 'btn-primary' : 'btn-secondary',
        status === 'saved' && '!translate-y-0 !bg-none !bg-white/10 !text-amber-100/70 !shadow-none',
        status === 'saving' && 'opacity-70',
        className
      )}
      {...rest}
    >
      {status === 'saving' && <Loader2 size={16} className="animate-spin" />}
      {status === 'saved' && <Check size={16} />}
      {status === 'saved' ? savedLabel : children}
    </button>
  )
}
