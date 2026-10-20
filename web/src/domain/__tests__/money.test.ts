import { describe, it, expect } from 'vitest'
import { toCents, fromCents, formatMoney, lineAmount, invoiceTotal, difference } from '../money'

describe('toCents', () => {
  it('parses European format "1.234,56"', () => {
    expect(toCents('1.234,56')).toBe(123456)
  })

  it('parses US format "1234.56"', () => {
    expect(toCents('1234.56')).toBe(123456)
  })

  it('parses space-separated "1 234,5"', () => {
    expect(toCents('1 234,5')).toBe(123450)
  })

  it('parses plain integer string', () => {
    expect(toCents('100')).toBe(10000)
  })

  it('parses string with only cents "0,99"', () => {
    expect(toCents('0,99')).toBe(99)
  })

  it('converts number input', () => {
    expect(toCents(12.34)).toBe(1234)
  })

  it('handles number with floating point precision', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
  })

  it('returns 0 for non-numeric string', () => {
    expect(toCents('abc')).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(toCents('')).toBe(0)
  })
})

describe('fromCents', () => {
  it('converts cents to decimal', () => {
    expect(fromCents(123456)).toBe(1234.56)
  })

  it('converts 0', () => {
    expect(fromCents(0)).toBe(0)
  })

  it('converts negative cents', () => {
    expect(fromCents(-500)).toBe(-5)
  })
})

describe('formatMoney', () => {
  it('formats EUR in pt-BR', () => {
    const result = formatMoney(123456, 'EUR', 'pt-BR')
    expect(result).toContain('1.234,56')
  })

  it('formats EUR in en', () => {
    const result = formatMoney(123456, 'EUR', 'en')
    expect(result).toContain('1,234.56')
  })

  it('formats zero', () => {
    const result = formatMoney(0, 'EUR', 'pt-BR')
    expect(result).toContain('0,00')
  })
})

describe('lineAmount', () => {
  it('calculates quantity × rate rounded', () => {
    expect(lineAmount(8, 5000)).toBe(40000)
  })

  it('rounds fractional results', () => {
    expect(lineAmount(1.5, 3333)).toBe(5000)
  })

  it('handles zero quantity', () => {
    expect(lineAmount(0, 5000)).toBe(0)
  })
})

describe('invoiceTotal', () => {
  it('sums all item amounts', () => {
    const items = [{ amount_cents: 10000 }, { amount_cents: 20000 }, { amount_cents: 5000 }]
    expect(invoiceTotal(items)).toBe(35000)
  })

  it('returns 0 for empty array', () => {
    expect(invoiceTotal([])).toBe(0)
  })
})

describe('difference', () => {
  it('returns positive when received > total', () => {
    expect(difference(11000, 10000)).toBe(1000)
  })

  it('returns negative when received < total', () => {
    expect(difference(9000, 10000)).toBe(-1000)
  })

  it('returns 0 when equal', () => {
    expect(difference(10000, 10000)).toBe(0)
  })
})
