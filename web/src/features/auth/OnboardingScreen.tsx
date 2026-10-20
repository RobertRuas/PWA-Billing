import { useState } from 'react'
import { useT } from '../../i18n'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { showToast } from '../../ui/Toast'
import { db } from '../../data/db'
import { localCreate, localUpdate } from '../../data/repository'
import { validateIBAN, validateSWIFT, normalizeIBAN } from '../../domain/iban'

interface Props {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: Props) {
  const t = useT()
  const { user } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1 — Technician
  const [techName, setTechName] = useState('')
  const [techCompany, setTechCompany] = useState('')
  const [techEmail, setTechEmail] = useState('')
  const [techAddress, setTechAddress] = useState('')
  const [techVat, setTechVat] = useState('')
  const [techTel, setTechTel] = useState('')

  // Step 2 — Bank
  const [ibanName, setIbanName] = useState('')
  const [iban, setIban] = useState('')
  const [swift, setSwift] = useState('')

  // Step 3 — Client + Project
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientVat, setClientVat] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectRole, setProjectRole] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [perdiem, setPerdiem] = useState('')

  async function saveStep1() {
    if (!user) return
    const profile = await db.mm_profiles.filter((p) => p.owner === user.id).first()
    if (profile) {
      await localUpdate('mm_profiles', profile.id, {
        tech_name: techName,
        tech_company: techCompany,
        tech_email: techEmail || user.email,
        tech_address: techAddress,
        tech_vat: techVat,
        tech_tel: techTel,
      })
    }
    setStep(2)
  }

  async function saveStep2() {
    if (!user) return
    if (iban && !validateIBAN(iban)) {
      showToast(t('error.ibanInvalid'), 'error')
      return
    }
    if (swift && !validateSWIFT(swift)) {
      showToast(t('error.swiftInvalid'), 'error')
      return
    }
    const profile = await db.mm_profiles.filter((p) => p.owner === user.id).first()
    if (profile) {
      await localUpdate('mm_profiles', profile.id, {
        bank_iban_name: ibanName,
        bank_iban: normalizeIBAN(iban),
        bank_swift: swift.replace(/\s+/g, '').toUpperCase(),
      })
    }
    setStep(3)
  }

  async function saveStep3() {
    if (!user) return
    try {
      if (clientName) {
        const clientId = await localCreate('mm_clients', {
          name: clientName,
          address: clientAddress,
          vat: clientVat,
          email: clientEmail,
        }, user.id)

        if (projectName) {
          const rateInCents = Math.round(parseFloat(hourlyRate || '0') * 100)
          const perdiemInCents = Math.round(parseFloat(perdiem || '0') * 100)
          await localCreate('mm_projects', {
            name: projectName,
            client: clientId,
            role: projectRole,
            hourly_rate_cents: rateInCents,
            perdiem_cents: perdiemInCents,
          }, user.id)
        }
      }
    } catch {
      showToast(t('error.generic'), 'error')
    }
    onComplete()
  }

  const stepTitles = [
    t('onboarding.step1.title'),
    t('onboarding.step2.title'),
    t('onboarding.step3.title'),
  ]

  const stepSubtitles = [
    t('onboarding.step1.subtitle'),
    t('onboarding.step2.subtitle'),
    t('onboarding.step3.subtitle'),
  ]

  function handleSkip() {
    if (step < 3) {
      setStep(step + 1)
    } else {
      onComplete()
    }
  }

  function handleNext() {
    if (step === 1) saveStep1()
    else if (step === 2) saveStep2()
    else saveStep3()
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={`${step}/3`}
        left={<button onClick={handleSkip}>{t('onboarding.skip')}</button>}
        right={
          <button onClick={handleNext}>
            {step < 3 ? t('onboarding.next') : t('onboarding.done')}
          </button>
        }
      />

      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{stepTitles[step - 1]}</h2>
        <p style={{ color: 'var(--label2)', fontSize: 14, marginBottom: 24 }}>{stepSubtitles[step - 1]}</p>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 1.5,
                background: s <= step ? 'var(--blue)' : 'var(--sep)',
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="list-group" style={{ margin: 0 }}>
            <div className="form-row">
              <label>{t('settings.technician.name')}</label>
              <input value={techName} onChange={(e) => setTechName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>{t('settings.technician.company')}</label>
              <input value={techCompany} onChange={(e) => setTechCompany(e.target.value)} />
            </div>
            <div className="form-row">
              <label>{t('settings.technician.email')}</label>
              <input type="email" value={techEmail} onChange={(e) => setTechEmail(e.target.value)} placeholder={user?.email} />
            </div>
            <div className="form-row">
              <label>{t('settings.technician.address')}</label>
              <textarea rows={2} value={techAddress} onChange={(e) => setTechAddress(e.target.value)} />
            </div>
            <div className="form-row">
              <label>{t('settings.technician.vat')}</label>
              <input value={techVat} onChange={(e) => setTechVat(e.target.value)} />
            </div>
            <div className="form-row">
              <label>{t('settings.technician.tel')}</label>
              <input type="tel" value={techTel} onChange={(e) => setTechTel(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="list-group" style={{ margin: 0 }}>
            <div className="form-row">
              <label>{t('settings.bank.ibanName')}</label>
              <input value={ibanName} onChange={(e) => setIbanName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>{t('settings.bank.iban')}</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="PT50 0000 0000 0000 0000 0000 0" />
            </div>
            <div className="form-row">
              <label>{t('settings.bank.swift')}</label>
              <input value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="XXXXXXXX" />
            </div>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="list-group-header" style={{ marginTop: 0 }}>{t('settings.clients.title')}</div>
            <div className="list-group">
              <div className="form-row">
                <label>{t('settings.client.name')}</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="form-row">
                <label>{t('settings.client.address')}</label>
                <textarea rows={2} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </div>
              <div className="form-row">
                <label>{t('settings.client.vat')}</label>
                <input value={clientVat} onChange={(e) => setClientVat(e.target.value)} />
              </div>
              <div className="form-row">
                <label>{t('settings.client.email')}</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
            </div>

            <div className="list-group-header">{t('settings.projects.title')}</div>
            <div className="list-group">
              <div className="form-row">
                <label>{t('settings.project.name')}</label>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
              </div>
              <div className="form-row">
                <label>{t('settings.project.role')}</label>
                <input value={projectRole} onChange={(e) => setProjectRole(e.target.value)} />
              </div>
              <div className="form-row">
                <label>{t('settings.billing.hourlyRate')}</label>
                <input type="number" inputMode="decimal" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
              </div>
              <div className="form-row">
                <label>{t('settings.billing.perdiem')}</label>
                <input type="number" inputMode="decimal" step="0.01" value={perdiem} onChange={(e) => setPerdiem(e.target.value)} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
