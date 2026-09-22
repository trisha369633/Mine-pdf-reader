import { ANNOTATION_STORE, PDF_STORE, openDatabase, requestResult, transactionComplete, type StoredPdf } from './database'
import type { PdfRecord } from '../types/pdf'

export class DuplicatePdfNameError extends Error {
  constructor() {
    super('A PDF with this name already exists in this folder.')
    this.name = 'DuplicatePdfNameError'
  }
}

export class InvalidPdfNameError extends Error {
  constructor(message = 'Enter a valid PDF name.') { super(message); this.name = 'InvalidPdfNameError' }
}

function normalisePdfName(name: string, currentName?: string) {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const baseName = trimmed.replace(/\.pdf$/i, '')
  if (!baseName) throw new InvalidPdfNameError('Enter a PDF name to continue.')
  if (/[\\/:*?"<>|]/.test(baseName) || [...baseName].some((character) => character.charCodeAt(0) < 32)) throw new InvalidPdfNameError('That PDF name contains unsupported characters.')
  const extension = currentName?.match(/\.pdf$/i)?.[0] ?? '.pdf'
  return `${baseName}${extension}`
}

function toPdfRecord(pdf: StoredPdf): PdfRecord {
  const { file: _file, ...metadata } = pdf
  return metadata
}

export async function getPdfsForFolder(folderId: string): Promise<PdfRecord[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readonly')
    const request = transaction.objectStore(PDF_STORE).index('folderId').getAll(folderId)
    const pdfs = await requestResult(request)
    await transactionComplete(transaction)
    return pdfs.map(toPdfRecord)
  } finally {
    database.close()
  }
}

export async function getAllPdfMetadata(): Promise<PdfRecord[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readonly')
    const pdfs = await requestResult(transaction.objectStore(PDF_STORE).getAll())
    await transactionComplete(transaction)
    return pdfs.map(toPdfRecord)
  } finally {
    database.close()
  }
}

export async function getPdf(id: string): Promise<StoredPdf | undefined> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readonly')
    const pdf = await requestResult(transaction.objectStore(PDF_STORE).get(id))
    await transactionComplete(transaction)
    return pdf
  } finally {
    database.close()
  }
}

export async function createPdf(folderId: string, file: File): Promise<PdfRecord> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readwrite')
    const store = transaction.objectStore(PDF_STORE)
    const existingPdfs = await requestResult(store.index('folderId').getAll(folderId))
    if (existingPdfs.some((pdf) => pdf.name.toLocaleLowerCase() === file.name.toLocaleLowerCase())) {
      transaction.abort()
      throw new DuplicatePdfNameError()
    }

    const now = Date.now()
    const pdf: StoredPdf = {
      id: crypto.randomUUID(),
      folderId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      createdAt: now,
      updatedAt: now,
      file,
    }
    store.add(pdf)
    await transactionComplete(transaction)
    return toPdfRecord(pdf)
  } finally {
    database.close()
  }
}

export async function deletePdf(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([PDF_STORE, ANNOTATION_STORE], 'readwrite')
    transaction.objectStore(PDF_STORE).delete(id)
    const annotationStore = transaction.objectStore(ANNOTATION_STORE)
    const annotationIds = await requestResult(annotationStore.index('pdfId').getAllKeys(id))
    annotationIds.forEach((annotationId) => annotationStore.delete(annotationId))
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

export async function renamePdf(id: string, name: string): Promise<PdfRecord> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readwrite')
    const store = transaction.objectStore(PDF_STORE)
    const pdf = await requestResult(store.get(id))
    if (!pdf) { transaction.abort(); throw new Error('PDF not found.') }
    const nextName = normalisePdfName(name, pdf.name)
    if (nextName === pdf.name) { await transactionComplete(transaction); return toPdfRecord(pdf) }
    const siblings = await requestResult(store.index('folderId').getAll(pdf.folderId))
    if (siblings.some((item) => item.id !== id && item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) { transaction.abort(); throw new DuplicatePdfNameError() }
    const updated: StoredPdf = { ...pdf, name: nextName, updatedAt: Date.now() }
    store.put(updated)
    await transactionComplete(transaction)
    return toPdfRecord(updated)
  } finally {
    database.close()
  }
}

export async function updatePdfReadingProgress(id: string, changes: Partial<Pick<StoredPdf, 'lastOpenedAt' | 'lastViewedPage'>>): Promise<PdfRecord> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readwrite')
    const store = transaction.objectStore(PDF_STORE)
    const pdf = await requestResult(store.get(id))
    if (!pdf) { transaction.abort(); throw new Error('PDF not found.') }
    const updated: StoredPdf = { ...pdf, ...changes }
    store.put(updated)
    await transactionComplete(transaction)
    return toPdfRecord(updated)
  } finally {
    database.close()
  }
}

export async function savePdf(pdf: StoredPdf): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_STORE, 'readwrite')
    transaction.objectStore(PDF_STORE).put(pdf)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}
