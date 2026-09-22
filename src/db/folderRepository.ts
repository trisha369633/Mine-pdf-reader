import { ANNOTATION_STORE, FOLDER_STORE, PDF_STORE, openDatabase, requestResult, transactionComplete, type StoredFolder, type StoredPdf } from './database'
import type { Folder } from '../types/folder'

export class DuplicateFolderNameError extends Error {
  constructor() {
    super('A folder with this name already exists.')
    this.name = 'DuplicateFolderNameError'
  }
}

function toFolder(record: StoredFolder, pdfs: StoredPdf[] = []): Folder {
  return { ...record, pdfIds: pdfs.filter((pdf) => pdf.folderId === record.id).map((pdf) => pdf.id) }
}

export async function getFolders(): Promise<Folder[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([FOLDER_STORE, PDF_STORE], 'readonly')
    const folderRequest = transaction.objectStore(FOLDER_STORE).getAll()
    const pdfRequest = transaction.objectStore(PDF_STORE).getAll()
    const folders = await requestResult(folderRequest)
    const pdfs = await requestResult(pdfRequest)
    await transactionComplete(transaction)
    return folders.map((folder) => toFolder(folder, pdfs)).sort((left, right) => left.createdAt - right.createdAt)
  } finally {
    database.close()
  }
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([FOLDER_STORE, PDF_STORE], 'readonly')
    const folder = await requestResult(transaction.objectStore(FOLDER_STORE).get(id))
    const pdfs = await requestResult(transaction.objectStore(PDF_STORE).index('folderId').getAll(id))
    await transactionComplete(transaction)
    return folder ? toFolder(folder, pdfs) : undefined
  } finally {
    database.close()
  }
}

export async function createFolder(name: string): Promise<Folder> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(FOLDER_STORE, 'readwrite')
    const store = transaction.objectStore(FOLDER_STORE)
    const existingFolders = await requestResult(store.getAll())
    if (existingFolders.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      transaction.abort()
      throw new DuplicateFolderNameError()
    }

    const now = Date.now()
    const folder: StoredFolder = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now }
    store.add(folder)
    await transactionComplete(transaction)
    return toFolder(folder)
  } finally {
    database.close()
  }
}

export async function updateFolder(folder: Folder): Promise<Folder> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(FOLDER_STORE, 'readwrite')
    const store = transaction.objectStore(FOLDER_STORE)
    const existingFolders = await requestResult(store.getAll())
    if (existingFolders.some((existing) => existing.id !== folder.id && existing.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase())) {
      transaction.abort()
      throw new DuplicateFolderNameError()
    }

    const updatedFolder: StoredFolder = { id: folder.id, name: folder.name, createdAt: folder.createdAt, updatedAt: folder.updatedAt }
    store.put(updatedFolder)
    await transactionComplete(transaction)
    return toFolder(updatedFolder)
  } finally {
    database.close()
  }
}

export async function deleteFolder(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([FOLDER_STORE, PDF_STORE, ANNOTATION_STORE], 'readwrite')
    const pdfStore = transaction.objectStore(PDF_STORE)
    const pdfs = await requestResult(pdfStore.index('folderId').getAll(id))
    const annotationStore = transaction.objectStore(ANNOTATION_STORE)
    for (const pdf of pdfs) {
      const annotationIds = await requestResult(annotationStore.index('pdfId').getAllKeys(pdf.id))
      annotationIds.forEach((annotationId) => annotationStore.delete(annotationId))
      pdfStore.delete(pdf.id)
    }
    transaction.objectStore(FOLDER_STORE).delete(id)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}
