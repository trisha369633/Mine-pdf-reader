import { ANNOTATION_STORE, openDatabase, requestResult, transactionComplete, type StoredAnnotation } from './database'
import type { Annotation } from '../types/annotation'

export async function getAnnotationCount(): Promise<number> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ANNOTATION_STORE, 'readonly')
    const count = await requestResult(transaction.objectStore(ANNOTATION_STORE).count())
    await transactionComplete(transaction)
    return count
  } finally {
    database.close()
  }
}

export async function getAnnotationsForPdf(pdfId: string): Promise<Annotation[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ANNOTATION_STORE, 'readonly')
    const records = await requestResult(transaction.objectStore(ANNOTATION_STORE).index('pdfId').getAll(pdfId))
    await transactionComplete(transaction)
    return records
      .filter((record) => record.pdfId === pdfId
        && typeof record.id === 'string'
        && Number.isInteger(record.pageNumber) && record.pageNumber > 0
        && ['highlight', 'pen', 'underline', 'note'].includes(record.type)
        && typeof record.color === 'string'
        && record.data !== null && typeof record.data === 'object'
        && Number.isFinite(record.createdAt) && Number.isFinite(record.updatedAt))
      .sort((left, right) => left.createdAt - right.createdAt)
  } finally {
    database.close()
  }
}

/**
 * Persist one complete PDF annotation snapshot in a single transaction. Keeping
 * snapshots atomic is important for undo/redo: a refresh can never observe a
 * partially-applied history step.
 */
export async function replaceAnnotationsForPdf(pdfId: string, annotations: Annotation[]): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ANNOTATION_STORE, 'readwrite')
    const store = transaction.objectStore(ANNOTATION_STORE)
    const index = store.index('pdfId')
    const existingIds = await requestResult(index.getAllKeys(pdfId))
    existingIds.forEach((id) => store.delete(id))
    annotations.filter((annotation) => annotation.pdfId === pdfId).forEach((annotation) => store.put(annotation as StoredAnnotation))
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

export async function deleteAnnotationsForPdf(pdfId: string): Promise<void> {
  await replaceAnnotationsForPdf(pdfId, [])
}

export async function saveAnnotation(annotation: Annotation): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ANNOTATION_STORE, 'readwrite')
    transaction.objectStore(ANNOTATION_STORE).put(annotation as StoredAnnotation)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

export async function deleteAnnotation(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ANNOTATION_STORE, 'readwrite')
    transaction.objectStore(ANNOTATION_STORE).delete(id)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}
