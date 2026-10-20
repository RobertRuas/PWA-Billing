import { useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'

export function LoginScreen() {
  const t = useT()
  const { login } = useAuth()
  const nav = useNav()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError(t('auth.login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--no-tabs" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700 }}>{t('app.name')}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="list-group">
          <div className="form-row">
            <label>{t('auth.login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </div>
          <div className="form-row">
            <label>{t('auth.login.password')}</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{ fontSize: 11, color: 'var(--blue)', whiteSpace: 'nowrap' }}
            >
              {t('auth.login.showPassword')}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {t('auth.login.submit')}
          </button>
        </div>
      </form>

      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={() => nav.push('/recuperar-senha')}
          style={{ fontSize: 13, color: 'var(--blue)' }}
        >
          {t('auth.login.forgot')}
        </button>
        <button
          onClick={() => nav.push('/criar-conta')}
          style={{ fontSize: 13, color: 'var(--blue)' }}
        >
          {t('auth.login.create')}
        </button>
      </div>
    </div>
  )
}
