import { Folder, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Folder as FolderRecord } from '../types/folder'

type DeleteFolderDialogProps = {
  folder: FolderRecord | null
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export function DeleteFolderDialog({ folder, onClose, onConfirm }: DeleteFolderDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  if (!folder) return null
  const hasPdfs = folder.pdfIds.length > 0
  const confirm = async () => { setIsDeleting(true); await onConfirm(); setIsDeleting(false) }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!isDeleting) onClose() }}>
      <section className="modal delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-folder-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="delete-dialog-icon" aria-hidden="true"><Trash2 size={22} /></div>
        <h2 id="delete-folder-title">Delete &quot;{folder.name}&quot;?</h2>
        <p>{hasPdfs ? 'Deleting this folder will also delete the PDFs inside it and their annotations.' : 'This folder is empty. This action cannot be undone.'}</p>
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button className="button button-danger" type="button" onClick={() => void confirm()} disabled={isDeleting}><Folder size={17} aria-hidden="true" /> {isDeleting ? 'Deleting...' : 'Delete Folder'}</button>
        </div>
      </section>
    </div>
  )
}
