import React from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, PencilLine, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { EventFormModal } from '../components/EventFormModal'
import {
  addMenuEntry,
  deleteMenuEntry,
  deleteMenuEvent,
  fetchDishIngredients,
  fetchDishes,
  fetchIngredientProducts,
  fetchMenuEntries,
  fetchMenuEventDays,
  fetchMenuEventFolders,
  fetchMenuEventMealTypes,
  fetchMenuEvents,
  upsertCartItem,
  updateMenuEntry,
} from '../lib/api'
import type {
  DishIngredient,
  DishUsageUnit,
  IngredientProduct,
  MenuEntry,
  MenuEvent,
  MenuEventDay,
  MenuEventMealType,
  MenuItemType,
} from '../lib/types'
import { cn, formatQty, matchesSearchTokens, shortWeekdayLabel, weekdayLabel } from '../lib/utils'

const FALLBACK_DAYS: MenuEventDay[] = [1, 2, 3, 4, 5, 6, 7].map((idx) => ({
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

function dayTabLabel(day: MenuEventDay, short = true): string {
  if (day.calendar_date) {
    const date = new Date(day.calendar_date)
    return short ? format(date, 'dd.MM', { locale: ru }) : format(date, 'dd.MM.yy, EEEE', { locale: ru })
  }
  return short ? shortWeekdayLabel(day.day_index) : weekdayLabel(day.day_index)
}

export function MenuPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const [searchParams, setSearchParams] = useSearchParams()
  const dayIndex = Number(searchParams.get('day') ?? '1') || 1
  const mode: 'view' | 'edit' = searchParams.get('mode') === 'edit' ? 'edit' : 'view'
  const selectedEventId = searchParams.get('event') ?? ''
  const [eventModalOpen, setEventModalOpen] = React.useState(false)
  const [editingEvent, setEditingEvent] = React.useState<MenuEvent | null>(null)

  const setDayIndex = React.useCallback(
    (idx: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('day', String(idx))
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setMode = React.useCallback(
    (next: 'view' | 'edit') => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          params.set('mode', next)
          return params
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setSelectedEventId = React.useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('event', id)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const dishIngredientsQ = useQuery({
    queryKey: ['dish_ingredients_all'],
    queryFn: () => fetchDishIngredients(undefined),
  })
  const eventsQ = useQuery({ queryKey: ['menu_events'], queryFn: fetchMenuEvents })
  const foldersQ = useQuery({ queryKey: ['menu_event_folders'], queryFn: fetchMenuEventFolders })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })
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

  const days = eventDaysQ.data?.length ? eventDaysQ.data : FALLBACK_DAYS
  const mealTypes = eventMealTypesQ.data?.length ? eventMealTypesQ.data : FALLBACK_MEAL_TYPES

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

  React.useEffect(() => {
    if (!days.some((d) => d.day_index === dayIndex)) {
      setDayIndex(days[0]?.day_index ?? 1)
    }
  }, [days, dayIndex])

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
    mutationFn: ({ mealType, itemType }: { mealType: string; itemType: MenuItemType }) => {
      if (!selectedEventId) throw new Error('Сначала создайте или выберите мероприятие.')
      return addMenuEntry({
        event_id: selectedEventId,
        weekday: dayIndex,
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
  const menu = React.useMemo(
    () => (menuQ.data ?? []).filter((row) => row.event_id === selectedEventId && row.weekday === dayIndex),
    [menuQ.data, selectedEventId, dayIndex]
  )

  const entriesByMealType = React.useMemo(() => {
    const map = new Map<string, MenuEntry[]>()
    for (const entry of menu) {
      const arr = map.get(entry.meal_type) ?? []
      arr.push(entry)
      map.set(entry.meal_type, arr)
    }
    return map
  }, [menu])

  const onAddEntry = React.useCallback(
    (mealKey: string, itemType: MenuItemType) => addMut.mutate({ mealType: mealKey, itemType }),
    [addMut]
  )
  const onChangeEntryDish = React.useCallback(
    (entryId: string, dishId: string) => updateMut.mutate({ id: entryId, patch: { dish_id: dishId || null } }),
    [updateMut]
  )
  const onChangeEntryIngredient = React.useCallback(
    (entryId: string, ingredientId: string) =>
      updateMut.mutate({ id: entryId, patch: { ingredient_id: ingredientId || null } }),
    [updateMut]
  )
  const onChangeEntryPortions = React.useCallback(
    (entryId: string, portions: number) => updateMut.mutate({ id: entryId, patch: { portions } }),
    [updateMut]
  )
  const onDeleteEntry = React.useCallback((entryId: string) => deleteMut.mutate(entryId), [deleteMut])
  const onAddEntryToCart = React.useCallback((entry: MenuEntry) => addToCartMut.mutate(entry), [addToCartMut])

  const dishIngredientsByDish = React.useMemo(() => {
    const map = new Map<string, DishIngredient[]>()
    for (const row of dishIngredientsQ.data ?? []) {
      const arr = map.get(row.dish_id) ?? []
      arr.push(row)
      map.set(row.dish_id, arr)
    }
    return map
  }, [dishIngredientsQ.data])

  function onDeleteCurrentEvent() {
    const current = events.find((e) => e.id === selectedEventId)
    if (!current) return
    if (!window.confirm(`Удалить мероприятие «${current.name}»?`)) return
    deleteEventMut.mutate(current.id)
  }

  const folders = foldersQ.data ?? []
  const eventsByFolder = new Map<string, MenuEvent[]>()
  const unfiledEvents: MenuEvent[] = []
  for (const event of events) {
    if (event.folder_id) {
      const arr = eventsByFolder.get(event.folder_id) ?? []
      arr.push(event)
      eventsByFolder.set(event.folder_id, arr)
    } else {
      unfiledEvents.push(event)
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null
  const selectedDay = days.find((d) => d.day_index === dayIndex) ?? days[0]

  function eventChip(event: MenuEvent) {
    return (
      <div key={event.id} className="flex items-center gap-1">
        <button
          onClick={() => setSelectedEventId(event.id)}
          className={
            selectedEventId === event.id
              ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-[#20150f]'
              : 'rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-amber-50 hover:bg-white/10'
          }
        >
          {event.name}
        </button>
        {mode === 'edit' && (
          <button
            className="btn-secondary px-2.5 py-2.5"
            title="Редактировать мероприятие"
            onClick={() => {
              setEditingEvent(event)
              setEventModalOpen(true)
            }}
          >
            <PencilLine size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <Layout title="Меню недели">
      <div className="glass-card p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="section-subtitle">{selectedEvent?.name ?? 'Мероприятие'}</div>
            <div className="section-title mt-1">{selectedDay ? dayTabLabel(selectedDay, false) : ''}</div>
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
          <div className="grid gap-3">
            {folders.map((folder) => {
              const folderEvents = eventsByFolder.get(folder.id) ?? []
              if (!folderEvents.length) return null
              return (
                <div key={folder.id}>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-widest text-amber-100/40">
                    {folder.name}
                  </div>
                  <div className="flex flex-wrap gap-2">{folderEvents.map(eventChip)}</div>
                </div>
              )
            })}

            {unfiledEvents.length > 0 && (
              <div>
                {folders.length > 0 && (
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-widest text-amber-100/40">
                    Без папки
                  </div>
                )}
                <div className="flex flex-wrap gap-2">{unfiledEvents.map(eventChip)}</div>
              </div>
            )}

            {mode === 'edit' && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary px-4 py-2.5"
                  onClick={() => {
                    setEditingEvent(null)
                    setEventModalOpen(true)
                  }}
                >
                  <Plus size={16} />
                  Добавить мероприятие
                </button>
                {selectedEventId && events.length > 1 && (
                  <button className="btn-danger px-4 py-2.5" onClick={onDeleteCurrentEvent}>
                    Удалить мероприятие
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {days.map((day) => (
            <button
              key={day.id}
              onClick={() => setDayIndex(day.day_index)}
              className={
                dayIndex === day.day_index
                  ? 'rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-3 text-sm font-semibold text-[#20150f]'
                  : 'rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-sm font-medium text-amber-50 hover:bg-white/10'
              }
            >
              {dayTabLabel(day)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {mealTypes.map((mt) => (
          <MealSection
            key={mt.id}
            mealType={mt}
            rows={entriesByMealType.get(mt.key) ?? EMPTY_ROWS}
            mode={mode}
            dishes={dishes}
            ingredientProducts={ingredientProductsQ.data ?? []}
            dishIngredientsByDish={dishIngredientsByDish}
            onAdd={onAddEntry}
            onChangeDish={onChangeEntryDish}
            onChangeIngredient={onChangeEntryIngredient}
            onChangePortions={onChangeEntryPortions}
            onDelete={onDeleteEntry}
            onAddToCart={onAddEntryToCart}
          />
        ))}
      </div>

      <EventFormModal
        open={eventModalOpen}
        initial={editingEvent}
        onClose={() => {
          setEventModalOpen(false)
          setEditingEvent(null)
          qc.invalidateQueries({ queryKey: ['menu_event_days', selectedEventId] })
          qc.invalidateQueries({ queryKey: ['menu_event_meal_types', selectedEventId] })
        }}
      />
    </Layout>
  )
}

const EMPTY_ROWS: MenuEntry[] = []

const MealSection = React.memo(function MealSection({
  mealType,
  rows,
  mode,
  dishes,
  ingredientProducts,
  dishIngredientsByDish,
  onAdd,
  onChangeDish,
  onChangeIngredient,
  onChangePortions,
  onDelete,
  onAddToCart,
}: {
  mealType: MenuEventMealType
  rows: MenuEntry[]
  mode: 'view' | 'edit'
  dishes: Array<{ id: string; name: string }>
  ingredientProducts: IngredientProduct[]
  dishIngredientsByDish: Map<string, DishIngredient[]>
  onAdd: (mealKey: string, itemType: MenuItemType) => void
  onChangeDish: (entryId: string, dishId: string) => void
  onChangeIngredient: (entryId: string, ingredientId: string) => void
  onChangePortions: (entryId: string, portions: number) => void
  onDelete: (entryId: string) => void
  onAddToCart: (entry: MenuEntry) => void
}) {
  return (
    <section className="glass-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-xl font-semibold text-amber-50">{mealType.label}</div>
        {mode === 'edit' && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary self-start px-4 py-2.5" onClick={() => onAdd(mealType.key, 'dish')}>
              <Plus size={16} />
              Блюдо
            </button>
            <button
              className="btn-secondary self-start px-4 py-2.5"
              onClick={() => onAdd(mealType.key, 'ingredient')}
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
            ingredientProducts={ingredientProducts}
            dishIngredientsByDish={dishIngredientsByDish}
            onChangeDish={(dishId) => onChangeDish(entry.id, dishId)}
            onChangeIngredient={(ingredientId) => onChangeIngredient(entry.id, ingredientId)}
            onChangePortions={(portions) => onChangePortions(entry.id, portions)}
            onDelete={() => onDelete(entry.id)}
            onAddToCart={() => onAddToCart(entry)}
          />
        ))}
      </div>
    </section>
  )
})

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

/**
 * Dropdown anchors are inside .glass-card sections, which use backdrop-blur — a
 * backdrop-filter ancestor becomes the containing block for position:fixed
 * descendants too (not just a stacking context), so a plain fixed+z-index child
 * still can't render above sibling cards. Portaling to document.body is the only
 * way out; this hook supplies the fixed-position coordinates for that portal.
 */
function useDropdownAnchorStyle(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>
): React.CSSProperties | undefined {
  const [style, setStyle] = React.useState<React.CSSProperties | undefined>(undefined)

  const recompute = React.useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    // Use the panel's real rendered height once mounted (it may hold just one
    // result) instead of assuming the worst case (max-h-[60vh]) — otherwise a
    // short list gets shoved far above the input to make room it never needs.
    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0
    let top = rect.bottom + margin
    if (panelHeight && top + panelHeight + margin > window.innerHeight) {
      top = Math.max(margin, window.innerHeight - panelHeight - margin)
    }

    setStyle({
      position: 'fixed',
      top,
      left: rect.left,
      width: rect.width,
    })
  }, [anchorRef, panelRef])

  React.useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined)
      return
    }

    recompute()
    // Second pass once the panel has actually mounted, so we can measure its
    // real height (the first pass above runs before it exists in the DOM).
    const raf = requestAnimationFrame(recompute)

    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [open, recompute])

  return style
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
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const selected = dishes.find((item) => item.id === value) ?? null

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(selected?.name ?? '')
  const dropdownStyle = useDropdownAnchorStyle(open, wrapperRef, panelRef)

  React.useEffect(() => {
    if (!open) setQuery(selected?.name ?? '')
  }, [selected?.id, selected?.name, open])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      // The panel is portaled to document.body, so it's outside wrapperRef's DOM
      // subtree — without this check every click on a result would look like an
      // "outside" click, closing the list before its onClick can fire.
      if (wrapperRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
      setQuery(selected?.name ?? '')
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [selected?.name])

  const filtered = dishes.filter((dish) => matchesSearchTokens(dish.name, query)).slice(0, 200)

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

      {open &&
        dropdownStyle &&
        createPortal(
          <div
            ref={panelRef}
            style={dropdownStyle}
            className="z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#18121d]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
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
          </div>,
          document.body
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
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const sorted = React.useMemo(
    () => [...ingredientProducts].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [ingredientProducts]
  )
  const selected = sorted.find((p) => p.id === value) ?? null

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(selected?.name ?? '')
  const dropdownStyle = useDropdownAnchorStyle(open, wrapperRef, panelRef)

  React.useEffect(() => {
    if (!open) setQuery(selected?.name ?? '')
  }, [selected?.id, selected?.name, open])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
      setQuery(selected?.name ?? '')
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [selected?.name])

  const filtered = sorted.filter((p) => matchesSearchTokens(p.name, query)).slice(0, 200)

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="glass-input w-full"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        placeholder="Начните вводить ингредиент"
      />
      {open &&
        dropdownStyle &&
        createPortal(
          <div
            ref={panelRef}
            style={dropdownStyle}
            className="z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#18121d]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
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
          </div>,
          document.body
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
