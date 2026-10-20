import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useT, useLocale } from '../../i18n'
import { formatPeriod } from '../../domain/dates'
import { useAuth } from '../../app/AuthContext'
import { useNav } from '../../app/navigation'

type Segment = 'hours' | 'expenses'

export function TimesheetsScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const [segment, setSegment] = useState<Segment>('hours')

  const timesheets = useLiveQuery(() =>
    user ? db.mm_timesheets.where('owner').equals(user.id).filter((ts) => !ts.deleted_at).toArray() : [],
    [user?.id],
  )

  const expenses = useLiveQuery(() =>
    user ? db.mm_perdiem_entries.where('owner').equals(user.id).filter((e) => !e.deleted_at).toArray() : [],
    [user?.id],
  )

  const sortedTimesheets = useMemo(
    () => (timesheets ?? []).sort((a, b) => ((b.week_start as string) || '').localeCompare((a.week_start as string) || '')),
    [timesheets],
  )

  const sortedExpenses = useMemo(
    () => (expenses ?? []).sort((a, b) => ((b.date as string) || '').localeCompare((a.date as string) || '')),
    [expenses],
  )

  return (
    <div className="page">
      <div className="large-title">{t('timesheets.title')}</div>

      <div className="segmented">
        <button className={`segmented-btn ${segment === 'hours' ? 'segmented-btn--active' : ''}`} onClick={() => setSegment('hours')}>
          {t('timesheets.hours')}
        </button>
        <button className={`segmented-btn ${segment === 'expenses' ? 'segmented-btn--active' : ''}`} onClick={() => setSegment('expenses')}>
          {t('timesheets.expenses')}
        </button>
      </div>

      {segment === 'hours' ? (
        sortedTimesheets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('timesheets.empty')}</div>
          </div>
        ) : (
          <div className="list-group" style={{ marginTop: 12 }}>
            {sortedTimesheets.map((ts) => (
              <button key={ts.id} className="list-row" onClick={() => nav.push(`/timesheets/${ts.id}`)}>
                <div className="list-row-content">
                  <div className="list-row-label">
                    {formatPeriod(ts.week_start as string, ts.week_end as string, locale)}
                  </div>
                  <div className="list-row-sublabel">
                    {ts.total_hours as number}h · {t(`invoice.status.${ts.status as 'draft'}`)}
                  </div>
                </div>
                <svg className="list-row-chevron" viewBox="0 0 7 12" fill="currentColor">
                  <path d="M0.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            ))}
          </div>
        )
      ) : (
        sortedExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('expenses.empty')}</div>
          </div>
        ) : (
          <div className="list-group" style={{ marginTop: 12 }}>
            {sortedExpenses.map((exp) => (
              <button key={exp.id} className="list-row" onClick={() => nav.push(`/despesas/${exp.id}`)}>
                <div className="list-row-content">
                  <div className="list-row-label">{exp.description as string || t(`expense.kind.${exp.kind as 'perdiem'}`)}</div>
                  <div className="list-row-sublabel">{exp.date as string}</div>
                </div>
                <span className="list-row-value">
                  {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format((exp.amount_cents as number) / 100)}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      <button
        className="fab"
        onClick={() => nav.push(segment === 'hours' ? '/timesheets/nova' : '/despesas/nova')}
        aria-label={segment === 'hours' ? t('timesheets.new') : t('expenses.new')}
      >
        +
      </button>
    </div>
  )
}
