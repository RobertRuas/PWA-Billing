import { useState, useEffect } from 'react'
import { useT } from '../../i18n'
import { pb } from '../../data/pb'

export function BackupConfirmScreen() {
  const t = useT()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    pb.send('/api/mm/backup/destinations/verify', {
      method: 'POST',
      body: { token },
    })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="page page--no-tabs" style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ marginTop: '30vh' }}>
        {status === 'loading' && (
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20, margin: '0 auto' }} />
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t('settings.backup.confirmEmail.title')}</h2>
            <p style={{ color: 'var(--secondary-label)', fontSize: 14 }}>{t('settings.backup.confirmEmail.success')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10007;</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t('common.error')}</h2>
            <p style={{ color: 'var(--secondary-label)', fontSize: 14 }}>{t('settings.backup.confirmEmail.error')}</p>
          </>
        )}
      </div>
    </div>
  )
}
