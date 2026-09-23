import { FilePenLine, FileText, MoreVertical, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { formatFileSize, formatLastOpened } from '../lib/format'
import type { PdfRecord } from '../types/pdf'

type PdfListItemProps = {
  pdf: PdfRecord
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
}

export function PdfListItem({ pdf, onOpen, onRename, onDelete }: PdfListItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down')
  const actionsRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isMenuOpen) return
    const trigger = actionsRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const triggerRect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    const menuHeight = menu.offsetHeight
    setMenuPlacement(spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow ? 'up' : 'down')
  }, [isMenuOpen])

  return (
    <article className="pdf-list-item">
      <button className="pdf-list-open" type="button" onClick={onOpen}>
        <span className="pdf-list-icon"><FileText size={20} aria-hidden="true" /></span>
        <span className="pdf-list-copy">
          <strong>{pdf.name}</strong>
          <span>PDF · {formatFileSize(pdf.size)}{pdf.lastOpenedAt ? ` · Opened ${formatLastOpened(pdf.lastOpenedAt)}` : ''}</span>
        </span>
      </button>
      {(onRename || onDelete) && <div className="pdf-list-actions" ref={actionsRef}>
        <button className="icon-button folder-menu-button" type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-label={`Actions for ${pdf.name}`} aria-expanded={isMenuOpen}>
          <MoreVertical size={19} aria-hidden="true" />
        </button>
        {isMenuOpen && <div className={`folder-menu ${menuPlacement === 'up' ? 'folder-menu-up' : ''}`} role="menu" ref={menuRef}>
          <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onOpen() }}><FileText size={16} aria-hidden="true" /> Open</button>
          {onRename && <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onRename() }}><FilePenLine size={16} aria-hidden="true" /> Rename</button>}
          {onDelete && <button className="folder-menu-danger" type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onDelete() }}><Trash2 size={16} aria-hidden="true" /> Delete</button>}
        </div>}
      </div>}
    </article>
  )
}
