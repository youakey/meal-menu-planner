import React from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { ru } from 'date-fns/locale'
import { cn } from '../lib/utils'

const dayPickerClassNames = {
  root: 'text-amber-50',
  months: 'flex flex-col gap-4',
  month: 'space-y-3',
  month_caption: 'flex items-center justify-center px-2 py-1 text-sm font-semibold text-amber-50',
  nav: 'flex items-center justify-between',
  button_previous:
    'rounded-xl border border-white/10 bg-white/5 p-1.5 text-amber-100/70 hover:bg-white/10 transition-colors',
  button_next:
    'rounded-xl border border-white/10 bg-white/5 p-1.5 text-amber-100/70 hover:bg-white/10 transition-colors',
  chevron: 'h-4 w-4 fill-current',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'w-9 text-center text-xs font-medium uppercase text-amber-100/40',
  weeks: 'flex flex-col gap-1 mt-1',
  week: 'flex',
  day: 'p-0.5',
  day_button:
    'flex h-8 w-8 items-center justify-center rounded-xl text-sm text-amber-100/80 transition-colors hover:bg-white/10',
  today: '[&_button]:border [&_button]:border-amber-300/40',
  selected: '[&_button]:bg-gradient-to-r [&_button]:from-amber-400 [&_button]:to-orange-500 [&_button]:text-[#20150f] [&_button]:font-semibold',
  range_start: '[&_button]:bg-gradient-to-r [&_button]:from-amber-400 [&_button]:to-orange-500 [&_button]:text-[#20150f] [&_button]:font-semibold',
  range_end: '[&_button]:bg-gradient-to-r [&_button]:from-amber-400 [&_button]:to-orange-500 [&_button]:text-[#20150f] [&_button]:font-semibold',
  range_middle: '[&_button]:bg-amber-400/15 [&_button]:text-amber-50',
  outside: '[&_button]:text-amber-100/20',
  disabled: '[&_button]:text-amber-100/15 [&_button]:pointer-events-none',
}

export function CalendarRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  className?: string
}) {
  return (
    <div className={cn('glass-input inline-block p-3', className)}>
      <DayPicker
        mode="range"
        locale={ru}
        selected={value}
        onSelect={onChange}
        weekStartsOn={1}
        classNames={dayPickerClassNames}
      />
    </div>
  )
}

export function CalendarMultiPicker({
  value,
  onChange,
  className,
}: {
  value: Date[]
  onChange: (dates: Date[] | undefined) => void
  className?: string
}) {
  return (
    <div className={cn('glass-input inline-block p-3', className)}>
      <DayPicker
        mode="multiple"
        locale={ru}
        selected={value}
        onSelect={onChange}
        weekStartsOn={1}
        classNames={dayPickerClassNames}
      />
    </div>
  )
}
