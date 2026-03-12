import type { Dish, DishIngredient, DishUsageUnit, IngredientBaseUnit, IngredientTotalsRow, MenuEntry } from './types'
import { round2 } from './utils'

function convertToDisplayUnit(quantity: number, fromUnit: DishUsageUnit): number {
  if (fromUnit === 'g') return quantity
  if (fromUnit === 'pcs') return quantity
  return quantity
}

function packageUnitToSameScaleAmount(amount: number, unit: IngredientBaseUnit): number {
  if (unit === 'kg') return amount * 1000
  if (unit === 'g') return amount
  if (unit === 'pcs') return amount
  return amount
}

function computeCostForIngredientUsage(ing: DishIngredient, portions = 1): number {
  const ingredient = ing.ingredient
  if (!ingredient) return 0

  const qty = Number(ing.quantity_per_portion ?? 0) * portions
  const packAmount = packageUnitToSameScaleAmount(Number(ingredient.package_amount ?? 0), ingredient.package_unit)
  const packPrice = Number(ingredient.package_price ?? 0)

  if (!packAmount || !packPrice || qty <= 0) return 0
  return round2((qty / packAmount) * packPrice)
}

export function computeDishCostPerPortion(ingredients: DishIngredient[]): number {
  return round2(ingredients.reduce((sum, ing) => sum + computeCostForIngredientUsage(ing, 1), 0))
}

export function computeTotals(params: {
  menuEntries: MenuEntry[]
  dishes: Dish[]
  ingredients: DishIngredient[]
}): IngredientTotalsRow[] {
  const { menuEntries, ingredients } = params

  const byDish = new Map<string, DishIngredient[]>()
  for (const ing of ingredients) {
    const arr = byDish.get(ing.dish_id) ?? []
    arr.push(ing)
    byDish.set(ing.dish_id, arr)
  }

  const totals = new Map<string, IngredientTotalsRow>()

  for (const entry of menuEntries) {
    if (!entry.dish_id) continue
    const portions = Number(entry.portions ?? 0)
    if (portions <= 0) continue

    const dishIngredients = byDish.get(entry.dish_id) ?? []
    for (const ing of dishIngredients) {
      if (!ing.ingredient) continue

      const key = ing.ingredient_id
      const existing = totals.get(key)
      const totalQty = convertToDisplayUnit(Number(ing.quantity_per_portion ?? 0) * portions, ing.usage_unit)
      const totalCost = computeCostForIngredientUsage(ing, portions)

      if (!existing) {
        totals.set(key, {
          ingredient_id: key,
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

  return Array.from(totals.values())
    .map((row) => ({
      ...row,
      total_quantity: round2(row.total_quantity),
      total_cost: round2(row.total_cost),
    }))
    .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name, 'ru'))
}

export function computeGrandTotal(rows: IngredientTotalsRow[]): number {
  return round2(rows.reduce((sum, row) => sum + row.total_cost, 0))
}
