import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type CreateFolderModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => string | undefined | Promise<string | undefined>
  initialName?: string
  title?: string
  submitLabel?: string
}

export function CreateFolderModal({ isOpen, onClose, onCreate, initialName = '', title = 'Create New Folder', submitLabel = 'Create Folder' }: CreateFolderModalProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [initialName, isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter a folder name to continue.')
      inputRef.current?.focus()
      return
    }
    setIsSaving(true)
    const validationError = await onCreate(trimmedName)
    setIsSaving(false)
    if (validationError) {
      setError(validationError)
      inputRef.current?.focus()
      return
    }
    setName('')
    setError('')
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!isSaving) onClose() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-folder-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Library organization</span>
            <h2 id="create-folder-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={isSaving} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="folder-name">Folder name</label>
          <input ref={inputRef} id="folder-name" type="text" value={name} onChange={(event) => { setName(event.target.value); if (error) setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'folder-name-error' : undefined} placeholder="e.g. Research papers" />
          {error && <p className="field-error" id="folder-name-error">{error}</p>}
          <div className="modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
