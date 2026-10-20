import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { localSoftDelete } from '../../data/repository'
import { useT, useLocale } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { useNav, useRoute } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'
import { ActionSheet } from '../../ui/ActionSheet'
import { formatMoney } from '../../domain/money'

export function ExpenseDetailScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const route = useRoute()
  const [showActions, setShowActions] = useState(false)

  const expId = route.path.match(/^\/despesas\/([a-z0-9]+)/)?.[1] || ''

  const entry = useLiveQuery(() => (expId ? db.mm_perdiem_entries.get(expId) : undefined), [expId])

  const project = useLiveQuery(
    () => (entry?.project ? db.mm_projects.get(entry.project as string) : undefined),
    [entry?.project],
  )

  const profile = useLiveQuery(
    () => (user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined),
    [user?.id],
  )

  const invoice = useLiveQuery(
    () => (entry?.invoice ? db.mm_invoices.get(entry.invoice as string) : undefined),
    [entry?.invoice],
  )

  const handleDelete = async () => {
    if (!entry) return
    if (!confirm(t('expense.detail.deleteConfirm'))) return
    await localSoftDelete('mm_perdiem_entries', entry.id)
    nav.pop()
  }

  if (!entry) {
    return (
      <div className="page page--no-tabs">
        <NavBar
          title={t('expense.detail.title')}
          left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        />
        <div style={{ padding: 24, textAlign: 'center' }}>{t('common.loading')}</div>
      </div>
    )
  }

  const currency =
    (project?.currency as string) || (profile?.currency as string) || 'EUR'
  const kind = entry.kind as string
  const invoiced = !!(entry.invoice as string)

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('expense.detail.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={() => setShowActions(true)}>···</button>}
      />

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {t(`expense.kind.${kind as 'perdiem'}`)}
          </span>
          {invoiced && (
            <span className="pill pill--paid">{t('timesheets.invoiced')}</span>
          )}
        </div>

        <div style={{ fontSize: 15, color: 'var(--label2)', marginBottom: 16 }}>
          {entry.date as string}
          {project && ` · ${project.name as string}`}
        </div>

        {(entry.description as string) && (
          <div
            style={{
              padding: '12px',
              background: 'var(--fill)',
              borderRadius: 10,
              marginBottom: 12,
              fontSize: 15,
            }}
          >
            {entry.description as string}
          </div>
        )}

        <div className="list-group" style={{ marginBottom: 16 }}>
          <div className="list-row">
            <div className="list-row-content">
              <div className="list-row-label">{t('expense.form.quantity')}</div>
            </div>
            <span className="list-row-value">{entry.quantity as number}</span>
          </div>
          <div className="list-row">
            <div className="list-row-content">
              <div className="list-row-label">{t('expense.form.rate')}</div>
            </div>
            <span className="list-row-value">
              {formatMoney(entry.rate_cents as number, currency, locale)}
            </span>
          </div>
          <div className="list-row">
            <div className="list-row-content">
              <div className="list-row-label" style={{ fontWeight: 700 }}>
                {t('expense.form.amount')}
              </div>
            </div>
            <span className="list-row-value" style={{ fontWeight: 700 }}>
              {formatMoney(entry.amount_cents as number, currency, locale)}
            </span>
          </div>
        </div>

        {invoice && (
          <div className="list-group" style={{ marginBottom: 16 }}>
            <button
              className="list-row"
              onClick={() => nav.push(`/faturas/${(entry.invoice as string)}`)}
            >
              <div className="list-row-content">
                <div className="list-row-label">{t('invoice.detail.title')}</div>
                <div className="list-row-sublabel">
                  {invoice.number as string} · {t(`invoice.status.${invoice.status as 'draft'}`)}
                </div>
              </div>
              <svg className="list-row-chevron" viewBox="0 0 7 12" fill="currentColor">
                <path d="M0.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <ActionSheet
        open={showActions}
        onClose={() => setShowActions(false)}
        actions={[
          {
            label: t('expense.detail.edit'),
            onSelect: () => nav.push(`/despesas/${entry.id}/editar`, { id: entry.id }),
          },
          {
            label: t('expense.detail.delete'),
            destructive: true,
            onSelect: handleDelete,
          },
        ]}
      />
    </div>
  )
}
