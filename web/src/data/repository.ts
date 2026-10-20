import { db, type CollectionName, type OutboxEntry } from './db'
import { generateId } from './id'
import { triggerSync } from './sync'

function now() {
  return new Date().toISOString()
}

export async function localCreate(
  collection: CollectionName,
  data: Record<string, unknown>,
  owner: string,
): Promise<string> {
  const id = (data.id as string) || generateId()
  const record = {
    ...data,
    id,
    owner,
    rev: 1,
    deleted_at: '',
    created: now(),
    updated: now(),
  }

  const table = db[collection]
  await table.put(record as never)

  await addToOutbox(collection, id, 'upsert', 0)
  triggerSync()
  return id
}

export async function localUpdate(
  collection: CollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const table = db[collection]
  const existing = await table.get(id)
  if (!existing) throw new Error(`Record ${id} not found in ${collection}`)

  const updated = {
    ...existing,
    ...data,
    rev: existing.rev + 1,
    updated: now(),
  }

  await table.put(updated as never)
  await addToOutbox(collection, id, 'upsert', existing.rev)
  triggerSync()
}

export async function localSoftDelete(
  collection: CollectionName,
  id: string,
): Promise<void> {
  const table = db[collection]
  const existing = await table.get(id)
  if (!existing) return

  await table.update(id, {
    deleted_at: now(),
    rev: existing.rev + 1,
    updated: now(),
  } as never)

  await addToOutbox(collection, id, 'delete', existing.rev)
  triggerSync()
}

async function addToOutbox(
  collection: string,
  recordId: string,
  op: 'upsert' | 'delete',
  baseRev: number,
) {
  const existing = await db.outbox
    .where({ collection, recordId })
    .first()

  if (existing) {
    await db.outbox.update(existing.seq!, {
      op,
      baseRev: existing.baseRev,
      createdAt: existing.createdAt,
      attempts: 0,
      lastError: '',
    } as Partial<OutboxEntry>)
  } else {
    await db.outbox.add({
      collection,
      recordId,
      op,
      baseRev,
      createdAt: now(),
      attempts: 0,
      lastError: '',
    })
  }
}

export async function storeFileLocally(
  recordId: string,
  field: string,
  blob: Blob,
) {
  await db.files.put({ recordId, field, blob, uploaded: false })
}
