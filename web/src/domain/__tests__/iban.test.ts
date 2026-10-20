import { describe, it, expect } from 'vitest'
import { normalizeIBAN, formatIBAN, validateIBAN, validateSWIFT } from '../iban'

describe('normalizeIBAN', () => {
  it('removes spaces and uppercases', () => {
    expect(normalizeIBAN('pt50 0002 0123 1234 5678 9015 4')).toBe('PT50000201231234567890154')
  })
})

describe('formatIBAN', () => {
  it('groups by 4 characters', () => {
    expect(formatIBAN('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
  })
})

describe('validateIBAN', () => {
  it('accepts valid PT IBAN', () => {
    expect(validateIBAN('PT50000201231234567890154')).toBe(true)
  })

  it('accepts valid DE IBAN', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true)
  })

  it('accepts valid GB IBAN', () => {
    expect(validateIBAN('GB29NWBK60161331926819')).toBe(true)
  })

  it('accepts IBAN with spaces', () => {
    expect(validateIBAN('GB29 NWBK 6016 1331 9268 19')).toBe(true)
  })

  it('rejects too-short IBAN', () => {
    expect(validateIBAN('DE89')).toBe(false)
  })

  it('rejects IBAN with wrong check digits', () => {
    expect(validateIBAN('DE00370400440532013000')).toBe(false)
  })

  it('rejects IBAN with lowercase letters only after normalization if pattern fails', () => {
    expect(validateIBAN('XX00INVALID')).toBe(false)
  })
})

describe('validateSWIFT', () => {
  it('accepts 8-character SWIFT', () => {
    expect(validateSWIFT('DEUTDEFF')).toBe(true)
  })

  it('accepts 11-character SWIFT', () => {
    expect(validateSWIFT('DEUTDEFF500')).toBe(true)
  })

  it('rejects 9-character SWIFT', () => {
    expect(validateSWIFT('DEUTDEFF5')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateSWIFT('')).toBe(false)
  })

  it('handles spaces', () => {
    expect(validateSWIFT('DEUT DEFF')).toBe(true)
  })
})
