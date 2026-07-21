import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import {
  fetchDishIngredients,
  fetchDishes,
  fetchIngredientProducts,
  fetchMenuEntries,
  fetchMenuEventDays,
  fetchMenuEventMealTypes,
  fetchMenuEvents,
} from '../lib/api'
import { computeGrandTotal, computeTotals } from '../lib/calculations'
import {
  buildDailyBreakdownFilename,
  buildMenuFilename,
  buildShoppingFilename,
  exportDailyBreakdownDocx,
  exportMenuDocx,
  exportShoppingListDocx,
} from '../lib/docxExport'
import type { MenuEventDay, MenuEventMealType } from '../lib/types'
import { formatQty, formatRub, mealTypeLabel, shortWeekdayLabel } from '../lib/utils'

const weekdays = [1, 2, 3, 4, 5, 6, 7]

const FALLBACK_DAYS: MenuEventDay[] = weekdays.map((idx) => ({
  id: `fallback-${idx}`,
  event_id: '',
  day_index: idx,
  calendar_date: null,
  created_at: '',
}))

const FALLBACK_MEAL_TYPES: MenuEventMealType[] = [
  { id: 'fallback-breakfast', event_id: '', key: 'breakfast', label: 'Завтрак', sort_order: 0, created_at: '' },
  { id: 'fallback-lunch', event_id: '', key: 'lunch', label: 'Обед', sort_order: 1, created_at: '' },
  { id: 'fallback-dinner', event_id: '', key: 'dinner', label: 'Ужин', sort_order: 2, created_at: '' },
  { id: 'fallback-late_snack', event_id: '', key: 'late_snack', label: 'Полдник', sort_order: 3, created_at: '' },
]

export function SummaryPage() {
  const [mode, setMode] = React.useState<'week' | 'day'>('week')
  const [weekday, setWeekday] = React.useState<number>(1)
  const [selectedEventId, setSelectedEventId] = React.useState<string>('')
  const [mealFilter, setMealFilter] = React.useState<'all' | 'breakfast' | 'lunch' | 'dinner'>('all')
  const [exporting, setExporting] = React.useState<'menu' | 'shopping' | 'breakdown' | null>(null)

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const ingsQ = useQuery({
    queryKey: ['dish_ingredients_all'],
    queryFn: () => fetchDishIngredients(undefined),
  })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })
  const eventsQ = useQuery({ queryKey: ['menu_events'], queryFn: fetchMenuEvents })
  const ingredientProductsQ = useQuery({ queryKey: ['ingredient_products'], queryFn: fetchIngredientProducts })
  const eventDaysQ = useQuery({
    queryKey: ['menu_event_days', selectedEventId],
    queryFn: () => fetchMenuEventDays(selectedEventId),
    enabled: !!selectedEventId,
  })
  const eventMealTypesQ = useQuery({
    queryKey: ['menu_event_meal_types', selectedEventId],
    queryFn: () => fetchMenuEventMealTypes(selectedEventId),
    enabled: !!selectedEventId,
  })

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
      ingredientProducts: ingredientProductsQ.data ?? [],
      eventId: selectedEventId || null,
      weekday: mode === 'day' ? weekday : null,
      mealType: mode === 'day' ? mealFilter : null,
    })
  }, [menuQ.data, dishesQ.data, ingsQ.data, ingredientProductsQ.data, mode, weekday, selectedEventId, mealFilter])

  const grand = computeGrandTotal(rows)
  const selectedEvent = (eventsQ.data ?? []).find((event) => event.id === selectedEventId) ?? null

  const filteredMenuEntries = React.useMemo(() => {
    return (menuQ.data ?? []).filter((entry) => {
      if (selectedEventId && entry.event_id !== selectedEventId) return false
      if (mode === 'day' && entry.weekday !== weekday) return false
      if (mode === 'day' && mealFilter !== 'all' && entry.meal_type !== mealFilter) return false
      return true
    })
  }, [menuQ.data, selectedEventId, mode, weekday, mealFilter])

  async function onExportMenu() {
    try {
      setExporting('menu')
      await exportMenuDocx({
        filename: buildMenuFilename(selectedEvent?.name ?? 'menu', mode, weekday),
        eventName: selectedEvent?.name ?? 'Мероприятие',
        mode,
        weekday,
        mealFilter,
        menuEntries: filteredMenuEntries,
        dishes: dishesQ.data ?? [],
        dishIngredients: ingsQ.data ?? [],
      })
    } finally {
      setExporting(null)
    }
  }

  async function onExportShopping() {
    try {
      setExporting('shopping')
      await exportShoppingListDocx({
        filename: buildShoppingFilename(selectedEvent?.name ?? 'shopping', mode, weekday),
        eventName: selectedEvent?.name ?? 'Мероприятие',
        mode,
        weekday,
        mealFilter,
        rows,
        grandTotal: grand,
      })
    } finally {
      setExporting(null)
    }
  }

  async function onExportBreakdown() {
    try {
      setExporting('breakdown')
      const days = eventDaysQ.data?.length ? eventDaysQ.data : FALLBACK_DAYS
      const mealTypesForExport = eventMealTypesQ.data?.length ? eventMealTypesQ.data : FALLBACK_MEAL_TYPES
      const eventEntries = (menuQ.data ?? []).filter(
        (entry) => !selectedEventId || entry.event_id === selectedEventId
      )
      await exportDailyBreakdownDocx({
        filename: buildDailyBreakdownFilename(selectedEvent?.name ?? 'menu'),
        eventName: selectedEvent?.name ?? 'Мероприятие',
        guestCount: selectedEvent?.guest_count ?? null,
        days,
        mealTypes: mealTypesForExport,
        menuEntries: eventEntries,
        dishes: dishesQ.data ?? [],
        dishIngredients: ingsQ.data ?? [],
        ingredientProducts: ingredientProductsQ.data ?? [],
      })
    } finally {
      setExporting(null)
    }
  }

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
            <>
              <div className="mt-4 grid grid-cols-7 gap-2">
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

              <div className="mt-4">
                <div className="mb-2 text-sm text-amber-100/70">Прием пищи</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMealFilter('all')}
                    className={
                      mealFilter === 'all'
                        ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-3 text-sm font-semibold text-[#20150f]'
                        : 'rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-amber-50'
                    }
                  >
                    Весь день
                  </button>
                  <button
                    onClick={() => setMealFilter('breakfast')}
                    className={
                      mealFilter === 'breakfast'
                        ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-3 text-sm font-semibold text-[#20150f]'
                        : 'rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-amber-50'
                    }
                  >
                    {mealTypeLabel('breakfast')}
                  </button>
                  <button
                    onClick={() => setMealFilter('lunch')}
                    className={
                      mealFilter === 'lunch'
                        ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-3 text-sm font-semibold text-[#20150f]'
                        : 'rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-amber-50'
                    }
                  >
                    {mealTypeLabel('lunch')}
                  </button>
                  <button
                    onClick={() => setMealFilter('dinner')}
                    className={
                      mealFilter === 'dinner'
                        ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-3 text-sm font-semibold text-[#20150f]'
                        : 'rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-amber-50'
                    }
                  >
                    {mealTypeLabel('dinner')}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <div className="text-sm text-amber-100/55">Общая стоимость</div>
            <div className="mt-2 text-3xl font-semibold text-amber-50">{formatRub(grand)}</div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button className="btn-secondary w-full" onClick={onExportMenu} disabled={exporting !== null}>
              {exporting === 'menu' ? 'Экспорт меню...' : 'Экспорт меню DOCX'}
            </button>
            <button className="btn-secondary w-full" onClick={onExportShopping} disabled={exporting !== null}>
              {exporting === 'shopping' ? 'Экспорт списка...' : 'Экспорт списка покупок DOCX'}
            </button>
            <button className="btn-primary w-full" onClick={onExportBreakdown} disabled={exporting !== null}>
              {exporting === 'breakdown' ? 'Экспорт по дням...' : 'Экспорт по дням (новый формат)'}
            </button>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="section-subtitle">Список ингредиентов</div>
          <div className="section-title mt-1">
            {mode === 'week'
              ? 'За всю неделю'
              : mealFilter === 'all'
                ? `За ${shortWeekdayLabel(weekday)}`
                : `${mealTypeLabel(mealFilter)} • ${shortWeekdayLabel(weekday)}`}
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
