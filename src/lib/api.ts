import { supabase } from './supabaseClient'
import type {
  CartItem,
  Dish,
  DishIngredient,
  DishUsageUnit,
  IngredientBaseUnit,
  IngredientKind,
  IngredientProduct,
  MenuEntry,
  MenuEvent,
  MealType,
  UUID,
} from './types'

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

// Supabase caps any single request at the project's "Max Rows" API setting
// (1000 by default), so tables that grow past that need explicit paging or
// rows silently go missing from the result with no error.
const PAGE_SIZE = 1000

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error) throw error

    const page = data ?? []
    rows.push(...page)

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

export async function fetchDishes(): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Dish[]
}

export async function fetchDish(dishId: UUID): Promise<Dish | null> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('id', dishId)
    .maybeSingle()

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

export async function fetchMenuEvents(): Promise<MenuEvent[]> {
  const { data, error } = await supabase
    .from('menu_events')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as MenuEvent[]
}

export async function upsertMenuEvent(input: {
  id?: UUID
  name: string
  notes?: string | null
  is_default?: boolean
}): Promise<MenuEvent> {
  const { data, error } = await supabase
    .from('menu_events')
    .upsert({
      id: input.id,
      name: input.name,
      notes: input.notes ?? null,
      is_default: input.is_default ?? false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as MenuEvent
}

export async function deleteMenuEvent(id: UUID): Promise<void> {
  const { error } = await supabase.from('menu_events').delete().eq('id', id)
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
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from('menu_entries')
      .select('*, ingredient:ingredient_products(*)')
      .order('created_at', { ascending: true })
      .range(from, to)
  )

  return (data as any[]).map((row) => ({
    ...row,
    portions: Number(row.portions ?? 0),
    item_type: row.item_type ?? 'dish',
    ingredient: row.ingredient
      ? {
          ...row.ingredient,
          package_amount: Number(row.ingredient.package_amount ?? 0),
          package_price: Number(row.ingredient.package_price ?? 0),
        }
      : null,
  })) as MenuEntry[]
}

export async function addMenuEntry(params: {
  event_id: UUID
  weekday: number
  meal_type: MealType
  dish_id: UUID | null
  portions: number
  variant_name?: string | null
  ingredient_id?: UUID | null
  item_type?: 'dish' | 'ingredient'
}): Promise<MenuEntry> {
  const { data, error } = await supabase
    .from('menu_entries')
    .insert({
      event_id: params.event_id,
      weekday: params.weekday,
      meal_type: params.meal_type,
      dish_id: params.dish_id,
      portions: params.portions,
      variant_name: params.variant_name ?? null,
      ingredient_id: params.ingredient_id ?? null,
      item_type: params.item_type ?? 'dish',
    })
    .select('*, ingredient:ingredient_products(*)')
    .single()

  if (error) throw error
  const row = data as any
  return {
    ...row,
    portions: Number(row.portions ?? 0),
    item_type: row.item_type ?? 'dish',
    ingredient: row.ingredient
      ? {
          ...row.ingredient,
          package_amount: Number(row.ingredient.package_amount ?? 0),
          package_price: Number(row.ingredient.package_price ?? 0),
        }
      : null,
  } as MenuEntry
}

export async function updateMenuEntry(id: UUID, patch: Partial<MenuEntry>): Promise<MenuEntry> {
  const { data, error } = await supabase
    .from('menu_entries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return { ...(data as any), portions: Number((data as any).portions ?? 0) } as MenuEntry
}

export async function deleteMenuEntry(id: UUID): Promise<void> {
  const { error } = await supabase.from('menu_entries').delete().eq('id', id)
  if (error) throw error
}

export async function fetchCartItems(): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, dish:dishes(*), ingredient:ingredient_products(*)')
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    portions: row.portions == null ? null : Number(row.portions ?? 0),
    quantity: row.quantity == null ? null : Number(row.quantity ?? 0),
    dish: row.dish ?? null,
    ingredient: row.ingredient
      ? {
          ...row.ingredient,
          package_amount: Number(row.ingredient.package_amount ?? 0),
          package_price: Number(row.ingredient.package_price ?? 0),
        }
      : null,
  })) as CartItem[]
}

export async function upsertCartItem(input: {
  id?: UUID
  item_kind: 'dish' | 'ingredient'
  dish_id?: UUID | null
  ingredient_id?: UUID | null
  portions?: number | null
  quantity?: number | null
  quantity_unit?: DishUsageUnit | null
  source_menu_entry_id?: UUID | null
  title_override?: string | null
}): Promise<CartItem> {
  const { data, error } = await supabase
    .from('cart_items')
    .upsert({
      id: input.id,
      item_kind: input.item_kind,
      dish_id: input.dish_id ?? null,
      ingredient_id: input.ingredient_id ?? null,
      portions: input.portions ?? null,
      quantity: input.quantity ?? null,
      quantity_unit: input.quantity_unit ?? null,
      source_menu_entry_id: input.source_menu_entry_id ?? null,
      title_override: input.title_override ?? null,
    })
    .select('*, dish:dishes(*), ingredient:ingredient_products(*)')
    .single()

  if (error) throw error

  const row: any = data
  return {
    ...row,
    portions: row.portions == null ? null : Number(row.portions ?? 0),
    quantity: row.quantity == null ? null : Number(row.quantity ?? 0),
    dish: row.dish ?? null,
    ingredient: row.ingredient
      ? {
          ...row.ingredient,
          package_amount: Number(row.ingredient.package_amount ?? 0),
          package_price: Number(row.ingredient.package_price ?? 0),
        }
      : null,
  } as CartItem
}

export async function deleteCartItem(id: UUID): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().eq('id', id)
  if (error) throw error
}

export async function clearCartItems(): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().not('id', 'is', null)
  if (error) throw error
}
