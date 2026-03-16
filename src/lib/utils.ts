export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ')
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatRub(n: number): string {
  const v = isFinite(n) ? n : 0
  return `${v.toFixed(2)} руб.`
}

export function formatQty(n: number, unit: 'g' | 'pcs' | 'l'): string {
  const v = round2(n)
  if (unit === 'g') return `${v} г`
  if (unit === 'pcs') return `${v} шт`
  return `${v} л`
}

export function weekdayLabel(weekday: number): string {
  switch (weekday) {
    case 1:
      return 'Понедельник'
    case 2:
      return 'Вторник'
    case 3:
      return 'Среда'
    case 4:
      return 'Четверг'
    case 5:
      return 'Пятница'
    default:
      return `День ${weekday}`
  }
}

export function shortWeekdayLabel(weekday: number): string {
  switch (weekday) {
    case 1:
      return 'Пн'
    case 2:
      return 'Вт'
    case 3:
      return 'Ср'
    case 4:
      return 'Чт'
    case 5:
      return 'Пт'
    default:
      return String(weekday)
  }
}

export function mealTypeLabel(mealType: string): string {
  switch (mealType) {
    case 'breakfast':
      return 'Завтрак'
    case 'lunch':
      return 'Обед'
    case 'dinner':
      return 'Ужин'
    case 'late_snack':
      return 'Перекус'
    default:
      return mealType
  }
}
