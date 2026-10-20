import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { localCreate, localUpdate, storeFileLocally } from '../../data/repository'
import { useT, useLocale } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { useNav, useRoute } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { toDateStr } from '../../domain/dates'
import { formatMoney, lineAmount } from '../../domain/money'
import { EXPENSE_KINDS } from '../../domain/schemas'

export function ExpenseFormScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const route = useRoute()

  const editId = route.path.match(/^\/despesas\/([a-z0-9]+)\/editar$/)?.[1]

  const profile = useLiveQuery(
    () => (user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined),
    [user?.id],
  )

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
  const [kind, setKind] = useState<string>('perdiem')
  const [date, setDate] = useState(() => toDateStr(new Date()))
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [rateCents, setRateCents] = useState('')
  const [saving, setSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  useEffect(() => {
    if (!projectId && !editId) {
      if (defaultProject && projects?.some((p) => p.id === defaultProject)) {
        setProjectId(defaultProject)
      } else if (projects?.length === 1) {
        setProjectId(projects[0]!.id)
      }
    }
  }, [defaultProject, projects, projectId, editId])

  // Set default rate from project's perdiem_cents
  const selectedProject = useMemo(
    () => projects?.find((p) => p.id === projectId),
    [projects, projectId],
  )

  useEffect(() => {
    if (!editId && selectedProject && kind === 'perdiem' && !rateCents) {
      const projectPerdiem = selectedProject.perdiem_cents as number
      const defaultPerdiem = profile?.default_perdiem_cents as number
      const cents = projectPerdiem || defaultPerdiem || 0
      if (cents > 0) {
        setRateCents(String(cents / 100))
      }
    }
  }, [selectedProject, kind, rateCents, editId, profile])

  const editingEntry = useLiveQuery(
    () => (editId ? db.mm_perdiem_entries.get(editId) : undefined),
    [editId],
  )

  useEffect(() => {
    if (editingEntry) {
      setProjectId(editingEntry.project as string)
      setKind(editingEntry.kind as string)
      setDate(editingEntry.date as string)
      setDescription((editingEntry.description as string) || '')
      setQuantity(String(editingEntry.quantity as number))
      setRateCents(String((editingEntry.rate_cents as number) / 100))
    }
  }, [editingEntry])

  const currency = (selectedProject?.currency as string) || (profile?.currency as string) || 'EUR'

  const parsedQty = parseFloat(quantity.replace(',', '.')) || 0
  const parsedRate = Math.round((parseFloat(rateCents.replace(',', '.')) || 0) * 100)
  const amountCents = lineAmount(parsedQty, parsedRate)

  const handleSave = useCallback(async () => {
    if (!user || !projectId || !date) return
    setSaving(true)
    try {
      const data = {
        project: projectId,
        date,
        kind,
        description,
        quantity: parsedQty,
        rate_cents: parsedRate,
        amount_cents: amountCents,
      }

      let recordId: string
      if (editId) {
        await localUpdate('mm_perdiem_entries', editId, data)
        recordId = editId
      } else {
        recordId = await localCreate('mm_perdiem_entries', data, user.id)
      }

      if (receiptFile) {
        await storeFileLocally(recordId, 'receipt', receiptFile)
      }

      showToast(t('common.save'))
      nav.pop()
    } catch {
      showToast(t('error.generic'))
    } finally {
      setSaving(false)
    }
  }, [user, projectId, date, kind, description, parsedQty, parsedRate, amountCents, editId, receiptFile, nav, t])

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={editId ? t('expense.form.title.edit') : t('expense.form.title.new')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={
          <button onClick={handleSave} disabled={saving || !projectId || !date}>
            {t('common.save')}
          </button>
        }
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label>{t('expense.form.project')}</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!!editId}>
            <option value="">—</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name as string}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>{t('expense.form.date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label>{t('expense.form.description')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            placeholder={t(`expense.kind.${kind as 'perdiem'}`)}
          />
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <div className="segmented">
          {EXPENSE_KINDS.map((k) => (
            <button
              key={k}
              className={`segmented-btn ${kind === k ? 'segmented-btn--active' : ''}`}
              onClick={() => setKind(k)}
            >
              {t(`expense.kind.${k}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label>{t('expense.form.quantity')}</label>
          <input type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="form-row">
          <label>{t('expense.form.rate')}</label>
          <input type="text" inputMode="decimal" value={rateCents} onChange={(e) => setRateCents(e.target.value)} placeholder="0.00" />
        </div>
      </div>

      <div className="list-group" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{t('expense.form.amount')}</span>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{formatMoney(amountCents, currency, locale)}</span>
      </div>

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label>{t('expense.form.receipt')}</label>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      <div style={{ height: 48 }} />
    </div>
  )
}
