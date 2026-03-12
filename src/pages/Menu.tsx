import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { addMenuEntry, deleteMenuEntry, fetchDishes, fetchMenuEntries, updateMenuEntry } from '../lib/api'
import type { MealType, MenuEntry } from '../lib/types'

const weekdays = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
]

const mealSections: Array<{ key: MealType; title: string }> = [
  { key: 'breakfast', title: 'Завтрак' },
  { key: 'lunch', title: 'Обед' },
  { key: 'dinner', title: 'Ужин' },
  { key: 'late_snack', title: 'Перекусывание' },
]

export function MenuPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const [weekday, setWeekday] = React.useState<number>(1)

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })

  const addMut = useMutation({
    mutationFn: (mealType: MealType) =>
      addMenuEntry({
        weekday,
        meal_type: mealType,
        dish_id: null,
        portions: 1,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_entries'] })
      toast.push('Блюдо добавлено в меню.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка добавления.', 'error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<MenuEntry> }) => updateMenuEntry(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_entries'] })
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка обновления.', 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteMenuEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_entries'] })
      toast.push('Позиция удалена.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления.', 'error'),
  })

  const allEntries = menuQ.data ?? []
  const dishes = dishesQ.data ?? []
  const entriesByMeal = new Map<MealType, MenuEntry[]>()

  for (const section of mealSections) {
    entriesByMeal.set(section.key, [])
  }

  for (const entry of allEntries) {
    if (entry.weekday !== weekday) continue
    const arr = entriesByMeal.get(entry.meal_type) ?? []
    arr.push(entry)
    entriesByMeal.set(entry.meal_type, arr)
  }

  return (
    <Layout title="Планировщик меню">
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-subtitle">Пн–Пт • 4 приема пищи</div>
            <div className="section-title mt-1">Планировщик меню</div>
          </div>

          <button className="btn-secondary self-start">Готово</button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {weekdays.map((day) => (
            <button
              key={day.value}
              onClick={() => setWeekday(day.value)}
              className={
                weekday === day.value
                  ? 'inline-flex h-12 min-w-[52px] items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-sm font-semibold text-[#20150f] shadow-[0_10px_26px_rgba(251,191,36,0.25)] transition-all duration-300'
                  : 'inline-flex h-12 min-w-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-amber-50 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10'
              }
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {mealSections.map((section) => (
          <MealSectionCard
            key={section.key}
            title={section.title}
            entries={entriesByMeal.get(section.key) ?? []}
            dishes={dishes}
            onAdd={() => addMut.mutate(section.key)}
            onChangeDish={(id, dishId) =>
              updateMut.mutate({
                id,
                patch: { dish_id: dishId || null },
              })
            }
            onChangePortions={(id, portions) =>
              updateMut.mutate({
                id,
                patch: { portions },
              })
            }
            onDelete={(id) => deleteMut.mutate(id)}
          />
        ))}
      </div>
    </Layout>
  )
}

function MealSectionCard({
  title,
  entries,
  dishes,
  onAdd,
  onChangeDish,
  onChangePortions,
  onDelete,
}: {
  title: string
  entries: MenuEntry[]
  dishes: Array<{ id: string; name: string }>
  onAdd: () => void
  onChangeDish: (id: string, dishId: string) => void
  onChangePortions: (id: string, portions: number) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="glass-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-semibold text-amber-50">{title}</div>
        </div>

        <button onClick={onAdd} className="btn-primary self-start">
          + Добавить блюдо
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {entries.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-amber-100/60">
            Пока пусто. Нажмите «Добавить блюдо».
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-3xl border border-white/10 bg-black/10 p-4 transition-all duration-300 hover:border-amber-300/20 hover:bg-white/[0.04]"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_160px_120px]">
              <div>
                <label className="mb-2 block text-sm text-amber-100/70">Выберите блюдо</label>
                <select
                  value={entry.dish_id ?? ''}
                  onChange={(e) => onChangeDish(entry.id, e.target.value)}
                  className="glass-input w-full"
                >
                  <option value="" className="bg-[#18161b]">
                    Выберите блюдо из каталога
                  </option>
                  {dishes.map((dish) => (
                    <option key={dish.id} value={dish.id} className="bg-[#18161b]">
                      {dish.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-amber-100/45">Выберите блюдо из каталога.</div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-amber-100/70">Кол-во порций</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={entry.portions}
                  onChange={(e) => onChangePortions(entry.id, Number(e.target.value || 0))}
                  className="glass-input w-full"
                />
                <div className="mt-2 text-xs text-amber-100/45">Можно дробное (например 1.5)</div>
              </div>

              <div className="flex items-end">
                <button onClick={() => onDelete(entry.id)} className="btn-danger w-full">
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
