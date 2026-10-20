import { useT } from '../i18n'

const TABS = [
  { key: 'summary', icon: 'summary' },
  { key: 'invoices', icon: 'invoices' },
  { key: 'timesheets', icon: 'timesheets' },
  { key: 'reports', icon: 'reports' },
  { key: 'settings', icon: 'settings' },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
  active: TabKey
  onSelect: (tab: TabKey) => void
  badges?: Partial<Record<TabKey, number>>
}

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'var(--blue)' : 'var(--gray)'
  const icons: Record<string, string> = {
    summary: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V7H7z',
    invoices: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z',
    timesheets: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    reports: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',
  }
  return (
    <svg viewBox="0 0 24 24" fill={color}>
      <path d={icons[name]} />
    </svg>
  )
}

export function TabBar({ active, onSelect, badges = {} }: Props) {
  const t = useT()

  const tabLabels: Record<TabKey, string> = {
    summary: t('tab.summary'),
    invoices: t('tab.invoices'),
    timesheets: t('tab.timesheets'),
    reports: t('tab.reports'),
    settings: t('tab.settings'),
  }

  return (
    <div className="tab-bar">
      <div className="tab-bar-inner">
        {TABS.map(({ key, icon }) => (
          <button
            key={key}
            className={`tab-bar-item ${active === key ? 'tab-bar-item--active' : ''}`}
            onClick={() => onSelect(key)}
            aria-label={tabLabels[key]}
          >
            {badges[key] ? <span className="tab-bar-badge">{badges[key]}</span> : null}
            <TabIcon name={icon} active={active === key} />
            <span>{tabLabels[key]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export type { TabKey }
