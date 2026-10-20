import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { localUpdate, localSoftDelete, localCreate } from '../../data/repository'
import { useT, useLocale } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { useNav, useRoute } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'
import { ActionSheet } from '../../ui/ActionSheet'
import { showToast } from '../../ui/Toast'
import { ReceiveSheet } from './ReceiveSheet'
import { formatMoney } from '../../domain/money'
import { formatPeriod, addDays, toDateStr, daysBetween } from '../../domain/dates'
import { canAdvance, canRevert, revertTarget, nextSteps, isEditable, type InvoiceStatus } from '../../domain/invoice-state'

export function InvoiceDetailScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const route = useRoute()

  const invoiceId = route.path.split('/')[2] || ''

  const [showActions, setShowActions] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const invoice = useLiveQuery(
    () => db.mm_invoices.get(invoiceId),
    [invoiceId],
  )

  const items = useLiveQuery(
    () =>
      db.mm_invoice_items
        .where('invoice')
        .equals(invoiceId)
        .filter((i) => !i.deleted_at)
        .toArray(),
    [invoiceId],
  )

  const events = useLiveQuery(
    () =>
      db.mm_invoice_events
        .where('invoice')
        .equals(invoiceId)
        .toArray(),
    [invoiceId],
  )

  const attachments = useLiveQuery(
    () =>
      db.mm_attachments
        .where('invoice')
        .equals(invoiceId)
        .filter((a) => !a.deleted_at)
        .toArray(),
    [invoiceId],
  )

  const profile = useLiveQuery(
    () => (user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined),
    [user?.id],
  )

  const status = (invoice?.status as InvoiceStatus) || 'draft'
  const currency = (invoice?.currency as string) || (profile?.currency as string) || 'EUR'
  const totalCents = (invoice?.total_cents as number) || 0

  const sortedItems = useMemo(
    () => (items ?? []).sort((a, b) => (a.position as number) - (b.position as number)),
    [items],
  )

  const sortedEvents = useMemo(
    () => (events ?? []).sort((a, b) => ((a.at as string) || '').localeCompare((b.at as string) || '')),
    [events],
  )

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function advanceTo(nextStatus: InvoiceStatus) {
    if (!invoice) return

    if (nextStatus === 'paid') {
      setShowReceive(true)
      return
    }

    if (!canAdvance(status, nextStatus)) return

    const updates: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === 'sent') updates.sent_at = new Date().toISOString()
    if (nextStatus === 'confirmed') updates.confirmed_at = new Date().toISOString()

    try {
      await localUpdate('mm_invoices', invoice.id, updates)
      showToast(t(`invoice.status.${nextStatus}`), 'success')
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  async function handleRevert() {
    if (!invoice) return
    const target = revertTarget(status)
    if (!target) return

    try {
      const updates: Record<string, unknown> = { status: target }
      if (target === 'draft') {
        updates.sent_at = ''
      }
      if (target === 'sent') {
        updates.confirmed_at = ''
      }
      if (target === 'confirmed') {
        updates.paid_at = ''
        updates.received_cents = 0
        updates.difference_cents = 0
        updates.payment_note = ''
      }
      await localUpdate('mm_invoices', invoice.id, updates)
      setShowRevertConfirm(false)
      showToast(t(`invoice.status.${target}`), 'info')
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  async function handleDelete() {
    if (!invoice) return
    try {
      await localSoftDelete('mm_invoices', invoice.id)
      setShowDeleteConfirm(false)
      showToast(t('invoice.detail.delete'), 'success')
      nav.pop()
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  async function handleDuplicate() {
    if (!invoice || !user) return
    try {
      const periodDays = daysBetween(
        invoice.period_start as string,
        invoice.period_end as string,
      )
      const newPeriodStart = addDays(invoice.period_end as string, 1)
      const newPeriodEnd = addDays(newPeriodStart, periodDays)

      const pattern = (profile?.invoice_number_pattern as string) || '{YYYY}-{SEQ}'
      const seq = (profile?.next_invoice_seq as number) || 1
      const { formatInvoiceNumber } = await import('../../domain/numbering')
      const newNumber = formatInvoiceNumber(pattern, seq, new Date())

      const newInvoiceId = await localCreate(
        'mm_invoices',
        {
          type: invoice.type,
          number: newNumber,
          invoice_date: toDateStr(new Date()),
          period_start: newPeriodStart,
          period_end: newPeriodEnd,
          currency: invoice.currency,
          status: 'draft',
          client: invoice.client,
          project: invoice.project,
          technician: invoice.technician,
          bank: invoice.bank,
          client_snapshot: invoice.client_snapshot,
          project_snapshot: invoice.project_snapshot,
          total_cents: invoice.total_cents,
          notes: invoice.notes,
        },
        user.id,
      )

      for (const item of sortedItems) {
        await localCreate(
          'mm_invoice_items',
          {
            invoice: newInvoiceId,
            position: item.position,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            rate_cents: item.rate_cents,
            amount_cents: item.amount_cents,
          },
          user.id,
        )
      }

      if (profile) {
        await localUpdate('mm_profiles', profile.id, { next_invoice_seq: seq + 1 })
      }

      showToast(t('invoice.detail.duplicate'), 'success')
      nav.replace(`/faturas/${newInvoiceId}`)
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  if (!invoice) {
    return (
      <div className="page page--no-tabs">
        <NavBar title={t('invoice.detail.title')} left={<button onClick={() => nav.pop()} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 16 }}>{t('common.back')}</button>} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20 }} />
        </div>
      </div>
    )
  }

  const steps = nextSteps(status)
  const primaryAction = steps[0]
  const technician = invoice.technician as Record<string, string> | undefined
  const bank = invoice.bank as Record<string, string> | undefined
  const clientSnap = invoice.client_snapshot as Record<string, string> | undefined
  const projectSnap = invoice.project_snapshot as Record<string, string> | undefined

  function SnapshotSection({ title, sectionKey, data }: { title: string; sectionKey: string; data: Record<string, string> | undefined }) {
    if (!data) return null
    const values = Object.entries(data).filter(([, v]) => v)
    if (values.length === 0) return null
    const expanded = expandedSections.has(sectionKey)

    return (
      <>
        <button
          className="list-row"
          onClick={() => toggleSection(sectionKey)}
          style={{ justifyContent: 'space-between' }}
        >
          <span>{title}</span>
          <span style={{ color: 'var(--label2)', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <div style={{ padding: '0 16px 12px', fontSize: 14, color: 'var(--label2)' }}>
            {values.map(([k, v]) => (
              <div key={k} style={{ marginBottom: 4 }}>{v}</div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('invoice.detail.title')}
        left={
          <button onClick={() => nav.pop()} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 16 }}>
            {t('common.back')}
          </button>
        }
        right={
          <button onClick={() => setShowActions(true)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 16 }}>
            •••
          </button>
        }
      />

      <div style={{ padding: '0 16px 120px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div
            style={{
              display: 'inline-flex',
              width: 40,
              height: 40,
              borderRadius: 20,
              background: invoice.type === 'hours' ? 'var(--blue)' : 'var(--orange)',
              color: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            {invoice.type === 'hours' ? 'H' : 'D'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--label2)' }}>#{invoice.number as string}</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
            {formatMoney(totalCents, currency, locale)}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`pill pill--${status}`}>{t(`invoice.status.${status}`)}</span>
          </div>
          {status === 'paid' && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              {(invoice.difference_cents as number) === 0 ? (
                <span style={{ color: 'var(--green)' }}>{t('invoice.alert.checked')}</span>
              ) : (
                <span style={{ color: 'var(--orange)' }}>
                  {t('invoice.alert.difference', {
                    amount: formatMoney(invoice.difference_cents as number, currency, locale),
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Primary action */}
        {primaryAction && (
          <button
            className="btn btn--primary"
            style={{ width: '100%', marginBottom: 16 }}
            onClick={() => advanceTo(primaryAction)}
          >
            {t(`invoice.action.${primaryAction === 'sent' ? 'send' : primaryAction === 'confirmed' ? 'confirm' : primaryAction === 'paid' ? 'receive' : 'cancel'}`)}
          </button>
        )}

        {/* Period */}
        {!!(invoice.period_start && invoice.period_end) && (
          <>
            <div className="list-group-header">{t('invoice.detail.period')}</div>
            <div className="list-group">
              <div className="list-row">
                {formatPeriod(invoice.period_start as string, invoice.period_end as string, locale)}
              </div>
            </div>
          </>
        )}

        {/* Lines */}
        {sortedItems.length > 0 && (
          <>
            <div className="list-group-header">{t('invoice.detail.lines')}</div>
            <div className="list-group">
              {sortedItems.map((item) => (
                <div key={item.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, flex: 1 }}>{item.description as string}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>
                      {formatMoney(item.amount_cents as number, currency, locale)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--label2)', marginTop: 2 }}>
                    {item.quantity as number} {item.unit as string} × {formatMoney(item.rate_cents as number, currency, locale)}
                  </div>
                </div>
              ))}
              <div className="list-row" style={{ justifyContent: 'space-between', fontWeight: 600 }}>
                <span>{t('invoice.detail.total')}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(totalCents, currency, locale)}</span>
              </div>
            </div>
          </>
        )}

        {/* Snapshots */}
        <div className="list-group-header">{t('invoice.detail.title')}</div>
        <div className="list-group">
          <SnapshotSection title={t('invoice.detail.technician')} sectionKey="tech" data={technician} />
          <SnapshotSection title={t('invoice.detail.bank')} sectionKey="bank" data={bank} />
          <SnapshotSection title={t('invoice.detail.client')} sectionKey="client" data={clientSnap} />
          <SnapshotSection title={t('invoice.detail.project')} sectionKey="project" data={projectSnap} />
        </div>

        {/* Attachments */}
        {(attachments ?? []).length > 0 && (
          <>
            <div className="list-group-header">{t('invoice.detail.attachments')}</div>
            <div className="list-group">
              {(attachments ?? []).map((att) => (
                <div key={att.id} className="list-row">
                  <span style={{ fontSize: 14 }}>{att.file_name as string}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Notes */}
        {(invoice.notes as string) && (
          <>
            <div className="list-group-header">{t('invoice.detail.notes')}</div>
            <div className="list-group">
              <div className="list-row" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
                {invoice.notes as string}
              </div>
            </div>
          </>
        )}

        {/* Payment note */}
        {status === 'paid' && (invoice.payment_note as string) && (
          <div className="list-group" style={{ marginTop: 8 }}>
            <div className="list-row" style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--label2)' }}>
              {invoice.payment_note as string}
            </div>
          </div>
        )}

        {/* Timeline */}
        {sortedEvents.length > 0 && (
          <>
            <div className="list-group-header">{t('invoice.detail.history')}</div>
            <div className="list-group">
              {sortedEvents.map((ev) => (
                <div key={ev.id} className="list-row" style={{ fontSize: 14, color: 'var(--label2)' }}>
                  <span className={`pill pill--${ev.to_status} pill--small`} style={{ marginRight: 8 }}>
                    {t(`invoice.status.${ev.to_status as InvoiceStatus}`)}
                  </span>
                  <span>{ev.at as string}</span>
                  {(ev.note as string) && <span style={{ marginLeft: 8 }}>— {ev.note as string}</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Revert */}
        {canRevert(status) && (
          <button
            className="btn btn--secondary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={() => setShowRevertConfirm(true)}
          >
            {t('invoice.action.revert')}
          </button>
        )}
      </div>

      {/* Actions menu */}
      <ActionSheet
        open={showActions}
        onClose={() => setShowActions(false)}
        actions={[
          ...(isEditable(status)
            ? [{ label: t('invoice.detail.edit'), onSelect: () => nav.push(`/faturas/${invoiceId}/editar`) }]
            : []),
          { label: t('invoice.detail.duplicate'), onSelect: handleDuplicate },
          ...(isEditable(status)
            ? [{ label: t('invoice.detail.delete'), destructive: true, onSelect: () => setShowDeleteConfirm(true) }]
            : []),
        ]}
      />

      {/* Receive sheet */}
      <ReceiveSheet
        open={showReceive}
        onClose={() => setShowReceive(false)}
        invoiceId={invoiceId}
        totalCents={totalCents}
        currency={currency}
      />

      {/* Revert confirmation */}
      {showRevertConfirm && (
        <div className="sheet-overlay" onClick={() => setShowRevertConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('invoice.action.revert')}</div>
            <div style={{ fontSize: 14, color: 'var(--label2)', marginBottom: 16 }}>
              {t('invoice.action.revertConfirm')}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => setShowRevertConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleRevert}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="sheet-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('invoice.detail.delete')}</div>
            <div style={{ fontSize: 14, color: 'var(--label2)', marginBottom: 16 }}>
              {t('invoice.action.revertConfirm')}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--primary" style={{ flex: 1, background: 'var(--red)' }} onClick={handleDelete}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
