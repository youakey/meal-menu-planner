import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { fetchDishIngredients, fetchDishes, fetchMenuEntries, fetchMenuEvents } from '../lib/api'
import { computeGrandTotal, computeTotals } from '../lib/calculations'
import { formatQty, formatRub, shortWeekdayLabel } from '../lib/utils'

const weekdays = [1, 2, 3, 4, 5]

export function SummaryPage() {
  const [mode, setMode] = React.useState<'week' | 'day'>('week')
  const [weekday, setWeekday] = React.useState<number>(1)
  const [selectedEventId, setSelectedEventId] = React.useState<string>('')

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const ingsQ = useQuery({ queryKey: ['dish_ingredients_all'], queryFn: () => fetchDishIngredients(undefined) })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })
  const eventsQ = useQuery({ queryKey: ['menu_events'], queryFn: fetchMenuEvents })

  React.useEffect(() => {
    const events = eventsQ.data ?? []
    if (!events.length) {
      setSelectedEventId('')
      return
    }

    if (!selectedEventId || !events.some((e) => e.id === selectedEventId)) {
      const preferred = events.find((e) => e.is_default) ?? events[0]
      setSelectedEventId(preferred.id)
    }
  }, [eventsQ.data, selectedEventId])

  const rows = React.useMemo(() => {
    return computeTotals({
      menuEntries: menuQ.data ?? [],
      dishes: dishesQ.data ?? [],
      ingredients: ingsQ.data ?? [],
      eventId: selectedEventId || null,
      weekday: mode === 'day' ? weekday : null,
    })
  }, [menuQ.data, dishesQ.data, ingsQ.data, mode, weekday, selectedEventId])

  const grand = computeGrandTotal(rows)

  return (
    <Layout title="Итоги">
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="glass-card p-6">
          <div className="section-subtitle">Период расчета</div>
          <div className="section-title mt-1">Фильтр итогов</div>

          <div className="mt-5">
            <div className="mb-2 text-sm text-amber-100/70">Мероприятие</div>
            <div className="flex flex-wrap gap-2">
              {(eventsQ.data ?? []).map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={
                    selectedEventId === event.id
                      ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-[#20150f]'
                      : 'rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-amber-50'
                  }
                >
                  {event.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              className={mode === 'week' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              onClick={() => setMode('week')}
            >
              За неделю
            </button>
            <button
              className={mode === 'day' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              onClick={() => setMode('day')}
            >
              За день
            </button>
          </div>

          {mode === 'day' && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {weekdays.map((day) => (
                <button
                  key={day}
                  onClick={() => setWeekday(day)}
                  className={
                    weekday === day
                      ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-3 text-sm font-semibold text-[#20150f]'
                      : 'rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-sm font-medium text-amber-50'
                  }
                >
                  {shortWeekdayLabel(day)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <div className="text-sm text-amber-100/55">Общая стоимость</div>
            <div className="mt-2 text-3xl font-semibold text-amber-50">{formatRub(grand)}</div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="section-subtitle">Список ингредиентов</div>
          <div className="section-title mt-1">
            {mode === 'week' ? 'За всю неделю' : `За ${shortWeekdayLabel(weekday)}`}
          </div>

          <div className="mt-5 overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-amber-100/55">
                  <th className="pb-3 pr-4 font-medium">Ингредиент</th>
                  <th className="pb-3 pr-4 font-medium">Количество</th>
                  <th className="pb-3 pr-4 font-medium">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-amber-100/50">
                      Пока нечего считать.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={`${row.ingredient_id}:${row.display_unit}`} className="border-b border-white/5">
                    <td className="py-4 pr-4 font-medium text-amber-50">{row.ingredient_name}</td>
                    <td className="py-4 pr-4 text-amber-100/65">
                      {formatQty(row.total_quantity, row.display_unit)}
                    </td>
                    <td className="py-4 pr-4 text-amber-100/85">{formatRub(row.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
