import { type ReactNode, useCallback, useRef, useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Sheet({ open, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0]!.clientY
    currentY.current = 0
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0]!.clientY - startY.current
    if (dy > 0 && sheetRef.current) {
      currentY.current = dy
      sheetRef.current.style.transform = `translateY(${dy}px)`
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (currentY.current > 100) {
      onClose()
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet-handle" />
        {title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}
