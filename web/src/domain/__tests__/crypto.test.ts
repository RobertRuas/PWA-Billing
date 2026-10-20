import { describe, it, expect } from 'vitest'
import { encryptBackup, decryptBackup } from '../crypto'
import type { MmbkFile } from '../crypto'

describe('encryptBackup / decryptBackup', () => {
  it('round-trips a payload', async () => {
    const payload = { invoices: [{ id: '1', total: 10000 }], version: 1 }
    const passphrase = 'test-passphrase-12345'

    const encrypted = await encryptBackup(payload, passphrase)
    const decrypted = await decryptBackup(encrypted, passphrase)

    expect(decrypted).toEqual(payload)
  })

  it('produces correct .mmbk file structure', async () => {
    const encrypted = await encryptBackup({ test: true }, 'pass123')

    expect(encrypted.format).toBe('mmbk')
    expect(encrypted.v).toBe(1)
    expect(encrypted.kdf.name).toBe('PBKDF2')
    expect(encrypted.kdf.hash).toBe('SHA-256')
    expect(encrypted.kdf.iterations).toBe(600000)
    expect(typeof encrypted.kdf.salt).toBe('string')
    expect(encrypted.cipher.name).toBe('AES-GCM')
    expect(typeof encrypted.cipher.iv).toBe('string')
    expect(typeof encrypted.ct).toBe('string')
    expect(typeof encrypted.createdAt).toBe('string')
  })

  it('throws on wrong passphrase', async () => {
    const encrypted = await encryptBackup({ secret: 'data' }, 'correct-pass')

    await expect(decryptBackup(encrypted, 'wrong-pass')).rejects.toThrow('Wrong passphrase')
  })

  it('throws on invalid format', async () => {
    const bad = { format: 'invalid', v: 1 } as unknown as MmbkFile

    await expect(decryptBackup(bad, 'any')).rejects.toThrow('Invalid backup format')
  })

  it('throws on invalid version', async () => {
    const bad = { format: 'mmbk', v: 99 } as unknown as MmbkFile

    await expect(decryptBackup(bad, 'any')).rejects.toThrow('Invalid backup format')
  })
})
