import { useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'

function passwordStrength(pw: string): { level: number; key: string } {
  let score = 0
  if (pw.length >= 10) score++
  if (pw.length >= 14) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, key: 'auth.register.passwordStrength.weak' as const }
  if (score <= 2) return { level: 2, key: 'auth.register.passwordStrength.fair' as const }
  if (score <= 3) return { level: 3, key: 'auth.register.passwordStrength.good' as const }
  return { level: 4, key: 'auth.register.passwordStrength.strong' as const }
}

const strengthColors = ['', 'var(--red)', 'var(--orange)', 'var(--blue)', 'var(--green)']

export function RegisterScreen() {
  const t = useT()
  const { register } = useAuth()
  const nav = useNav()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [language, setLanguage] = useState('auto')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const strength = passwordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError(t('error.passwordMin', { min: 6 }))
      return
    }
    if (password !== passwordConfirm) {
      setError(t('error.passwordMatch'))
      return
    }

    setLoading(true)
    try {
      await register(name, email, password, language)
      setSuccess(true)
    } catch (err) {
      setError(t('error.generic'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page page--no-tabs" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t('auth.register.success')}</h2>
        <p style={{ fontSize: 13, color: 'var(--label2)', marginBottom: 24 }}>
          {t('auth.register.successDetail', { email })}
        </p>
        <button className="btn btn--primary" onClick={() => nav.pop()} style={{ maxWidth: 200 }}>
          {t('auth.login.submit')}
        </button>
      </div>
    )
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('auth.register')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
      />

      <form onSubmit={handleSubmit}>
        <div className="list-group" style={{ marginTop: 16 }}>
          <div className="form-row">
            <label>{t('auth.register.name')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="form-row">
            <label>{t('auth.register.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
          </div>
          <div className="form-row">
            <label>{t('auth.register.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          {password.length > 0 && (
            <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 1.5, background: i <= strength.level ? strengthColors[strength.level] : 'var(--fill)' }} />
              ))}
              <span style={{ fontSize: 10.5, color: strengthColors[strength.level], marginLeft: 6 }}>
                {t(strength.key as Parameters<typeof t>[0])}
              </span>
            </div>
          )}
          <div className="form-row">
            <label>{t('auth.register.passwordConfirm')}</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <div className="form-row">
            <label>{t('auth.register.language')}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="auto">{t('settings.preferences.language.auto')}</option>
              <option value="pt-BR">{t('settings.preferences.language.ptBR')}</option>
              <option value="en">{t('settings.preferences.language.en')}</option>
            </select>
          </div>
        </div>

        <p style={{ fontSize: 10.5, color: 'var(--label2)', padding: '8px 16px' }}>
          {t('auth.register.passwordMin')}
        </p>

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            {error}
          </div>
        )}

        <div style={{ padding: '16px 16px 0' }}>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {t('auth.register.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
