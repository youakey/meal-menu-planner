import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { Dish, DishIngredient, IngredientTotalsRow, MenuEntry, MealType } from './types'
import { formatQty, formatRub, mealTypeLabel, shortWeekdayLabel, weekdayLabel } from './utils'

const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'late_snack']

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildIngredientPreview(
  entry: MenuEntry,
  dishIngredientsByDish: Map<string, DishIngredient[]>
): string {
  if (!entry.dish_id) return '—'
  const rows = dishIngredientsByDish.get(entry.dish_id) ?? []
  if (!rows.length) return '—'

  return rows
    .map((row) => {
      const qty = Number(row.quantity_per_portion ?? 0) * Number(entry.portions ?? 0)
      const name = row.ingredient?.name ?? 'Ингредиент'
      return `${name} — ${formatQty(qty, row.usage_unit)}`
    })
    .join('; ')
}

export async function exportMenuDocx(params: {
  filename: string
  eventName: string
  mode: 'week' | 'day'
  weekday?: number
  mealFilter?: 'all' | 'breakfast' | 'lunch' | 'dinner'
  menuEntries: MenuEntry[]
  dishes: Dish[]
  dishIngredients: DishIngredient[]
}) {
  const { filename, eventName, mode, weekday, mealFilter = 'all', menuEntries, dishes, dishIngredients } = params

  const dishesById = new Map(dishes.map((d) => [d.id, d]))
  const dishIngredientsByDish = new Map<string, DishIngredient[]>()

  for (const row of dishIngredients) {
    const arr = dishIngredientsByDish.get(row.dish_id) ?? []
    arr.push(row)
    dishIngredientsByDish.set(row.dish_id, arr)
  }

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: 'Меню',
      heading: HeadingLevel.TITLE,
      spacing: { after: 220 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Мероприятие: ${eventName}`, bold: true })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text:
        mode === 'week'
          ? 'Период: вся неделя'
          : `Период: ${weekdayLabel(weekday ?? 1)}${
              mealFilter !== 'all' ? ` • ${mealTypeLabel(mealFilter)}` : ''
            }`,
      spacing: { after: 240 },
    }),
  ]

  const sorted = [...menuEntries].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday
    return mealOrder.indexOf(a.meal_type) - mealOrder.indexOf(b.meal_type)
  })

  if (!sorted.length) {
    children.push(new Paragraph({ text: 'Нет данных для экспорта.' }))
  } else {
    const weekdays = [...new Set(sorted.map((entry) => entry.weekday))]
    for (const day of weekdays) {
      const dayEntries = sorted.filter((entry) => entry.weekday === day)
      children.push(
        new Paragraph({
          text: weekdayLabel(day),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 220, after: 120 },
        })
      )

      for (const mealType of mealOrder) {
        const mealEntries = dayEntries.filter((entry) => entry.meal_type === mealType)
        if (!mealEntries.length) continue

        children.push(
          new Paragraph({
            text: mealTypeLabel(mealType),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 140, after: 80 },
          })
        )

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ['Блюдо', 'Порции', 'Ингредиенты'].map(
                  (text) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text, bold: true })],
                        }),
                      ],
                    })
                ),
              }),
              ...mealEntries.map(
                (entry) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            text: dishesById.get(entry.dish_id ?? '')?.name ?? 'Блюдо не выбрано',
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: String(entry.portions ?? 0) })],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            text: buildIngredientPreview(entry, dishIngredientsByDish),
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            ],
          })
        )
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename)
}

export async function exportShoppingListDocx(params: {
  filename: string
  eventName: string
  mode: 'week' | 'day'
  weekday?: number
  mealFilter?: 'all' | 'breakfast' | 'lunch' | 'dinner'
  rows: IngredientTotalsRow[]
  grandTotal: number
}) {
  const { filename, eventName, mode, weekday, mealFilter = 'all', rows, grandTotal } = params

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: 'Список покупок',
      heading: HeadingLevel.TITLE,
      spacing: { after: 220 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Мероприятие: ${eventName}`, bold: true })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text:
        mode === 'week'
          ? 'Период: вся неделя'
          : `Период: ${weekdayLabel(weekday ?? 1)}${
              mealFilter !== 'all' ? ` • ${mealTypeLabel(mealFilter)}` : ''
            }`,
      spacing: { after: 200 },
    }),
  ]

  if (!rows.length) {
    children.push(new Paragraph({ text: 'Нет данных для экспорта.' }))
  } else {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ['Ингредиент', 'Количество', 'Стоимость'].map(
              (text) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text, bold: true })],
                    }),
                  ],
                })
            ),
          }),
          ...rows.map(
            (row) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: row.ingredient_name })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: formatQty(row.total_quantity, row.display_unit) })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: formatRub(row.total_cost) })],
                  }),
                ],
              })
          ),
        ],
      })
    )

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240 },
        children: [new TextRun({ text: `Итого: ${formatRub(grandTotal)}`, bold: true })],
      })
    )
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename)
}

export function buildMenuFilename(eventName: string, mode: 'week' | 'day', weekday?: number) {
  const suffix = mode === 'week' ? 'week' : `day-${shortWeekdayLabel(weekday ?? 1)}`
  return `menu-${eventName}-${suffix}.docx`
}

export function buildShoppingFilename(eventName: string, mode: 'week' | 'day', weekday?: number) {
  const suffix = mode === 'week' ? 'week' : `day-${shortWeekdayLabel(weekday ?? 1)}`
  return `shopping-list-${eventName}-${suffix}.docx`
}
