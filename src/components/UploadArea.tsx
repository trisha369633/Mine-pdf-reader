import { useState } from 'react'
import type { RefObject } from 'react'
import { Upload } from 'lucide-react'

type UploadAreaProps = {
  inputRef: RefObject<HTMLInputElement | null>
}

export function UploadArea({ inputRef }: UploadAreaProps) {
  const [fileName, setFileName] = useState('')

  return (
    <div className="upload-area">
      <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')} />
      <div className="upload-icon"><Upload size={21} aria-hidden="true" /></div>
      <div className="upload-copy">
        <h3>{fileName || 'Upload PDF'}</h3>
        <p>{fileName ? 'Selected locally. Storage will be added later.' : 'Choose a PDF from your device'}</p>
      </div>
      <button className="button button-outline" type="button" onClick={() => inputRef.current?.click()}>{fileName ? 'Choose another' : 'Choose file'}</button>
    </div>
  )
}
