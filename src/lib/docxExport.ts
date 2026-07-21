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
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type {
  Dish,
  DishIngredient,
  IngredientProduct,
  IngredientTotalsRow,
  MenuEntry,
  MenuEventDay,
  MenuEventMealType,
} from './types'
import { computeMenuEntryCost } from './calculations'
import { formatQty, formatRub, mealTypeLabel, shortWeekdayLabel, weekdayLabel } from './utils'

const mealOrder: string[] = ['breakfast', 'lunch', 'dinner', 'late_snack']

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

/** "06-09.07.26" when the range shares a month/year, else a full "06.07.26–09.09.26" range. */
function formatDateRangeCompact(dates: Date[]): string {
  if (!dates.length) return ''
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first.getTime() === last.getTime()) return format(first, 'dd.MM.yy', { locale: ru })

  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  if (sameMonth) {
    return `${format(first, 'dd')}-${format(last, 'dd.MM.yy', { locale: ru })}`
  }
  return `${format(first, 'dd.MM.yy', { locale: ru })}–${format(last, 'dd.MM.yy', { locale: ru })}`
}

function dayHeaderLabel(day: MenuEventDay): { date: string; weekday: string } {
  if (day.calendar_date) {
    const d = new Date(day.calendar_date)
    return { date: format(d, 'dd.MM.yy', { locale: ru }), weekday: format(d, 'EEEE', { locale: ru }) }
  }
  return { date: '', weekday: weekdayLabel(day.day_index) }
}

/**
 * Export matching the "Малорита 06-09.07.26 / Кол-во гостей …" layout: one continuous
 * table, a header row per day (date + weekday), a row per meal (dish list + meal cost),
 * a bold day-total row, and a bold grand total below the table.
 */
export async function exportDailyBreakdownDocx(params: {
  filename: string
  eventName: string
  guestCount: string | null
  days: MenuEventDay[]
  mealTypes: MenuEventMealType[]
  menuEntries: MenuEntry[]
  dishes: Dish[]
  dishIngredients: DishIngredient[]
  ingredientProducts: IngredientProduct[]
}) {
  const { filename, eventName, guestCount, days, mealTypes, menuEntries, dishes, dishIngredients, ingredientProducts } =
    params

  const dishesById = new Map(dishes.map((d) => [d.id, d]))
  const dishIngredientsByDish = new Map<string, DishIngredient[]>()
  for (const row of dishIngredients) {
    const arr = dishIngredientsByDish.get(row.dish_id) ?? []
    arr.push(row)
    dishIngredientsByDish.set(row.dish_id, arr)
  }

  const calendarDates = days.filter((d) => d.calendar_date).map((d) => new Date(d.calendar_date as string))
  const titleRange = calendarDates.length ? ` ${formatDateRangeCompact(calendarDates)}` : ''

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: `${eventName}${titleRange}`, bold: true })],
      spacing: { after: 60 },
    }),
  ]

  if (guestCount && guestCount.trim()) {
    children.push(new Paragraph({ text: `Кол-во гостей ${guestCount.trim()}`, spacing: { after: 200 } }))
  }

  const cellWidths = [15, 65, 20]
  const rows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ width: { size: cellWidths[0], type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '' })] }),
        new TableCell({ width: { size: cellWidths[1], type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '' })] }),
        new TableCell({
          width: { size: cellWidths[2], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Стоимость', bold: true })] })],
        }),
      ],
    }),
  ]

  let grandTotal = 0

  for (const day of days) {
    const dayEntries = menuEntries.filter((e) => e.weekday === day.day_index)
    if (!dayEntries.length) continue

    const { date, weekday } = dayHeaderLabel(day)

    rows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            children: [
              ...(date ? [new Paragraph({ children: [new TextRun({ text: date, bold: true })] })] : []),
              new Paragraph({ children: [new TextRun({ text: weekday, bold: true })] }),
            ],
          }),
          new TableCell({ children: [new Paragraph({ text: '' })] }),
        ],
      })
    )

    let dayTotal = 0

    for (const mt of mealTypes) {
      const mealEntries = dayEntries.filter((e) => e.meal_type === mt.key)
      if (!mealEntries.length) continue

      const mealCost = mealEntries.reduce(
        (sum, entry) => sum + computeMenuEntryCost(entry, dishIngredientsByDish, ingredientProducts),
        0
      )
      dayTotal += mealCost

      const dishLines = mealEntries.map((entry) => {
        if ((entry.item_type ?? 'dish') === 'ingredient') {
          return entry.ingredient?.name ?? 'Ингредиент'
        }
        return dishesById.get(entry.dish_id ?? '')?.name ?? 'Блюдо не выбрано'
      })

      rows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: mt.label })] }),
            new TableCell({ children: dishLines.map((line) => new Paragraph({ text: line })) }),
            new TableCell({ children: [new Paragraph({ text: formatRub(mealCost) })] }),
          ],
        })
      )
    }

    rows.push(
      new TableRow({
        children: [
          new TableCell({ columnSpan: 2, children: [new Paragraph({ text: '' })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatRub(dayTotal), bold: true })] })] }),
        ],
      })
    )

    grandTotal += dayTotal
  }

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 240 },
      children: [new TextRun({ text: `Итог: ${formatRub(grandTotal)}.`, bold: true })],
    })
  )

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename)
}

export function buildDailyBreakdownFilename(eventName: string) {
  return `menu-breakdown-${eventName}.docx`
}
