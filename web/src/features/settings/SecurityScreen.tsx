import { useState } from 'react'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { pb } from '../../data/pb'
import { clearAllData } from '../../data/db'

export function SecurityScreen() {
  const t = useT()
  const nav = useNav()
  const { user } = useAuth()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const [deleteStep, setDeleteStep] = useState(0)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleChangePassword() {
    setPwError('')
    if (newPw.length < 10) {
      setPwError(t('error.passwordMin', { min: 10 }))
      return
    }
    if (newPw !== confirmPw) {
      setPwError(t('error.passwordMatch'))
      return
    }
    setPwLoading(true)
    try {
      await pb.collection('mm_users').update(user!.id, {
        oldPassword: currentPw,
        password: newPw,
        passwordConfirm: newPw,
      })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      showToast(t('settings.security.passwordChanged'))
    } catch {
      setPwError(t('error.generic'))
    } finally {
      setPwLoading(false)
    }
  }

  async function handleLogoutAll() {
    if (!confirm(t('settings.security.logoutAllConfirm'))) return
    try {
      await pb.send('/api/mm/account/logout-all', { method: 'POST' })
      showToast(t('settings.security.logoutAllSuccess'))
    } catch {
      showToast(t('error.generic'))
    }
  }

  async function handleDeleteAccount() {
    if (deleteStep === 0) {
      if (!confirm(t('settings.security.deleteAccountConfirm'))) return
      setDeleteStep(1)
      return
    }
    setDeleteError('')
    if (!deletePw) {
      setDeleteError(t('error.required'))
      return
    }
    setDeleteLoading(true)
    try {
      await pb.send('/api/mm/account/delete', {
        method: 'POST',
        body: { password: deletePw },
      })
      await clearAllData()
      pb.authStore.clear()
      nav.reset('/')
      window.location.reload()
    } catch {
      setDeleteError(t('error.generic'))
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.security.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
      />

      <div className="list-group-header">{t('settings.security.changePassword')}</div>
      <div className="list-group">
        <div className="form-row">
          <label className="form-row-label">{t('settings.security.currentPassword')}</label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.security.newPassword')}</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => { setNewPw(e.target.value); setPwError('') }}
            autoComplete="new-password"
          />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.security.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setPwError('') }}
            autoComplete="new-password"
          />
          {pwError && <span className="form-row-error">{pwError}</span>}
        </div>
        <button
          className="list-row"
          onClick={handleChangePassword}
          disabled={pwLoading || !currentPw || !newPw || !confirmPw}
          style={{ justifyContent: 'center' }}
        >
          <span style={{ color: 'var(--blue)', fontSize: 14 }}>
            {t('settings.security.changePassword')}
          </span>
        </button>
      </div>

      <div className="list-group-header" style={{ marginTop: 24 }}>{t('settings.security.logoutAll')}</div>
      <div className="list-group">
        <button className="list-row" onClick={handleLogoutAll} style={{ justifyContent: 'center' }}>
          <span style={{ color: 'var(--orange)', fontSize: 14 }}>
            {t('settings.security.logoutAll')}
          </span>
        </button>
      </div>

      <div className="list-group-header" style={{ marginTop: 24 }}>{t('settings.security.deleteAccount')}</div>
      <div className="list-group">
        {deleteStep === 1 && (
          <div className="form-row">
            <label className="form-row-label">{t('settings.security.deleteAccountPassword')}</label>
            <input
              type="password"
              value={deletePw}
              onChange={(e) => { setDeletePw(e.target.value); setDeleteError('') }}
              autoComplete="current-password"
            />
            {deleteError && <span className="form-row-error">{deleteError}</span>}
          </div>
        )}
        <button
          className="list-row"
          onClick={handleDeleteAccount}
          disabled={deleteLoading}
          style={{ justifyContent: 'center' }}
        >
          <span style={{ color: 'var(--red)', fontSize: 14 }}>
            {deleteStep === 0 ? t('settings.security.deleteAccount') : t('settings.security.deleteAccountStep2')}
          </span>
        </button>
      </div>
    </div>
  )
}
