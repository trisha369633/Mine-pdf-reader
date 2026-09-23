import { useMemo } from 'react'
import { ArrowRight, FileText, Folder as FolderIcon, HardDrive, Highlighter } from 'lucide-react'
import { formatFileSize } from '../lib/format'
import { FolderCard } from './FolderCard'
import { PdfListItem } from './PdfListItem'
import type { Folder } from '../types/folder'
import type { PdfRecord } from '../types/pdf'

type HomeDashboardProps = {
  folders: Folder[]
  pdfs: PdfRecord[]
  annotationCount: number
  isLoading: boolean
  onOpenPdf: (pdfId: string) => void
  onOpenFolder: (folder: Folder) => void
  onRenameFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  onGoToFolders: () => void
}

const FOLDER_OVERVIEW_LIMIT = 6

export function HomeDashboard({ folders, pdfs, annotationCount, isLoading, onOpenPdf, onOpenFolder, onRenameFolder, onDeleteFolder, onGoToFolders }: HomeDashboardProps) {
  const { continueReading, recentPdfs, totalStorage, folderOverview, hasMoreFolders } = useMemo(() => {
    const continueReadingList = pdfs
      .filter((pdf) => (pdf.lastViewedPage ?? 0) > 1)
      .sort((left, right) => (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0))
      .slice(0, 4)
    const continueReadingIds = new Set(continueReadingList.map((pdf) => pdf.id))
    const recentList = pdfs
      .filter((pdf) => pdf.lastOpenedAt !== undefined && !continueReadingIds.has(pdf.id))
      .sort((left, right) => (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0))
      .slice(0, 6)
    const storage = pdfs.reduce((sum, pdf) => sum + pdf.size, 0)
    const rankedFolders = folders
      .map((folder) => {
        const mostRecentOpen = pdfs
          .filter((pdf) => pdf.folderId === folder.id)
          .reduce((max, pdf) => (pdf.lastOpenedAt && pdf.lastOpenedAt > max ? pdf.lastOpenedAt : max), 0)
        return { folder, activity: mostRecentOpen > 0 ? mostRecentOpen : folder.updatedAt }
      })
      .sort((left, right) => right.activity - left.activity)

    return {
      continueReading: continueReadingList,
      recentPdfs: recentList,
      totalStorage: storage,
      folderOverview: rankedFolders.slice(0, FOLDER_OVERVIEW_LIMIT).map((entry) => entry.folder),
      hasMoreFolders: folders.length > FOLDER_OVERVIEW_LIMIT,
    }
  }, [folders, pdfs])

  if (isLoading) {
    return <section className="loading-state" role="status">Loading your library...</section>
  }

  const hasPdfs = pdfs.length > 0

  return (
    <div className="home-dashboard">
      <div className="home-heading">
        <span className="eyebrow">Personal library</span>
        <h1>Home</h1>
      </div>

      {!hasPdfs ? (
        <p className="home-inline-empty">You have folders but no PDFs yet.</p>
      ) : (
        <>
          <section className="home-section" aria-labelledby="continue-reading-heading">
            <div className="section-heading"><h2 id="continue-reading-heading">Continue Reading</h2></div>
            {continueReading.length === 0 ? (
              <p className="home-inline-empty">Nothing in progress yet.</p>
            ) : (
              <div className="pdf-list">
                {continueReading.map((pdf) => <PdfListItem key={pdf.id} pdf={pdf} onOpen={() => onOpenPdf(pdf.id)} />)}
              </div>
            )}
          </section>

          <section className="home-section" aria-labelledby="recent-pdfs-heading">
            <div className="section-heading"><h2 id="recent-pdfs-heading">Recent PDFs</h2></div>
            {recentPdfs.length === 0 ? (
              <p className="home-inline-empty">You haven't opened any PDFs yet.</p>
            ) : (
              <div className="pdf-list">
                {recentPdfs.map((pdf) => <PdfListItem key={pdf.id} pdf={pdf} onOpen={() => onOpenPdf(pdf.id)} />)}
              </div>
            )}
          </section>
        </>
      )}

      <section className="home-section" aria-labelledby="library-stats-heading">
        <div className="section-heading"><h2 id="library-stats-heading">Library Statistics</h2></div>
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-tile-icon"><FolderIcon size={18} aria-hidden="true" /></span>
            <div><strong>{folders.length}</strong><span>{folders.length === 1 ? 'Folder' : 'Folders'}</span></div>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-icon"><FileText size={18} aria-hidden="true" /></span>
            <div><strong>{pdfs.length}</strong><span>{pdfs.length === 1 ? 'PDF' : 'PDFs'}</span></div>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-icon"><Highlighter size={18} aria-hidden="true" /></span>
            <div><strong>{annotationCount}</strong><span>{annotationCount === 1 ? 'Annotation' : 'Annotations'}</span></div>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-icon"><HardDrive size={18} aria-hidden="true" /></span>
            <div><strong>{formatFileSize(totalStorage)}</strong><span>Storage</span></div>
          </div>
        </div>
      </section>

      <section className="home-section" aria-labelledby="folder-overview-heading">
        <div className="section-heading">
          <h2 id="folder-overview-heading">Folder Overview</h2>
          {hasMoreFolders && <button className="button button-secondary" type="button" onClick={onGoToFolders}>View all folders <ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
        <div className="folder-grid">
          {folderOverview.map((folder) => (
            <FolderCard key={folder.id} folder={folder} onOpen={() => onOpenFolder(folder)} onRename={() => onRenameFolder(folder)} onDelete={() => onDeleteFolder(folder)} />
          ))}
        </div>
      </section>
    </div>
  )
}
