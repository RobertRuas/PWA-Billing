import { useState, useMemo } from 'react'
import { Sheet } from '../../ui/Sheet'
import { useT, useLocale } from '../../i18n'
import { formatMoney, fromCents, toCents, difference } from '../../domain/money'
import { toDateStr } from '../../domain/dates'
import { localUpdate } from '../../data/repository'
import { showToast } from '../../ui/Toast'

interface Props {
  open: boolean
  onClose: () => void
  invoiceId: string
  totalCents: number
  currency: string
}

export function ReceiveSheet({ open, onClose, invoiceId, totalCents, currency }: Props) {
  const t = useT()
  const locale = useLocale()
  const [amountStr, setAmountStr] = useState(() => fromCents(totalCents).toFixed(2))
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const receivedCents = useMemo(() => toCents(amountStr), [amountStr])
  const diff = useMemo(() => difference(receivedCents, totalCents), [receivedCents, totalCents])

  const diffColor = diff === 0 ? 'var(--green)' : diff < 0 ? 'var(--orange)' : 'var(--blue)'

  async function handleConfirm() {
    setSaving(true)
    try {
      await localUpdate('mm_invoices', invoiceId, {
        status: 'paid',
        paid_at: dateStr,
        received_cents: receivedCents,
        difference_cents: diff,
        payment_note: note,
      })
      showToast(t('invoice.status.paid'), 'success')
      onClose()
    } catch {
      showToast(t('error.generic'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('invoice.receive.title')}>
      <div style={{ padding: '0 16px 16px' }}>
        <div className="form-row">
          <label>{t('invoice.receive.amount')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>{t('invoice.receive.date')}</label>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>{t('invoice.receive.note')}</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={diff !== 0 ? t('invoice.receive.noteRecommended') : ''}
          />
        </div>

        <div
          className="list-group"
          style={{ margin: '12px 0', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ color: 'var(--label2)' }}>{t('invoice.receive.difference')}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: diffColor }}>
            {diff > 0 ? '+' : ''}{formatMoney(diff, currency, locale)}
          </span>
        </div>

        {diff !== 0 && (
          <div style={{ fontSize: 13, color: 'var(--orange)', marginBottom: 12, padding: '0 4px' }}>
            {t('invoice.receive.noteRecommended')}
          </div>
        )}

        <button
          className="btn btn--primary"
          style={{ width: '100%' }}
          onClick={handleConfirm}
          disabled={saving}
        >
          {t('invoice.receive.confirm')}
        </button>
      </div>
    </Sheet>
  )
}
