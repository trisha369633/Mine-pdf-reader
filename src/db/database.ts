export const DATABASE_NAME = 'mine-pdf-reader'
export const DATABASE_VERSION = 3

export const FOLDER_STORE = 'folders'
export const PDF_STORE = 'pdfs'
export const ANNOTATION_STORE = 'annotations'

export type StoredFolder = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type StoredPdf = {
  id: string
  folderId: string
  name: string
  size: number
  type: string
  createdAt: number
  updatedAt: number
  lastOpenedAt?: number
  lastViewedPage?: number
  file: Blob
}

export type StoredAnnotation = {
  id: string
  pdfId: string
  pageNumber: number
  type: 'highlight' | 'pen' | 'underline' | 'note'
  color: string
  data: {
    x?: number
    y?: number
    width?: number
    height?: number
    startX?: number
    startY?: number
    endX?: number
    endY?: number
    points?: Array<{ x: number; y: number }>
    widthPx?: number
    text?: string
  }
  createdAt: number
  updatedAt: number
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available.'))
      return
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(FOLDER_STORE)) {
        database.createObjectStore(FOLDER_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(PDF_STORE)) {
        const pdfStore = database.createObjectStore(PDF_STORE, { keyPath: 'id' })
        pdfStore.createIndex('folderId', 'folderId', { unique: false })
      }
      if (!database.objectStoreNames.contains(ANNOTATION_STORE)) {
        const annotationStore = database.createObjectStore(ANNOTATION_STORE, { keyPath: 'id' })
        annotationStore.createIndex('pdfId', 'pdfId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'))
  })
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'))
  })
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local storage transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage transaction was cancelled.'))
  })
}
