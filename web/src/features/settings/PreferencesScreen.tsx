import { useState } from 'react'
import { useT } from '../../i18n'
import { resolveLocale } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { pb } from '../../data/pb'

export function PreferencesScreen() {
  const t = useT()
  const nav = useNav()
  const { user, refresh } = useAuth()

  const [language, setLanguage] = useState(user?.language || 'auto')
  const [appearance, setAppearance] = useState(user?.theme || 'auto')

  async function handleLanguageChange(value: string) {
    setLanguage(value)
    if (user) {
      try {
        await pb.collection('mm_users').update(user.id, { language: value })
        await refresh()
        const resolved = resolveLocale(value)
        document.documentElement.lang = resolved === 'pt-BR' ? 'pt-BR' : 'en'
      } catch {
        showToast(t('error.generic'))
      }
    }
  }

  async function handleAppearanceChange(value: string) {
    setAppearance(value)
    if (value === 'auto') {
      delete document.documentElement.dataset.theme
      try { localStorage.removeItem('mm-theme') } catch {}
    } else {
      document.documentElement.dataset.theme = value
      try { localStorage.setItem('mm-theme', value) } catch {}
    }
    if (user) {
      try {
        await pb.collection('mm_users').update(user.id, { theme: value })
        await refresh()
      } catch {
        showToast(t('error.generic'))
      }
    }
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.preferences.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
      />

      <div className="list-group-header">{t('settings.preferences.language')}</div>
      <div className="list-group">
        {(['auto', 'pt-BR', 'en'] as const).map((opt) => {
          const labels: Record<string, string> = {
            auto: t('settings.preferences.language.auto') + (opt === 'auto' ? ` (${resolveLocale('auto') === 'pt-BR' ? 'Português' : 'English'})` : ''),
            'pt-BR': t('settings.preferences.language.ptBR'),
            en: t('settings.preferences.language.en'),
          }
          return (
            <button
              key={opt}
              className="list-row"
              onClick={() => handleLanguageChange(opt)}
            >
              <div className="list-row-content">
                <div className="list-row-label">{labels[opt]}</div>
              </div>
              {language === opt && (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--blue)" style={{ flexShrink: 0 }}>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          )
        })}
      </div>

      <div className="list-group-header">{t('settings.preferences.appearance')}</div>
      <div className="list-group">
        {(['auto', 'light', 'dark'] as const).map((opt) => {
          const labels: Record<string, string> = {
            auto: t('settings.preferences.appearance.auto'),
            light: t('settings.preferences.appearance.light'),
            dark: t('settings.preferences.appearance.dark'),
          }
          return (
            <button
              key={opt}
              className="list-row"
              onClick={() => handleAppearanceChange(opt)}
            >
              <div className="list-row-content">
                <div className="list-row-label">{labels[opt]}</div>
              </div>
              {appearance === opt && (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--blue)" style={{ flexShrink: 0 }}>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
