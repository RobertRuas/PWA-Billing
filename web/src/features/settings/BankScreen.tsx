import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { db } from '../../data/db'
import { localUpdate } from '../../data/repository'
import { normalizeIBAN, formatIBAN, validateIBAN, validateSWIFT } from '../../domain/iban'

export function BankScreen() {
  const t = useT()
  const nav = useNav()
  const { user } = useAuth()

  const profile = useLiveQuery(
    () => db.mm_profiles.where('owner').equals(user?.id ?? '').first(),
    [user?.id],
  )

  const [ibanName, setIbanName] = useState('')
  const [iban, setIban] = useState('')
  const [swift, setSwift] = useState('')
  const [ibanError, setIbanError] = useState('')
  const [swiftError, setSwiftError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (profile && !loaded) {
      setIbanName((profile.bank_iban_name as string) || '')
      setIban(formatIBAN((profile.bank_iban as string) || ''))
      setSwift((profile.bank_swift as string) || '')
      setLoaded(true)
    }
  }, [profile, loaded])

  function handleIbanBlur() {
    const normalized = normalizeIBAN(iban)
    if (normalized && !validateIBAN(normalized)) {
      setIbanError(t('error.ibanInvalid'))
    } else {
      setIbanError('')
    }
    if (normalized) setIban(formatIBAN(normalized))
  }

  function handleSwiftBlur() {
    const trimmed = swift.trim().toUpperCase()
    if (trimmed && !validateSWIFT(trimmed)) {
      setSwiftError(t('error.swiftInvalid'))
    } else {
      setSwiftError('')
    }
    if (trimmed) setSwift(trimmed)
  }

  async function handleSave() {
    if (!profile) return
    const normalizedIban = normalizeIBAN(iban)
    if (normalizedIban && !validateIBAN(normalizedIban)) {
      setIbanError(t('error.ibanInvalid'))
      return
    }
    const trimmedSwift = swift.trim().toUpperCase()
    if (trimmedSwift && !validateSWIFT(trimmedSwift)) {
      setSwiftError(t('error.swiftInvalid'))
      return
    }
    await localUpdate('mm_profiles', profile.id, {
      bank_iban_name: ibanName.trim(),
      bank_iban: normalizedIban,
      bank_swift: trimmedSwift,
    })
    showToast(t('common.save'))
    nav.pop()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.bank.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={handleSave}>{t('common.save')}</button>}
      />

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="form-row">
          <label className="form-row-label">{t('settings.bank.ibanName')}</label>
          <input type="text" value={ibanName} onChange={(e) => setIbanName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.bank.iban')}</label>
          <input
            type="text"
            value={iban}
            onChange={(e) => { setIban(e.target.value); setIbanError('') }}
            onBlur={handleIbanBlur}
            autoCapitalize="characters"
            spellCheck={false}
          />
          {ibanError && <span className="form-row-error">{ibanError}</span>}
        </div>
        <div className="form-row">
          <label className="form-row-label">{t('settings.bank.swift')}</label>
          <input
            type="text"
            value={swift}
            onChange={(e) => { setSwift(e.target.value); setSwiftError('') }}
            onBlur={handleSwiftBlur}
            autoCapitalize="characters"
            spellCheck={false}
          />
          {swiftError && <span className="form-row-error">{swiftError}</span>}
        </div>
      </div>
    </div>
  )
}
