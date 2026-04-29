import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, PencilLine, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import {
  addMenuEntry,
  deleteMenuEntry,
  deleteMenuEvent,
  fetchDishIngredients,
  fetchDishes,
  fetchIngredientProducts,
  fetchMenuEntries,
  fetchMenuEvents,
  upsertCartItem,
  upsertMenuEvent,
  updateMenuEntry,
} from '../lib/api'
import type { DishIngredient, DishUsageUnit, IngredientProduct, MealType, MenuEntry, MenuItemType } from '../lib/types'
import { cn, formatQty, matchesSearchTokens, mealTypeLabel, shortWeekdayLabel, weekdayLabel } from '../lib/utils'

const weekdays = [1, 2, 3, 4, 5, 6, 7]
const mealSections: MealType[] = ['breakfast', 'lunch', 'dinner', 'late_snack']

export function MenuPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const [weekday, setWeekday] = React.useState<number>(1)
  const [mode, setMode] = React.useState<'view' | 'edit'>('view')
  const [selectedEventId, setSelectedEventId] = React.useState<string>('')

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const dishIngredientsQ = useQuery({
    queryKey: ['dish_ingredients_all'],
    queryFn: () => fetchDishIngredients(undefined),
  })
  const eventsQ = useQuery({ queryKey: ['menu_events'], queryFn: fetchMenuEvents })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })
  const ingredientProductsQ = useQuery({ queryKey: ['ingredient_products'], queryFn: fetchIngredientProducts })

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

  const createEventMut = useMutation({
    mutationFn: (name: string) =>
      upsertMenuEvent({
        name,
        is_default: (eventsQ.data?.length ?? 0) === 0,
      }),
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: ['menu_events'] })
      setSelectedEventId(event.id)
      toast.push('Мероприятие добавлено.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка создания мероприятия.', 'error'),
  })

  const deleteEventMut = useMutation({
    mutationFn: deleteMenuEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_events'] })
      qc.invalidateQueries({ queryKey: ['menu_entries'] })
      toast.push('Мероприятие удалено.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления мероприятия.', 'error'),
  })

  const addMut = useMutation({
    mutationFn: ({ mealType, itemType }: { mealType: MealType; itemType: MenuItemType }) => {
      if (!selectedEventId) throw new Error('Сначала создайте или выберите мероприятие.')
      return addMenuEntry({
        event_id: selectedEventId,
        weekday,
        meal_type: mealType,
        dish_id: null,
        portions: 1,
        variant_name: null,
        ingredient_id: null,
        item_type: itemType,
      })
    },
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
      const itemType = entry.item_type ?? 'dish'
      if (itemType === 'ingredient') {
        if (!entry.ingredient_id) throw new Error('Сначала выберите ингредиент.')
        const ing = entry.ingredient ?? (ingredientProductsQ.data ?? []).find((p) => p.id === entry.ingredient_id)
        return upsertCartItem({
          item_kind: 'ingredient',
          ingredient_id: entry.ingredient_id,
          quantity: entry.portions,
          quantity_unit: (ing?.package_unit === 'kg' ? 'g' : ing?.package_unit === 'l' ? 'ml' : ing?.package_unit ?? 'g') as DishUsageUnit,
          source_menu_entry_id: entry.id,
          title_override: ing?.name ?? null,
        })
      }
      if (!entry.dish_id) throw new Error('Сначала выберите блюдо.')
      const dish = (dishesQ.data ?? []).find((row) => row.id === entry.dish_id)
      return upsertCartItem({
        item_kind: 'dish',
        dish_id: entry.dish_id,
        portions: entry.portions,
        source_menu_entry_id: entry.id,
        title_override: dish?.name ?? null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart_items'] })
      toast.push('Добавлено в корзину.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка добавления в корзину.', 'error'),
  })

  const events = eventsQ.data ?? []
  const dishes = React.useMemo(
    () => [...(dishesQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [dishesQ.data]
  )
  const menu = (menuQ.data ?? []).filter(
    (row) => row.event_id === selectedEventId && row.weekday === weekday
  )

  const dishIngredientsByDish = React.useMemo(() => {
    const map = new Map<string, DishIngredient[]>()
    for (const row of dishIngredientsQ.data ?? []) {
      const arr = map.get(row.dish_id) ?? []
      arr.push(row)
      map.set(row.dish_id, arr)
    }
    return map
  }, [dishIngredientsQ.data])

  function onCreateEvent() {
    const name = window.prompt('Название мероприятия')
    if (!name?.trim()) return
    createEventMut.mutate(name.trim())
  }

  function onDeleteCurrentEvent() {
    const current = events.find((e) => e.id === selectedEventId)
    if (!current) return
    if (!window.confirm(`Удалить мероприятие «${current.name}»?`)) return
    deleteEventMut.mutate(current.id)
  }

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

        <div className="mt-5">
          <div className="mb-2 text-sm text-amber-100/70">Мероприятия</div>
          <div className="flex flex-wrap gap-2">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={
                  selectedEventId === event.id
                    ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-[#20150f]'
                    : 'rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-amber-50 hover:bg-white/10'
                }
              >
                {event.name}
              </button>
            ))}

            {mode === 'edit' && (
              <>
                <button className="btn-secondary px-4 py-2.5" onClick={onCreateEvent}>
                  <Plus size={16} />
                  Добавить мероприятие
                </button>
                {selectedEventId && events.length > 1 && (
                  <button className="btn-danger px-4 py-2.5" onClick={onDeleteCurrentEvent}>
                    Удалить мероприятие
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2">
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary self-start px-4 py-2.5"
                      onClick={() => addMut.mutate({ mealType, itemType: 'dish' })}
                    >
                      <Plus size={16} />
                      Блюдо
                    </button>
                    <button
                      className="btn-secondary self-start px-4 py-2.5"
                      onClick={() => addMut.mutate({ mealType, itemType: 'ingredient' })}
                    >
                      <Plus size={16} />
                      Ингредиент
                    </button>
                  </div>
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
                    ingredientProducts={ingredientProductsQ.data ?? []}
                    dishIngredientsByDish={dishIngredientsByDish}
                    onChangeDish={(dishId) =>
                      updateMut.mutate({ id: entry.id, patch: { dish_id: dishId || null } })
                    }
                    onChangeIngredient={(ingredientId) =>
                      updateMut.mutate({ id: entry.id, patch: { ingredient_id: ingredientId || null } })
                    }
                    onChangePortions={(portions) =>
                      updateMut.mutate({ id: entry.id, patch: { portions } })
                    }
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
  ingredientProducts,
  dishIngredientsByDish,
  onChangeDish,
  onChangeIngredient,
  onChangePortions,
  onDelete,
  onAddToCart,
}: {
  entry: MenuEntry
  mode: 'view' | 'edit'
  dishes: Array<{ id: string; name: string }>
  ingredientProducts: IngredientProduct[]
  dishIngredientsByDish: Map<string, DishIngredient[]>
  onChangeDish: (dishId: string) => void
  onChangeIngredient: (ingredientId: string) => void
  onChangePortions: (portions: number) => void
  onDelete: () => void
  onAddToCart: () => void
}) {
  const itemType = entry.item_type ?? 'dish'
  const selectedDish = dishes.find((row) => row.id === entry.dish_id)
  const selectedIngredient = entry.ingredient ?? ingredientProducts.find((p) => p.id === entry.ingredient_id)
  const ingredientsPreview = buildIngredientsPreview(entry, dishIngredientsByDish)

  const typeLabel = itemType === 'ingredient' ? 'Ингредиент' : 'Блюдо'
  const titleText =
    itemType === 'ingredient'
      ? (selectedIngredient?.name ?? 'Ингредиент не выбран')
      : (selectedDish?.name ?? 'Блюдо не выбрано')

  if (mode === 'view') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/10 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-xs font-medium uppercase tracking-widest text-amber-400/60">
              {typeLabel}
            </div>
            <div className="text-lg font-semibold text-amber-50">{titleText}</div>
            <div className="mt-1 text-sm text-amber-100/60">
              {itemType === 'ingredient' ? `Количество: ${entry.portions}` : `Порций: ${entry.portions}`}
            </div>
            {itemType === 'dish' && (
              <div className="mt-3">
                <div className="mb-1 text-sm text-amber-100/70">Ингредиенты</div>
                <div className="text-sm leading-7 text-amber-100/60">
                  {ingredientsPreview.length ? (
                    ingredientsPreview.map((line, idx) => <div key={idx}>{line}</div>)
                  ) : (
                    'Нет ингредиентов'
                  )}
                </div>
              </div>
            )}
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
      <div className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-400/60">{typeLabel}</div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_180px_auto]">
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">
            {itemType === 'ingredient' ? 'Ингредиент' : 'Блюдо'}
          </label>
          {itemType === 'ingredient' ? (
            <SearchableIngredientProductSelect
              ingredientProducts={ingredientProducts}
              value={entry.ingredient_id ?? ''}
              onChange={onChangeIngredient}
            />
          ) : (
            <SearchableDishSelect
              dishes={dishes}
              value={entry.dish_id ?? ''}
              onChange={onChangeDish}
            />
          )}
          <div className="mt-2 text-xs text-amber-100/45">
            {titleText} • {entry.portions} {itemType === 'ingredient' ? 'ед.' : 'порц.'}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">
            {itemType === 'ingredient' ? 'Количество' : 'Порции'}
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={entry.portions}
            onChange={(e) => onChangePortions(Number(e.target.value || 0))}
            className="glass-input w-full"
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
    </div>
  )
}

function SearchableDishSelect({
  dishes,
  value,
  onChange,
}: {
  dishes: Array<{ id: string; name: string }>
  value: string
  onChange: (dishId: string) => void
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const selected = dishes.find((item) => item.id === value) ?? null

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(selected?.name ?? '')

  React.useEffect(() => {
    if (!open) setQuery(selected?.name ?? '')
  }, [selected?.id, selected?.name, open])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selected?.name ?? '')
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [selected?.name])

  const filtered = dishes.filter((dish) => matchesSearchTokens(dish.name, query)).slice(0, 50)

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="glass-input w-full"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        placeholder="Начните вводить название блюда"
      />

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-80 overflow-auto rounded-2xl border border-white/10 bg-[#18121d]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-amber-100/50">Ничего не найдено.</div>
          )}

          {filtered.map((dish) => (
            <button
              key={dish.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(dish.id)
                setQuery(dish.name)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors',
                dish.id === value
                  ? 'bg-amber-400/15 text-amber-50'
                  : 'text-amber-100/75 hover:bg-white/5 hover:text-amber-50'
              )}
            >
              {dish.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchableIngredientProductSelect({
  ingredientProducts,
  value,
  onChange,
}: {
  ingredientProducts: IngredientProduct[]
  value: string
  onChange: (id: string) => void
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const sorted = React.useMemo(
    () => [...ingredientProducts].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [ingredientProducts]
  )
  const selected = sorted.find((p) => p.id === value) ?? null

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(selected?.name ?? '')

  React.useEffect(() => {
    if (!open) setQuery(selected?.name ?? '')
  }, [selected?.id, selected?.name, open])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selected?.name ?? '')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [selected?.name])

  const filtered = sorted.filter((p) => matchesSearchTokens(p.name, query)).slice(0, 50)

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="glass-input w-full"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        placeholder="Начните вводить ингредиент"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-80 overflow-auto rounded-2xl border border-white/10 bg-[#18121d]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-amber-100/50">Ничего не найдено.</div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(p.id); setQuery(p.name); setOpen(false) }}
              className={cn(
                'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors',
                p.id === value ? 'bg-amber-400/15 text-amber-50' : 'text-amber-100/75 hover:bg-white/5 hover:text-amber-50'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function buildIngredientsPreview(
  entry: MenuEntry,
  dishIngredientsByDish: Map<string, DishIngredient[]>
): string[] {
  if ((entry.item_type ?? 'dish') === 'ingredient') return []
  if (!entry.dish_id) return []
  const rows = dishIngredientsByDish.get(entry.dish_id) ?? []
  return rows.map((row) => {
    const qty = Number(row.quantity_per_portion ?? 0) * Number(entry.portions ?? 0)
    const ingredientName = row.ingredient?.name ?? 'Ингредиент'
    return `${ingredientName} — ${formatQty(qty, row.usage_unit)}`
  })
}
