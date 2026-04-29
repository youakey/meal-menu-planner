import type {
  CartItem,
  Dish,
  DishIngredient,
  IngredientBaseUnit,
  IngredientProduct,
  IngredientTotalsRow,
  MenuEntry,
} from './types'
import { round2 } from './utils'

function normalizeAmountToBase(amount: number, unit: IngredientBaseUnit | 'g' | 'pcs' | 'l' | 'ml'): number {
  if (unit === 'kg') return amount * 1000
  if (unit === 'g') return amount
  if (unit === 'pcs') return amount
  if (unit === 'l') return amount * 1000
  return amount
}

function computeCostForIngredientUsage(ing: DishIngredient, portions = 1): number {
  const ingredient = ing.ingredient
  if (!ingredient) return 0

  const qty = Number(ing.quantity_per_portion ?? 0) * portions
  const qtyBase = normalizeAmountToBase(qty, ing.usage_unit)
  const packBase = normalizeAmountToBase(
    Number(ingredient.package_amount ?? 0),
    ingredient.package_unit
  )
  const packPrice = Number(ingredient.package_price ?? 0)

  if (!packBase || !packPrice || qtyBase <= 0) return 0
  return round2((qtyBase / packBase) * packPrice)
}

export function computeDishCostPerPortion(ingredients: DishIngredient[]): number {
  return round2(ingredients.reduce((sum, ing) => sum + computeCostForIngredientUsage(ing, 1), 0))
}

export function computeTotals(params: {
  menuEntries: MenuEntry[]
  dishes: Dish[]
  ingredients: DishIngredient[]
  ingredientProducts?: IngredientProduct[]
  eventId?: string | null
  weekday?: number | null
  mealType?: string | null
}): IngredientTotalsRow[] {
  const { menuEntries, ingredients, ingredientProducts, weekday, eventId, mealType } = params

  const byDish = new Map<string, DishIngredient[]>()
  for (const ing of ingredients) {
    const arr = byDish.get(ing.dish_id) ?? []
    arr.push(ing)
    byDish.set(ing.dish_id, arr)
  }

  const totals = new Map<string, IngredientTotalsRow>()

  for (const entry of menuEntries) {
    if (eventId && entry.event_id !== eventId) continue
    if (weekday && entry.weekday !== weekday) continue
    if (mealType && mealType !== 'all' && entry.meal_type !== mealType) continue

    const itemType = entry.item_type ?? 'dish'

    if (itemType === 'ingredient') {
      const ing = entry.ingredient ?? (ingredientProducts ?? []).find((p) => p.id === entry.ingredient_id)
      if (!ing || !entry.ingredient_id) continue

      const qty = Number(entry.portions ?? 0)
      if (qty <= 0) continue

      const unit = (entry as any).quantity_unit ?? (ing.package_unit === 'kg' ? 'g' : ing.package_unit === 'l' ? 'ml' : ing.package_unit)
      const qtyBase = normalizeAmountToBase(qty, unit)
      const packBase = normalizeAmountToBase(Number(ing.package_amount ?? 0), ing.package_unit)
      const cost = packBase > 0 ? round2((qtyBase / packBase) * Number(ing.package_price ?? 0)) : 0

      const key = `${entry.ingredient_id}:${unit}`
      const existing = totals.get(key)
      if (!existing) {
        totals.set(key, { ingredient_id: entry.ingredient_id, ingredient_name: ing.name, total_quantity: qty, display_unit: unit as any, total_cost: cost })
      } else {
        existing.total_quantity += qty
        existing.total_cost += cost
      }
      continue
    }

    if (!entry.dish_id) continue
    const portions = Number(entry.portions ?? 0)
    if (portions <= 0) continue

    const dishIngredients = byDish.get(entry.dish_id) ?? []
    for (const ing of dishIngredients) {
      if (!ing.ingredient) continue

      const key = `${ing.ingredient_id}:${ing.usage_unit}`
      const existing = totals.get(key)
      const totalQty = Number(ing.quantity_per_portion ?? 0) * portions
      const totalCost = computeCostForIngredientUsage(ing, portions)

      if (!existing) {
        totals.set(key, {
          ingredient_id: ing.ingredient_id,
          ingredient_name: ing.ingredient.name,
          total_quantity: totalQty,
          display_unit: ing.usage_unit,
          total_cost: totalCost,
        })
      } else {
        existing.total_quantity += totalQty
        existing.total_cost += totalCost
      }
    }
  }

  return finalizeRows(Array.from(totals.values()))
}

export function computeTotalsFromCart(params: {
  cartItems: CartItem[]
  dishIngredients: DishIngredient[]
}): IngredientTotalsRow[] {
  const { cartItems, dishIngredients } = params
  const byDish = new Map<string, DishIngredient[]>()

  for (const row of dishIngredients) {
    const arr = byDish.get(row.dish_id) ?? []
    arr.push(row)
    byDish.set(row.dish_id, arr)
  }

  const totals = new Map<string, IngredientTotalsRow>()

  for (const item of cartItems) {
    if (item.item_kind === 'dish' && item.dish_id) {
      const portions = Number(item.portions ?? 0)
      if (portions <= 0) continue

      const rows = byDish.get(item.dish_id) ?? []
      for (const ing of rows) {
        if (!ing.ingredient) continue
        const key = `${ing.ingredient_id}:${ing.usage_unit}`
        const existing = totals.get(key)
        const qty = Number(ing.quantity_per_portion ?? 0) * portions
        const cost = computeCostForIngredientUsage(ing, portions)

        if (!existing) {
          totals.set(key, {
            ingredient_id: ing.ingredient_id,
            ingredient_name: ing.ingredient.name,
            total_quantity: qty,
            display_unit: ing.usage_unit,
            total_cost: cost,
          })
        } else {
          existing.total_quantity += qty
          existing.total_cost += cost
        }
      }
    }

    if (item.item_kind === 'ingredient' && item.ingredient) {
      const unit = item.quantity_unit ?? defaultCartUnit(item.ingredient.package_unit)
      const qty = Number(item.quantity ?? 0)
      if (qty <= 0) continue

      const qtyBase = normalizeAmountToBase(qty, unit)
      const packBase = normalizeAmountToBase(
        Number(item.ingredient.package_amount ?? 0),
        item.ingredient.package_unit
      )

      const cost = packBase > 0 ? (qtyBase / packBase) * Number(item.ingredient.package_price ?? 0) : 0
      const key = `${item.ingredient_id}:${unit}`
      const existing = totals.get(key)

      if (!existing) {
        totals.set(key, {
          ingredient_id: item.ingredient_id!,
          ingredient_name: item.title_override?.trim() || item.ingredient.name,
          total_quantity: qty,
          display_unit: unit,
          total_cost: cost,
        })
      } else {
        existing.total_quantity += qty
        existing.total_cost += cost
      }
    }
  }

  return finalizeRows(Array.from(totals.values()))
}

function finalizeRows(rows: IngredientTotalsRow[]): IngredientTotalsRow[] {
  return rows
    .map((row) => ({
      ...row,
      total_quantity: round2(row.total_quantity),
      total_cost: round2(row.total_cost),
    }))
    .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name, 'ru'))
}

function defaultCartUnit(packageUnit: IngredientBaseUnit) {
  if (packageUnit === 'pcs') return 'pcs'
  if (packageUnit === 'ml') return 'ml'
  if (packageUnit === 'l') return 'l'
  return 'g'
}

export function computeGrandTotal(rows: IngredientTotalsRow[]): number {
  return round2(rows.reduce((sum, row) => sum + row.total_cost, 0))
}
