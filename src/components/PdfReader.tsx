import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Eraser, Highlighter, Minus, MousePointer2, Pencil, Plus, Redo2, StickyNote, Underline, Undo2 } from 'lucide-react'
import { getPdf, updatePdfReadingProgress } from '../db/pdfRepository'
import { getAnnotationsForPdf, replaceAnnotationsForPdf } from '../db/annotationRepository'
import type { Folder as FolderRecord } from '../types/folder'
import type { PdfRecord } from '../types/pdf'
import type { Annotation, AnnotationData, AnnotationType } from '../types/annotation'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'

type PdfReaderProps = { pdfId: string; folder: FolderRecord | undefined; onBack: () => void }
type Tool = 'select' | AnnotationType | 'eraser'
type NoteDraft = { pageNumber: number; x: number; y: number; annotation?: Annotation }
type Point = { x: number; y: number }

const COLORS = ['#202b2a', '#b34e47', '#22728a', '#2d6a5c', '#e2b93b', '#d77a32', '#8a5a9b', '#d46f91', '#ffffff']
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function pointFromEvent(event: PointerEvent, element: HTMLElement): Point {
  const rect = element.getBoundingClientRect()
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
}
function drawAnnotation(context: CanvasRenderingContext2D, annotation: Annotation, width: number, height: number) {
  const { data } = annotation
  context.save(); context.lineCap = 'round'; context.lineJoin = 'round'
  if (annotation.type === 'highlight' && data.x !== undefined && data.y !== undefined && data.width !== undefined && data.height !== undefined) {
    context.globalAlpha = .3; context.fillStyle = annotation.color; context.fillRect(data.x * width, data.y * height, data.width * width, data.height * height)
  } else if (annotation.type === 'underline' && data.startX !== undefined && data.startY !== undefined && data.endX !== undefined && data.endY !== undefined) {
    context.strokeStyle = annotation.color; context.lineWidth = (data.widthPx ?? 3) * width / 600
    context.beginPath(); context.moveTo(data.startX * width, data.startY * height); context.lineTo(data.endX * width, data.endY * height); context.stroke()
  } else if (annotation.type === 'pen' && data.points?.length) {
    context.strokeStyle = annotation.color; context.lineWidth = (data.widthPx ?? 3) * width / 600; context.beginPath()
    data.points.forEach((point, index) => index === 0 ? context.moveTo(point.x * width, point.y * height) : context.lineTo(point.x * width, point.y * height))
    if (data.points.length === 1) context.lineTo(data.points[0].x * width + .01, data.points[0].y * height)
    context.stroke()
  } else if (annotation.type === 'note' && data.x !== undefined && data.y !== undefined) {
    context.fillStyle = annotation.color; context.strokeStyle = '#8b6d13'; context.lineWidth = 1; context.beginPath(); context.arc(data.x * width, data.y * height, 8, 0, Math.PI * 2); context.fill(); context.stroke()
    context.fillStyle = '#fff'; context.font = 'bold 11px sans-serif'; context.fillText('i', data.x * width - 2, data.y * height + 4)
  }
  context.restore()
}
function distanceFromSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy))
}
function hitAnnotation(annotation: Annotation, point: Point): boolean {
  const { data } = annotation
  if (annotation.type === 'note') return data.x !== undefined && data.y !== undefined && Math.hypot(point.x - data.x, point.y - data.y) < .04
  if (annotation.type === 'highlight') return data.x !== undefined && data.y !== undefined && point.x >= data.x - .015 && point.x <= data.x + (data.width ?? 0) + .015 && point.y >= data.y - .015 && point.y <= data.y + (data.height ?? 0) + .015
  if (annotation.type === 'underline' && data.startX !== undefined && data.startY !== undefined && data.endX !== undefined && data.endY !== undefined) return distanceFromSegment(point, { x: data.startX, y: data.startY }, { x: data.endX, y: data.endY }) < .025
  return data.points?.some((candidate, index, points) => index === 0 ? Math.hypot(point.x - candidate.x, point.y - candidate.y) < .03 : distanceFromSegment(point, points[index - 1], candidate) < .025) ?? false
}

export function PdfReader({ pdfId, folder, onBack }: PdfReaderProps) {
  const [pdf, setPdf] = useState<PdfRecord | null>(null); const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0); const [currentPage, setCurrentPage] = useState(1); const [zoom, setZoom] = useState(1); const [fitToWidth, setFitToWidth] = useState(true)
  const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState(false); const [annotationError, setAnnotationError] = useState('')
  const [annotations, setAnnotations] = useState<Annotation[]>([]); const [tool, setTool] = useState<Tool>('select'); const [color, setColor] = useState(COLORS[4]); const [penWidth, setPenWidth] = useState(4)
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null); const [noteText, setNoteText] = useState(''); const [history, setHistory] = useState<Annotation[][]>([]); const [future, setFuture] = useState<Annotation[][]>([])
  const [pagesReady, setPagesReady] = useState(0); const [resizeVersion, setResizeVersion] = useState(0)
  const [progressReady, setProgressReady] = useState(false)
  const pageAreaRef = useRef<HTMLDivElement>(null); const toolRef = useRef<Tool>(tool); const colorRef = useRef(color); const widthRef = useRef(penWidth); const annotationsRef = useRef(annotations); const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => { toolRef.current = tool }, [tool]); useEffect(() => { colorRef.current = color }, [color]); useEffect(() => { widthRef.current = penWidth }, [penWidth]); useEffect(() => { annotationsRef.current = annotations }, [annotations])

  const persistSnapshot = useCallback((next: Annotation[]) => {
    writeQueueRef.current = writeQueueRef.current.catch(() => undefined).then(() => replaceAnnotationsForPdf(pdfId, next)).catch(() => setAnnotationError('Your annotation could not be saved locally. Please try again.'))
  }, [pdfId])
  const applyChange = useCallback((next: Annotation[]) => {
    const current = annotationsRef.current; annotationsRef.current = next; setAnnotations(next); setAnnotationError(''); setHistory((past) => [...past, current]); setFuture([]); persistSnapshot(next)
  }, [persistSnapshot])
  const addAnnotations = useCallback((newAnnotations: Annotation[]) => { if (newAnnotations.length) applyChange([...annotationsRef.current, ...newAnnotations]) }, [applyChange])

  useEffect(() => {
    let mounted = true; let objectUrl = ''; let loadingTask: PDFDocumentLoadingTask | null = null
    getPdf(pdfId).then(async (record) => {
      if (!record) throw new Error('PDF not found')
      objectUrl = URL.createObjectURL(record.file); loadingTask = pdfjsLib.getDocument({ url: objectUrl }); const loaded = await loadingTask.promise; const stored = await getAnnotationsForPdf(pdfId)
      if (!mounted) { await loadingTask.destroy(); URL.revokeObjectURL(objectUrl); return }
      setPdf({ id: record.id, folderId: record.folderId, name: record.name, size: record.size, type: record.type, createdAt: record.createdAt, updatedAt: record.updatedAt, lastOpenedAt: record.lastOpenedAt, lastViewedPage: record.lastViewedPage }); annotationsRef.current = stored; setAnnotations(stored); setHistory([]); setFuture([]); setDocumentProxy(loaded); setPageCount(loaded.numPages)
    }).catch(() => { if (mounted) setError(true) }).finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false; if (loadingTask) void loadingTask.destroy(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [pdfId])
  useEffect(() => {
    const area = pageAreaRef.current; if (!area || !window.ResizeObserver) return
    let frame = 0; const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setResizeVersion((value) => value + 1)) }); observer.observe(area)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [])
  useEffect(() => {
    if (!documentProxy || !pageAreaRef.current) return
    let cancelled = false
    const renderPages = async () => {
      const area = pageAreaRef.current; if (!area) return; const availableWidth = Math.max(280, area.clientWidth - 32); area.replaceChildren()
      for (let number = 1; number <= documentProxy.numPages; number += 1) {
        const wrapper = document.createElement('div'); wrapper.className = 'pdf-page pdf-page-loading'; wrapper.dataset.page = String(number); wrapper.style.width = `${availableWidth}px`; wrapper.style.minHeight = '240px'; area.appendChild(wrapper)
        const page = await documentProxy.getPage(number); if (cancelled) return; const base = page.getViewport({ scale: 1 }); const scale = fitToWidth ? availableWidth / base.width * zoom : zoom; const viewport = page.getViewport({ scale: Math.max(.5, scale) })
        wrapper.classList.remove('pdf-page-loading'); wrapper.style.width = `${viewport.width}px`; wrapper.style.height = `${viewport.height}px`; wrapper.style.minHeight = ''
        const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); if (!context) continue; const ratio = window.devicePixelRatio || 1; canvas.width = viewport.width * ratio; canvas.height = viewport.height * ratio; canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
        const textLayer = document.createElement('div'); textLayer.className = 'textLayer'; const overlay = document.createElement('canvas'); overlay.className = 'annotation-canvas'; overlay.width = viewport.width * ratio; overlay.height = viewport.height * ratio; overlay.style.width = `${viewport.width}px`; overlay.style.height = `${viewport.height}px`; wrapper.append(canvas, textLayer, overlay)
        context.setTransform(ratio, 0, 0, ratio, 0, 0); await page.render({ canvas, canvasContext: context, viewport }).promise; if (cancelled) return; await new pdfjsLib.TextLayer({ textContentSource: await page.getTextContent(), container: textLayer, viewport }).render()
      }
      if (!cancelled) setPagesReady((value) => value + 1)
    }
    void renderPages().catch(() => { if (!cancelled) setError(true) }); return () => { cancelled = true }
  }, [documentProxy, fitToWidth, zoom, resizeVersion])
  useEffect(() => {
    if (!pdf || !pagesReady || progressReady) return
    const page = Math.max(1, Math.min(pageCount, pdf.lastViewedPage ?? 1))
    const target = pageAreaRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`)
    const frame = requestAnimationFrame(() => { target?.scrollIntoView({ behavior: 'auto', block: 'start' }); setCurrentPage(page); setProgressReady(true) })
    return () => cancelAnimationFrame(frame)
  }, [pageCount, pagesReady, pdf, progressReady])
  useEffect(() => {
    if (!pdf || !progressReady || pdf.lastViewedPage === currentPage) return
    const timeout = window.setTimeout(() => {
      void updatePdfReadingProgress(pdf.id, { lastViewedPage: currentPage }).then((updated) => setPdf(updated)).catch(() => setAnnotationError('Unable to save your reading position locally.'))
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [currentPage, pdf, progressReady])
  useEffect(() => {
    const area = pageAreaRef.current; if (!area) return
    area.querySelectorAll<HTMLCanvasElement>('.annotation-canvas').forEach((canvas) => { const pageNumber = Number(canvas.parentElement?.dataset.page); const context = canvas.getContext('2d'); if (!context) return; context.clearRect(0, 0, canvas.width, canvas.height); const ratio = window.devicePixelRatio || 1; context.setTransform(ratio, 0, 0, ratio, 0, 0); annotations.filter((annotation) => annotation.pageNumber === pageNumber).forEach((annotation) => drawAnnotation(context, annotation, canvas.clientWidth, canvas.clientHeight)) })
  }, [annotations, documentProxy, zoom, fitToWidth, pagesReady, resizeVersion])
  useEffect(() => {
    const area = pageAreaRef.current; if (!documentProxy || !area) return
    const observer = new IntersectionObserver((entries) => { const visible = entries.find((entry) => entry.isIntersecting); if (visible) setCurrentPage(Number((visible.target as HTMLElement).dataset.page)) }, { root: area, threshold: .35 }); area.querySelectorAll<HTMLElement>('.pdf-page').forEach((page) => observer.observe(page)); return () => observer.disconnect()
  }, [documentProxy, zoom, fitToWidth, pagesReady, resizeVersion])
  useEffect(() => { pageAreaRef.current?.querySelectorAll<HTMLCanvasElement>('.annotation-canvas').forEach((canvas) => { canvas.style.pointerEvents = tool === 'select' || tool === 'highlight' ? 'none' : 'auto' }) }, [tool, pagesReady])
  useEffect(() => {
    const area = pageAreaRef.current; if (!area) return
    const openNoteInSelectMode = (event: PointerEvent) => {
      if (toolRef.current !== 'select' || event.button !== 0) return
      const canvas = [...area.querySelectorAll<HTMLCanvasElement>('.annotation-canvas')].find((candidate) => {
        const bounds = candidate.getBoundingClientRect()
        return event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      })
      if (!canvas) return
      const point = pointFromEvent(event, canvas); const pageNumber = Number(canvas.parentElement?.dataset.page)
      const note = [...annotationsRef.current].reverse().find((annotation) => annotation.pageNumber === pageNumber && annotation.type === 'note' && hitAnnotation(annotation, point))
      if (!note) return
      event.preventDefault(); setNoteDraft({ pageNumber, x: note.data.x!, y: note.data.y!, annotation: note }); setNoteText(note.data.text ?? '')
    }
    area.addEventListener('pointerdown', openNoteInSelectMode)
    return () => area.removeEventListener('pointerdown', openNoteInSelectMode)
  }, [pagesReady])
  useEffect(() => {
    const captureTextHighlight = () => {
      if (toolRef.current !== 'highlight') return
      requestAnimationFrame(() => {
        const selection = window.getSelection(); const area = pageAreaRef.current; if (!selection || selection.isCollapsed || !area) return
        const now = Date.now(); const highlights: Annotation[] = []
        for (let index = 0; index < selection.rangeCount; index += 1) for (const rect of selection.getRangeAt(index).getClientRects()) {
          const page = [...area.querySelectorAll<HTMLElement>('.pdf-page')].find((candidate) => { const bounds = candidate.getBoundingClientRect(); return rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top })
          const canvas = page?.querySelector<HTMLCanvasElement>('.annotation-canvas'); if (!canvas || rect.width < 1 || rect.height < 1) continue; const bounds = canvas.getBoundingClientRect()
          const x = Math.max(0, Math.min(1, (rect.left - bounds.left) / bounds.width)); const y = Math.max(0, Math.min(1, (rect.top - bounds.top) / bounds.height))
          highlights.push({ id: crypto.randomUUID(), pdfId, pageNumber: Number(page?.dataset.page), type: 'highlight', color: colorRef.current, data: { x, y, width: Math.min(1 - x, rect.width / bounds.width), height: Math.min(1 - y, rect.height / bounds.height) }, createdAt: now, updatedAt: now })
        }
        if (highlights.length) { addAnnotations(highlights); selection.removeAllRanges() }
      })
    }
    document.addEventListener('pointerup', captureTextHighlight); return () => document.removeEventListener('pointerup', captureTextHighlight)
  }, [addAnnotations, pdfId])
  useEffect(() => {
    const area = pageAreaRef.current; if (!documentProxy || !area) return; const cleanups: Array<() => void> = []
    area.querySelectorAll<HTMLCanvasElement>('.annotation-canvas').forEach((canvas) => {
      let start: Point | null = null; let points: Point[] = []; const pageNumber = () => Number(canvas.parentElement?.dataset.page)
      const down = (event: PointerEvent) => { if (event.button !== 0 || toolRef.current === 'select' || toolRef.current === 'highlight') return; event.preventDefault(); canvas.setPointerCapture(event.pointerId); start = pointFromEvent(event, canvas); points = [start]; if (toolRef.current === 'note') { const existing = [...annotationsRef.current].reverse().find((annotation) => annotation.pageNumber === pageNumber() && annotation.type === 'note' && hitAnnotation(annotation, start!)); setNoteDraft(existing ? { pageNumber: pageNumber(), x: existing.data.x!, y: existing.data.y!, annotation: existing } : { pageNumber: pageNumber(), x: start.x, y: start.y }); setNoteText(existing?.data.text ?? ''); start = null } }
      const move = (event: PointerEvent) => { if (!start) return; event.preventDefault(); const point = pointFromEvent(event, canvas); points.push(point); const context = canvas.getContext('2d'); if (!context) return; context.clearRect(0, 0, canvas.width, canvas.height); const ratio = window.devicePixelRatio || 1; context.setTransform(ratio, 0, 0, ratio, 0, 0); annotationsRef.current.filter((item) => item.pageNumber === pageNumber()).forEach((item) => drawAnnotation(context, item, canvas.clientWidth, canvas.clientHeight)); const activeTool = toolRef.current; if (activeTool === 'eraser' || activeTool === 'note') return; const draft: Annotation = { id: 'draft', pdfId, pageNumber: pageNumber(), type: activeTool as AnnotationType, color: colorRef.current, data: activeTool === 'pen' ? { points, widthPx: widthRef.current } : { startX: start.x, startY: start.y, endX: point.x, endY: point.y, widthPx: widthRef.current }, createdAt: 0, updatedAt: 0 }; drawAnnotation(context, draft, canvas.clientWidth, canvas.clientHeight) }
      const finish = (event: PointerEvent) => { if (!start) return; event.preventDefault(); const end = pointFromEvent(event, canvas); const activeTool = toolRef.current; if (activeTool === 'eraser') { const target = [...annotationsRef.current].reverse().find((item) => item.pageNumber === pageNumber() && hitAnnotation(item, end)); if (target) applyChange(annotationsRef.current.filter((item) => item.id !== target.id)) } else if (activeTool === 'pen' || activeTool === 'underline') { const data: AnnotationData = activeTool === 'pen' ? { points, widthPx: widthRef.current } : { startX: start.x, startY: start.y, endX: end.x, endY: end.y, widthPx: widthRef.current }; const now = Date.now(); addAnnotations([{ id: crypto.randomUUID(), pdfId, pageNumber: pageNumber(), type: activeTool, color: colorRef.current, data, createdAt: now, updatedAt: now }]) } start = null; points = [] }
      const cancel = () => { start = null; points = [] }; canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', cancel); cleanups.push(() => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', finish); canvas.removeEventListener('pointercancel', cancel) })
    })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [documentProxy, pdfId, pagesReady, applyChange, addAnnotations])

  const saveNote = () => { if (!noteDraft || !noteText.trim()) return; const now = Date.now(); const note: Annotation = { id: noteDraft.annotation?.id ?? crypto.randomUUID(), pdfId, pageNumber: noteDraft.pageNumber, type: 'note', color: noteDraft.annotation?.color ?? color, data: { x: noteDraft.x, y: noteDraft.y, text: noteText.trim() }, createdAt: noteDraft.annotation?.createdAt ?? now, updatedAt: now }; applyChange(noteDraft.annotation ? annotationsRef.current.map((item) => item.id === note.id ? note : item) : [...annotationsRef.current, note]); setNoteDraft(null) }
  const deleteNote = () => { if (!noteDraft?.annotation) return; applyChange(annotationsRef.current.filter((item) => item.id !== noteDraft.annotation?.id)); setNoteDraft(null) }
  const undo = () => { const previous = history.at(-1); if (!previous) return; const current = annotationsRef.current; annotationsRef.current = previous; setAnnotations(previous); setHistory((items) => items.slice(0, -1)); setFuture((items) => [...items, current]); persistSnapshot(previous) }
  const redo = () => { const next = future.at(-1); if (!next) return; const current = annotationsRef.current; annotationsRef.current = next; setAnnotations(next); setFuture((items) => items.slice(0, -1)); setHistory((items) => [...items, current]); persistSnapshot(next) }
  const goToPage = (page: number) => { const target = pageAreaRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`); target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setCurrentPage(page) }
  const tools: Array<{ id: Tool; label: string; icon: ReactNode }> = [{ id: 'select', label: 'Select', icon: <MousePointer2 size={16} /> }, { id: 'highlight', label: 'Highlight', icon: <Highlighter size={16} /> }, { id: 'pen', label: 'Pen', icon: <Pencil size={16} /> }, { id: 'underline', label: 'Underline', icon: <Underline size={16} /> }, { id: 'note', label: 'Add note', icon: <StickyNote size={16} /> }, { id: 'eraser', label: 'Eraser', icon: <Eraser size={16} /> }]
  const readerTitle = pdf?.name ?? 'PDF Reader'
  return <section className="pdf-reader" aria-labelledby="pdf-reader-title">
    <header className="pdf-reader-header"><button className="back-link" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /><span className="reader-back-wide">Back to {folder?.name ?? 'Folder'}</span><span className="reader-back-short">Back</span></button><h1 id="pdf-reader-title" title={readerTitle}>{readerTitle}</h1></header>
    {isLoading ? <div className="reader-message" role="status">Opening PDF...</div> : error || !documentProxy ? <div className="reader-message reader-error"><h2>Unable to open this PDF.</h2><button className="button button-secondary" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back to Folder</button></div> : <>
      <div className="reader-toolbar" aria-label="PDF and annotation controls"><div className="annotation-tools">{tools.map((item) => <button key={item.id} className={`reader-tool ${tool === item.id ? 'reader-tool-active' : ''}`} type="button" onClick={() => setTool(item.id)} aria-label={item.label} title={item.label}>{item.icon}<span>{item.label}</span></button>)}</div><div className="reader-history"><button className="icon-button" type="button" onClick={undo} disabled={!history.length} aria-label="Undo"><Undo2 size={16} /></button><button className="icon-button" type="button" onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 size={16} /></button></div><div className="reader-page-controls"><button className="icon-button" type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page">‹</button><span>{currentPage} / {pageCount}</span><button className="icon-button" type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="Next page">›</button></div><div className="reader-zoom-controls"><button className="icon-button" type="button" onClick={() => setZoom((value) => Math.max(.5, Number((value - .1).toFixed(1))))} disabled={zoom <= .5} aria-label="Zoom out"><Minus size={16} /></button><span>{Math.round(zoom * 100)}%</span><button className="icon-button" type="button" onClick={() => setZoom((value) => Math.min(2, Number((value + .1).toFixed(1))))} disabled={zoom >= 2} aria-label="Zoom in"><Plus size={16} /></button><button className={`fit-button ${fitToWidth ? 'fit-button-active' : ''}`} type="button" onClick={() => setFitToWidth((value) => !value)}>Fit to width</button></div></div>
      {(tool === 'pen' || tool === 'highlight' || tool === 'underline') && <div className="annotation-palette" aria-label="Annotation options"><div className="color-swatches">{COLORS.map((swatch) => <button key={swatch} className={`color-swatch ${color === swatch ? 'color-swatch-active' : ''}`} style={{ backgroundColor: swatch }} type="button" onClick={() => setColor(swatch)} aria-label={`Use ${swatch} color`} />)}</div>{tool === 'pen' && <div className="pen-widths">{[2, 4, 8].map((width) => <button key={width} className={penWidth === width ? 'width-active' : ''} type="button" onClick={() => setPenWidth(width)}>{width}px</button>)}</div>}</div>}
      {annotationError && <p className="annotation-error" role="alert">{annotationError}</p>}<div className="pdf-page-area" ref={pageAreaRef} aria-label="PDF pages" />
    </>}
    {noteDraft && <div className="note-editor-backdrop"><section className="note-editor" role="dialog" aria-modal="true" aria-labelledby="note-title"><h2 id="note-title">Note</h2><textarea autoFocus value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Write your note..." /><div className="modal-actions">{noteDraft.annotation && <button className="button button-danger" type="button" onClick={deleteNote}>Delete note</button>}<button className="button button-secondary" type="button" onClick={() => setNoteDraft(null)}>Cancel</button><button className="button button-primary" type="button" onClick={saveNote}>Save</button></div></section></div>}
  </section>
}
