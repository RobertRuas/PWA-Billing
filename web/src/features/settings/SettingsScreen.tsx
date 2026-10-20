import { useAuth } from '../../app/AuthContext'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { SyncIndicator } from '../../ui/SyncIndicator'

export function SettingsScreen() {
  const t = useT()
  const { user, logout } = useAuth()
  const nav = useNav()

  function Chevron() {
    return (
      <svg className="list-row-chevron" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0.5 1l5 5-5 5" />
      </svg>
    )
  }

  async function handleLogout() {
    if (confirm(t('settings.logout.confirm'))) {
      await logout()
    }
  }

  return (
    <div className="page">
      <div className="large-title">{t('settings.title')}</div>

      {/* Account */}
      <div className="list-group-header">{t('settings.account')}</div>
      <div className="list-group">
        <div className="list-row">
          <div className="list-row-content"><div className="list-row-label">{t('settings.account.name')}</div></div>
          <span className="list-row-value">{user?.name}</span>
        </div>
        <button className="list-row" onClick={() => nav.push('/ajustes/conta')}>
          <div className="list-row-content"><div className="list-row-label">{t('settings.account.email')}</div></div>
          <span className="list-row-value">{user?.email}</span>
          <Chevron />
        </button>
      </div>

      {/* Invoice data */}
      <div className="list-group-header">{t('settings.invoiceData')}</div>
      <div className="list-group">
        <button className="list-row" onClick={() => nav.push('/ajustes/tecnico')}>
          <div className="list-row-icon" style={{ background: 'var(--blue)' }}>
            <svg viewBox="0 0 24 24" fill="#fff" width="14" height="14"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          </div>
          <div className="list-row-content"><div className="list-row-label">{t('settings.technician')}</div></div>
          <Chevron />
        </button>
        <button className="list-row" onClick={() => nav.push('/ajustes/banco')}>
          <div className="list-row-icon" style={{ background: 'var(--green)' }}>
            <svg viewBox="0 0 24 24" fill="#fff" width="14" height="14"><path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z" /></svg>
          </div>
          <div className="list-row-content"><div className="list-row-label">{t('settings.bank')}</div></div>
          <Chevron />
        </button>
        <button className="list-row" onClick={() => nav.push('/ajustes/clientes')}>
          <div className="list-row-icon" style={{ background: 'var(--orange)' }}>
            <svg viewBox="0 0 24 24" fill="#fff" width="14" height="14"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" /></svg>
          </div>
          <div className="list-row-content"><div className="list-row-label">{t('settings.clients')}</div></div>
          <Chevron />
        </button>
        <button className="list-row" onClick={() => nav.push('/ajustes/projetos')}>
          <div className="list-row-icon" style={{ background: 'var(--indigo)' }}>
            <svg viewBox="0 0 24 24" fill="#fff" width="14" height="14"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" /></svg>
          </div>
          <div className="list-row-content"><div className="list-row-label">{t('settings.projects')}</div></div>
          <Chevron />
        </button>
      </div>

      {/* Billing */}
      <div className="list-group-header">{t('settings.billing')}</div>
      <div className="list-group">
        <button className="list-row" onClick={() => nav.push('/ajustes/faturacao')}>
          <div className="list-row-content"><div className="list-row-label">{t('settings.billing')}</div></div>
          <Chevron />
        </button>
      </div>

      {/* Preferences */}
      <div className="list-group-header">{t('settings.preferences')}</div>
      <div className="list-group">
        <button className="list-row" onClick={() => nav.push('/ajustes/preferencias')}>
          <div className="list-row-content"><div className="list-row-label">{t('settings.preferences.language')}</div></div>
          <Chevron />
        </button>
      </div>

      {/* Sync */}
      <div className="list-group-header">{t('settings.sync')}</div>
      <div className="list-group">
        <div className="list-row">
          <SyncIndicator />
        </div>
      </div>

      {/* Backup */}
      <div className="list-group-header">{t('settings.backup')}</div>
      <div className="list-group">
        <button className="list-row" onClick={() => nav.push('/ajustes/backup')}>
          <div className="list-row-content"><div className="list-row-label">{t('settings.backup')}</div></div>
          <Chevron />
        </button>
      </div>

      {/* Security */}
      <div className="list-group-header">{t('settings.security')}</div>
      <div className="list-group">
        <button className="list-row" onClick={() => nav.push('/ajustes/seguranca')}>
          <div className="list-row-content"><div className="list-row-label">{t('settings.security')}</div></div>
          <Chevron />
        </button>
      </div>

      {/* About */}
      <div className="list-group-header">{t('settings.about')}</div>
      <div className="list-group">
        <div className="list-row">
          <div className="list-row-content"><div className="list-row-label">{t('settings.about.version')}</div></div>
          <span className="list-row-value">1.0.0</span>
        </div>
        <div className="list-row">
          <div className="list-row-content"><div className="list-row-label">{t('settings.about.offlineReady')}</div></div>
          <span className="list-row-value" style={{ color: 'var(--green)' }}>✓</span>
        </div>
      </div>

      {/* Logout */}
      <div className="list-group" style={{ marginTop: 24, marginBottom: 40 }}>
        <button className="list-row" onClick={handleLogout} style={{ justifyContent: 'center' }}>
          <span style={{ color: 'var(--red)', fontSize: 14 }}>{t('settings.logout')}</span>
        </button>
      </div>
    </div>
  )
}
