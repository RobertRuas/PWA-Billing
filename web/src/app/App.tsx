import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { I18nContext, resolveLocale } from '../i18n'
import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeProvider'
import { StackNavigator, useRoute } from './navigation'
import { TabBar, type TabKey } from '../ui/TabBar'
import { ToastContainer } from '../ui/Toast'
import { db } from '../data/db'

import { LoginScreen } from '../features/auth/LoginScreen'
import { RegisterScreen } from '../features/auth/RegisterScreen'
import { VerifyEmailScreen } from '../features/auth/VerifyEmailScreen'
import { ResetPasswordRequestScreen, ResetPasswordConfirmScreen } from '../features/auth/ResetPasswordScreen'
import { OnboardingScreen } from '../features/auth/OnboardingScreen'
import { SummaryScreen } from '../features/invoices/SummaryScreen'
import { InvoiceListScreen } from '../features/invoices/InvoiceListScreen'
import { InvoiceFormScreen } from '../features/invoices/InvoiceFormScreen'
import { InvoiceDetailScreen } from '../features/invoices/InvoiceDetailScreen'
import { TimesheetsScreen } from '../features/timesheets/TimesheetsScreen'
import { TimesheetFormScreen } from '../features/timesheets/TimesheetFormScreen'
import { TimesheetDetailScreen } from '../features/timesheets/TimesheetDetailScreen'
import { ExpenseFormScreen } from '../features/expenses/ExpenseFormScreen'
import { ExpenseDetailScreen } from '../features/expenses/ExpenseDetailScreen'
import { ReportsScreen } from '../features/reports/ReportsScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { AccountScreen } from '../features/settings/AccountScreen'
import { TechnicianScreen } from '../features/settings/TechnicianScreen'
import { BankScreen } from '../features/settings/BankScreen'
import { ClientsScreen } from '../features/settings/ClientsScreen'
import { ClientFormScreen } from '../features/settings/ClientFormScreen'
import { ProjectsScreen } from '../features/settings/ProjectsScreen'
import { ProjectFormScreen } from '../features/settings/ProjectFormScreen'
import { BillingScreen } from '../features/settings/BillingScreen'
import { PreferencesScreen } from '../features/settings/PreferencesScreen'
import { SecurityScreen } from '../features/settings/SecurityScreen'
import { BackupScreen } from '../features/backup/BackupScreen'
import { BackupConfirmScreen } from '../features/backup/BackupConfirmScreen'
import { InstallSheet, useInstallPrompt } from '../features/install/InstallScreen'

function AppRouter() {
  const { user, loading } = useAuth()
  const route = useRoute()
  const [tab, setTab] = useState<TabKey>('summary')
  const [onboardingDone, setOnboardingDone] = useState(false)
  const { shouldShow: showInstall, dismiss: dismissInstall } = useInstallPrompt()
  const [installDismissed, setInstallDismissed] = useState(false)

  const profile = useLiveQuery(
    () => user ? db.mm_profiles.filter((p) => p.owner === user.id).first() : undefined,
    [user?.id],
  )

  const needsOnboarding = user && profile !== undefined && profile !== null && !profile.tech_name && !onboardingDone

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20 }} />
      </div>
    )
  }

  // Public routes
  const path = route.path
  if (path.startsWith('/verificar-email')) return <VerifyEmailScreen />
  if (path.startsWith('/redefinir-senha')) return <ResetPasswordConfirmScreen />
  if (path.startsWith('/confirmar-backup')) return <BackupConfirmScreen />

  if (!user) {
    if (path === '/criar-conta') return <RegisterScreen />
    if (path === '/recuperar-senha') return <ResetPasswordRequestScreen />
    return <LoginScreen />
  }

  // Onboarding
  if (needsOnboarding) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />
  }

  // Authenticated routes — Invoices
  if (path === '/faturas/nova') return <InvoiceFormScreen />
  if (path.endsWith('/editar') && path.startsWith('/faturas/')) return <InvoiceFormScreen />
  if (path.startsWith('/faturas/')) return <InvoiceDetailScreen />

  // Timesheets
  if (path === '/timesheets/nova') return <TimesheetFormScreen />
  if (path.endsWith('/editar') && path.startsWith('/timesheets/')) return <TimesheetFormScreen />
  if (path.startsWith('/timesheets/')) return <TimesheetDetailScreen />

  // Expenses
  if (path === '/despesas/nova') return <ExpenseFormScreen />
  if (path.endsWith('/editar') && path.startsWith('/despesas/')) return <ExpenseFormScreen />
  if (path.startsWith('/despesas/')) return <ExpenseDetailScreen />

  // Settings sub-screens
  if (path === '/ajustes/conta') return <AccountScreen />
  if (path === '/ajustes/tecnico') return <TechnicianScreen />
  if (path === '/ajustes/banco') return <BankScreen />
  if (path === '/ajustes/clientes/novo') return <ClientFormScreen />
  if (path.startsWith('/ajustes/clientes/')) return <ClientFormScreen />
  if (path === '/ajustes/clientes') return <ClientsScreen />
  if (path === '/ajustes/projetos/novo') return <ProjectFormScreen />
  if (path.startsWith('/ajustes/projetos/')) return <ProjectFormScreen />
  if (path === '/ajustes/projetos') return <ProjectsScreen />
  if (path === '/ajustes/faturacao') return <BillingScreen />
  if (path === '/ajustes/preferencias') return <PreferencesScreen />
  if (path === '/ajustes/seguranca') return <SecurityScreen />
  if (path === '/ajustes/backup') return <BackupScreen />

  // Tab screens
  const tabScreens: Record<TabKey, React.ReactNode> = {
    summary: <SummaryScreen />,
    invoices: <InvoiceListScreen />,
    timesheets: <TimesheetsScreen />,
    reports: <ReportsScreen />,
    settings: <SettingsScreen />,
  }

  return (
    <>
      {tabScreens[tab]}
      <TabBar active={tab} onSelect={setTab} />
      <InstallSheet
        open={showInstall && !installDismissed}
        onClose={() => { dismissInstall(); setInstallDismissed(true) }}
      />
    </>
  )
}

export function App() {
  const [locale] = useState(() => resolveLocale('auto'))

  useEffect(() => {
    document.documentElement.lang = locale === 'pt-BR' ? 'pt-BR' : 'en'
  }, [locale])

  return (
    <I18nContext.Provider value={locale}>
      <AuthProvider>
        <ThemeProvider>
          <StackNavigator>
            <AppRouter />
          </StackNavigator>
          <ToastContainer />
        </ThemeProvider>
      </AuthProvider>
    </I18nContext.Provider>
  )
}
