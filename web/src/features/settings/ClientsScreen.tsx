import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n'
import { useNav } from '../../app/navigation'
import { useAuth } from '../../app/AuthContext'
import { NavBar } from '../../ui/NavBar'
import { db } from '../../data/db'
import { localSoftDelete, localUpdate } from '../../data/repository'

export function ClientsScreen() {
  const t = useT()
  const nav = useNav()
  const { user } = useAuth()
  const [showArchived, setShowArchived] = useState(false)

  const clients = useLiveQuery(async () => {
    const all = await db.mm_clients.where('owner').equals(user?.id ?? '').toArray()
    return all.filter((c) => !c.deleted_at)
  }, [user?.id])

  const active = clients?.filter((c) => !c.archived) ?? []
  const archived = clients?.filter((c) => c.archived) ?? []

  async function handleDelete(id: string) {
    if (confirm(t('common.delete') + '?')) {
      await localSoftDelete('mm_clients', id)
    }
  }

  async function handleToggleArchive(id: string, currentlyArchived: boolean) {
    await localUpdate('mm_clients', id, { archived: !currentlyArchived })
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
        title={t('settings.clients.title')}
        left={<button onClick={() => nav.pop()}>{t('common.back')}</button>}
        right={<button onClick={() => nav.push('/ajustes/clientes/novo')}>+</button>}
      />

      {active.length === 0 && archived.length === 0 && (
        <div className="empty-state">
          <p>{t('settings.clients.empty')}</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="list-group" style={{ marginTop: 12 }}>
          {active.map((client) => (
            <button
              key={client.id}
              className="list-row"
              onClick={() => nav.push(`/ajustes/clientes/${client.id}`)}
              onContextMenu={(e) => {
                e.preventDefault()
                const action = confirm(`${t('settings.client.archive')}?`)
                if (action) handleToggleArchive(client.id, false)
              }}
            >
              <div className="list-row-content">
                <div className="list-row-label">{String(client.name)}</div>
                {!!client.email && <div className="list-row-sublabel">{String(client.email)}</div>}
              </div>
              <Chevron />
            </button>
          ))}
        </div>
      )}

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
              {archived.map((client) => (
                <div key={client.id} className="list-row" style={{ opacity: 0.6 }}>
                  <div className="list-row-content">
                    <div className="list-row-label">{client.name as string}</div>
                  </div>
                  <button
                    className="btn btn--small"
                    onClick={() => handleToggleArchive(client.id, true)}
                  >
                    {t('settings.client.unarchive')}
                  </button>
                  <button
                    className="btn btn--small btn--destructive"
                    style={{ marginLeft: 8 }}
                    onClick={() => handleDelete(client.id)}
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
