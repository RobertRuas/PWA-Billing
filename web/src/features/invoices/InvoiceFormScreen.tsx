import { useState, useMemo, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { generateId } from '../../data/id'
import { localCreate, localUpdate, storeFileLocally } from '../../data/repository'
import { useT, useLocale } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { useNav, useRoute } from '../../app/navigation'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { formatMoney, lineAmount, toCents, fromCents } from '../../domain/money'
import { formatPeriod, isoWeekNumber, toDateStr, weekStart, weekEnd } from '../../domain/dates'
import { formatInvoiceNumber } from '../../domain/numbering'
import type { InvoiceStatus } from '../../domain/invoice-state'
import type { TranslationKey } from '../../i18n'

interface LineItem {
  tempId: string
  description: string
  quantity: number
  unit: 'h' | 'day' | 'unit' | 'km'
  rate_cents: number
  amount_cents: number
}

interface LocalAttachment {
  tempId: string
  file: File
}

export function InvoiceFormScreen() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuth()
  const nav = useNav()
  const route = useRoute()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const params = new URLSearchParams(route.path.split('?')[1] || '')
  const editId = route.path.match(/^\/faturas\/([a-z0-9]+)\/editar$/)?.[1]
  const initialType = (params.get('tipo') as 'hours' | 'expenses') || 'hours'

  const [type, setType] = useState<'hours' | 'expenses'>(initialType)
  const [number, setNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => toDateStr(new Date()))
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(!editId)

  const profile = useLiveQuery(
    () => (user ? db.mm_profiles.where('owner').equals(user.id).first() : undefined),
    [user?.id],
  )

  const clients = useLiveQuery(
    () =>
      user
        ? db.mm_clients.where('owner').equals(user.id).filter((c) => !c.deleted_at && !c.archived).toArray()
        : [],
    [user?.id],
  )

  const allProjects = useLiveQuery(
    () =>
      user
        ? db.mm_projects.where('owner').equals(user.id).filter((p) => !p.deleted_at && !p.archived).toArray()
        : [],
    [user?.id],
  )

  const projects = useMemo(
    () => (allProjects ?? []).filter((p) => !clientId || p.client === clientId),
    [allProjects, clientId],
  )

  const existingInvoice = useLiveQuery(
    () => (editId ? db.mm_invoices.get(editId) : undefined),
    [editId],
  )

  const existingItems = useLiveQuery(
    () =>
      editId
        ? db.mm_invoice_items.where('invoice').equals(editId).filter((i) => !i.deleted_at).toArray()
        : [],
    [editId],
  )

  useEffect(() => {
    if (editId && existingInvoice && existingItems && !loaded) {
      setType(existingInvoice.type as 'hours' | 'expenses')
      setNumber(existingInvoice.number as string)
      setInvoiceDate(existingInvoice.invoice_date as string)
      setPeriodStart(existingInvoice.period_start as string)
      setPeriodEnd(existingInvoice.period_end as string)
      setClientId((existingInvoice.client as string) || '')
      setProjectId((existingInvoice.project as string) || '')
      setNotes((existingInvoice.notes as string) || '')
      setLines(
        existingItems
          .sort((a, b) => (a.position as number) - (b.position as number))
          .map((item) => ({
            tempId: item.id,
            description: item.description as string,
            quantity: item.quantity as number,
            unit: item.unit as LineItem['unit'],
            rate_cents: item.rate_cents as number,
            amount_cents: item.amount_cents as number,
          })),
      )
      setLoaded(true)
    }
  }, [editId, existingInvoice, existingItems, loaded])

  useEffect(() => {
    if (!editId && profile && !number) {
      const pattern = (profile.invoice_number_pattern as string) || '{YYYY}-{SEQ}'
      const seq = (profile.next_invoice_seq as number) || 1
      setNumber(formatInvoiceNumber(pattern, seq, new Date()))
    }
  }, [profile, editId, number])

  useEffect(() => {
    if (!editId && profile && !clientId) {
      const dc = (profile.default_client as string) || ''
      const dp = (profile.default_project as string) || ''
      if (dc) setClientId(dc)
      if (dp) setProjectId(dp)
    }
  }, [profile, editId, clientId])

  const currency = useMemo(() => {
    if (projectId) {
      const proj = (allProjects ?? []).find((p) => p.id === projectId)
      if (proj?.currency) return proj.currency as string
    }
    return (profile?.currency as string) || 'EUR'
  }, [projectId, allProjects, profile])

  const totalCents = useMemo(() => lines.reduce((s, l) => s + l.amount_cents, 0), [lines])

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[idx]!, ...patch }
      line.amount_cents = lineAmount(line.quantity, line.rate_cents)
      next[idx] = line
      return next
    })
    setDirty(true)
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function addLine() {
    const defaultRate = type === 'hours'
      ? (() => {
          const proj = (allProjects ?? []).find((p) => p.id === projectId)
          return (proj?.hourly_rate_cents as number) || (profile?.default_hourly_rate_cents as number) || 0
        })()
      : (() => {
          const proj = (allProjects ?? []).find((p) => p.id === projectId)
          return (proj?.perdiem_cents as number) || (profile?.default_perdiem_cents as number) || 0
        })()

    setLines((prev) => [
      ...prev,
      {
        tempId: generateId(),
        description: '',
        quantity: 0,
        unit: type === 'hours' ? 'h' : 'day',
        rate_cents: defaultRate,
        amount_cents: 0,
      },
    ])
    setDirty(true)
  }

  async function generateFromTimesheets() {
    if (!user || !periodStart || !periodEnd) return
    const entries = await db.mm_timesheet_entries
      .where('owner')
      .equals(user.id)
      .filter((e) => {
        if (e.deleted_at) return false
        if (e.invoice) return false
        const d = e.date as string
        return d >= periodStart && d <= periodEnd
      })
      .toArray()

    if (entries.length === 0) return

    const weekStartDay = ((profile?.week_starts_on as number) ?? 1) as 0 | 1
    const rate = (() => {
      const proj = (allProjects ?? []).find((p) => p.id === projectId)
      return (proj?.hourly_rate_cents as number) || (profile?.default_hourly_rate_cents as number) || 0
    })()

    const byWeek = new Map<string, { hours: number; ws: string; we: string }>()
    for (const entry of entries) {
      const d = entry.date as string
      const ws = weekStart(d, weekStartDay)
      const we = weekEnd(ws)
      const existing = byWeek.get(ws) ?? { hours: 0, ws, we }
      existing.hours += (entry.hours as number) || 0
      byWeek.set(ws, existing)
    }

    const newLines: LineItem[] = []
    for (const [, week] of [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const wn = isoWeekNumber(week.ws)
      const periodLabel = formatPeriod(week.ws, week.we, locale)
      const hrs = Math.round(week.hours * 100) / 100
      const desc = locale.startsWith('pt')
        ? `Semana ${wn} · ${periodLabel} · ${hrs} h × ${fromCents(rate).toFixed(2)} €`
        : `Week ${wn} · ${periodLabel} · ${hrs} h × €${fromCents(rate).toFixed(2)}`

      newLines.push({
        tempId: generateId(),
        description: desc,
        quantity: hrs,
        unit: 'h',
        rate_cents: rate,
        amount_cents: lineAmount(hrs, rate),
      })
    }

    setLines((prev) => [...prev, ...newLines])
    setDirty(true)
  }

  async function generateFromExpenses() {
    if (!user || !periodStart || !periodEnd) return
    const entries = await db.mm_perdiem_entries
      .where('owner')
      .equals(user.id)
      .filter((e) => {
        if (e.deleted_at) return false
        if (e.invoice) return false
        const d = e.date as string
        return d >= periodStart && d <= periodEnd
      })
      .toArray()

    if (entries.length === 0) return

    const byKind = new Map<string, { qty: number; rate: number; desc: string }>()
    for (const entry of entries) {
      const kind = entry.kind as string
      const existing = byKind.get(kind)
      if (existing) {
        existing.qty += (entry.quantity as number) || 1
      } else {
        byKind.set(kind, {
          qty: (entry.quantity as number) || 1,
          rate: (entry.rate_cents as number) || 0,
          desc: t(`expense.kind.${kind}` as TranslationKey),
        })
      }
    }

    const newLines: LineItem[] = []
    for (const [, group] of byKind) {
      newLines.push({
        tempId: generateId(),
        description: group.desc,
        quantity: group.qty,
        unit: 'day',
        rate_cents: group.rate,
        amount_cents: lineAmount(group.qty, group.rate),
      })
    }

    setLines((prev) => [...prev, ...newLines])
    setDirty(true)
  }

  function handleAttachment() {
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      setAttachments((prev) => [...prev, { tempId: generateId(), file }])
    }
    e.target.value = ''
    setDirty(true)
  }

  function removeAttachment(tempId: string) {
    setAttachments((prev) => prev.filter((a) => a.tempId !== tempId))
    setDirty(true)
  }

  function buildSnapshots() {
    const clientRec = (clients ?? []).find((c) => c.id === clientId)
    const projectRec = (allProjects ?? []).find((p) => p.id === projectId)

    return {
      technician: {
        name: (profile?.tech_name as string) || '',
        company: (profile?.tech_company as string) || '',
        email: (profile?.tech_email as string) || '',
        address: (profile?.tech_address as string) || '',
        vat: (profile?.tech_vat as string) || '',
        tel: (profile?.tech_tel as string) || '',
      },
      bank: {
        ibanName: (profile?.bank_iban_name as string) || '',
        iban: (profile?.bank_iban as string) || '',
        swift: (profile?.bank_swift as string) || '',
      },
      client_snapshot: clientRec
        ? {
            name: (clientRec.name as string) || '',
            address: (clientRec.address as string) || '',
            vat: (clientRec.vat as string) || '',
            email: (clientRec.email as string) || '',
          }
        : { name: '', address: '', vat: '', email: '' },
      project_snapshot: projectRec
        ? {
            name: (projectRec.name as string) || '',
            role: (projectRec.role as string) || '',
            startDate: (projectRec.start_date as string) || '',
            endDate: (projectRec.end_date as string) || '',
            location: (projectRec.location as string) || '',
          }
        : { name: '', role: '', startDate: '', endDate: '', location: '' },
    }
  }

  async function handleSave(emit: boolean) {
    if (!user) return
    if (!number.trim()) {
      showToast(t('error.required'), 'error')
      return
    }
    if (periodEnd && periodStart && periodEnd < periodStart) {
      showToast(t('error.periodInvalid'), 'error')
      return
    }

    const existing = await db.mm_invoices
      .where('owner')
      .equals(user.id)
      .filter((i) => !i.deleted_at && (i.number as string) === number.trim() && i.id !== editId)
      .first()
    if (existing) {
      showToast(t('invoice.form.numberConflict'), 'error')
      return
    }

    setSaving(true)
    try {
      const snapshots = buildSnapshots()
      const status: InvoiceStatus = emit ? 'sent' : 'draft'
      const invoiceData: Record<string, unknown> = {
        type,
        number: number.trim(),
        invoice_date: invoiceDate,
        period_start: periodStart,
        period_end: periodEnd,
        currency,
        status,
        client: clientId,
        project: projectId,
        ...snapshots,
        total_cents: totalCents,
        notes,
        sent_at: emit ? new Date().toISOString() : '',
      }

      let invoiceId: string
      if (editId) {
        await localUpdate('mm_invoices', editId, invoiceData)
        invoiceId = editId

        const oldItems = await db.mm_invoice_items
          .where('invoice')
          .equals(editId)
          .filter((i) => !i.deleted_at)
          .toArray()
        const oldIds = new Set(oldItems.map((i) => i.id))
        const newIds = new Set(lines.filter((l) => oldIds.has(l.tempId)).map((l) => l.tempId))
        for (const old of oldItems) {
          if (!newIds.has(old.id)) {
            await localUpdate('mm_invoice_items', old.id, { deleted_at: new Date().toISOString() })
          }
        }
      } else {
        invoiceId = await localCreate('mm_invoices', invoiceData, user.id)
        if (profile) {
          const seq = (profile.next_invoice_seq as number) || 1
          await localUpdate('mm_profiles', profile.id, { next_invoice_seq: seq + 1 })
        }
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const itemData: Record<string, unknown> = {
          invoice: invoiceId,
          position: i,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          rate_cents: line.rate_cents,
          amount_cents: line.amount_cents,
        }
        const existsInDb = await db.mm_invoice_items.get(line.tempId)
        if (existsInDb && !existsInDb.deleted_at) {
          await localUpdate('mm_invoice_items', line.tempId, itemData)
        } else {
          await localCreate('mm_invoice_items', { ...itemData, id: line.tempId }, user.id)
        }
      }

      for (const att of attachments) {
        const attId = att.tempId
        await storeFileLocally(attId, 'file', att.file)
        await localCreate(
          'mm_attachments',
          {
            id: attId,
            invoice: invoiceId,
            kind: 'invoice_pdf',
            file_name: att.file.name,
            size_bytes: att.file.size,
          },
          user.id,
        )
      }

      showToast(t('common.save'), 'success')
      nav.pop()
    } catch {
      showToast(t('error.generic'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (dirty && !confirm(t('invoice.form.unsavedChanges'))) return
    nav.pop()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={editId ? t('invoice.form.title.edit') : t('invoice.form.title.new')}
        left={<button onClick={handleBack}>{t('common.back')}</button>}
        right={
          <button onClick={() => handleSave(false)} disabled={saving}>
            {t('invoice.form.save')}
          </button>
        }
      />

      <div style={{ padding: '0 16px 120px' }}>
        {/* Type selector */}
        <div className="segmented" style={{ marginBottom: 16 }}>
          <button
            className={`segmented-btn ${type === 'hours' ? 'segmented-btn--active' : ''}`}
            onClick={() => { setType('hours'); setDirty(true) }}
          >
            {t('invoice.type.hours')}
          </button>
          <button
            className={`segmented-btn ${type === 'expenses' ? 'segmented-btn--active' : ''}`}
            onClick={() => { setType('expenses'); setDirty(true) }}
          >
            {t('invoice.type.expenses')}
          </button>
        </div>

        {/* Number & Date */}
        <div className="list-group">
          <div className="form-row">
            <label>{t('invoice.form.number')}</label>
            <input type="text" value={number} onChange={(e) => { setNumber(e.target.value); setDirty(true) }} />
          </div>
          <div className="form-row">
            <label>{t('invoice.form.date')}</label>
            <input type="date" value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); setDirty(true) }} />
          </div>
        </div>

        {/* Period */}
        <div className="list-group-header">{t('invoice.detail.period')}</div>
        <div className="list-group">
          <div className="form-row">
            <label>{t('invoice.form.periodStart')}</label>
            <input type="date" value={periodStart} onChange={(e) => { setPeriodStart(e.target.value); setDirty(true) }} />
          </div>
          <div className="form-row">
            <label>{t('invoice.form.periodEnd')}</label>
            <input type="date" value={periodEnd} onChange={(e) => { setPeriodEnd(e.target.value); setDirty(true) }} />
          </div>
        </div>

        {/* Client & Project */}
        <div className="list-group-header">{t('invoice.form.client')}</div>
        <div className="list-group">
          <div className="form-row">
            <label>{t('invoice.form.client')}</label>
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(''); setDirty(true) }}>
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name as string}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>{t('invoice.form.project')}</label>
            <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setDirty(true) }}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name as string}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate lines */}
        {type === 'hours' && periodStart && periodEnd && (
          <button
            className="btn btn--secondary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={generateFromTimesheets}
          >
            {t('invoice.form.generateLines')}
          </button>
        )}
        {type === 'expenses' && periodStart && periodEnd && (
          <button
            className="btn btn--secondary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={generateFromExpenses}
          >
            {t('invoice.form.generateExpenseLines')}
          </button>
        )}

        {/* Lines */}
        <div className="list-group-header">{t('invoice.detail.lines')}</div>
        {lines.length === 0 ? (
          <div style={{ padding: '12px 0', color: 'var(--label2)', textAlign: 'center', fontSize: 14 }}>
            {t('invoice.form.addLine')}
          </div>
        ) : (
          <div className="list-group">
            {lines.map((line, idx) => (
              <div key={line.tempId} style={{ padding: 12 }}>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder={t('invoice.form.description')}
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, alignItems: 'end' }}>
                  <div className="form-row" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11 }}>{t('invoice.form.quantity')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-row" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11 }}>{t('invoice.form.unit')}</label>
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(idx, { unit: e.target.value as LineItem['unit'] })}
                    >
                      <option value="h">h</option>
                      <option value="day">day</option>
                      <option value="unit">unit</option>
                      <option value="km">km</option>
                    </select>
                  </div>
                  <div className="form-row" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11 }}>{t('invoice.form.rate')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.rate_cents ? fromCents(line.rate_cents).toFixed(2) : ''}
                      onChange={(e) => updateLine(idx, { rate_cents: toCents(e.target.value) })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(line.amount_cents, currency, locale)}
                  </span>
                  <button
                    onClick={() => removeLine(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 14 }}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn btn--secondary btn--small"
          style={{ width: '100%', marginTop: 8 }}
          onClick={addLine}
        >
          + {t('invoice.form.addLine')}
        </button>

        {/* Total */}
        <div
          className="list-group"
          style={{ margin: '16px 0', padding: 12, display: 'flex', justifyContent: 'space-between' }}
        >
          <span style={{ fontWeight: 600 }}>{t('invoice.form.total')}</span>
          <span style={{ fontWeight: 600, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(totalCents, currency, locale)}
          </span>
        </div>

        {/* Attachments */}
        <div className="list-group-header">{t('invoice.form.attachments')}</div>
        <div className="list-group">
          {attachments.map((att) => (
            <div key={att.tempId} className="list-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.file.name}
              </span>
              <button
                onClick={() => removeAttachment(att.tempId)}
                style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 13, flexShrink: 0 }}
              >
                {t('common.remove')}
              </button>
            </div>
          ))}
          <button className="list-row" onClick={handleAttachment} style={{ color: 'var(--blue)' }}>
            + {t('invoice.form.addAttachment')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {/* Notes */}
        <div className="list-group-header">{t('invoice.form.notes')}</div>
        <div className="list-group">
          <div className="form-row">
            <textarea
              rows={3}
              value={notes}
              placeholder={t('invoice.form.notes')}
              onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            className="btn btn--secondary"
            style={{ flex: 1 }}
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {t('invoice.form.save')}
          </button>
          <button
            className="btn btn--primary"
            style={{ flex: 1 }}
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {t('invoice.form.saveAndSend')}
          </button>
        </div>
      </div>
    </div>
  )
}
