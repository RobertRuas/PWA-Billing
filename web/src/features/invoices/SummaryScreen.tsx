import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useT, useLocale } from '../../i18n'
import { formatMoney } from '../../domain/money'
import { formatPeriod } from '../../domain/dates'
import { SyncIndicator } from '../../ui/SyncIndicator'
import { ActionSheet } from '../../ui/ActionSheet'
import { useAuth } from '../../app/AuthContext'
import { useNav } from '../../app/navigation'
import type { InvoiceStatus } from '../../domain/invoice-state'

export function SummaryScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const [showNewMenu, setShowNewMenu] = useState(false)
  const year = new Date().getFullYear()

  const profile = useLiveQuery(() =>
    user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined,
    [user?.id],
  )

  const invoices = useLiveQuery(() =>
    user ? db.mm_invoices.where('owner').equals(user.id).filter((i) => !i.deleted_at).toArray() : [],
    [user?.id],
  )

  const currency = (profile?.currency as string) || 'EUR'

  const receivedThisYear = (invoices ?? [])
    .filter((i) => i.status === 'paid' && (i.paid_at as string)?.startsWith(String(year)))
    .reduce((sum, i) => sum + ((i.received_cents as number) || 0), 0)

  const pendingInvoices = (invoices ?? []).filter((i) =>
    (i.status as InvoiceStatus) === 'sent' || (i.status as InvoiceStatus) === 'confirmed',
  )
  const toReceive = pendingInvoices.reduce((sum, i) => sum + ((i.total_cents as number) || 0), 0)

  const recentPaid = (invoices ?? [])
    .filter((i) => i.status === 'paid')
    .sort((a, b) => ((b.paid_at as string) || '').localeCompare((a.paid_at as string) || ''))
    .slice(0, 3)

  const [reminderDays, setReminderDays] = useState(0)
  useEffect(() => {
    if (profile) setReminderDays(profile.payment_reminder_days as number || 0)
  }, [profile])

  const overdueInvoices = pendingInvoices.filter((inv) => {
    if (reminderDays <= 0) return false
    const sentAt = (inv.sent_at as string) || (inv.invoice_date as string)
    if (!sentAt) return false
    const diff = (Date.now() - new Date(sentAt).getTime()) / 86400000
    return diff > reminderDays
  })

  const diffInvoices = (invoices ?? []).filter(
    (i) => i.status === 'paid' && (i.difference_cents as number) !== 0,
  )

  const hasAlerts = overdueInvoices.length > 0 || diffInvoices.length > 0
  const isEmpty = (invoices ?? []).length === 0

  return (
    <div className="page">
      <div className="large-title">{t('summary.title')}</div>
      <SyncIndicator />

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>
          </div>
          <div className="empty-state-title">{t('summary.empty')}</div>
          <button className="btn btn--primary btn--small" onClick={() => setShowNewMenu(true)}>
            {t('summary.newInvoice')}
          </button>
        </div>
      ) : (
        <>
          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '8px 16px' }}>
            <div className="list-group" style={{ margin: 0, padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--label2)', textTransform: 'uppercase' }}>
                {t('summary.receivedThisYear', { year: String(year) })}
              </div>
              <div className="value-large" style={{ fontSize: 22, marginTop: 4 }}>
                {formatMoney(receivedThisYear, currency, locale)}
              </div>
            </div>
            <div className="list-group" style={{ margin: 0, padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--label2)', textTransform: 'uppercase' }}>
                {t('summary.toReceive')}
              </div>
              <div className="value-large" style={{ fontSize: 22, marginTop: 4, color: 'var(--blue)' }}>
                {formatMoney(toReceive, currency, locale)}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--label2)', marginTop: 2 }}>
                {t('summary.invoiceCount', { count: pendingInvoices.length })}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {hasAlerts && (
            <>
              <div className="list-group-header">{t('summary.alerts')}</div>
              <div className="list-group">
                {overdueInvoices.map((inv) => {
                  const sentAt = (inv.sent_at as string) || (inv.invoice_date as string)
                  const days = Math.floor((Date.now() - new Date(sentAt).getTime()) / 86400000)
                  return (
                    <button key={inv.id} className="list-row" onClick={() => nav.push(`/faturas/${inv.id}`)}>
                      <span className="pill pill--overdue">{t('invoice.alert.overdue', { days })}</span>
                      <span className="list-row-value">#{inv.number as string}</span>
                    </button>
                  )
                })}
                {diffInvoices.map((inv) => (
                  <button key={inv.id} className="list-row" onClick={() => nav.push(`/faturas/${inv.id}`)}>
                    <span className="pill pill--overdue">
                      {t('invoice.alert.difference', { amount: formatMoney(inv.difference_cents as number, currency, locale) })}
                    </span>
                    <span className="list-row-value">#{inv.number as string}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Pending */}
          {pendingInvoices.length > 0 && (
            <>
              <div className="list-group-header">{t('summary.pending')}</div>
              <div className="list-group">
                {pendingInvoices.slice(0, 5).map((inv) => (
                  <button key={inv.id} className="list-row" onClick={() => nav.push(`/faturas/${inv.id}`)}>
                    <div className="list-row-content">
                      <div className="list-row-label">#{inv.number as string}</div>
                      <div className="list-row-sublabel">
                        {formatPeriod(inv.period_start as string, inv.period_end as string, locale)}
                      </div>
                    </div>
                    <span className="list-row-value">{formatMoney(inv.total_cents as number, currency, locale)}</span>
                    <span className={`pill pill--${inv.status}`}>{t(`invoice.status.${inv.status as InvoiceStatus}`)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Recent paid */}
          {recentPaid.length > 0 && (
            <>
              <div className="list-group-header">{t('summary.recentlyReceived')}</div>
              <div className="list-group">
                {recentPaid.map((inv) => (
                  <button key={inv.id} className="list-row" onClick={() => nav.push(`/faturas/${inv.id}`)}>
                    <div className="list-row-content">
                      <div className="list-row-label">#{inv.number as string}</div>
                      <div className="list-row-sublabel">
                        {formatPeriod(inv.period_start as string, inv.period_end as string, locale)}
                      </div>
                    </div>
                    <span className="list-row-value">{formatMoney(inv.received_cents as number, currency, locale)}</span>
                    <span className="pill pill--paid">{t('invoice.status.paid')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
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
          { label: t('timesheets.new'), onSelect: () => nav.push('/timesheets/nova') },
          { label: t('expenses.new'), onSelect: () => nav.push('/despesas/nova') },
        ]}
      />
    </div>
  )
}
