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
import { formatQty, formatRub, round2 } from '../lib/utils'
import type { DishIngredient, DishUsageUnit, IngredientProduct } from '../lib/types'

export function DishEditPage() {
  const { dishId } = useParams()
  const id = dishId as string
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const dishQ = useQuery({ queryKey: ['dish', id], queryFn: () => fetchDish(id), enabled: !!id })
  const rowsQ = useQuery({ queryKey: ['dish_ingredients', id], queryFn: () => fetchDishIngredients(id), enabled: !!id })
  const ingredientsQ = useQuery({ queryKey: ['ingredient_products'], queryFn: fetchIngredientProducts })

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
    mutationFn: () => upsertDish({ id, name: name.trim() || 'Без названия', notes: notes.trim() || null }),
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
        quantity_per_portion: 100,
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
      <div className="mb-5 flex items-center justify-between gap-3">
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
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
            Теперь блюдо не хранит собственную базу ингредиентов. Оно только ссылается на ингредиенты из общего каталога и знает, сколько каждого ингредиента нужно на одну порцию.
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

  const currentIngredient = row.ingredient ?? ingredientOptions.find((i) => i.id === row.ingredient_id) ?? null
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
    <div className="rounded-3xl border border-white/10 bg-black/10 p-5 transition-all duration-300 hover:border-amber-300/20">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_180px_180px_1fr]">
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Ингредиент из базы</label>
          <select
            className="glass-input w-full"
            value={ingredientId}
            onChange={(e) => {
              const nextId = e.target.value
              const nextIngredient = ingredientOptions.find((item) => item.id === nextId)
              setIngredientId(nextId)
              if (nextIngredient) {
                setUsageUnit(defaultUsageUnit(nextIngredient))
                setQuantity(nextIngredient.kind === 'piece' ? '1' : nextIngredient.kind === 'volume' ? '0.1' : '100')
              }
            }}
          >
            {ingredientOptions.map((item) => (
              <option key={item.id} value={item.id} className="bg-[#18161b]">
                {item.name}
              </option>
            ))}
          </select>
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
              {selectedIngredient ? formatQty(Number(quantity.replace(',', '.')) || 0, usageUnit) : '—'}
            </span>
            <b>{formatRub(currentCost)}</b>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-amber-100/45">
          {selectedIngredient
            ? `${selectedIngredient.name}: ${selectedIngredient.package_amount} ${ingredientUnitLabel(selectedIngredient.package_unit)} за ${formatRub(selectedIngredient.package_price)}`
            : 'Выберите ингредиент из базы.'}
        </div>
        <div className="flex gap-3">
          <button className="btn-danger px-3 py-2" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
          <button className="btn-primary px-4 py-2" onClick={() => saveMut.mutate()}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function defaultUsageUnit(ingredient: IngredientProduct): DishUsageUnit {
  if (ingredient.kind === 'piece') return 'pcs'
  if (ingredient.kind === 'volume') return 'l'
  return 'g'
}

function usageUnitOptions(ingredient: IngredientProduct | null | undefined): Array<{ value: DishUsageUnit; label: string }> {
  if (!ingredient) return [{ value: 'g', label: 'г' }]
  if (ingredient.kind === 'piece') return [{ value: 'pcs', label: 'шт' }]
  if (ingredient.kind === 'volume') return [{ value: 'l', label: 'л' }]
  return [{ value: 'g', label: 'г' }]
}

function ingredientUnitLabel(unit: string) {
  if (unit === 'kg') return 'кг'
  if (unit === 'g') return 'г'
  if (unit === 'pcs') return 'шт'
  return 'л'
}

function estimateCost(ingredient: IngredientProduct, qty: number, usageUnit: DishUsageUnit): number {
  const validQty = isFinite(qty) && qty > 0 ? qty : 0
  if (!validQty) return 0

  let packageAmount = ingredient.package_amount
  if (ingredient.package_unit === 'kg' && usageUnit === 'g') packageAmount = ingredient.package_amount * 1000

  if (!packageAmount) return 0
  return round2((validQty / packageAmount) * ingredient.package_price)
}
