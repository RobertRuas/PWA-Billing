import { useEffect, useState, useCallback } from 'react'

interface ToastData {
  message: string
  type?: 'success' | 'error' | 'info'
}

let showToastFn: ((data: ToastData) => void) | null = null

export function showToast(message: string, type: ToastData['type'] = 'info') {
  showToastFn?.({ message, type })
}

export function ToastContainer() {
  const [toast, setToast] = useState<ToastData | null>(null)

  const show = useCallback((data: ToastData) => {
    setToast(data)
    setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    showToastFn = show
    return () => { showToastFn = null }
  }, [show])

  if (!toast) return null

  const color = toast.type === 'error' ? 'var(--red)' : toast.type === 'success' ? 'var(--green)' : 'var(--blue)'

  return (
    <div className="toast">
      <div style={{ width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span>{toast.message}</span>
    </div>
  )
}
