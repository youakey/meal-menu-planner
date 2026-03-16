// src/pages/Cart.tsx
import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import {
  clearCartItems,
  deleteCartItem,
  fetchCartItems,
  fetchDishIngredients,
  upsertCartItem,
} from '../lib/api'
import { computeGrandTotal, computeTotalsFromCart } from '../lib/calculations'
import { formatQty, formatRub } from '../lib/utils'
import type { CartItem } from '../lib/types'

export function CartPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const cartQ = useQuery({ queryKey: ['cart_items'], queryFn: fetchCartItems })
  const dishIngredientsQ = useQuery({
    queryKey: ['dish_ingredients_all'],
    queryFn: () => fetchDishIngredients(undefined),
  })

  const updateMut = useMutation({
    mutationFn: ({
      item,
      patch,
    }: {
      item: CartItem
      patch: Partial<Pick<CartItem, 'portions' | 'quantity' | 'quantity_unit' | 'title_override'>>
    }) =>
      upsertCartItem({
        id: item.id,
        item_kind: item.item_kind,
        dish_id: item.dish_id,
        ingredient_id: item.ingredient_id,
        portions: patch.portions ?? item.portions,
        quantity: patch.quantity ?? item.quantity,
        quantity_unit: patch.quantity_unit ?? item.quantity_unit,
        source_menu_entry_id: item.source_menu_entry_id,
        title_override: patch.title_override ?? item.title_override,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart_items'] }),
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка обновления корзины.', 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteCartItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart_items'] })
      toast.push('Позиция удалена из корзины.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления.', 'error'),
  })

  const clearMut = useMutation({
    mutationFn: clearCartItems,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart_items'] })
      toast.push('Корзина очищена.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка очистки корзины.', 'error'),
  })

  const rows = React.useMemo(() => {
    return computeTotalsFromCart({
      cartItems: cartQ.data ?? [],
      dishIngredients: dishIngredientsQ.data ?? [],
    })
  }, [cartQ.data, dishIngredientsQ.data])

  const grand = computeGrandTotal(rows)

  return (
    <Layout title="Корзина">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="glass-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="section-subtitle">Вручную и из меню</div>
              <div className="section-title mt-1">Позиции корзины</div>
            </div>
            <button className="btn-danger self-start" onClick={() => clearMut.mutate()}>
              Очистить корзину
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {(cartQ.data ?? []).length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-amber-100/55">
                Корзина пустая. Добавляйте блюда из недельного меню или отдельные ингредиенты из базы.
              </div>
            )}

            {(cartQ.data ?? []).map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                onPatch={(patch) => updateMut.mutate({ item, patch })}
                onDelete={() => deleteMut.mutate(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="section-subtitle">Расчет</div>
          <div className="section-title mt-1">Итоги корзины</div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <div className="text-sm text-amber-100/55">Общая стоимость</div>
            <div className="mt-2 text-3xl font-semibold text-amber-50">{formatRub(grand)}</div>
          </div>

          <div className="mt-5 space-y-3">
            {rows.length === 0 && (
              <div className="text-sm text-amber-100/55">
                Добавьте позиции в корзину, затем здесь появится расчет.
              </div>
            )}

            {rows.map((row) => (
              <div
                key={`${row.ingredient_id}:${row.display_unit}`}
                className="rounded-2xl border border-white/10 bg-black/10 p-4"
              >
                <div className="font-medium text-amber-50">{row.ingredient_name}</div>
                <div className="mt-1 text-sm text-amber-100/60">
                  {formatQty(row.total_quantity, row.display_unit)}
                </div>
                <div className="mt-1 text-sm text-amber-100/85">{formatRub(row.total_cost)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function CartItemCard({
  item,
  onPatch,
  onDelete,
}: {
  item: CartItem
  onPatch: (
    patch: Partial<Pick<CartItem, 'portions' | 'quantity' | 'quantity_unit' | 'title_override'>>
  ) => void
  onDelete: () => void
}) {
  if (item.item_kind === 'dish') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_160px_auto]">
          <div>
            <div className="text-lg font-semibold text-amber-50">
              {item.title_override?.trim() || item.dish?.name || 'Блюдо'}
            </div>
            <div className="mt-1 text-sm text-amber-100/55">Позиция добавлена из недельного меню</div>
          </div>
          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Порции</label>
            <input
              className="glass-input w-full"
              type="number"
              min="0"
              step="0.1"
              value={item.portions ?? 0}
              onChange={(e) => onPatch({ portions: Number(e.target.value || 0) })}
            />
          </div>
          <div className="flex items-end">
            <button className="btn-danger w-full" onClick={onDelete}>
              Удалить
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_160px_140px_auto]">
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Название</label>
          <input
            className="glass-input w-full"
            value={item.title_override ?? item.ingredient?.name ?? ''}
            onChange={(e) => onPatch({ title_override: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Количество</label>
          <input
            className="glass-input w-full"
            type="number"
            min="0"
            step="0.1"
            value={item.quantity ?? 0}
            onChange={(e) => onPatch({ quantity: Number(e.target.value || 0) })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-amber-100/70">Ед.</label>
          <select
            className="glass-input w-full"
            value={item.quantity_unit ?? defaultUnit(item.ingredient?.package_unit)}
            onChange={(e) => onPatch({ quantity_unit: e.target.value as any })}
          >
            {unitOptions(item.ingredient?.package_unit).map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#18161b]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-danger w-full" onClick={onDelete}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}

function defaultUnit(packageUnit?: string | null) {
  if (packageUnit === 'pcs') return 'pcs'
  if (packageUnit === 'l') return 'l'
  return 'g'
}

function unitOptions(
  packageUnit?: string | null
): Array<{ value: 'g' | 'pcs' | 'l'; label: string }> {
  if (packageUnit === 'pcs') return [{ value: 'pcs', label: 'шт' }]
  if (packageUnit === 'l') return [{ value: 'l', label: 'л' }]
  return [{ value: 'g', label: 'г' }]
}