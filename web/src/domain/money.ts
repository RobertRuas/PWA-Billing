// All monetary values stored as integer cents (§NF-15)

export function toCents(value: string | number): number {
  if (typeof value === 'number') return Math.round(value * 100)
  const cleaned = value.replace(/\s/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/[.,](?=\d{3})/g, '')
  const n = parseFloat(cleaned)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents))
}

export function lineAmount(quantity: number, rateCents: number): number {
  return Math.round(quantity * rateCents)
}

export function invoiceTotal(items: Array<{ amount_cents: number }>): number {
  return items.reduce((sum, item) => sum + item.amount_cents, 0)
}

export function difference(receivedCents: number, totalCents: number): number {
  return receivedCents - totalCents
}
