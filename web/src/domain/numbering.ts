export function formatInvoiceNumber(pattern: string, seq: number, date: Date): string {
  const y = date.getUTCFullYear()
  return pattern
    .replace('{YYYY}', String(y))
    .replace('{YY}', String(y).slice(-2))
    .replace('{SEQ}', String(seq).padStart(3, '0'))
}

export function previewPattern(pattern: string): string {
  return formatInvoiceNumber(pattern, 1, new Date())
}
