import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { PdfRecord } from '../types/pdf'

type RenamePdfModalProps = {
  pdf: PdfRecord | null
  onClose: () => void
  onRename: (name: string) => Promise<string | undefined>
}

function displayName(name: string) { return name.replace(/\.pdf$/i, '') }

export function RenamePdfModal({ pdf, onClose, onRename }: RenamePdfModalProps) {
  const [name, setName] = useState(() => displayName(pdf?.name ?? ''))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  if (!pdf) return null
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const value = name.trim()
    if (!value) { setError('Enter a PDF name to continue.'); return }
    setIsSaving(true); const result = await onRename(value); setIsSaving(false)
    if (result) { setError(result); inputRef.current?.focus() }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!isSaving) onClose() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="rename-pdf-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-heading"><div><span className="eyebrow">PDF management</span><h2 id="rename-pdf-title">Rename PDF</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={isSaving} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button></div>
      <form onSubmit={(event) => void submit(event)}><label htmlFor="pdf-name">PDF name</label><div className="pdf-name-input"><input ref={inputRef} id="pdf-name" type="text" autoFocus value={name} onChange={(event) => { setName(event.target.value); if (error) setError('') }} disabled={isSaving} aria-invalid={Boolean(error)} aria-describedby={error ? 'pdf-name-error' : undefined} /><span>.pdf</span></div>{error && <p className="field-error" id="pdf-name-error">{error}</p>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button></div></form>
    </section>
  </div>
}
