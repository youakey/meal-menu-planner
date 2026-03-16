import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, PencilLine, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import {
  addMenuEntry,
  deleteMenuEntry,
  fetchDishes,
  fetchMenuEntries,
  upsertCartItem,
  updateMenuEntry,
} from '../lib/api'
import type { MealType, MenuEntry } from '../lib/types'
import { formatQty, mealTypeLabel, shortWeekdayLabel, weekdayLabel } from '../lib/utils'

const weekdays = [1, 2, 3, 4, 5]
const mealSections: MealType[] = ['breakfast', 'lunch', 'dinner', 'late_snack']

export function MenuPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [weekday, setWeekday] = React.useState<number>(1)
  const [mode, setMode] = React.useState<'view' | 'edit'>('view')

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })

  const addMut = useMutation({
    mutationFn: (mealType: MealType) =>
      addMenuEntry({
        weekday,
        meal_type: mealType,
        dish_id: null,
        portions: 1,
        variant_name: '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_entries'] })
      toast.push('Позиция добавлена в меню.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка добавления в меню.', 'error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<MenuEntry> }) => updateMenuEntry(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_entries'] }),
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

  const addToCartMut = useMutation({
    mutationFn: async (entry: MenuEntry) => {
      if (!entry.dish_id) throw new Error('Сначала выберите блюдо.')
      const dish = (dishesQ.data ?? []).find((row) => row.id === entry.dish_id)
      return upsertCartItem({
        item_kind: 'dish',
        dish_id: entry.dish_id,
        portions: entry.portions,
        source_menu_entry_id: entry.id,
        title_override: entry.variant_name?.trim()
          ? `${dish?.name ?? 'Блюдо'} — ${entry.variant_name.trim()}`
          : dish?.name ?? null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart_items'] })
      toast.push('Блюдо добавлено в корзину.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка добавления в корзину.', 'error'),
  })

  const dishes = dishesQ.data ?? []
  const menu = (menuQ.data ?? []).filter((row) => row.weekday === weekday)

  return (
    <Layout title="Меню недели">
      <div className="glass-card p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="section-subtitle">План на неделю</div>
            <div className="section-title mt-1">{weekdayLabel(weekday)}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={mode === 'view' ? 'btn-primary px-4 py-2.5' : 'btn-secondary px-4 py-2.5'}
              onClick={() => setMode('view')}
            >
              <Eye size={16} />
              Просмотр
            </button>
            <button
              className={mode === 'edit' ? 'btn-primary px-4 py-2.5' : 'btn-secondary px-4 py-2.5'}
              onClick={() => setMode('edit')}
            >
              <PencilLine size={16} />
              Редактирование
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          {weekdays.map((day) => (
            <button
              key={day}
              onClick={() => setWeekday(day)}
              className={
                weekday === day
                  ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-3 text-sm font-semibold text-[#20150f]'
                  : 'rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-sm font-medium text-amber-50 hover:bg-white/10'
              }
            >
              {shortWeekdayLabel(day)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {mealSections.map((mealType) => {
          const rows = menu.filter((entry) => entry.meal_type === mealType)
          return (
            <section key={mealType} className="glass-card p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xl font-semibold text-amber-50">{mealTypeLabel(mealType)}</div>
                {mode === 'edit' && (
                  <button className="btn-primary self-start px-4 py-2.5" onClick={() => addMut.mutate(mealType)}>
                    <Plus size={16} />
                    Добавить
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {rows.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-amber-100/55">
                    Для этого приема пищи блюд пока нет.
                  </div>
                )}

                {rows.map((entry) => (
                  <MenuEntryCard
                    key={entry.id}
                    entry={entry}
                    mode={mode}
                    dishes={dishes}
                    onChangeDish={(dishId) => updateMut.mutate({ id: entry.id, patch: { dish_id: dishId || null } })}
                    onChangePortions={(portions) => updateMut.mutate({ id: entry.id, patch: { portions } })}
                    onChangeVariant={(variant_name) => updateMut.mutate({ id: entry.id, patch: { variant_name } })}
                    onDelete={() => deleteMut.mutate(entry.id)}
                    onAddToCart={() => addToCartMut.mutate(entry)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </Layout>
  )
}

function MenuEntryCard({
  entry,
  mode,
  dishes,
  onChangeDish,
  onChangePortions,
  onChangeVariant,
  onDelete,
  onAddToCart,
}: {
  entry: MenuEntry
  mode: 'view' | 'edit'
  dishes: Array<{ id: string; name: string }>
  onChangeDish: (dishId: string) => void
  onChangePortions: (portions: number) => void
  onChangeVariant: (variant: string) => void
  onDelete: () => void
  onAddToCart: () => void
}) {
  const selectedDish = dishes.find((row) => row.id === entry.dish_id)

  if (mode === 'view') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/10 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-amber-50">{selectedDish?.name ?? 'Блюдо не выбрано'}</div>
            <div className="mt-1 text-sm text-amber-100/60">
              {entry.variant_name?.trim() ? `Вариация: ${entry.variant_name.trim()} • ` : ''}
              Порций: {entry.portions}
            </div>
          </div>
          <button className="btn-secondary self-start px-4 py-2.5" onClick={onAddToCart}>
            <ShoppingCart size={16} />
            В корзину
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-4 md:p-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_180px_1fr_auto]">
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Блюдо</label>
          <select value={entry.dish_id ?? ''} onChange={(e) => onChangeDish(e.target.value)} className="glass-input w-full">
            <option value="" className="bg-[#18161b]">Выберите блюдо</option>
            {dishes.map((dish) => (
              <option key={dish.id} value={dish.id} className="bg-[#18161b]">{dish.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Порции</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={entry.portions}
            onChange={(e) => onChangePortions(Number(e.target.value || 0))}
            className="glass-input w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Вариация</label>
          <input
            value={entry.variant_name ?? ''}
            onChange={(e) => onChangeVariant(e.target.value)}
            className="glass-input w-full"
            placeholder="Например: без сахара / детская / постная"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button className="btn-secondary px-3 py-3" onClick={onAddToCart} title="В корзину">
            <ShoppingCart size={16} />
          </button>
          <button className="btn-danger px-3 py-3" onClick={onDelete} title="Удалить">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs text-amber-100/45">
        Быстрый просмотр: {selectedDish?.name ?? 'не выбрано'} • {formatQty(entry.portions, 'pcs')} {entry.variant_name?.trim() ? `• ${entry.variant_name.trim()}` : ''}
      </div>
    </div>
  )
}
