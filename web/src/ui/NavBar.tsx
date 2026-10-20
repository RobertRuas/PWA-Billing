import type { ReactNode } from 'react'

interface Props {
  title: string
  left?: ReactNode
  right?: ReactNode
}

export function NavBar({ title, left, right }: Props) {
  return (
    <div className="nav-bar">
      <div className="nav-bar-inner">
        <div className="nav-bar-btn">{left}</div>
        <div className="nav-bar-title">{title}</div>
        <div className="nav-bar-btn nav-bar-btn--bold">{right}</div>
      </div>
    </div>
  )
}
