import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Folder, Search, Upload } from 'lucide-react'
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

export function FolderView({ folder, pdfs, isLoadingPdfs, onBack, onUploadPdf, onDeletePdf, onRenamePdf, onOpenPdf, onNotifyError, search, sort, onSearchChange, onSortChange }: FolderViewProps) {
  const inputRef = useRef<HTMLInputElement>(null); const [isSaving, setIsSaving] = useState(false); const [pdfToDelete, setPdfToDelete] = useState<PdfRecord | null>(null); const [pdfToRename, setPdfToRename] = useState<PdfRecord | null>(null)
  const visiblePdfs = useMemo(() => pdfs.filter((pdf) => pdf.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((left, right) => {
    if (sort === 'name-asc') return left.name.localeCompare(right.name)
    if (sort === 'name-desc') return right.name.localeCompare(left.name)
    return sort === 'oldest' ? left.createdAt - right.createdAt : right.createdAt - left.createdAt
  }), [pdfs, search, sort])
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) { onNotifyError('Please select a PDF file.'); return }; setIsSaving(true); const error = await onUploadPdf(file); setIsSaving(false); if (error) onNotifyError(error) }
  const choosePdf = () => inputRef.current?.click(); const pdfCount = `${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'}`
  return <section className="folder-view" aria-labelledby="folder-view-title">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back to My Folders</button>
    <div className="folder-view-heading"><span className="folder-view-icon" aria-hidden="true"><Folder size={24} /></span><div><h1 id="folder-view-title">{folder.name}</h1><p>{isLoadingPdfs ? 'Loading PDFs...' : pdfCount}</p></div></div>
    <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void handleFileChange(event)} />
    {isLoadingPdfs ? <div className="pdf-loading-state" role="status">Loading PDFs...</div> : pdfs.length === 0 ? <div className="folder-empty-state"><span className="eyebrow">Folder is ready</span><h2>No PDFs in this folder</h2><p>Keep the PDFs for this subject together in one place.</p><button className="button button-secondary" type="button" onClick={choosePdf} disabled={isSaving}><Upload size={18} aria-hidden="true" /> {isSaving ? 'Saving PDF...' : 'Upload PDF'}</button></div> : <section className="pdf-list-section" aria-labelledby="pdf-list-title">
      <div className="section-heading"><h2 id="pdf-list-title">PDFs</h2><button className="button button-secondary" type="button" onClick={choosePdf} disabled={isSaving}><Upload size={17} aria-hidden="true" /> {isSaving ? 'Saving PDF...' : 'Upload PDF'}</button></div>
      <div className="pdf-list-controls"><label className="pdf-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">Search PDFs</span><input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search PDFs" /></label><label className="pdf-sort">Sort <select value={sort} onChange={(event) => onSortChange(event.target.value as PdfSort)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label></div>
      {visiblePdfs.length === 0 ? <div className="pdf-search-empty"><h3>No PDFs found</h3><p>Try a different search.</p></div> : <div className="pdf-list">{visiblePdfs.map((pdf) => <PdfListItem key={pdf.id} pdf={pdf} onOpen={() => onOpenPdf(pdf.id)} onRename={() => setPdfToRename(pdf)} onDelete={() => setPdfToDelete(pdf)} />)}</div>}
    </section>}
    <RenamePdfModal key={pdfToRename?.id ?? 'closed'} pdf={pdfToRename} onClose={() => setPdfToRename(null)} onRename={async (name) => { if (!pdfToRename) return undefined; const result = await onRenamePdf(pdfToRename, name); if (!result) setPdfToRename(null); return result }} />
    <DeletePdfDialog pdf={pdfToDelete} onClose={() => setPdfToDelete(null)} onConfirm={async () => { if (pdfToDelete) { await onDeletePdf(pdfToDelete); setPdfToDelete(null) } }} />
  </section>
}
