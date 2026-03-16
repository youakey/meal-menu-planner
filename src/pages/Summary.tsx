import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { fetchDishIngredients, fetchDishes, fetchMenuEntries } from '../lib/api'
import { computeGrandTotal, computeTotals } from '../lib/calculations'
import { formatQty, formatRub, shortWeekdayLabel } from '../lib/utils'

const weekdays = [1, 2, 3, 4, 5]

export function SummaryPage() {
  const [mode, setMode] = React.useState<'week' | 'day'>('week')
  const [weekday, setWeekday] = React.useState<number>(1)

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const ingsQ = useQuery({ queryKey: ['dish_ingredients_all'], queryFn: () => fetchDishIngredients(undefined) })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })

  const rows = React.useMemo(() => {
    return computeTotals({
      menuEntries: menuQ.data ?? [],
      dishes: dishesQ.data ?? [],
      ingredients: ingsQ.data ?? [],
      weekday: mode === 'day' ? weekday : null,
    })
  }, [menuQ.data, dishesQ.data, ingsQ.data, mode, weekday])

  const grand = computeGrandTotal(rows)

  function downloadCsv() {
    const header = ['Ингредиент', 'Количество', 'Стоимость']
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push([safeCsv(r.ingredient_name), safeCsv(formatQty(r.total_quantity, r.display_unit)), String(r.total_cost.toFixed(2))].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = mode === 'week' ? 'summary-week.csv' : `summary-day-${weekday}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout title="Итоги">
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="glass-card p-6">
          <div className="section-subtitle">Период расчета</div>
          <div className="section-title mt-1">Фильтр итогов</div>

          <div className="mt-5 flex gap-2">
            <button className={mode === 'week' ? 'btn-primary flex-1' : 'btn-secondary flex-1'} onClick={() => setMode('week')}>
              За неделю
            </button>
            <button className={mode === 'day' ? 'btn-primary flex-1' : 'btn-secondary flex-1'} onClick={() => setMode('day')}>
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

          <button className="btn-secondary mt-4 w-full" onClick={downloadCsv}>
            Скачать CSV
          </button>
        </div>

        <div className="glass-card p-6">
          <div className="section-subtitle">Список ингредиентов</div>
          <div className="section-title mt-1">{mode === 'week' ? 'За всю неделю' : `За ${shortWeekdayLabel(weekday)}`}</div>

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
                      Пока нечего считать. Заполните меню.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={`${row.ingredient_id}:${row.display_unit}`} className="border-b border-white/5">
                    <td className="py-4 pr-4 font-medium text-amber-50">{row.ingredient_name}</td>
                    <td className="py-4 pr-4 text-amber-100/65">{formatQty(row.total_quantity, row.display_unit)}</td>
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

function safeCsv(v: string): string {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
