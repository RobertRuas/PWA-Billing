import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav, useRoute } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { db } from '../../data/db'
import { localCreate, localUpdate } from '../../data/repository'

export function ClientFormScreen() {
  const t = useT()
  const nav = useNav()
  const route = useRoute()
  const { user } = useAuth()

  const clientId = route.path.split('/').pop()
  const isNew = clientId === 'novo'

  const existing = useLiveQuery(
    () => (isNew ? undefined : db.mm_clients.get(clientId!)),
    [clientId],
  )

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [vatNum, setVatNum] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [nameError, setNameError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (existing && !loaded) {
      setName((existing.name as string) || '')
      setAddress((existing.address as string) || '')
      setVatNum((existing.vat as string) || '')
      setEmail((existing.email as string) || '')
      setNotes((existing.notes as string) || '')
      setLoaded(true)
    }
  }, [existing, loaded])

  async function handleSave() {
    if (!name.trim()) {
      setNameError(t('error.required'))
      return
    }
    const data = {
      name: name.trim(),
      address: address.trim(),
      vat: vatNum.trim(),
      email: email.trim(),
      notes: notes.trim(),
    }
    if (isNew) {
      await localCreate('mm_clients', data, user!.id)
    } else {
      await localUpdate('mm_clients', clientId!, data)
    }
    showToast(t('common.save'))
    nav.pop()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={isNew ? t('settings.client.new') : t('settings.client.edit')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={handleSave}>{t('common.save')}</button>}
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label className="form-row-label">{t('settings.client.name')} *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError('') }}
          />
          {nameError && <span className="form-row-error">{nameError}</span>}
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.client.address')}</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.client.vat')}</label>
          <input type="text" value={vatNum} onChange={(e) => setVatNum(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.client.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.client.notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
    </div>
  )
}
