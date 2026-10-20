import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { localUpdate, localSoftDelete } from '../../data/repository'
import { useT, useLocale, type TranslationKey } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { useNav, useRoute } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'
import { ActionSheet } from '../../ui/ActionSheet'
import { showToast } from '../../ui/Toast'
import { formatPeriod, daysInRange } from '../../domain/dates'
import { useState } from 'react'

const DAY_KEYS_MON = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_KEYS_SUN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function TimesheetDetailScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const route = useRoute()
  const [showActions, setShowActions] = useState(false)

  const tsId = route.params?.id || ''

  const ts = useLiveQuery(() => (tsId ? db.mm_timesheets.get(tsId) : undefined), [tsId])

  const entries = useLiveQuery(
    () =>
      tsId
        ? db.mm_timesheet_entries
            .where('timesheet')
            .equals(tsId)
            .filter((e) => !e.deleted_at)
            .toArray()
        : [],
    [tsId],
  )

  const project = useLiveQuery(
    () => (ts?.project ? db.mm_projects.get(ts.project as string) : undefined),
    [ts?.project],
  )

  const profile = useLiveQuery(
    () => (user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined),
    [user?.id],
  )

  const weekStartsOn = (profile?.week_starts_on as 0 | 1) ?? 1

  const days = useMemo(
    () => (ts ? daysInRange(ts.week_start as string, ts.week_end as string) : []),
    [ts],
  )

  const dayKeys = weekStartsOn === 1 ? DAY_KEYS_MON : DAY_KEYS_SUN

  const entriesByDate = useMemo(() => {
    const map = new Map<string, { hours: number; note: string; invoice: string }>()
    for (const e of entries ?? []) {
      map.set(e.date as string, {
        hours: e.hours as number,
        note: (e.note as string) || '',
        invoice: (e.invoice as string) || '',
      })
    }
    return map
  }, [entries])

  const handleSubmit = async () => {
    if (!ts || ts.status !== 'draft') return
    await localUpdate('mm_timesheets', ts.id, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    showToast(t('timesheet.form.submit'))
  }

  const handleDelete = async () => {
    if (!ts) return
    if (!confirm(t('timesheet.detail.deleteConfirm'))) return
    await localSoftDelete('mm_timesheets', ts.id)
    for (const e of entries ?? []) {
      await localSoftDelete('mm_timesheet_entries', e.id)
    }
    nav.pop()
  }

  if (!ts) {
    return (
      <div className="page page--no-tabs">
        <NavBar title={t('timesheet.detail.title')} left={<button onClick={() => nav.pop()}>{t('common.back')}</button>} />
        <div style={{ padding: 24, textAlign: 'center' }}>{t('common.loading')}</div>
      </div>
    )
  }

  const status = ts.status as string
  const statusKey = `timesheet.status.${status}` as TranslationKey

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('timesheet.detail.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={() => setShowActions(true)}>···</button>}
      />

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {(project?.name as string) || '—'}
          </span>
          <span className={`pill pill--${status === 'draft' ? 'draft' : status === 'submitted' ? 'sent' : 'paid'}`}>
            {t(statusKey)}
          </span>
        </div>

        <div style={{ fontSize: 15, color: 'var(--color-secondary-label)', marginBottom: 16 }}>
          {formatPeriod(ts.week_start as string, ts.week_end as string, locale)}
        </div>

        <div className="list-group">
          {days.map((day, i) => {
            const entry = entriesByDate.get(day)
            const h = entry?.hours ?? 0
            const invoiced = !!entry?.invoice
            return (
              <div
                key={day}
                className="list-row"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}
              >
                <div
                  style={{
                    width: 32,
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--color-secondary-label)',
                  }}
                >
                  {t(`day.${dayKeys[i]}`)}
                </div>
                <div style={{ width: 24, fontSize: 15, fontWeight: 500 }}>
                  {new Date(day + 'T00:00:00Z').getUTCDate()}
                </div>
                <div style={{ flex: 1 }}>
                  {entry?.note && (
                    <span style={{ fontSize: 13, color: 'var(--color-secondary-label)' }}>
                      {entry.note}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, minWidth: 36, textAlign: 'right' }}>
                  {h > 0 ? `${h}h` : '—'}
                </div>
                {invoiced && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--color-green)',
                      flexShrink: 0,
                    }}
                    title={t('timesheets.invoiced')}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 0',
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          <span>{t('timesheet.detail.totalHours')}</span>
          <span>{(ts.total_hours as number) || 0}h</span>
        </div>

        {!!ts.notes && (
          <div
            style={{
              padding: '12px',
              background: 'var(--color-fill-tertiary)',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 15,
            }}
          >
            {String(ts.notes)}
          </div>
        )}

        {status === 'draft' && (
          <button
            className="btn btn--primary"
            style={{ width: '100%', marginBottom: 32 }}
            onClick={handleSubmit}
          >
            {t('timesheet.form.submit')}
          </button>
        )}
      </div>

      <ActionSheet
        open={showActions}
        onClose={() => setShowActions(false)}
        actions={[
          {
            label: t('timesheet.detail.edit'),
            onSelect: () => nav.push(`/timesheets/${ts.id}/editar`, { id: ts.id }),
          },
          {
            label: t('timesheet.detail.delete'),
            destructive: true,
            onSelect: handleDelete,
          },
        ]}
      />
    </div>
  )
}
