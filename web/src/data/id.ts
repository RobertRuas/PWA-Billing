const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function generateId(): string {
  const buf = new Uint8Array(15)
  crypto.getRandomValues(buf)
  let id = ''
  for (let i = 0; i < 15; i++) {
    id += CHARS[buf[i]! % CHARS.length]
  }
  return id
}
