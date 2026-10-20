import { describe, it, expect } from 'vitest'
import { formatInvoiceNumber, previewPattern } from '../numbering'

describe('formatInvoiceNumber', () => {
  const date = new Date(Date.UTC(2026, 9, 15))

  it('replaces {YYYY} and {SEQ}', () => {
    expect(formatInvoiceNumber('{YYYY}-{SEQ}', 1, date)).toBe('2026-001')
  })

  it('replaces {YY} and {SEQ}', () => {
    expect(formatInvoiceNumber('{YY}-{SEQ}', 42, date)).toBe('26-042')
  })

  it('pads SEQ to 3 digits', () => {
    expect(formatInvoiceNumber('{YYYY}-{SEQ}', 1, date)).toBe('2026-001')
    expect(formatInvoiceNumber('{YYYY}-{SEQ}', 99, date)).toBe('2026-099')
    expect(formatInvoiceNumber('{YYYY}-{SEQ}', 100, date)).toBe('2026-100')
    expect(formatInvoiceNumber('{YYYY}-{SEQ}', 1234, date)).toBe('2026-1234')
  })

  it('handles pattern with prefix', () => {
    expect(formatInvoiceNumber('INV-{YYYY}/{SEQ}', 5, date)).toBe('INV-2026/005')
  })
})

describe('previewPattern', () => {
  it('returns formatted string with seq 1', () => {
    const result = previewPattern('{YYYY}-{SEQ}')
    expect(result).toMatch(/^\d{4}-001$/)
  })
})
