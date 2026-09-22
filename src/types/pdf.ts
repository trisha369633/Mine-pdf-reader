export type PdfRecord = {
  id: string
  folderId: string
  name: string
  size: number
  type: string
  createdAt: number
  updatedAt: number
  lastOpenedAt?: number
  lastViewedPage?: number
}
