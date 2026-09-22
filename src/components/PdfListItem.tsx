import { FilePenLine, FileText, MoreVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PdfRecord } from '../types/pdf'

type PdfListItemProps = {
  pdf: PdfRecord
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
function formatLastOpened(timestamp: number) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp) }

export function PdfListItem({ pdf, onOpen, onRename, onDelete }: PdfListItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <article className="pdf-list-item">
      <button className="pdf-list-open" type="button" onClick={onOpen}>
        <span className="pdf-list-icon"><FileText size={20} aria-hidden="true" /></span>
        <span className="pdf-list-copy">
          <strong>{pdf.name}</strong>
          <span>PDF · {formatFileSize(pdf.size)}{pdf.lastOpenedAt ? ` · Opened ${formatLastOpened(pdf.lastOpenedAt)}` : ''}</span>
        </span>
      </button>
      <div className="pdf-list-actions">
        <button className="icon-button folder-menu-button" type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-label={`Actions for ${pdf.name}`} aria-expanded={isMenuOpen}>
          <MoreVertical size={19} aria-hidden="true" />
        </button>
        {isMenuOpen && <div className="folder-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onOpen() }}><FileText size={16} aria-hidden="true" /> Open</button>
          <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onRename() }}><FilePenLine size={16} aria-hidden="true" /> Rename</button>
          <button className="folder-menu-danger" type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onDelete() }}><Trash2 size={16} aria-hidden="true" /> Delete</button>
        </div>}
      </div>
    </article>
  )
}
