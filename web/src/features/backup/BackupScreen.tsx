import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { Sheet } from '../../ui/Sheet'
import { showToast } from '../../ui/Toast'
import { db, COLLECTIONS } from '../../data/db'
import { pb } from '../../data/pb'
import { localSoftDelete } from '../../data/repository'
import { encryptBackup, decryptBackup, type MmbkFile } from '../../domain/crypto'

export function BackupScreen() {
  const t = useT()
  const nav = useNav()
  const { user } = useAuth()

  const destinations = useLiveQuery(
    () => db.mm_backup_destinations.filter((d) => !d.deleted_at && d.owner === user?.id).toArray(),
    [user?.id],
  )

  const logs = useLiveQuery(
    () => db.mm_backup_logs.filter((l) => !l.deleted_at && l.owner === user?.id).reverse().sortBy('created'),
    [user?.id],
  )

  const profile = useLiveQuery(
    () => db.mm_profiles.filter((p) => p.owner === user?.id).first(),
    [user?.id],
  )

  const [addingEmail, setAddingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [sendSheetOpen, setSendSheetOpen] = useState(false)
  const [restoreSheetOpen, setRestoreSheetOpen] = useState(false)

  // Send backup state
  const [selectedDests, setSelectedDests] = useState<string[]>([])
  const [passphrase, setPassphrase] = useState('')
  const [passphraseConfirm, setPassphraseConfirm] = useState('')
  const [includeAttachments, setIncludeAttachments] = useState(false)
  const [sending, setSending] = useState(false)

  // Restore state
  const [restoreFile, setRestoreFile] = useState<MmbkFile | null>(null)
  const [restorePassphrase, setRestorePassphrase] = useState('')
  const [restoreSummary, setRestoreSummary] = useState<{ invoices: number; attachments: number; from: string; to: string } | null>(null)
  const [restoreData, setRestoreData] = useState<Record<string, unknown[]> | null>(null)
  const [restoreError, setRestoreError] = useState('')

  const verifiedDests = (destinations ?? []).filter((d) => d.verified)

  async function handleAddEmail() {
    if (!newEmail || !user) return
    try {
      await pb.send('/api/mm/backup/destinations', {
        method: 'POST',
        body: { email: newEmail },
      })
      showToast(t('settings.backup.pending'), 'info')
      setNewEmail('')
      setAddingEmail(false)
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  async function handleResend(id: string) {
    try {
      await pb.send(`/api/mm/backup/destinations/${id}/resend`, { method: 'POST' })
      showToast(t('settings.backup.resend'), 'success')
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  async function handleRemove(id: string) {
    if (!confirm(t('common.confirm'))) return
    await localSoftDelete('mm_backup_destinations', id)
  }

  function handleScheduleChange(schedule: string) {
    if (!profile) return
    db.mm_profiles.update(profile.id, { backup_schedule: schedule } as never)
  }

  async function gatherBackupPayload() {
    const payload: Record<string, unknown[]> = {}
    for (const col of COLLECTIONS) {
      if (col === 'mm_backup_destinations' || col === 'mm_backup_logs') continue
      const records = await db[col].filter((r) => !r.deleted_at && r.owner === user?.id).toArray()
      payload[col] = records
    }
    if (includeAttachments) {
      const files = await db.files.toArray()
      payload._files = files.map((f) => ({
        recordId: f.recordId,
        field: f.field,
        size: f.blob.size,
        type: f.blob.type,
      }))
    }
    return payload
  }

  async function handleSendBackup() {
    if (passphrase.length < 8 || passphrase !== passphraseConfirm || selectedDests.length === 0) return
    setSending(true)
    try {
      const payload = await gatherBackupPayload()
      const encrypted = await encryptBackup(payload, passphrase)
      const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' })

      const sizeBytes = blob.size
      if (sizeBytes > 15 * 1024 * 1024) {
        showToast(t('settings.backup.sizeWarning'), 'info')
      }

      const formData = new FormData()
      formData.append('file', blob, `billing-backup-${new Date().toISOString().slice(0, 10)}.mmbk`)
      formData.append('destinations', JSON.stringify(selectedDests))

      await pb.send('/api/mm/backup/send', {
        method: 'POST',
        body: formData,
      })

      showToast(t('settings.backup.sent'), 'success')
      setSendSheetOpen(false)
      resetSendState()
    } catch {
      showToast(t('error.generic'), 'error')
    } finally {
      setSending(false)
    }
  }

  async function handleExportFile() {
    const pp = prompt(t('settings.backup.passphrase'))
    if (!pp || pp.length < 8) return
    const ppConfirm = prompt(t('settings.backup.passphraseConfirm'))
    if (pp !== ppConfirm) return

    try {
      const payload = await gatherBackupPayload()
      const encrypted = await encryptBackup(payload, pp)
      const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `billing-backup-${new Date().toISOString().slice(0, 10)}.mmbk`
      a.click()
      URL.revokeObjectURL(url)
      showToast(t('settings.backup.sent'), 'success')
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }

  function handleRestoreFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as MmbkFile
        if (parsed.format !== 'mmbk') throw new Error('Invalid')
        setRestoreFile(parsed)
        setRestoreError('')
        setRestoreSummary(null)
        setRestoreData(null)
        setRestorePassphrase('')
        setRestoreSheetOpen(true)
      } catch {
        showToast(t('error.generic'), 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleDecryptRestore() {
    if (!restoreFile || restorePassphrase.length < 8) return
    try {
      const data = (await decryptBackup(restoreFile, restorePassphrase)) as Record<string, unknown[]>
      setRestoreData(data)
      const invoices = (data.mm_invoices ?? []).length
      const attachments = (data.mm_attachments ?? []).length
      const dates = (data.mm_invoices ?? [] as unknown[])
        .map((i: unknown) => ((i as Record<string, string>).invoice_date ?? ''))
        .filter(Boolean)
        .sort()
      setRestoreSummary({
        invoices,
        attachments,
        from: dates[0] ?? '—',
        to: dates[dates.length - 1] ?? '—',
      })
      setRestoreError('')
    } catch {
      setRestoreError(t('settings.backup.wrongPassphrase'))
    }
  }

  const handleMergeRestore = useCallback(async () => {
    if (!restoreData || !user) return
    try {
      for (const col of COLLECTIONS) {
        if (col === 'mm_backup_destinations' || col === 'mm_backup_logs') continue
        const records = (restoreData[col] ?? []) as Array<Record<string, unknown> & { id: string }>
        for (const record of records) {
          const existing = await db[col].get(record.id)
          if (!existing) {
            await db[col].put({ ...record, owner: user.id } as never)
          }
        }
      }
      showToast(t('settings.backup.restoreSuccess'), 'success')
      setRestoreSheetOpen(false)
      setRestoreFile(null)
      setRestoreData(null)
      setRestoreSummary(null)
    } catch {
      showToast(t('error.generic'), 'error')
    }
  }, [restoreData, user, t])

  function resetSendState() {
    setSelectedDests([])
    setPassphrase('')
    setPassphraseConfirm('')
    setIncludeAttachments(false)
  }

  function toggleDest(id: string) {
    setSelectedDests((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    )
  }

  const schedule = (profile?.backup_schedule as string) ?? 'off'

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.backup')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
      />

      {/* Destinations */}
      <div className="list-group-header">{t('settings.backup.destinations')}</div>
      <div className="list-group">
        {(destinations ?? []).map((dest) => (
          <div key={dest.id} className="list-row">
            <div className="list-row-content">
              <div className="list-row-label">{dest.email as string}</div>
              <div className="list-row-detail">
                {dest.verified ? (
                  <span className="pill pill--green">{t('settings.backup.verified')}</span>
                ) : (
                  <span className="pill pill--orange">{t('settings.backup.pending')}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!dest.verified && (
                <button className="btn btn--small" onClick={() => handleResend(dest.id)}>
                  {t('settings.backup.resend')}
                </button>
              )}
              <button className="btn btn--small btn--destructive" onClick={() => handleRemove(dest.id)}>
                {t('common.remove')}
              </button>
            </div>
          </div>
        ))}

        {addingEmail ? (
          <div className="list-row" style={{ gap: 8 }}>
            <input
              type="email"
              className="form-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn btn--small btn--primary" onClick={handleAddEmail}>
              {t('common.add')}
            </button>
            <button className="btn btn--small" onClick={() => { setAddingEmail(false); setNewEmail('') }}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button className="list-row" onClick={() => setAddingEmail(true)}>
            <span style={{ color: 'var(--blue)', fontSize: 14 }}>{t('settings.backup.addEmail')}</span>
          </button>
        )}
      </div>

      {/* Schedule */}
      <div className="list-group-header">{t('settings.backup.schedule')}</div>
      <div className="list-group">
        {(['off', 'weekly', 'monthly'] as const).map((opt) => (
          <button
            key={opt}
            className="list-row"
            onClick={() => handleScheduleChange(opt)}
          >
            <div className="list-row-content">
              <div className="list-row-label">{t(`settings.backup.schedule.${opt}`)}</div>
            </div>
            {schedule === opt && <span style={{ color: 'var(--blue)' }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="list-group-header" />
      <div className="list-group">
        <button
          className="list-row"
          onClick={() => { resetSendState(); setSendSheetOpen(true) }}
          disabled={verifiedDests.length === 0}
        >
          <span style={{ color: verifiedDests.length > 0 ? 'var(--blue)' : 'var(--label2)', fontSize: 14 }}>
            {t('settings.backup.sendNow')}
          </span>
        </button>
        <button className="list-row" onClick={handleExportFile}>
          <span style={{ color: 'var(--blue)', fontSize: 14 }}>{t('settings.backup.export')}</span>
        </button>
        <label className="list-row" style={{ cursor: 'pointer' }}>
          <span style={{ color: 'var(--blue)', fontSize: 14 }}>{t('settings.backup.restore')}</span>
          <input
            type="file"
            accept=".mmbk"
            onChange={handleRestoreFileSelect}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* History */}
      {(logs ?? []).length > 0 && (
        <>
          <div className="list-group-header">{t('settings.backup.history')}</div>
          <div className="list-group">
            {(logs ?? []).slice(0, 10).map((log) => (
              <div key={log.id} className="list-row">
                <div className="list-row-content">
                  <div className="list-row-label">{log.destination_email as string}</div>
                  <div className="list-row-detail">{new Date(log.created).toLocaleDateString()}</div>
                </div>
                <span className="pill pill--green">{t('common.done')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Send Backup Sheet */}
      <Sheet open={sendSheetOpen} onClose={() => setSendSheetOpen(false)} title={t('settings.backup.sendNow')}>
        <div style={{ padding: '0 16px 24px' }}>
          <div className="list-group-header">{t('settings.backup.selectDestinations')}</div>
          <div className="list-group">
            {verifiedDests.map((dest) => (
              <button
                key={dest.id}
                className="list-row"
                onClick={() => toggleDest(dest.id)}
              >
                <div className="list-row-content">
                  <div className="list-row-label">{dest.email as string}</div>
                </div>
                {selectedDests.includes(dest.id) && <span style={{ color: 'var(--blue)' }}>✓</span>}
              </button>
            ))}
          </div>

          <div className="form-row" style={{ marginTop: 16 }}>
            <label className="form-label">{t('settings.backup.passphrase')}</label>
            <input
              type="password"
              className="form-input"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('settings.backup.passphraseMin')}
            />
          </div>

          <div className="form-row">
            <label className="form-label">{t('settings.backup.passphraseConfirm')}</label>
            <input
              type="password"
              className="form-input"
              value={passphraseConfirm}
              onChange={(e) => setPassphraseConfirm(e.target.value)}
            />
          </div>

          <div className="list-group" style={{ marginTop: 16 }}>
            <button className="list-row" onClick={() => setIncludeAttachments(!includeAttachments)}>
              <div className="list-row-content">
                <div className="list-row-label">{t('settings.backup.includeAttachments')}</div>
              </div>
              <div className={`toggle ${includeAttachments ? 'toggle--on' : ''}`}>
                <div className="toggle-thumb" />
              </div>
            </button>
          </div>

          <button
            className="btn btn--primary"
            style={{ width: '100%', marginTop: 24 }}
            onClick={handleSendBackup}
            disabled={sending || passphrase.length < 8 || passphrase !== passphraseConfirm || selectedDests.length === 0}
          >
            {sending ? t('settings.backup.sending') : t('common.confirm')}
          </button>
        </div>
      </Sheet>

      {/* Restore Sheet */}
      <Sheet open={restoreSheetOpen} onClose={() => setRestoreSheetOpen(false)} title={t('settings.backup.restore')}>
        <div style={{ padding: '0 16px 24px' }}>
          {!restoreSummary ? (
            <>
              <div className="form-row">
                <label className="form-label">{t('settings.backup.restorePassphrase')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder={t('settings.backup.passphraseMin')}
                />
              </div>
              {restoreError && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{restoreError}</p>}
              <button
                className="btn btn--primary"
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleDecryptRestore}
                disabled={restorePassphrase.length < 8}
              >
                {t('common.confirm')}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--label2)', margin: '8px 0 16px' }}>
                {t('settings.backup.restoreSummary', {
                  invoices: String(restoreSummary.invoices),
                  attachments: String(restoreSummary.attachments),
                  from: restoreSummary.from,
                  to: restoreSummary.to,
                })}
              </p>
              <button
                className="btn btn--primary"
                style={{ width: '100%' }}
                onClick={handleMergeRestore}
              >
                {t('settings.backup.restoreMerge')}
              </button>
            </>
          )}
        </div>
      </Sheet>
    </div>
  )
}
