// Backup encryption using WebCrypto (§4.10 BK-04)
// AES-256-GCM with PBKDF2-SHA-256 key derivation (600,000 iterations)

const PBKDF2_ITERATIONS = 600000

function buf(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    buf(enc.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buf(salt), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(buf(data))
  writer.close()
  const reader = cs.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(buf(data))
  writer.close()
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

export interface MmbkFile {
  format: 'mmbk'
  v: 1
  createdAt: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  ct: string
}

export async function encryptBackup(payload: unknown, passphrase: string): Promise<MmbkFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)

  const json = JSON.stringify(payload)
  const compressed = await compress(new TextEncoder().encode(json))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buf(iv) },
    key,
    buf(compressed),
  )

  return {
    format: 'mmbk',
    v: 1,
    createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(buf(salt)) },
    cipher: { name: 'AES-GCM', iv: toBase64(buf(iv)) },
    ct: toBase64(encrypted),
  }
}

export async function decryptBackup(file: MmbkFile, passphrase: string): Promise<unknown> {
  if (file.format !== 'mmbk' || file.v !== 1) throw new Error('Invalid backup format')

  const salt = fromBase64(file.kdf.salt)
  const iv = fromBase64(file.cipher.iv)
  const ct = fromBase64(file.ct)
  const key = await deriveKey(passphrase, salt)

  let decrypted: ArrayBuffer
  try {
    decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(ct))
  } catch {
    throw new Error('Wrong passphrase')
  }

  const decompressed = await decompress(new Uint8Array(decrypted))
  const json = new TextDecoder().decode(decompressed)
  return JSON.parse(json)
}

export async function deriveNonExtractableKey(passphrase: string): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt)
  return { key, salt }
}
