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

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function formatQty(n: number, unit: 'g' | 'pcs' | 'l'): string {
  const v = round2(n)
  if (unit === 'g') return `${v} г`
  if (unit === 'pcs') return `${v} шт`
  return `${v} л`
}
