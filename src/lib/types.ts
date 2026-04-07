export type UUID = string

export type Dish = {
  id: UUID
  user_id: UUID
  name: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type IngredientKind = 'weight' | 'piece' | 'volume'
export type IngredientBaseUnit = 'kg' | 'g' | 'pcs' | 'l' | 'ml'
export type DishUsageUnit = 'g' | 'pcs' | 'l' | 'ml'

export type IngredientProduct = {
  id: UUID
  user_id: UUID
  name: string
  kind: IngredientKind
  package_amount: number
  package_unit: IngredientBaseUnit
  package_price: number
  created_at: string
  updated_at: string
}

export type MenuEvent = {
  id: UUID
  user_id: UUID
  name: string
  notes: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type DishIngredient = {
  id: UUID
  dish_id: UUID
  user_id: UUID
  ingredient_id: UUID
  quantity_per_portion: number
  usage_unit: DishUsageUnit
  created_at: string
  updated_at: string
  ingredient?: IngredientProduct | null
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'late_snack'

export type MenuEntry = {
  id: UUID
  user_id: UUID
  event_id: UUID
  weekday: number
  meal_type: MealType
  dish_id: UUID | null
  portions: number
  variant_name: string | null
  created_at: string
  updated_at: string
}

export type IngredientTotalsRow = {
  ingredient_id: UUID
  ingredient_name: string
  total_quantity: number
  display_unit: DishUsageUnit
  total_cost: number
}

export type CartItemKind = 'dish' | 'ingredient'

export type CartItem = {
  id: UUID
  user_id: UUID
  item_kind: CartItemKind
  dish_id: UUID | null
  ingredient_id: UUID | null
  portions: number | null
  quantity: number | null
  quantity_unit: DishUsageUnit | null
  source_menu_entry_id: UUID | null
  title_override: string | null
  created_at: string
  updated_at: string
  dish?: Dish | null
  ingredient?: IngredientProduct | null
}
