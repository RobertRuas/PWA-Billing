import { useState, useEffect, useCallback } from 'react'
import { useT } from '../../i18n'
import { Sheet } from '../../ui/Sheet'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
})

function isStandalone(): boolean {
  return (
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
}

function isIOSNonSafari(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
}

const DISMISS_KEY = 'install_dismissed_at'

function isDismissed(): boolean {
  try {
    const val = localStorage.getItem(DISMISS_KEY)
    if (!val) return false
    const dismissedAt = parseInt(val, 10)
    return Date.now() - dismissedAt < 14 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function useInstallPrompt() {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return
    setShouldShow(true)
  }, [])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* noop */ }
    setShouldShow(false)
  }, [])

  return { shouldShow, dismiss }
}

interface Props {
  open: boolean
  onClose: () => void
}

export function InstallSheet({ open, onClose }: Props) {
  const t = useT()

  async function handleAndroidInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        deferredPrompt = null
        onClose()
      }
    }
  }

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* noop */ }
    onClose()
  }

  const showAndroidInstall = !!deferredPrompt

  return (
    <Sheet open={open} onClose={onClose} title={t('install.title')}>
      <div style={{ padding: '0 16px 24px' }}>
        {isIOSSafari() && (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>1.</span>
              <span>{t('install.ios.step1')}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--blue)">
                <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z" />
              </svg>
              <span>({t('install.ios.share')})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>2.</span>
              <span>{t('install.ios.step2')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>3.</span>
              <span>{t('install.ios.step3')}</span>
            </div>
          </div>
        )}

        {isIOSNonSafari() && (
          <p style={{ fontSize: 14, color: 'var(--label2)', textAlign: 'center' }}>
            {t('install.ios.notSafari')}
          </p>
        )}

        {showAndroidInstall && (
          <button
            className="btn btn--primary"
            style={{ width: '100%' }}
            onClick={handleAndroidInstall}
          >
            {t('install.android.install')}
          </button>
        )}

        {!isIOSSafari() && !isIOSNonSafari() && !showAndroidInstall && (
          <p style={{ fontSize: 14, color: 'var(--label2)', textAlign: 'center' }}>
            {t('install.ios.step2')}
          </p>
        )}

        <button
          className="btn btn--secondary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={handleDismiss}
        >
          {t('install.later')}
        </button>
      </div>
    </Sheet>
  )
}
