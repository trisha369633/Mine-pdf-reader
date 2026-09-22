export type AnnotationType = 'highlight' | 'pen' | 'underline' | 'note'

export type AnnotationData = {
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

export type Annotation = {
  id: string
  pdfId: string
  pageNumber: number
  type: AnnotationType
  color: string
  data: AnnotationData
  createdAt: number
  updatedAt: number
}