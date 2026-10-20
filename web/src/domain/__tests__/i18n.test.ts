import { describe, it, expect } from 'vitest'
import ptBR from '../../i18n/pt-BR'
import en from '../../i18n/en'

describe('i18n completeness (§NF-13)', () => {
  const ptKeys = Object.keys(ptBR).sort()
  const enKeys = Object.keys(en).sort()

  it('pt-BR and en have the same number of keys', () => {
    expect(ptKeys.length).toBe(enKeys.length)
  })

  it('every pt-BR key exists in en', () => {
    const missingInEn = ptKeys.filter((k) => !(k in en))
    expect(missingInEn).toEqual([])
  })

  it('every en key exists in pt-BR', () => {
    const missingInPtBR = enKeys.filter((k) => !(k in ptBR))
    expect(missingInPtBR).toEqual([])
  })

  it('no empty translation values in pt-BR', () => {
    const empty = ptKeys.filter((k) => (ptBR as Record<string, string>)[k]?.trim() === '')
    expect(empty).toEqual([])
  })

  it('no empty translation values in en', () => {
    const empty = enKeys.filter((k) => (en as Record<string, string>)[k]?.trim() === '')
    expect(empty).toEqual([])
  })
})
