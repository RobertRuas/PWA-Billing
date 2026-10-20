import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav, useRoute } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { db } from '../../data/db'
import { localCreate, localUpdate } from '../../data/repository'
import { toCents, fromCents } from '../../domain/money'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'BRL']

export function ProjectFormScreen() {
  const t = useT()
  const nav = useNav()
  const route = useRoute()
  const { user } = useAuth()

  const projectId = route.path.split('/').pop()
  const isNew = projectId === 'novo'

  const existing = useLiveQuery(
    () => (isNew ? undefined : db.mm_projects.get(projectId!)),
    [projectId],
  )

  const clients = useLiveQuery(async () => {
    const all = await db.mm_clients.where('owner').equals(user?.id ?? '').toArray()
    return all.filter((c) => !c.deleted_at && !c.archived)
  }, [user?.id])

  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [perdiem, setPerdiem] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [nameError, setNameError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (existing && !loaded) {
      setClientId((existing.client as string) || '')
      setName((existing.name as string) || '')
      setRole((existing.role as string) || '')
      setStartDate((existing.start_date as string) || '')
      setEndDate((existing.end_date as string) || '')
      setLocation((existing.location as string) || '')
      setHourlyRate(existing.hourly_rate_cents ? String(fromCents(existing.hourly_rate_cents as number)) : '')
      setPerdiem(existing.perdiem_cents ? String(fromCents(existing.perdiem_cents as number)) : '')
      setCurrency((existing.currency as string) || 'EUR')
      setLoaded(true)
    }
  }, [existing, loaded])

  async function handleSave() {
    if (!name.trim()) {
      setNameError(t('error.required'))
      return
    }
    const data: Record<string, unknown> = {
      client: clientId || '',
      name: name.trim(),
      role: role.trim(),
      start_date: startDate,
      end_date: endDate,
      location: location.trim(),
      hourly_rate_cents: hourlyRate ? toCents(hourlyRate) : 0,
      perdiem_cents: perdiem ? toCents(perdiem) : 0,
      currency,
    }
    if (isNew) {
      await localCreate('mm_projects', data, user!.id)
    } else {
      await localUpdate('mm_projects', projectId!, data)
    }
    showToast(t('common.save'))
    nav.pop()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={isNew ? t('settings.project.new') : t('settings.project.edit')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={handleSave}>{t('common.save')}</button>}
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.client')}</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">—</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name as string}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.name')} *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError('') }}
          />
          {nameError && <span className="form-row-error">{nameError}</span>}
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.role')}</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.startDate')}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.endDate')}</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.location')}</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      <div className="list-group-header">{t('settings.billing.title')}</div>
      <div className="list-group">
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.hourlyRate')}</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.project.perdiem')}</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={perdiem}
            onChange={(e) => setPerdiem(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
