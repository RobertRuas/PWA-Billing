import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { pb } from '../../data/pb'
import { useNav } from '../../app/navigation'

export function VerifyEmailScreen() {
  const t = useT()
  const nav = useNav()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    pb.collection('mm_users')
      .confirmVerification(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="page page--no-tabs" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 24px', textAlign: 'center' }}>
      {status === 'loading' && <p>{t('common.loading')}</p>}
      {status === 'success' && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t('auth.verify.title')}</h2>
          <p style={{ fontSize: 13, color: 'var(--label2)', marginBottom: 24 }}>{t('auth.verify.success')}</p>
          <button className="btn btn--primary" onClick={() => nav.reset('/')} style={{ maxWidth: 200 }}>
            {t('auth.verify.login')}
          </button>
        </>
      )}
      {status === 'error' && (
        <>
          <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 24 }}>{t('auth.verify.error')}</p>
          <button className="btn btn--secondary" onClick={() => nav.reset('/')} style={{ maxWidth: 200 }}>
            {t('common.back')}
          </button>
        </>
      )}
    </div>
  )
}
