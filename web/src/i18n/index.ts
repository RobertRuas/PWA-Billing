import { createContext, useContext } from 'react'
import ptBR from './pt-BR'
import en from './en'

export type TranslationKey = keyof typeof ptBR
type Translations = Record<TranslationKey, string>

const locales: Record<string, Translations> = { 'pt-BR': ptBR, en }

export function resolveLocale(setting: string): string {
  if (setting === 'auto' || !setting) {
    const langs = navigator.languages ?? [navigator.language]
    for (const lang of langs) {
      if (lang.startsWith('pt')) return 'pt-BR'
    }
    return 'en'
  }
  return setting
}

export function t(key: TranslationKey, locale: string, params?: Record<string, string | number>): string {
  const dict = locales[locale] ?? locales['en']!
  let text = dict[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      const pluralMatch = text.match(new RegExp(`\\{${k}, plural, one \\{([^}]+)\\} other \\{([^}]+)\\}\\}`))
      if (pluralMatch) {
        const replacement = Number(v) === 1 ? pluralMatch[1]! : pluralMatch[2]!
        text = text.replace(pluralMatch[0], replacement)
      }
    }
  }
  return text
}

export const I18nContext = createContext<string>('pt-BR')

export function useLocale(): string {
  return useContext(I18nContext)
}

export function useT() {
  const locale = useLocale()
  return (key: TranslationKey, params?: Record<string, string | number>) => t(key, locale, params)
}

export function getAllKeys(): TranslationKey[] {
  return Object.keys(ptBR) as TranslationKey[]
}
