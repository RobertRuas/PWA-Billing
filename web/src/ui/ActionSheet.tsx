import { useEffect } from 'react'
import { useT } from '../i18n'

interface Action {
  label: string
  destructive?: boolean
  onSelect: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  actions: Action[]
}

export function ActionSheet({ open, onClose, actions }: Props) {
  const t = useT()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="action-sheet-overlay" onClick={onClose}>
      <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="action-sheet-group">
          {actions.map((action, i) => (
            <button
              key={i}
              className={`action-sheet-btn ${action.destructive ? 'action-sheet-btn--destructive' : ''}`}
              onClick={() => { action.onSelect(); onClose() }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="action-sheet-group">
          <button className="action-sheet-btn action-sheet-btn--cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
