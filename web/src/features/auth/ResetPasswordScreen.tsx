import { useState } from 'react'
import { useT } from '../../i18n'
import { pb } from '../../data/pb'
import { useNav } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'

export function ResetPasswordRequestScreen() {
  const t = useT()
  const nav = useNav()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await pb.collection('mm_users').requestPasswordReset(email)
    } catch {
      // always show success (§AUTH-04)
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('auth.resetRequest.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
      />

      {sent ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--label2)', marginBottom: 24 }}>
            {t('auth.resetRequest.success')}
          </p>
          <button className="btn btn--secondary" onClick={() => nav.pop()} style={{ maxWidth: 200, margin: '0 auto' }}>
            {t('auth.resetRequest.back')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="list-group" style={{ marginTop: 16 }}>
            <div className="form-row">
              <label>{t('auth.resetRequest.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
            </div>
          </div>
          <div style={{ padding: '16px 16px 0' }}>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {t('auth.resetRequest.submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function ResetPasswordConfirmScreen() {
  const t = useT()
  const nav = useNav()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 10) { setError(t('error.passwordMin', { min: 10 })); return }
    if (password !== passwordConfirm) { setError(t('error.passwordMatch')); return }

    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { setError(t('auth.resetConfirm.error')); return }

    setLoading(true)
    try {
      await pb.collection('mm_users').confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
    } catch {
      setError(t('auth.resetConfirm.error'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page page--no-tabs" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t('auth.resetConfirm.success')}</h2>
        <button className="btn btn--primary" onClick={() => nav.reset('/')} style={{ maxWidth: 200 }}>
          {t('auth.login.submit')}
        </button>
      </div>
    )
  }

  return (
    <div className="page page--no-tabs">
      <NavBar title={t('auth.resetConfirm.title')} />
      <form onSubmit={handleSubmit}>
        <div className="list-group" style={{ marginTop: 16 }}>
          <div className="form-row">
            <label>{t('auth.resetConfirm.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          <div className="form-row">
            <label>{t('auth.resetConfirm.passwordConfirm')}</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{error}</div>}
        <div style={{ padding: '16px 16px 0' }}>
          <button type="submit" className="btn btn--primary" disabled={loading}>{t('auth.resetConfirm.submit')}</button>
        </div>
      </form>
    </div>
  )
}
