import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT, useLocale } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { db } from '../../data/db'
import { localSoftDelete, localUpdate } from '../../data/repository'
import { formatMoney } from '../../domain/money'

export function ProjectsScreen() {
  const t = useT()
  const locale = useLocale()
  const nav = useNav()
  const { user } = useAuth()
  const [showArchived, setShowArchived] = useState(false)

  const projects = useLiveQuery(async () => {
    const all = await db.mm_projects.where('owner').equals(user?.id ?? '').toArray()
    return all.filter((p) => !p.deleted_at)
  }, [user?.id])

  const clients = useLiveQuery(
    () => db.mm_clients.where('owner').equals(user?.id ?? '').toArray(),
    [user?.id],
  )

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name as string]))

  const active = projects?.filter((p) => !p.archived) ?? []
  const archived = projects?.filter((p) => p.archived) ?? []

  const grouped = new Map<string, typeof active>()
  for (const p of active) {
    const clientName = clientMap.get(p.client as string) ?? '—'
    if (!grouped.has(clientName)) grouped.set(clientName, [])
    grouped.get(clientName)!.push(p)
  }

  async function handleDelete(id: string) {
    if (confirm(t('common.delete') + '?')) {
      await localSoftDelete('mm_projects', id)
    }
  }

  async function handleToggleArchive(id: string, currentlyArchived: boolean) {
    await localUpdate('mm_projects', id, { archived: !currentlyArchived })
  }

  function Chevron() {
    return (
      <svg className="list-row-chevron" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0.5 1l5 5-5 5" />
      </svg>
    )
  }

  return (
    <div className="page page--no-tabs">
      <NavBar
        title={t('settings.projects.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={() => nav.push('/ajustes/projetos/novo')}>+</button>}
      />

      {active.length === 0 && archived.length === 0 && (
        <div className="empty-state">
          <p>{t('settings.projects.empty')}</p>
        </div>
      )}

      {[...grouped.entries()].map(([clientName, prjs]) => (
        <div key={clientName}>
          <div className="list-group-header">{clientName}</div>
          <div className="list-group">
            {prjs.map((project) => (
              <button
                key={project.id}
                className="list-row"
                onClick={() => nav.push(`/ajustes/projetos/${project.id}`)}
              >
                <div className="list-row-content">
                  <div className="list-row-label">{project.name as string}</div>
                  <div className="list-row-sublabel">
                    {project.role ? `${project.role} · ` : ''}
                    {project.hourly_rate_cents
                      ? formatMoney(project.hourly_rate_cents as number, (project.currency as string) || 'EUR', locale) + '/h'
                      : ''}
                  </div>
                </div>
                <Chevron />
              </button>
            ))}
          </div>
        </div>
      ))}

      {archived.length > 0 && (
        <>
          <button
            className="list-group-header"
            onClick={() => setShowArchived(!showArchived)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {t('settings.clients.showArchived')} ({archived.length})
            <svg
              viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ transform: showArchived ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </button>
          {showArchived && (
            <div className="list-group">
              {archived.map((project) => (
                <div key={project.id} className="list-row" style={{ opacity: 0.6 }}>
                  <div className="list-row-content">
                    <div className="list-row-label">{project.name as string}</div>
                  </div>
                  <button
                    className="btn btn--small"
                    onClick={() => handleToggleArchive(project.id, true)}
                  >
                    {t('settings.project.unarchive')}
                  </button>
                  <button
                    className="btn btn--small btn--destructive"
                    style={{ marginLeft: 8 }}
                    onClick={() => handleDelete(project.id)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
