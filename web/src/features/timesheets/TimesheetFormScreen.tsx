import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { localCreate, localUpdate, storeFileLocally } from '../../data/repository'
import { useT, useLocale } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { useNav, useRoute } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { weekStart as calcWeekStart, weekEnd, addDays, toDateStr, daysInRange, formatPeriod } from '../../domain/dates'

const DAY_KEYS_MON = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_KEYS_SUN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function TimesheetFormScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const route = useRoute()

  const editId = route.params?.id

  const profile = useLiveQuery(
    () => (user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined),
    [user?.id],
  )

  const weekStartsOn = (profile?.week_starts_on as 0 | 1) ?? 1

  const projects = useLiveQuery(
    () =>
      user
        ? db.mm_projects
            .where('owner')
            .equals(user.id)
            .filter((p) => !p.deleted_at && !p.archived)
            .toArray()
        : [],
    [user?.id],
  )

  const defaultProject = (profile?.default_project as string) || ''

  const [projectId, setProjectId] = useState('')
  const [ws, setWs] = useState(() => calcWeekStart(toDateStr(new Date()), weekStartsOn))
  const [hours, setHours] = useState<Record<string, string>>({})
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({})
  const [tsNotes, setTsNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId && !editId) {
      if (defaultProject && projects?.some((p) => p.id === defaultProject)) {
        setProjectId(defaultProject)
      } else if (projects?.length === 1) {
        setProjectId(projects[0]!.id)
      }
    }
  }, [defaultProject, projects, projectId, editId])

  const editingTs = useLiveQuery(
    () => (editId ? db.mm_timesheets.get(editId) : undefined),
    [editId],
  )

  const editingEntries = useLiveQuery(
    () =>
      editId
        ? db.mm_timesheet_entries
            .where('timesheet')
            .equals(editId)
            .filter((e) => !e.deleted_at)
            .toArray()
        : [],
    [editId],
  )

  useEffect(() => {
    if (editingTs) {
      setProjectId(editingTs.project as string)
      setWs(editingTs.week_start as string)
      setTsNotes((editingTs.notes as string) || '')
    }
  }, [editingTs])

  useEffect(() => {
    if (editingEntries?.length) {
      const h: Record<string, string> = {}
      const n: Record<string, string> = {}
      for (const e of editingEntries) {
        const d = e.date as string
        const hVal = e.hours as number
        h[d] = hVal ? String(hVal) : ''
        n[d] = (e.note as string) || ''
      }
      setHours(h)
      setDayNotes(n)
    }
  }, [editingEntries])

  useEffect(() => {
    if (!projectId || !user || editId) {
      setDuplicateId(null)
      return
    }
    db.mm_timesheets
      .where('[owner+project+week_start]')
      .equals([user.id, projectId, ws])
      .filter((ts) => !ts.deleted_at)
      .first()
      .then((ts) => setDuplicateId(ts?.id ?? null))
  }, [projectId, ws, user, editId])

  const we = weekEnd(ws)
  const days = useMemo(() => daysInRange(ws, we), [ws, we])
  const dayKeys = weekStartsOn === 1 ? DAY_KEYS_MON : DAY_KEYS_SUN

  const totalHours = useMemo(
    () => days.reduce((sum, d) => sum + (parseFloat((hours[d] || '0').replace(',', '.')) || 0), 0),
    [days, hours],
  )

  const handleHoursChange = useCallback((day: string, value: string) => {
    const cleaned = value.replace(',', '.')
    if (cleaned !== '' && !/^\d{0,2}(\.\d{0,2})?$/.test(cleaned)) return
    setHours((h) => ({ ...h, [day]: value }))
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editId) return
      await storeFileLocally(editId, 'file', file)
      showToast(t('timesheet.form.attach'))
    },
    [editId, t],
  )

  const handleSave = useCallback(
    async (submit: boolean) => {
      if (!user || !projectId) return
      setSaving(true)
      try {
        let tsId = editId

        if (duplicateId && !editId) {
          tsId = duplicateId
          await localUpdate('mm_timesheets', tsId, {
            total_hours: totalHours,
            notes: tsNotes,
            ...(submit ? { status: 'submitted', submitted_at: new Date().toISOString() } : {}),
          })
        } else if (tsId) {
          await localUpdate('mm_timesheets', tsId, {
            total_hours: totalHours,
            notes: tsNotes,
            ...(submit && editingTs?.status === 'draft'
              ? { status: 'submitted', submitted_at: new Date().toISOString() }
              : {}),
          })
        } else {
          tsId = await localCreate(
            'mm_timesheets',
            {
              project: projectId,
              week_start: ws,
              week_end: we,
              status: submit ? 'submitted' : 'draft',
              submitted_at: submit ? new Date().toISOString() : '',
              total_hours: totalHours,
              notes: tsNotes,
            },
            user.id,
          )
        }

        const existingByDate = new Map(
          (editingEntries ?? []).map((e) => [e.date as string, e]),
        )

        for (const day of days) {
          const h = parseFloat((hours[day] || '0').replace(',', '.')) || 0
          const note = dayNotes[day] || ''
          const existing = existingByDate.get(day)

          if (existing) {
            if (h !== (existing.hours as number) || note !== (existing.note as string || '')) {
              await localUpdate('mm_timesheet_entries', existing.id, { hours: h, note })
            }
          } else if (h > 0 || note) {
            await localCreate(
              'mm_timesheet_entries',
              { timesheet: tsId, date: day, hours: h, note },
              user.id,
            )
          }
        }

        showToast(t('common.save'))
        nav.pop()
      } catch {
        showToast(t('error.generic'))
      } finally {
        setSaving(false)
      }
    },
    [
      user, projectId, editId, duplicateId, ws, we, totalHours, tsNotes,
      days, hours, dayNotes, editingTs, editingEntries, nav, t,
    ],
  )

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={editId ? t('timesheet.form.title.edit') : t('timesheet.form.title.new')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={
          <button onClick={() => handleSave(false)} disabled={saving || !projectId}>
            {t('common.save')}
          </button>
        }
      />

      <div style={{ padding: '0 16px' }}>
        <div className="form-row">
          <label className="form-row-label">{t('timesheet.form.project')}</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="form-row-input"
            disabled={!!editId}
          >
            <option value="">—</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name as string}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '12px 0',
          }}
        >
          <button
            className="btn btn--small"
            onClick={() => setWs(addDays(ws, -7))}
            disabled={!!editId}
          >
            ‹
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{formatPeriod(ws, we, locale)}</span>
          <button
            className="btn btn--small"
            onClick={() => setWs(addDays(ws, 7))}
            disabled={!!editId}
          >
            ›
          </button>
        </div>

        {duplicateId && !editId && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--color-fill-tertiary)',
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 14,
              color: 'var(--color-secondary-label)',
            }}
          >
            {t('timesheet.form.existsWarning')}
          </div>
        )}

        <div className="list-group">
          {days.map((day, i) => (
            <div
              key={day}
              className="list-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}
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
              <div
                style={{
                  width: 24,
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {new Date(day + 'T00:00:00Z').getUTCDate()}
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={hours[day] || ''}
                onChange={(e) => handleHoursChange(day, e.target.value)}
                style={{
                  width: 56,
                  textAlign: 'right',
                  fontSize: 16,
                  padding: '6px 8px',
                  border: '1px solid var(--color-separator)',
                  borderRadius: 8,
                  background: 'var(--color-fill-tertiary)',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-secondary-label)' }}>h</span>
              <input
                type="text"
                placeholder="—"
                value={dayNotes[day] || ''}
                onChange={(e) => setDayNotes((n) => ({ ...n, [day]: e.target.value }))}
                style={{
                  flex: 1,
                  fontSize: 14,
                  padding: '6px 8px',
                  border: '1px solid var(--color-separator)',
                  borderRadius: 8,
                  background: 'var(--color-fill-tertiary)',
                  minWidth: 0,
                }}
                maxLength={300}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 0',
            fontWeight: 600,
            fontSize: 17,
          }}
        >
          <span>{t('timesheets.total')}</span>
          <span>{totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}h</span>
        </div>

        <div className="form-row" style={{ marginBottom: 12 }}>
          <label className="form-row-label">{t('timesheet.form.notes')}</label>
          <textarea
            value={tsNotes}
            onChange={(e) => setTsNotes(e.target.value)}
            className="form-row-input"
            rows={3}
            maxLength={1000}
            style={{ fontSize: 16, padding: '8px 12px', borderRadius: 8 }}
          />
        </div>

        {editId && (
          <div className="form-row" style={{ marginBottom: 12 }}>
            <label className="form-row-label">{t('timesheet.form.attach')}</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileChange}
              style={{ fontSize: 16 }}
            />
          </div>
        )}

        <button
          className="btn btn--primary"
          style={{ width: '100%', marginBottom: 32 }}
          onClick={() => handleSave(true)}
          disabled={saving || !projectId}
        >
          {t('timesheet.form.submit')}
        </button>
      </div>
    </div>
  )
}
