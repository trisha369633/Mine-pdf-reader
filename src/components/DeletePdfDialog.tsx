import { FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PdfRecord } from '../types/pdf'

type DeletePdfDialogProps = {
  pdf: PdfRecord | null
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export function DeletePdfDialog({ pdf, onClose, onConfirm }: DeletePdfDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  if (!pdf) return null
  const confirm = async () => { setIsDeleting(true); await onConfirm(); setIsDeleting(false) }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!isDeleting) onClose() }}>
      <section className="modal delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-pdf-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="delete-dialog-icon" aria-hidden="true"><Trash2 size={22} /></div>
        <h2 id="delete-pdf-title">Delete &quot;{pdf.name}&quot;?</h2>
        <p>Are you sure you want to delete this PDF? This action cannot be undone.</p>
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button className="button button-danger" type="button" onClick={() => void confirm()} disabled={isDeleting}><FileText size={17} aria-hidden="true" /> {isDeleting ? 'Deleting...' : 'Delete PDF'}</button>
        </div>
      </section>
    </div>
  )
}
