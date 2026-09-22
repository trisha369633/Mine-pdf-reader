import { useState } from 'react'
import { Folder as FolderIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { Folder } from '../types/folder'

type FolderCardProps = {
  folder: Folder
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

export function FolderCard({ folder, onOpen, onRename, onDelete }: FolderCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pdfLabel = `${folder.pdfIds.length} ${folder.pdfIds.length === 1 ? 'PDF' : 'PDFs'}`

  return (
    <article className="folder-card">
      <button className="folder-card-open" type="button" onClick={onOpen}>
        <span className="folder-card-icon"><FolderIcon size={22} aria-hidden="true" /></span>
        <span className="folder-card-copy">
          <strong>{folder.name}</strong>
          <span>{pdfLabel}</span>
        </span>
      </button>
      <div className="folder-card-actions">
        <button className="icon-button folder-menu-button" type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-label={`Actions for ${folder.name}`} aria-expanded={isMenuOpen}>
          <MoreVertical size={19} aria-hidden="true" />
        </button>
        {isMenuOpen && (
          <div className="folder-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onOpen() }}><FolderIcon size={16} aria-hidden="true" /> Open</button>
            <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onRename() }}><Pencil size={16} aria-hidden="true" /> Rename</button>
            <button className="folder-menu-danger" type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onDelete() }}><Trash2 size={16} aria-hidden="true" /> Delete</button>
          </div>
        )}
      </div>
    </article>
  )
}
