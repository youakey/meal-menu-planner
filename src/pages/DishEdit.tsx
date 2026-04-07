import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import {
  deleteDishIngredient,
  fetchDish,
  fetchDishIngredients,
  fetchIngredientProducts,
  upsertDish,
  upsertDishIngredient,
} from '../lib/api'
import { computeDishCostPerPortion } from '../lib/calculations'
import { cn, formatRub, matchesSearchTokens, round2 } from '../lib/utils'
import type { DishIngredient, DishUsageUnit, IngredientProduct } from '../lib/types'

export function DishEditPage() {
  const { dishId } = useParams()
  const id = dishId as string
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const dishQ = useQuery({ queryKey: ['dish', id], queryFn: () => fetchDish(id), enabled: !!id })
  const rowsQ = useQuery({
    queryKey: ['dish_ingredients', id],
    queryFn: () => fetchDishIngredients(id),
    enabled: !!id,
  })
  const ingredientsQ = useQuery({
    queryKey: ['ingredient_products'],
    queryFn: fetchIngredientProducts,
  })

  const [name, setName] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [toDeleteIng, setToDeleteIng] = React.useState<DishIngredient | null>(null)

  React.useEffect(() => {
    if (dishQ.data) {
      setName(dishQ.data.name)
      setNotes(dishQ.data.notes ?? '')
    }
  }, [dishQ.data?.id])

  const saveDishMut = useMutation({
    mutationFn: () =>
      upsertDish({
        id,
        name: name.trim() || 'Без названия',
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dishes'] })
      qc.invalidateQueries({ queryKey: ['dish', id] })
      toast.push('Блюдо сохранено.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка сохранения блюда.', 'error'),
  })

  const addRowMut = useMutation({
    mutationFn: async () => {
      const first = ingredientsQ.data?.[0]
      if (!first) throw new Error('Сначала добавьте хотя бы один ингредиент в базу.')
      return upsertDishIngredient({
        dish_id: id,
        ingredient_id: first.id,
        quantity_per_portion:
          first.kind === 'piece'
            ? 1
            : first.kind === 'volume' && first.package_unit === 'ml'
              ? 100
              : first.kind === 'volume'
                ? 0.1
                : 100,
        usage_unit: defaultUsageUnit(first),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dish_ingredients', id] })
      toast.push('Строка ингредиента добавлена.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка добавления ингредиента.', 'error'),
  })

  const delIngMut = useMutation({
    mutationFn: deleteDishIngredient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dish_ingredients', id] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      toast.push('Ингредиент удален из блюда.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления.', 'error'),
  })

  if (!id) return null

  const rows = rowsQ.data ?? []
  const ingredientOptions = ingredientsQ.data ?? []
  const dishCostPerPortion = computeDishCostPerPortion(rows)

  return (
    <Layout title="Редактирование блюда">
      <div className="sticky top-[72px] z-10 -mx-1 px-1 pb-4 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft size={16} />
            Назад
          </button>
          <Link to="/ingredients" className="btn-secondary">
            Перейти к базе ингредиентов
          </Link>
        </div>

        <div className="glass-card p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-amber-100/70">Название блюда</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input w-full"
                placeholder="Например: Венские вафли"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-amber-100/70">Заметки</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="glass-input w-full"
                placeholder="Например: семейный завтрак"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => saveDishMut.mutate()} className="btn-primary">
              Сохранить блюдо
            </button>
            <button onClick={() => addRowMut.mutate()} className="btn-secondary">
              <Plus size={16} />
              Добавить ингредиент
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="glass-card p-6">
          <div className="section-subtitle">Состав блюда</div>
          <div className="section-title mt-1">Ингредиенты на порцию</div>

          <div className="mt-5 grid gap-4">
            {rows.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-amber-100/55">
                Пока нет ингредиентов. Нажмите «Добавить ингредиент».
              </div>
            )}

            {rows.map((row) => (
              <DishIngredientRow
                key={row.id}
                row={row}
                ingredientOptions={ingredientOptions}
                onDelete={() => setToDeleteIng(row)}
              />
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="section-subtitle">Сводка</div>
          <div className="section-title mt-1">Стоимость блюда</div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <div className="text-sm text-amber-100/55">Стоимость на 1 порцию</div>
            <div className="mt-2 text-3xl font-semibold text-amber-50">{formatRub(dishCostPerPortion)}</div>
          </div>

          <div className="mt-5 text-sm leading-7 text-amber-100/60">
            Теперь блюдо не хранит собственную базу ингредиентов. Оно только ссылается на
            ингредиенты из общего каталога и знает, сколько каждого ингредиента нужно на одну
            порцию.
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDeleteIng}
        title="Удалить ингредиент из блюда?"
        description={toDeleteIng?.ingredient ? `Строка «${toDeleteIng.ingredient.name}» будет удалена.` : ''}
        onClose={() => setToDeleteIng(null)}
        onConfirm={() => {
          if (toDeleteIng) delIngMut.mutate(toDeleteIng.id)
        }}
      />
    </Layout>
  )
}

function DishIngredientRow({
  row,
  ingredientOptions,
  onDelete,
}: {
  row: DishIngredient
  ingredientOptions: IngredientProduct[]
  onDelete: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()

  const currentIngredient =
    row.ingredient ?? ingredientOptions.find((i) => i.id === row.ingredient_id) ?? null

  const [ingredientId, setIngredientId] = React.useState(row.ingredient_id)
  const [quantity, setQuantity] = React.useState(String(row.quantity_per_portion))
  const [usageUnit, setUsageUnit] = React.useState<DishUsageUnit>(row.usage_unit)

  React.useEffect(() => {
    setIngredientId(row.ingredient_id)
    setQuantity(String(row.quantity_per_portion))
    setUsageUnit(row.usage_unit)
  }, [row.id, row.ingredient_id, row.quantity_per_portion, row.usage_unit])

  const saveMut = useMutation({
    mutationFn: async () => {
      const selected = ingredientOptions.find((i) => i.id === ingredientId)
      if (!selected) throw new Error('Выберите ингредиент.')
      const qty = Number(quantity.replace(',', '.'))
      if (!isFinite(qty) || qty <= 0) throw new Error('Количество на порцию должно быть больше нуля.')

      return upsertDishIngredient({
        id: row.id,
        dish_id: row.dish_id,
        ingredient_id: selected.id,
        quantity_per_portion: qty,
        usage_unit: usageUnit,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dish_ingredients', row.dish_id] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      toast.push('Строка сохранена.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка сохранения.', 'error'),
  })

  const selectedIngredient = ingredientOptions.find((i) => i.id === ingredientId) ?? currentIngredient
  const currentCost = selectedIngredient
    ? estimateCost(selectedIngredient, Number(quantity.replace(',', '.')), usageUnit)
    : 0

  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_180px_180px_1fr_auto]">
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Ингредиент из базы</label>
          <SearchableIngredientSelect
            ingredients={ingredientOptions}
            value={ingredientId}
            onChange={(nextId) => {
              const nextIngredient = ingredientOptions.find((item) => item.id === nextId)
              setIngredientId(nextId)
              if (nextIngredient) {
                setUsageUnit(defaultUsageUnit(nextIngredient))
              }
            }}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Кол-во на порцию</label>
          <input
            className="glass-input w-full"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Единица</label>
          <select
            className="glass-input w-full"
            value={usageUnit}
            onChange={(e) => setUsageUnit(e.target.value as DishUsageUnit)}
          >
            {usageUnitOptions(selectedIngredient).map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#18161b]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Стоимость на порцию</label>
          <div className="glass-input flex min-h-[50px] items-center justify-between">
            <span className="text-amber-100/60">
              {selectedIngredient ? `${quantity || 0} ${unitLabel(usageUnit)}` : '—'}
            </span>
            <b>{formatRub(currentCost)}</b>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button className="btn-danger px-3 py-3" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
          <button className="btn-primary px-4 py-3" onClick={() => saveMut.mutate()}>
            Сохранить
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs text-amber-100/45">
        {selectedIngredient
          ? `${selectedIngredient.name} • ${selectedIngredient.package_amount} ${ingredientUnitLabel(
              selectedIngredient.package_unit
            )} за ${formatRub(selectedIngredient.package_price)}`
          : 'Выберите ингредиент из базы.'}
      </div>
    </div>
  )
}

function SearchableIngredientSelect({
  ingredients,
  value,
  onChange,
}: {
  ingredients: IngredientProduct[]
  value: string
  onChange: (id: string) => void
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const sortedIngredients = React.useMemo(
    () => [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [ingredients]
  )
  const selected = sortedIngredients.find((item) => item.id === value) ?? null

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

  const filtered = sortedIngredients.filter((item) => matchesSearchTokens(item.name, query)).slice(0, 50)

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
        placeholder="Начните вводить ингредиент"
      />

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-[#18121d]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-amber-100/50">Ничего не найдено.</div>
          )}

          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(item.id)
                setQuery(item.name)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors',
                item.id === value
                  ? 'bg-amber-400/15 text-amber-50'
                  : 'text-amber-100/75 hover:bg-white/5 hover:text-amber-50'
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function defaultUsageUnit(ingredient: IngredientProduct): DishUsageUnit {
  if (ingredient.kind === 'piece') return 'pcs'
  if (ingredient.kind === 'volume') return ingredient.package_unit === 'ml' ? 'ml' : 'l'
  return 'g'
}

function usageUnitOptions(
  ingredient: IngredientProduct | null | undefined
): Array<{ value: DishUsageUnit; label: string }> {
  if (!ingredient) return [{ value: 'g', label: 'г' }]
  if (ingredient.kind === 'piece') return [{ value: 'pcs', label: 'шт' }]
  if (ingredient.kind === 'volume') {
    return [
      { value: 'l', label: 'л' },
      { value: 'ml', label: 'мл' },
    ]
  }
  return [{ value: 'g', label: 'г' }]
}

function ingredientUnitLabel(unit: string) {
  if (unit === 'kg') return 'кг'
  if (unit === 'g') return 'г'
  if (unit === 'pcs') return 'шт'
  if (unit === 'ml') return 'мл'
  return 'л'
}

function unitLabel(unit: DishUsageUnit) {
  if (unit === 'pcs') return 'шт'
  if (unit === 'l') return 'л'
  if (unit === 'ml') return 'мл'
  return 'г'
}

function toBase(amount: number, unit: string): number {
  if (unit === 'kg') return amount * 1000
  if (unit === 'g') return amount
  if (unit === 'l') return amount * 1000
  if (unit === 'ml') return amount
  return amount
}

function estimateCost(ingredient: IngredientProduct, qty: number, usageUnit: DishUsageUnit): number {
  const validQty = isFinite(qty) && qty > 0 ? qty : 0
  if (!validQty) return 0

  const qtyBase = toBase(validQty, usageUnit)
  const packBase = toBase(ingredient.package_amount, ingredient.package_unit)
  if (!packBase) return 0

  return round2((qtyBase / packBase) * ingredient.package_price)
}
