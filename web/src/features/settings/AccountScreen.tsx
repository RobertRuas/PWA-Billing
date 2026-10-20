import { useState } from 'react'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { pb } from '../../data/pb'

export function AccountScreen() {
  const t = useT()
  const nav = useNav()
  const { user, refresh } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [nameEditing, setNameEditing] = useState(false)

  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  async function handleSaveName() {
    if (!user) return
    try {
      await pb.collection('mm_users').update(user.id, { name: name.trim() })
      await refresh()
      setNameEditing(false)
      showToast(t('settings.account.nameSaved'))
    } catch {
      showToast(t('error.generic'))
    }
  }

  async function handleChangeEmail() {
    setEmailError('')
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailError(t('error.email'))
      return
    }
    setEmailLoading(true)
    try {
      await pb.collection('mm_users').requestEmailChange(newEmail.trim())
      showToast(t('settings.account.emailChangeSuccess', { email: newEmail.trim() }))
      setNewEmail('')
      setShowEmailChange(false)
    } catch {
      setEmailError(t('error.generic'))
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.account.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="list-row">
          <div className="list-row-content">
            <div className="list-row-label">{t('settings.account.name')}</div>
          </div>
          {nameEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ flex: 1, maxWidth: 200, textAlign: 'right' }}
                autoFocus
              />
              <button
                className="btn btn--small"
                onClick={handleSaveName}
                disabled={!name.trim()}
              >
                {t('common.save')}
              </button>
            </div>
          ) : (
            <button
              className="list-row-value"
              onClick={() => setNameEditing(true)}
              style={{ cursor: 'pointer' }}
            >
              {user?.name || '—'}
            </button>
          )}
        </div>
        <div className="list-row">
          <div className="list-row-content">
            <div className="list-row-label">{t('settings.account.email')}</div>
          </div>
          <span className="list-row-value">{user?.email}</span>
        </div>
      </div>

      <div className="list-group" style={{ marginTop: 12 }}>
        {!showEmailChange ? (
          <button className="list-row" onClick={() => setShowEmailChange(true)} style={{ justifyContent: 'center' }}>
            <span style={{ color: 'var(--blue)', fontSize: 14 }}>{t('settings.account.changeEmail')}</span>
          </button>
        ) : (
          <>
            <div className="form-row">
              <label className="form-row-label">{t('settings.account.newEmail')}</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setEmailError('') }}
                autoFocus
              />
              {emailError && <span className="form-row-error">{emailError}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
              <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => { setShowEmailChange(false); setNewEmail(''); setEmailError('') }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleChangeEmail} disabled={emailLoading}>
                {t('common.confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
