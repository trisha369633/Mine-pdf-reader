import { FilePenLine, FileText, MoreVertical, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatFileSize, formatLastOpened } from '../lib/format'
import type { PdfRecord } from '../types/pdf'

type PdfListItemProps = {
  pdf: PdfRecord
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
}

type MenuPosition = { top: number; left: number; placement: 'down' | 'up' }

const MENU_GAP = 8
const VIEWPORT_MARGIN = 12

export function PdfListItem({ pdf, onOpen, onRename, onDelete }: PdfListItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const computeMenuPosition = () => {
    const card = cardRef.current
    const button = buttonRef.current
    const menu = menuRef.current
    if (!card || !button || !menu) return
    const cardRect = card.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()

    const spaceBelow = window.innerHeight - cardRect.bottom
    const spaceAbove = cardRect.top
    const placement: 'down' | 'up' = spaceBelow < menuRect.height + MENU_GAP && spaceAbove > spaceBelow ? 'up' : 'down'
    const rawTop = placement === 'down' ? cardRect.bottom + MENU_GAP : cardRect.top - MENU_GAP - menuRect.height
    const top = Math.min(Math.max(rawTop, VIEWPORT_MARGIN), Math.max(window.innerHeight - menuRect.height - VIEWPORT_MARGIN, VIEWPORT_MARGIN))

    const maxLeft = window.innerWidth - menuRect.width - VIEWPORT_MARGIN
    const left = Math.min(Math.max(buttonRect.right - menuRect.width, VIEWPORT_MARGIN), Math.max(maxLeft, VIEWPORT_MARGIN))

    setMenuPosition({ top, left, placement })
  }

  useLayoutEffect(() => {
    if (!isMenuOpen) {
      setMenuPosition(null)
      return
    }
    computeMenuPosition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) return
    const reposition = () => computeMenuPosition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen])

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <article className="pdf-list-item" ref={cardRef}>
      <button className="pdf-list-open" type="button" onClick={onOpen}>
        <span className="pdf-list-icon"><FileText size={20} aria-hidden="true" /></span>
        <span className="pdf-list-copy">
          <strong>{pdf.name}</strong>
          <span>PDF · {formatFileSize(pdf.size)}{pdf.lastOpenedAt ? ` · Opened ${formatLastOpened(pdf.lastOpenedAt)}` : ''}</span>
        </span>
      </button>
      {(onRename || onDelete) && <div className="pdf-list-actions">
        <button ref={buttonRef} className="icon-button folder-menu-button" type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-label={`Actions for ${pdf.name}`} aria-expanded={isMenuOpen}>
          <MoreVertical size={19} aria-hidden="true" />
        </button>
        {isMenuOpen && createPortal(
          <div
            className={`folder-menu pdf-list-menu ${menuPosition?.placement === 'up' ? 'folder-menu-up' : ''}`}
            role="menu"
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPosition ? menuPosition.top : 0,
              left: menuPosition ? menuPosition.left : 0,
              visibility: menuPosition ? 'visible' : 'hidden',
            }}
          >
            <button type="button" role="menuitem" onClick={() => { closeMenu(); onOpen() }}><FileText size={16} aria-hidden="true" /> Open</button>
            {onRename && <button type="button" role="menuitem" onClick={() => { closeMenu(); onRename() }}><FilePenLine size={16} aria-hidden="true" /> Rename</button>}
            {onDelete && <button className="folder-menu-danger" type="button" role="menuitem" onClick={() => { closeMenu(); onDelete() }}><Trash2 size={16} aria-hidden="true" /> Delete</button>}
          </div>,
          document.body,
        )}
      </div>}
    </article>
  )
}
