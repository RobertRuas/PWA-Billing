import { pb } from './pb'
import { db, getTable, setMeta, getMeta, type CollectionName, type OutboxEntry } from './db'

const PUSH_ORDER: CollectionName[] = [
  'mm_clients',
  'mm_projects',
  'mm_timesheets',
  'mm_timesheet_entries',
  'mm_perdiem_entries',
  'mm_invoices',
  'mm_invoice_items',
  'mm_attachments',
  'mm_profiles',
]

const PULL_ORDER: CollectionName[] = [
  'mm_profiles',
  'mm_clients',
  'mm_projects',
  'mm_timesheets',
  'mm_timesheet_entries',
  'mm_perdiem_entries',
  'mm_invoices',
  'mm_invoice_items',
  'mm_invoice_events',
  'mm_attachments',
  'mm_backup_destinations',
  'mm_backup_logs',
]

type SyncStatus = 'idle' | 'syncing' | 'error'
type SyncListener = (status: SyncStatus, lastSyncAt: string | null, pendingCount: number, error?: string) => void

let syncStatus: SyncStatus = 'idle'
let lastError: string | undefined
let listeners: SyncListener[] = []
let syncLock = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function onSyncChange(fn: SyncListener) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

async function notify() {
  const lastSyncAt = (await getMeta('lastSyncAt')) ?? null
  const pendingCount = await db.outbox.count()
  for (const fn of listeners) fn(syncStatus, lastSyncAt, pendingCount, lastError)
}

export function triggerSync(debounceMs = 1500) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runSync(), debounceMs)
}

export async function runSync(): Promise<boolean> {
  if (syncLock) return false
  if (!pb.authStore.isValid) return false
  if (!navigator.onLine) return false

  syncLock = true
  syncStatus = 'syncing'
  lastError = undefined
  await notify()

  let success = true
  try {
    await pushOutbox()
    await pullAll()
    await setMeta('lastSyncAt', new Date().toISOString())
  } catch (err) {
    success = false
    syncStatus = 'error'
    lastError = err instanceof Error ? err.message : 'Unknown error'
    await notify()
  } finally {
    syncLock = false
    if (success) {
      syncStatus = 'idle'
      await notify()
    }
  }
  return success
}

async function pushOutbox() {
  for (const collection of PUSH_ORDER) {
    const entries = await db.outbox
      .where('collection')
      .equals(collection)
      .sortBy('seq')

    for (const entry of entries) {
      try {
        await pushEntry(entry)
        await db.outbox.delete(entry.seq!)
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status
        if (status === 409) {
          await handleConflict(entry)
          await db.outbox.delete(entry.seq!)
        } else if (status === 400) {
          await db.outbox.update(entry.seq!, {
            attempts: entry.attempts + 1,
            lastError: err instanceof Error ? err.message : 'Validation error',
          })
        } else {
          throw err
        }
      }
    }
  }
}

async function pushEntry(entry: OutboxEntry) {
  const table = getTable(entry.collection as CollectionName)
  const local = await table.get(entry.recordId)
  if (!local) return

  if (entry.op === 'delete') {
    await pb.collection(entry.collection).update(entry.recordId, {
      deleted_at: local.deleted_at,
      rev: entry.baseRev + 1,
    })
    return
  }

  const fileEntries = await db.files
    .where({ recordId: entry.recordId, uploaded: false })
    .toArray()

  let data: FormData | Record<string, unknown>
  if (fileEntries.length > 0) {
    const fd = new FormData()
    const record = { ...local } as Record<string, unknown>
    delete record.id
    for (const [k, v] of Object.entries(record)) {
      if (v !== undefined && v !== null) {
        fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    }
    for (const fe of fileEntries) {
      fd.append(fe.field, fe.blob)
    }
    data = fd
  } else {
    const { id: _id, ...rest } = local
    data = rest as Record<string, unknown>
  }

  try {
    await pb.collection(entry.collection).update(entry.recordId, data)
  } catch (err: unknown) {
    if ((err as { status?: number })?.status === 404) {
      const { id: _id, ...createData } = local
      await pb.collection(entry.collection).create({ id: entry.recordId, ...createData })
    } else {
      throw err
    }
  }

  for (const fe of fileEntries) {
    await db.files.update(fe.id!, { uploaded: true })
  }
}

async function handleConflict(entry: OutboxEntry) {
  try {
    const remote = await pb.collection(entry.collection).getOne(entry.recordId)
    const table = getTable(entry.collection as CollectionName)
    await table.put({ ...remote } as never)
  } catch {
    // record may have been deleted
  }
}

async function pullAll() {
  for (const collection of PULL_ORDER) {
    const cursorKey = `cursor_${collection}`
    const cursor = (await getMeta(cursorKey)) ?? ''

    const filter = cursor ? `updated > "${cursor}"` : ''
    const records = await pb.collection(collection).getFullList({
      filter,
      sort: 'updated',
      batch: 200,
    })

    const table = getTable(collection)
    for (const record of records) {
      const pending = await db.outbox
        .where({ collection, recordId: record.id })
        .count()
      if (pending > 0) continue
      await table.put({ ...record } as never)
    }

    if (records.length > 0) {
      const lastUpdated = records[records.length - 1]!.updated as string
      await setMeta(cursorKey, lastUpdated)
    }
  }
}

export function initSyncListeners() {
  window.addEventListener('online', () => runSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runSync()
  })

  setInterval(() => {
    if (document.visibilityState === 'visible') runSync()
  }, 5 * 60 * 1000)
}
