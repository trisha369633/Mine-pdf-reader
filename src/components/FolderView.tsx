import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Upload } from 'lucide-react'
import { DeletePdfDialog } from './DeletePdfDialog'
import { PdfListItem } from './PdfListItem'
import { RenamePdfModal } from './RenamePdfModal'
import type { Folder as FolderRecord } from '../types/folder'
import type { PdfRecord } from '../types/pdf'

export type PdfSort = 'newest' | 'oldest' | 'name-asc' | 'name-desc'
type FolderViewProps = {
  folder: FolderRecord; pdfs: PdfRecord[]; isLoadingPdfs: boolean; onBack: () => void
  onUploadPdf: (file: File) => Promise<string | undefined>; onDeletePdf: (pdf: PdfRecord) => Promise<void>; onRenamePdf: (pdf: PdfRecord, name: string) => Promise<string | undefined>
  onOpenPdf: (pdfId: string) => void; onNotifyError: (message: string) => void
  search: string; sort: PdfSort; onSearchChange: (value: string) => void; onSortChange: (value: PdfSort) => void
}

export function FolderView({ folder, pdfs, isLoadingPdfs, onBack, onUploadPdf, onDeletePdf, onRenamePdf, onOpenPdf, onNotifyError }: FolderViewProps) {
  const inputRef = useRef<HTMLInputElement>(null); const [isSaving, setIsSaving] = useState(false); const [pdfToDelete, setPdfToDelete] = useState<PdfRecord | null>(null); const [pdfToRename, setPdfToRename] = useState<PdfRecord | null>(null)
  const visiblePdfs = useMemo(() => [...pdfs].sort((left, right) => right.createdAt - left.createdAt), [pdfs])
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) { onNotifyError('Please select a PDF file.'); return }; setIsSaving(true); const error = await onUploadPdf(file); setIsSaving(false); if (error) onNotifyError(error) }
  const choosePdf = () => inputRef.current?.click()
  return <section className="folder-view" aria-label={folder.name}>
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back to My Folders</button>
    <h2 className="folder-pdfs-heading">PDFs</h2>
    <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void handleFileChange(event)} />
    {isLoadingPdfs ? <div className="pdf-loading-state" role="status">Loading PDFs...</div> : pdfs.length === 0 ? <div className="folder-empty-state"><span className="eyebrow">Folder is ready</span><h2>No PDFs in this folder</h2><p>Keep the PDFs for this subject together in one place.</p><button className="button button-secondary" type="button" onClick={choosePdf} disabled={isSaving}><Upload size={18} aria-hidden="true" /> {isSaving ? 'Saving PDF...' : 'Upload PDF'}</button></div> : <div className="pdf-list">{visiblePdfs.map((pdf) => <PdfListItem key={pdf.id} pdf={pdf} onOpen={() => onOpenPdf(pdf.id)} onRename={() => setPdfToRename(pdf)} onDelete={() => setPdfToDelete(pdf)} />)}</div>}
    <RenamePdfModal key={pdfToRename?.id ?? 'closed'} pdf={pdfToRename} onClose={() => setPdfToRename(null)} onRename={async (name) => { if (!pdfToRename) return undefined; const result = await onRenamePdf(pdfToRename, name); if (!result) setPdfToRename(null); return result }} />
    <DeletePdfDialog pdf={pdfToDelete} onClose={() => setPdfToDelete(null)} onConfirm={async () => { if (pdfToDelete) { await onDeletePdf(pdfToDelete); setPdfToDelete(null) } }} />
  </section>
}
