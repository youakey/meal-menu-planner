import { supabase } from './supabaseClient'
import type {
  Dish,
  DishIngredient,
  DishUsageUnit,
  IngredientBaseUnit,
  IngredientKind,
  IngredientProduct,
  MenuEntry,
  MealType,
  UUID,
} from './types'

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

export async function fetchDishes(): Promise<Dish[]> {
  const { data, error } = await supabase.from('dishes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Dish[]
}

export async function fetchDish(dishId: UUID): Promise<Dish | null> {
  const { data, error } = await supabase.from('dishes').select('*').eq('id', dishId).maybeSingle()
  if (error) throw error
  return (data ?? null) as Dish | null
}

export async function upsertDish(input: Partial<Dish> & { name: string; id?: UUID }): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .upsert({
      id: input.id,
      name: input.name,
      notes: input.notes ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Dish
}

export async function deleteDish(dishId: UUID): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) throw error
}

export async function fetchIngredientProducts(): Promise<IngredientProduct[]> {
  const { data, error } = await supabase
    .from('ingredient_products')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    package_amount: Number(row.package_amount ?? 0),
    package_price: Number(row.package_price ?? 0),
  })) as IngredientProduct[]
}

export async function upsertIngredientProduct(input: {
  id?: UUID
  name: string
  kind: IngredientKind
  package_amount: number
  package_unit: IngredientBaseUnit
  package_price: number
}): Promise<IngredientProduct> {
  const { data, error } = await supabase
    .from('ingredient_products')
    .upsert({
      id: input.id,
      name: input.name,
      kind: input.kind,
      package_amount: input.package_amount,
      package_unit: input.package_unit,
      package_price: input.package_price,
    })
    .select('*')
    .single()

  if (error) throw error
  return {
    ...(data as any),
    package_amount: Number((data as any).package_amount ?? 0),
    package_price: Number((data as any).package_price ?? 0),
  } as IngredientProduct
}

export async function deleteIngredientProduct(id: UUID): Promise<void> {
  const { error } = await supabase.from('ingredient_products').delete().eq('id', id)
  if (error) throw error
}

export async function fetchDishIngredients(dishId?: UUID): Promise<DishIngredient[]> {
  let q = supabase
    .from('dish_ingredients')
    .select('*, ingredient:ingredient_products(*)')
    .order('created_at', { ascending: true })

  if (dishId) q = q.eq('dish_id', dishId)

  const { data, error } = await q
  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    quantity_per_portion: Number(row.quantity_per_portion ?? 0),
    ingredient: row.ingredient
      ? {
          ...row.ingredient,
          package_amount: Number(row.ingredient.package_amount ?? 0),
          package_price: Number(row.ingredient.package_price ?? 0),
        }
      : null,
  })) as DishIngredient[]
}

export async function upsertDishIngredient(input: {
  id?: UUID
  dish_id: UUID
  ingredient_id: UUID
  quantity_per_portion: number
  usage_unit: DishUsageUnit
}): Promise<DishIngredient> {
  const { data, error } = await supabase
    .from('dish_ingredients')
    .upsert({
      id: input.id,
      dish_id: input.dish_id,
      ingredient_id: input.ingredient_id,
      quantity_per_portion: input.quantity_per_portion,
      usage_unit: input.usage_unit,
    })
    .select('*, ingredient:ingredient_products(*)')
    .single()

  if (error) throw error

  const row: any = data
  return {
    ...row,
    quantity_per_portion: Number(row.quantity_per_portion ?? 0),
    ingredient: row.ingredient
      ? {
          ...row.ingredient,
          package_amount: Number(row.ingredient.package_amount ?? 0),
          package_price: Number(row.ingredient.package_price ?? 0),
        }
      : null,
  } as DishIngredient
}

export async function deleteDishIngredient(id: UUID): Promise<void> {
  const { error } = await supabase.from('dish_ingredients').delete().eq('id', id)
  if (error) throw error
}

export async function fetchMenuEntries(): Promise<MenuEntry[]> {
  const { data, error } = await supabase
    .from('menu_entries')
    .select('*')
    .order('weekday', { ascending: true })
    .order('meal_type', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as MenuEntry[]
}

export async function addMenuEntry(params: {
  weekday: number
  meal_type: MealType
  dish_id: UUID | null
  portions: number
}): Promise<MenuEntry> {
  const { data, error } = await supabase
    .from('menu_entries')
    .insert({
      weekday: params.weekday,
      meal_type: params.meal_type,
      dish_id: params.dish_id,
      portions: params.portions,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as MenuEntry
}

export async function updateMenuEntry(id: UUID, patch: Partial<MenuEntry>): Promise<MenuEntry> {
  const { data, error } = await supabase
    .from('menu_entries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as MenuEntry
}

export async function deleteMenuEntry(id: UUID): Promise<void> {
  const { error } = await supabase.from('menu_entries').delete().eq('id', id)
  if (error) throw error
}
