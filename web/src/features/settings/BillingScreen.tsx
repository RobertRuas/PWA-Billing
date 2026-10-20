import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { db } from '../../data/db'
import { localUpdate } from '../../data/repository'
import { toCents, fromCents } from '../../domain/money'
import { previewPattern } from '../../domain/numbering'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'BRL']
const REMINDER_OPTIONS = [0, 7, 15, 30, 45, 60]

export function BillingScreen() {
  const t = useT()
  const nav = useNav()
  const { user } = useAuth()

  const profile = useLiveQuery(
    () => db.mm_profiles.where('owner').equals(user?.id ?? '').first(),
    [user?.id],
  )

  const [currency, setCurrency] = useState('EUR')
  const [hourlyRate, setHourlyRate] = useState('')
  const [perdiemVal, setPerdiemVal] = useState('')
  const [numberPattern, setNumberPattern] = useState('FT {YYYY}/{SEQ}')
  const [nextSeq, setNextSeq] = useState(1)
  const [reminderDays, setReminderDays] = useState(0)
  const [weekStart, setWeekStart] = useState<'monday' | 'sunday'>('monday')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (profile && !loaded) {
      setCurrency((profile.currency as string) || 'EUR')
      setHourlyRate(profile.default_hourly_rate_cents ? String(fromCents(profile.default_hourly_rate_cents as number)) : '')
      setPerdiemVal(profile.default_perdiem_cents ? String(fromCents(profile.default_perdiem_cents as number)) : '')
      setNumberPattern((profile.invoice_number_pattern as string) || 'FT {YYYY}/{SEQ}')
      setNextSeq((profile.next_invoice_seq as number) || 1)
      setReminderDays((profile.payment_reminder_days as number) || 0)
      setWeekStart(((profile.week_starts_on as string) || 'monday') as 'monday' | 'sunday')
      setLoaded(true)
    }
  }, [profile, loaded])

  async function handleSave() {
    if (!profile) return
    await localUpdate('mm_profiles', profile.id, {
      currency,
      default_hourly_rate_cents: hourlyRate ? toCents(hourlyRate) : 0,
      default_perdiem_cents: perdiemVal ? toCents(perdiemVal) : 0,
      invoice_number_pattern: numberPattern,
      next_invoice_seq: nextSeq,
      payment_reminder_days: reminderDays,
      week_starts_on: weekStart,
    })
    showToast(t('common.save'))
    nav.pop()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.billing.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={handleSave}>{t('common.save')}</button>}
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label className="form-row-label">{t('settings.billing.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.billing.hourlyRate')}</label>
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
          <label className="form-row-label">{t('settings.billing.perdiem')}</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={perdiemVal}
            onChange={(e) => setPerdiemVal(e.target.value)}
          />
        </div>
      </div>

      <div className="list-group-header">{t('settings.billing.numberPattern')}</div>
      <div className="list-group">
        <div className="form-row">
          <label className="form-row-label">{t('settings.billing.numberPattern')}</label>
          <input
            type="text"
            value={numberPattern}
            onChange={(e) => setNumberPattern(e.target.value)}
            placeholder="FT {YYYY}/{SEQ}"
          />
        </div>
        <div className="list-row">
          <div className="list-row-content">
            <div className="list-row-label">{t('settings.billing.numberPreview')}</div>
          </div>
          <span className="list-row-value">{previewPattern(numberPattern)}</span>
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.billing.nextNumber')}</label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={nextSeq}
            onChange={(e) => setNextSeq(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
      </div>

      <div className="list-group-header">{t('settings.preferences.title')}</div>
      <div className="list-group">
        <div className="form-row">
          <label className="form-row-label">{t('settings.billing.paymentReminder')}</label>
          <select value={reminderDays} onChange={(e) => setReminderDays(Number(e.target.value))}>
            {REMINDER_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? t('settings.billing.paymentReminder.off') : t('settings.billing.paymentReminder.days', { days: d })}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.billing.weekStart')}</label>
          <select value={weekStart} onChange={(e) => setWeekStart(e.target.value as 'monday' | 'sunday')}>
            <option value="monday">{t('settings.billing.weekStart.monday')}</option>
            <option value="sunday">{t('settings.billing.weekStart.sunday')}</option>
          </select>
        </div>
      </div>
    </div>
  )
}
