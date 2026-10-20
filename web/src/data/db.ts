import Dexie, { type EntityTable } from 'dexie'

export interface OutboxEntry {
  seq?: number
  collection: string
  recordId: string
  op: 'upsert' | 'delete'
  baseRev: number
  createdAt: string
  attempts: number
  lastError: string
}

export interface FileEntry {
  id?: number
  recordId: string
  field: string
  blob: Blob
  uploaded: boolean
}

export interface MetaEntry {
  key: string
  value: string
}

interface DexieRecord {
  id: string
  owner: string
  rev: number
  deleted_at: string
  created: string
  updated: string
  [key: string]: unknown
}

class BillingDB extends Dexie {
  mm_profiles!: EntityTable<DexieRecord, 'id'>
  mm_clients!: EntityTable<DexieRecord, 'id'>
  mm_projects!: EntityTable<DexieRecord, 'id'>
  mm_timesheets!: EntityTable<DexieRecord, 'id'>
  mm_timesheet_entries!: EntityTable<DexieRecord, 'id'>
  mm_perdiem_entries!: EntityTable<DexieRecord, 'id'>
  mm_invoices!: EntityTable<DexieRecord, 'id'>
  mm_invoice_items!: EntityTable<DexieRecord, 'id'>
  mm_invoice_events!: EntityTable<DexieRecord, 'id'>
  mm_attachments!: EntityTable<DexieRecord, 'id'>
  mm_backup_destinations!: EntityTable<DexieRecord, 'id'>
  mm_backup_logs!: EntityTable<DexieRecord, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  files!: EntityTable<FileEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('billing')
    this.version(1).stores({
      mm_profiles: 'id, owner',
      mm_clients: 'id, owner, [owner+updated]',
      mm_projects: 'id, owner, client, [owner+updated]',
      mm_timesheets: 'id, owner, project, [owner+updated], [owner+project+week_start]',
      mm_timesheet_entries: 'id, owner, timesheet, [owner+updated], [timesheet+date], invoice',
      mm_perdiem_entries: 'id, owner, project, [owner+updated], date, invoice',
      mm_invoices: 'id, owner, [owner+updated], [owner+invoice_date], [owner+status], [owner+paid_at], status',
      mm_invoice_items: 'id, owner, invoice, [owner+updated]',
      mm_invoice_events: 'id, owner, invoice',
      mm_attachments: 'id, owner, invoice, [owner+updated]',
      mm_backup_destinations: 'id, owner',
      mm_backup_logs: 'id, owner',
      outbox: '++seq, collection, recordId',
      files: '++id, recordId, field, uploaded',
      meta: 'key',
    })
  }
}

export const db = new BillingDB()

export const COLLECTIONS = [
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
] as const

export type CollectionName = typeof COLLECTIONS[number]

export function getTable(name: CollectionName) {
  return db[name]
}

export async function clearAllData() {
  for (const col of COLLECTIONS) {
    await db[col].clear()
  }
  await db.outbox.clear()
  await db.files.clear()
  await db.meta.clear()
}

export async function getMeta(key: string): Promise<string | undefined> {
  const entry = await db.meta.get(key)
  return entry?.value
}

export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value })
}
