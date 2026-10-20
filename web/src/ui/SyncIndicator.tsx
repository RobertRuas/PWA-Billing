import { useState, useEffect } from 'react'
import { useT, useLocale } from '../i18n'
import { onSyncChange, runSync } from '../data/sync'

export function SyncIndicator() {
  const t = useT()
  const locale = useLocale()
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const unsub = onSyncChange((s, ls, p) => {
      setStatus(s)
      setLastSync(ls)
      setPending(p)
    })

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      unsub()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  function formatLastSync(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()

    if (diffMs < 60000) return t('common.now')

    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

    if (isToday) return `${t('common.today')} ${time}`
    if (isYesterday) return `${t('common.yesterday')} ${time}`
    return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${time}`
  }

  let dotClass = 'sync-dot'
  let text: string

  if (status === 'syncing') {
    dotClass += ' sync-dot--syncing'
    text = t('sync.syncing')
  } else if (status === 'error') {
    dotClass += ' sync-dot--error'
    text = t('sync.error')
  } else if (!online) {
    dotClass += ' sync-dot--offline'
    text = lastSync
      ? `${t('sync.offline')} · ${t('sync.lastSync')} ${formatLastSync(lastSync)}`
      : t('sync.offline')
  } else {
    dotClass += ' sync-dot--online'
    text = lastSync
      ? `${t('sync.synced')} · ${formatLastSync(lastSync)}`
      : t('sync.synced')
  }

  if (pending > 0 && status !== 'syncing') {
    text += ` · ${t('sync.pending', { count: pending })}`
  }

  return (
    <button className="sync-indicator" onClick={() => runSync()} aria-label={t('sync.now')}>
      <span className={dotClass} />
      <span>{text}</span>
    </button>
  )
}
