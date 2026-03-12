import React from 'react'
import type { Dish, UUID } from '../lib/types'
import { cn } from '../lib/utils'

export function DishPicker(props: {
  dishes: Dish[]
  value: UUID | null
  onChange: (dishId: UUID | null) => void
  placeholder?: string
}) {
  const { dishes, value, onChange, placeholder = 'Выберите блюдо…' } = props
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const selected = value ? dishes.find((d) => d.id === value) : null

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return dishes
    return dishes.filter((d) => d.name.toLowerCase().includes(q))
  }, [dishes, query])

  React.useEffect(() => {
    if (selected) setQuery(selected.name)
  }, [selected?.id])

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
      />
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
          <div className="max-h-56 overflow-auto">
            <button
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-slate-50',
                !value && 'bg-slate-50'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(null)
                setQuery('')
                setOpen(false)
              }}
            >
              — Без блюда —
            </button>
            {filtered.map((d) => (
              <button
                key={d.id}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-slate-50',
                  d.id === value && 'bg-slate-50'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(d.id)
                  setQuery(d.name)
                  setOpen(false)
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200 p-2 flex justify-end">
            <button
              className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
