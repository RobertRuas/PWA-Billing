import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useT, useLocale } from '../../i18n'
import { formatMoney } from '../../domain/money'
import { formatPeriod } from '../../domain/dates'
import { isPending, type InvoiceStatus } from '../../domain/invoice-state'
import { useAuth } from '../../app/AuthContext'
import { useNav } from '../../app/navigation'
import { ActionSheet } from '../../ui/ActionSheet'

type Filter = 'all' | 'pending' | 'received' | 'drafts'

export function InvoiceListScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showNewMenu, setShowNewMenu] = useState(false)

  const allInvoices = useLiveQuery(() =>
    user
      ? db.mm_invoices
          .where('owner')
          .equals(user.id)
          .filter((i) => !i.deleted_at)
          .toArray()
      : [],
    [user?.id],
  )

  const profile = useLiveQuery(() =>
    user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined,
    [user?.id],
  )

  const currency = (profile?.currency as string) || 'EUR'

  const filtered = useMemo(() => {
    let list = allInvoices ?? []

    if (filter === 'pending') list = list.filter((i) => isPending(i.status as InvoiceStatus))
    else if (filter === 'received') list = list.filter((i) => i.status === 'paid')
    else if (filter === 'drafts') list = list.filter((i) => i.status === 'draft')

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) =>
          (i.number as string)?.toLowerCase().includes(q) ||
          (i.notes as string)?.toLowerCase().includes(q),
      )
    }

    return list.sort((a, b) => ((b.invoice_date as string) || '').localeCompare((a.invoice_date as string) || ''))
  }, [allInvoices, filter, search])

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {}
    for (const inv of filtered) {
      const d = inv.invoice_date as string
      const key = d?.slice(0, 7) || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(inv)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('invoices.all') },
    { key: 'pending', label: t('invoices.pending') },
    { key: 'received', label: t('invoices.received') },
    { key: 'drafts', label: t('invoices.drafts') },
  ]

  function monthLabel(ym: string): string {
    const [y, m] = ym.split('-')
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1))
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }

  return (
    <div className="page">
      <div className="large-title">{t('invoices.title')}</div>

      <div className="segmented">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`segmented-btn ${filter === f.key ? 'segmented-btn--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="search-field">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          type="text"
          placeholder={t('invoices.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{t('invoices.empty')}</div>
        </div>
      ) : (
        grouped.map(([ym, invoices]) => {
          const groupTotal = invoices.reduce((s, i) => s + ((i.total_cents as number) || 0), 0)
          return (
            <div key={ym}>
              <div className="list-group-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{monthLabel(ym)}</span>
                <span>{formatMoney(groupTotal, currency, locale)}</span>
              </div>
              <div className="list-group">
                {invoices.map((inv) => (
                  <button key={inv.id} className="list-row" onClick={() => nav.push(`/faturas/${inv.id}`)}>
                    <div
                      className="list-row-icon"
                      style={{ background: inv.type === 'hours' ? 'var(--blue)' : 'var(--orange)', fontSize: 12 }}
                    >
                      {inv.type === 'hours' ? 'H' : 'D'}
                    </div>
                    <div className="list-row-content">
                      <div className="list-row-label">#{inv.number as string}</div>
                      <div className="list-row-sublabel">
                        {formatPeriod(inv.period_start as string, inv.period_end as string, locale)}
                      </div>
                    </div>
                    <span className="list-row-value">
                      {formatMoney(inv.total_cents as number, currency, locale)}
                    </span>
                    <span className={`pill pill--${inv.status}`}>
                      {t(`invoice.status.${inv.status as InvoiceStatus}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })
      )}

      <button className="fab" onClick={() => setShowNewMenu(true)} aria-label={t('invoices.new')}>
        +
      </button>

      <ActionSheet
        open={showNewMenu}
        onClose={() => setShowNewMenu(false)}
        actions={[
          { label: t('invoices.newHours'), onSelect: () => nav.push('/faturas/nova?tipo=hours') },
          { label: t('invoices.newExpenses'), onSelect: () => nav.push('/faturas/nova?tipo=expenses') },
        ]}
      />
    </div>
  )
}
