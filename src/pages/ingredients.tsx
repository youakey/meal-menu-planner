import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { deleteIngredientProduct, fetchIngredientProducts, upsertIngredientProduct } from '../lib/api'
import type { IngredientBaseUnit, IngredientKind, IngredientProduct } from '../lib/types'
import { formatRub } from '../lib/utils'

const kindOptions: Array<{ value: IngredientKind; label: string }> = [
  { value: 'weight', label: 'Весовой' },
  { value: 'piece', label: 'Поштучный' },
  { value: 'volume', label: 'Жидкость' },
]

export function IngredientsPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const ingredientsQ = useQuery({ queryKey: ['ingredient_products'], queryFn: fetchIngredientProducts })

  const [editing, setEditing] = React.useState<IngredientProduct | null>(null)
  const [toDelete, setToDelete] = React.useState<IngredientProduct | null>(null)

  const delMut = useMutation({
    mutationFn: deleteIngredientProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredient_products'] })
      qc.invalidateQueries({ queryKey: ['dish_ingredients'] })
      toast.push('Ингредиент удален.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления ингредиента.', 'error'),
  })

  return (
    <Layout title="База ингредиентов">
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <IngredientEditor
          key={editing?.id ?? 'new'}
          initial={editing}
          onDone={() => setEditing(null)}
        />

        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="section-subtitle">Каталог</div>
              <div className="section-title mt-1">Ваши ингредиенты</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-amber-100/70">
              Всего: {ingredientsQ.data?.length ?? 0}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {(ingredientsQ.data ?? []).length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-amber-100/55">
                Пока здесь пусто. Добавьте первый ингредиент слева.
              </div>
            )}

            {(ingredientsQ.data ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-black/10 p-5 transition-all duration-300 hover:border-amber-300/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-amber-50">{item.name}</div>
                    <div className="mt-1 text-sm text-amber-100/60">
                      {kindLabel(item.kind)} • {item.package_amount} {unitLabel(item.package_unit)} • {formatRub(item.package_price)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary px-3 py-2" onClick={() => setEditing(item)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn-danger px-3 py-2" onClick={() => setToDelete(item)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Удалить ингредиент?"
        description={
          toDelete ? `Ингредиент «${toDelete.name}» будет удален из базы. В блюдах его тоже придется заменить.` : ''
        }
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) delMut.mutate(toDelete.id)
        }}
      />
    </Layout>
  )
}

function IngredientEditor({
  initial,
  onDone,
}: {
  initial: IngredientProduct | null
  onDone: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()

  const [name, setName] = React.useState(initial?.name ?? '')
  const [kind, setKind] = React.useState<IngredientKind>(initial?.kind ?? 'weight')
  const [packageAmount, setPackageAmount] = React.useState(String(initial?.package_amount ?? 1))
  const [packageUnit, setPackageUnit] = React.useState<IngredientBaseUnit>(initial?.package_unit ?? 'kg')
  const [packagePrice, setPackagePrice] = React.useState(String(initial?.package_price ?? ''))

  React.useEffect(() => {
    if (kind === 'weight' && !['kg', 'g'].includes(packageUnit)) setPackageUnit('kg')
    if (kind === 'piece' && packageUnit !== 'pcs') setPackageUnit('pcs')
    if (kind === 'volume' && packageUnit !== 'l') setPackageUnit('l')
  }, [kind, packageUnit])

  const saveMut = useMutation({
    mutationFn: async () => {
      const amount = Number(packageAmount.replace(',', '.'))
      const price = Number(packagePrice.replace(',', '.'))

      if (!name.trim()) throw new Error('Введите название ингредиента.')
      if (!isFinite(amount) || amount <= 0) throw new Error('Количество должно быть больше нуля.')
      if (!isFinite(price) || price < 0) throw new Error('Стоимость не может быть отрицательной.')

      return upsertIngredientProduct({
        id: initial?.id,
        name: name.trim(),
        kind,
        package_amount: amount,
        package_unit: packageUnit,
        package_price: price,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredient_products'] })
      toast.push(initial ? 'Ингредиент обновлен.' : 'Ингредиент добавлен.', 'success')
      if (!initial) {
        setName('')
        setKind('weight')
        setPackageAmount('1')
        setPackageUnit('kg')
        setPackagePrice('')
      } else {
        onDone()
      }
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка сохранения ингредиента.', 'error'),
  })

  return (
    <div className="glass-card p-6">
      <div className="section-subtitle">{initial ? 'Редактирование' : 'Новая запись'}</div>
      <div className="section-title mt-1">{initial ? 'Изменить ингредиент' : 'Добавить ингредиент'}</div>

      <div className="mt-5 grid gap-4">
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Название ингредиента</label>
          <input
            className="glass-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Мука"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Тип</label>
          <select className="glass-input w-full" value={kind} onChange={(e) => setKind(e.target.value as IngredientKind)}>
            {kindOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#18161b]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Количество в упаковке</label>
            <input
              className="glass-input w-full"
              value={packageAmount}
              onChange={(e) => setPackageAmount(e.target.value)}
              inputMode="decimal"
              placeholder="1"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Единица</label>
            <select
              className="glass-input w-full"
              value={packageUnit}
              onChange={(e) => setPackageUnit(e.target.value as IngredientBaseUnit)}
            >
              {unitOptionsForKind(kind).map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#18161b]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Стоимость упаковки</label>
          <input
            className="glass-input w-full"
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-primary" onClick={() => saveMut.mutate()}>
          <Plus size={16} />
          {initial ? 'Сохранить изменения' : 'Добавить в базу'}
        </button>
        {initial && (
          <button className="btn-secondary" onClick={onDone}>
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}

function unitOptionsForKind(kind: IngredientKind): Array<{ value: IngredientBaseUnit; label: string }> {
  if (kind === 'piece') return [{ value: 'pcs', label: 'шт' }]
  if (kind === 'volume') return [{ value: 'l', label: 'л' }]
  return [
    { value: 'kg', label: 'кг' },
    { value: 'g', label: 'г' },
  ]
}

function unitLabel(unit: IngredientBaseUnit) {
  if (unit === 'pcs') return 'шт'
  if (unit === 'kg') return 'кг'
  if (unit === 'g') return 'г'
  return 'л'
}

function kindLabel(kind: IngredientKind) {
  if (kind === 'piece') return 'Поштучный'
  if (kind === 'volume') return 'Жидкость'
  return 'Весовой'
}
