import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useT, useLocale } from '../../i18n'
import { formatMoney } from '../../domain/money'
import { overlapDays, daysBetween } from '../../domain/dates'
import { useAuth } from '../../app/AuthContext'

type RangeType = 'month' | 'quarter' | 'year' | 'custom'
type DateBase = 'invoiceDate' | 'receiptDate' | 'workPeriod'

function rangeForType(type: RangeType, offset: number): { start: string; end: string } {
  const now = new Date()
  if (type === 'year') {
    const y = now.getUTCFullYear() + offset
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  if (type === 'quarter') {
    const q = Math.floor(now.getUTCMonth() / 3) + offset
    const baseYear = now.getUTCFullYear() + Math.floor(q / 4)
    const baseQ = ((q % 4) + 4) % 4
    const sm = baseQ * 3
    const start = `${baseYear}-${String(sm + 1).padStart(2, '0')}-01`
    const endMonth = sm + 3
    const endYear = endMonth > 12 ? baseYear + 1 : baseYear
    const em = endMonth > 12 ? endMonth - 12 : endMonth
    const lastDay = new Date(Date.UTC(endYear, em, 0)).getUTCDate()
    const end = `${endYear}-${String(em).padStart(2, '0')}-${lastDay}`
    return { start, end }
  }
  // month
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return {
    start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    end: `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}`,
  }
}

export function ReportsScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const [rangeType, setRangeType] = useState<RangeType>('year')
  const [offset, setOffset] = useState(0)
  const [dateBase, setDateBase] = useState<DateBase>('invoiceDate')

  const profile = useLiveQuery(() =>
    user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined,
    [user?.id],
  )

  const allInvoices = useLiveQuery(() =>
    user ? db.mm_invoices.where('owner').equals(user.id).filter((i) => !i.deleted_at).toArray() : [],
    [user?.id],
  )

  const currency = (profile?.currency as string) || 'EUR'
  const range = rangeForType(rangeType, offset)

  const filtered = useMemo(() => {
    return (allInvoices ?? []).filter((inv) => {
      if (inv.status === 'cancelled') return false
      if (dateBase === 'invoiceDate') {
        return (inv.invoice_date as string) >= range.start && (inv.invoice_date as string) <= range.end
      }
      if (dateBase === 'receiptDate') {
        if (inv.status !== 'paid') return false
        return (inv.paid_at as string)?.slice(0, 10) >= range.start && (inv.paid_at as string)?.slice(0, 10) <= range.end
      }
      // workPeriod — overlap
      return overlapDays(range.start, range.end, inv.period_start as string, inv.period_end as string) > 0
    })
  }, [allInvoices, dateBase, range])

  const totalIssued = filtered.reduce((s, i) => {
    if (dateBase === 'workPeriod') {
      const totalDays = daysBetween(i.period_start as string, i.period_end as string) + 1
      const overlap = overlapDays(range.start, range.end, i.period_start as string, i.period_end as string)
      return s + Math.round(((i.total_cents as number) * overlap) / totalDays)
    }
    return s + (i.total_cents as number)
  }, 0)

  const totalReceived = filtered.filter((i) => i.status === 'paid').reduce((s, i) => {
    if (dateBase === 'workPeriod') {
      const totalDays = daysBetween(i.period_start as string, i.period_end as string) + 1
      const overlap = overlapDays(range.start, range.end, i.period_start as string, i.period_end as string)
      return s + Math.round(((i.received_cents as number) * overlap) / totalDays)
    }
    return s + (i.received_cents as number)
  }, 0)

  const toReceive = totalIssued - totalReceived

  function exportCSV() {
    const header = 'Number;Date;Type;Period Start;Period End;Status;Total;Received;Difference\n'
    const rows = filtered.map((i) =>
      [
        i.number,
        i.invoice_date,
        i.type,
        i.period_start,
        i.period_end,
        i.status,
        ((i.total_cents as number) / 100).toFixed(2),
        ((i.received_cents as number) / 100).toFixed(2),
        ((i.difference_cents as number) / 100).toFixed(2),
      ].join(';'),
    ).join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billing-report-${range.start}-${range.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rangeTypes: { key: RangeType; label: string }[] = [
    { key: 'month', label: t('reports.month') },
    { key: 'quarter', label: t('reports.quarter') },
    { key: 'year', label: t('reports.year') },
    { key: 'custom', label: t('reports.custom') },
  ]

  return (
    <div className="page">
      <div className="large-title">{t('reports.title')}</div>

      <div className="segmented">
        {rangeTypes.map((r) => (
          <button
            key={r.key}
            className={`segmented-btn ${rangeType === r.key ? 'segmented-btn--active' : ''}`}
            onClick={() => { setRangeType(r.key); setOffset(0) }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={() => setOffset((o) => o - 1)} style={{ fontSize: 18, color: 'var(--blue)' }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {rangeType === 'year' ? range.start.slice(0, 4) : `${range.start} – ${range.end}`}
        </span>
        <button onClick={() => setOffset((o) => o + 1)} style={{ fontSize: 18, color: 'var(--blue)' }}>›</button>
      </div>

      {/* Date base selector */}
      <div className="list-group">
        <div className="form-row">
          <label style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--label2)' }}>{t('reports.dateBase')}</label>
          <select value={dateBase} onChange={(e) => setDateBase(e.target.value as DateBase)}>
            <option value="invoiceDate">{t('reports.dateBase.invoiceDate')}</option>
            <option value="receiptDate">{t('reports.dateBase.receiptDate')}</option>
            <option value="workPeriod">{t('reports.dateBase.workPeriod')}</option>
          </select>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '16px 16px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10.5, color: 'var(--label2)', textTransform: 'uppercase' }}>{t('reports.issued')}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{formatMoney(totalIssued, currency, locale)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10.5, color: 'var(--label2)', textTransform: 'uppercase' }}>{t('reports.received')}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--green)' }}>{formatMoney(totalReceived, currency, locale)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10.5, color: 'var(--label2)', textTransform: 'uppercase' }}>{t('reports.toReceive')}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--blue)' }}>{formatMoney(toReceive, currency, locale)}</div>
        </div>
      </div>

      {/* Invoice list */}
      {filtered.length > 0 && (
        <div className="list-group" style={{ marginTop: 16 }}>
          {filtered.map((inv) => (
            <div key={inv.id} className="list-row">
              <div className="list-row-content">
                <div className="list-row-label">#{inv.number as string}</div>
                <div className="list-row-sublabel">{inv.invoice_date as string}</div>
              </div>
              <span className="list-row-value">{formatMoney(inv.total_cents as number, currency, locale)}</span>
              <span className={`pill pill--${inv.status}`}>{t(`invoice.status.${inv.status as 'draft'}`)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '16px' }}>
        <button className="btn btn--secondary" onClick={exportCSV}>
          {t('reports.exportCSV')}
        </button>
      </div>
    </div>
  )
}
