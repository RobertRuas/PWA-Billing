import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { db } from '../../data/db'
import { localUpdate } from '../../data/repository'

export function TechnicianScreen() {
  const t = useT()
  const nav = useNav()
  const { user } = useAuth()

  const profile = useLiveQuery(
    () => db.mm_profiles.where('owner').equals(user?.id ?? '').first(),
    [user?.id],
  )

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [vat, setVat] = useState('')
  const [tel, setTel] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (profile && !loaded) {
      setName((profile.tech_name as string) || '')
      setCompany((profile.tech_company as string) || '')
      setEmail((profile.tech_email as string) || '')
      setAddress((profile.tech_address as string) || '')
      setVat((profile.tech_vat as string) || '')
      setTel((profile.tech_tel as string) || '')
      setLoaded(true)
    }
  }, [profile, loaded])

  async function handleSave() {
    if (!profile) return
    await localUpdate('mm_profiles', profile.id, {
      tech_name: name.trim(),
      tech_company: company.trim(),
      tech_email: email.trim(),
      tech_address: address.trim(),
      tech_vat: vat.trim(),
      tech_tel: tel.trim(),
    })
    showToast(t('common.save'))
    nav.pop()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.technician.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={handleSave}>{t('common.save')}</button>}
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label className="form-row-label">{t('settings.technician.name')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.technician.company')}</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.technician.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.technician.address')}</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.technician.vat')}</label>
          <input type="text" value={vat} onChange={(e) => setVat(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.technician.tel')}</label>
          <input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
        </div>
      </div>
    </div>
  )
}
