export function normalizeIBAN(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

export function formatIBAN(iban: string): string {
  const norm = normalizeIBAN(iban)
  return norm.replace(/(.{4})/g, '$1 ').trim()
}

export function validateIBAN(raw: string): boolean {
  const iban = normalizeIBAN(raw)
  if (iban.length < 5 || iban.length > 34) return false
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55))
  let remainder = ''
  for (const ch of numeric) {
    remainder += ch
    const n = parseInt(remainder, 10)
    remainder = String(n % 97)
  }
  return parseInt(remainder, 10) === 1
}

export function validateSWIFT(swift: string): boolean {
  const s = swift.replace(/\s+/g, '').toUpperCase()
  return s.length === 8 || s.length === 11
}
