import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { fetchDishIngredients, fetchDishes, fetchMenuEntries } from '../lib/api'
import { computeGrandTotal, computeTotals } from '../lib/calculations'
import { formatQty, formatRub } from '../lib/utils'

export function SummaryPage() {
  const toast = useToast()

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const ingsQ = useQuery({ queryKey: ['dish_ingredients_all'], queryFn: () => fetchDishIngredients(undefined) })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })

  const rows = React.useMemo(() => {
    return computeTotals({
      menuEntries: menuQ.data ?? [],
      dishes: dishesQ.data ?? [],
      ingredients: ingsQ.data ?? [],
    })
  }, [menuQ.data, dishesQ.data, ingsQ.data])

  const grand = computeGrandTotal(rows)

  async function copyToClipboard() {
    const text = rows
      .map((r) => `${r.ingredient_name}: ${formatQty(r.total_quantity, r.display_unit)} — ${formatRub(r.total_cost)}`)
      .concat([`Итого: ${formatRub(grand)}`])
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast.push('Скопировано в буфер обмена.', 'success')
    } catch {
      toast.push('Не удалось скопировать.', 'error')
    }
  }

  function downloadCsv() {
    const header = ['Ингредиент', 'Количество', 'Стоимость']
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [safeCsv(r.ingredient_name), safeCsv(formatQty(r.total_quantity, r.display_unit)), String(r.total_cost.toFixed(2))].join(',')
      )
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shopping-summary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout title="Итоги и покупки">
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="glass-card p-6">
          <div className="section-subtitle">Финальный расчет</div>
          <div className="section-title mt-1">Сумма недели</div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <div className="text-sm text-amber-100/55">Общая стоимость</div>
            <div className="mt-2 text-3xl font-semibold text-amber-50">{formatRub(grand)}</div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <button onClick={copyToClipboard} className="btn-primary">
              Копировать список
            </button>
            <button onClick={downloadCsv} className="btn-secondary">
              Скачать CSV
            </button>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="section-subtitle">Список покупок</div>
          <div className="section-title mt-1">Что нужно купить</div>

          <div className="mt-5 overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
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
                      Пока нечего считать. Добавьте блюда и заполните меню.
                    </td>
                  </tr>
                )}

                {rows.map((row) => (
                  <tr key={row.ingredient_id} className="border-b border-white/5">
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
