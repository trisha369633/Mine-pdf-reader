import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Folder,
  FolderPlus,
  Home,
  Menu,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import './App.css'
import { CreateFolderModal } from './components/CreateFolderModal'
import { DeleteFolderDialog } from './components/DeleteFolderDialog'
import { EmptyState } from './components/EmptyState'
import { ErrorToast } from './components/ErrorToast'
import { FolderCard } from './components/FolderCard'
import { FolderView, type PdfSort } from './components/FolderView'
import { HomeDashboard } from './components/HomeDashboard'
import { SuccessToast } from './components/SuccessToast'
import { getAnnotationCount } from './db/annotationRepository'
import { createFolder, deleteFolder as removeFolder, DuplicateFolderNameError, getFolders, updateFolder } from './db/folderRepository'
import { createPdf, deletePdf, DuplicatePdfNameError, getAllPdfMetadata, InvalidPdfNameError, getPdfsForFolder, renamePdf, updatePdfReadingProgress } from './db/pdfRepository'
import { PdfReader } from './components/PdfReader'
import type { Folder as FolderRecord } from './types/folder'
import type { PdfRecord } from './types/pdf'

type AppView = 'home' | 'folders' | 'folder' | 'reader'

function App() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [currentView, setCurrentView] = useState<AppView>('home')
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [openPdfId, setOpenPdfId] = useState<string | null>(null)
  const [folderModal, setFolderModal] = useState<'create' | 'rename' | null>(null)
  const [folderForAction, setFolderForAction] = useState<FolderRecord | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<FolderRecord | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoadingFolders, setIsLoadingFolders] = useState(true)
  const [storageError, setStorageError] = useState('')
  const [pdfs, setPdfs] = useState<PdfRecord[]>([])
  const [loadedPdfFolderId, setLoadedPdfFolderId] = useState<string | null>(null)
  const [pdfSearch, setPdfSearch] = useState('')
  const [pdfSort, setPdfSort] = useState<PdfSort>('newest')
  const [homePdfs, setHomePdfs] = useState<PdfRecord[]>([])
  const [annotationCount, setAnnotationCount] = useState(0)
  const [isLoadingHome, setIsLoadingHome] = useState(true)
  const toastTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let isMounted = true
    getFolders()
      .then((storedFolders) => {
        if (isMounted) setFolders(storedFolders)
      })
      .catch(() => {
        if (isMounted) setStorageError('Unable to load your local folders.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingFolders(false)
      })

    return () => {
      isMounted = false
      if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (currentView !== 'home') return
    let isMounted = true
    setIsLoadingHome(true)
    Promise.all([getAllPdfMetadata(), getAnnotationCount()])
      .then(([allPdfs, count]) => {
        if (isMounted) {
          setHomePdfs(allPdfs)
          setAnnotationCount(count)
        }
      })
      .catch(() => {
        if (isMounted) setStorageError('Unable to load your library overview.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingHome(false)
      })

    return () => { isMounted = false }
  }, [currentView])

  const showSuccess = (message: string) => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current)
    setSuccessMessage(message)
    toastTimeoutRef.current = window.setTimeout(() => setSuccessMessage(''), 3000)
  }

  const openCreateFolder = () => {
    setIsNavOpen(false)
    setFolderForAction(null)
    setFolderModal('create')
  }
  const goHome = () => {
    setCurrentView('home')
    setOpenFolderId(null)
    setOpenPdfId(null)
    setIsNavOpen(false)
  }
  const goToFolders = () => {
    setCurrentView('folders')
    setOpenFolderId(null)
    setOpenPdfId(null)
    setIsNavOpen(false)
  }
  const startUploadFromHome = () => {
    if (folders.length === 0) {
      openCreateFolder()
    } else {
      goToFolders()
    }
  }
  const openFolderById = (folder: FolderRecord) => {
    setOpenFolderId(folder.id)
    setOpenPdfId(null)
    setPdfSearch('')
    setPdfSort('newest')
    setCurrentView('folder')
  }
  const handleSaveFolder = async (name: string) => {
    const duplicate = folders.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase() && folder.id !== folderForAction?.id)
    if (duplicate) return 'A folder with this name already exists.'

    const now = Date.now()
    try {
      if (folderModal === 'rename' && folderForAction) {
        if (folderForAction.name === name) { setFolderModal(null); setFolderForAction(null); return undefined }
        const updatedFolder = await updateFolder({ ...folderForAction, name, updatedAt: now })
        setFolders((currentFolders) => currentFolders.map((folder) => folder.id === updatedFolder.id ? { ...updatedFolder, pdfIds: folder.pdfIds } : folder))
        showSuccess('Folder renamed successfully')
      } else {
        const createdFolder = await createFolder(name)
        setFolders((currentFolders) => [...currentFolders, createdFolder])
        showSuccess('Folder created successfully')
      }
    } catch (error) {
      if (error instanceof DuplicateFolderNameError) return error.message
      setStorageError('Unable to save your folder. Please try again.')
      return 'Unable to save your folder. Please try again.'
    }
    setFolderModal(null)
    setFolderForAction(null)
    return undefined
  }
  const openRenameFolder = (folder: FolderRecord) => {
    setFolderForAction(folder)
    setFolderModal('rename')
  }
  const deleteFolder = async () => {
    if (!folderToDelete) return
    try {
      await removeFolder(folderToDelete.id)
      setFolders((currentFolders) => currentFolders.filter((folder) => folder.id !== folderToDelete.id))
      if (openFolderId === folderToDelete.id) setPdfs([])
      if (openFolderId === folderToDelete.id) {
        setOpenFolderId(null)
        setCurrentView('folders')
      }
      setFolderToDelete(null)
      showSuccess('Folder deleted successfully')
    } catch {
      setStorageError('Unable to delete your folder. Please try again.')
    }
  }
  const openFolder = folders.find((folder) => folder.id === openFolderId)

  useEffect(() => {
    if (currentView !== 'folder' || !openFolderId) return
    let isMounted = true
    getPdfsForFolder(openFolderId)
      .then((storedPdfs) => {
        if (isMounted) setPdfs(storedPdfs)
      })
      .catch(() => {
        if (isMounted) setStorageError('Unable to load PDFs from this folder.')
      })
      .finally(() => {
        if (isMounted) setLoadedPdfFolderId(openFolderId)
      })

    return () => { isMounted = false }
  }, [currentView, openFolderId])

  const handleUploadPdf = async (file: File) => {
    if (!openFolderId) return 'Unable to find the open folder.'
    try {
      const createdPdf = await createPdf(openFolderId, file)
      setPdfs((currentPdfs) => [...currentPdfs, createdPdf])
      setFolders((currentFolders) => currentFolders.map((folder) => folder.id === openFolderId ? { ...folder, pdfIds: [...folder.pdfIds, createdPdf.id] } : folder))
      showSuccess('PDF uploaded successfully')
      return undefined
    } catch (error) {
      if (error instanceof DuplicatePdfNameError) return error.message
      return 'This PDF could not be saved on this device.'
    }
  }

  const handleDeletePdf = async (pdf: PdfRecord) => {
    try {
      await deletePdf(pdf.id)
      setPdfs((currentPdfs) => currentPdfs.filter((currentPdf) => currentPdf.id !== pdf.id))
      setFolders((currentFolders) => currentFolders.map((folder) => folder.id === pdf.folderId ? { ...folder, pdfIds: folder.pdfIds.filter((pdfId) => pdfId !== pdf.id) } : folder))
      showSuccess('PDF deleted successfully')
    } catch {
      setStorageError('This PDF could not be deleted. Please try again.')
    }
  }
  const handleRenamePdf = async (pdf: PdfRecord, name: string) => {
    const requestedName = `${name.trim().replace(/\.pdf$/i, '')}.pdf`
    if (pdf.name.toLocaleLowerCase() === requestedName.toLocaleLowerCase()) return undefined
    try {
      const updated = await renamePdf(pdf.id, name)
      setPdfs((currentPdfs) => currentPdfs.map((item) => item.id === updated.id ? updated : item))
      showSuccess('PDF renamed successfully')
      return undefined
    } catch (error) {
      if (error instanceof DuplicatePdfNameError || error instanceof InvalidPdfNameError) return error.message
      return 'Unable to rename this PDF. Please try again.'
    }
  }
  const openPdf = (pdfId: string) => {
    setOpenPdfId(pdfId)
    setCurrentView('reader')
    void updatePdfReadingProgress(pdfId, { lastOpenedAt: Date.now() })
      .then((updated) => setPdfs((currentPdfs) => currentPdfs.map((pdf) => pdf.id === updated.id ? updated : pdf)))
      .catch(() => setStorageError('Unable to save PDF reading activity locally.'))
  }
  const closePdfReader = () => {
    const pdfFolderId = pdfs.find((pdf) => pdf.id === openPdfId)?.folderId ?? openFolderId
    setOpenPdfId(null)
    if (folders.some((folder) => folder.id === pdfFolderId)) {
      setOpenFolderId(pdfFolderId ?? null)
      setCurrentView('folder')
    } else {
      goToFolders()
    }
  }

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <a className="brand" href="/" aria-label="Mine PDF Reader home"><span className="brand-name">Mine</span><span className="brand-subtitle">PDF Reader</span></a>
        <button className="icon-button" type="button" onClick={() => setIsNavOpen(!isNavOpen)} aria-label="Toggle navigation" aria-expanded={isNavOpen}>{isNavOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}</button>
      </header>

      <aside className={`sidebar ${isNavOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <a className="brand desktop-brand" href="/" aria-label="Mine PDF Reader home"><span className="brand-name">Mine</span><span className="brand-subtitle">PDF Reader</span></a>
          <nav aria-label="Primary navigation">
            <button className={`nav-item ${currentView === 'home' ? 'nav-item-active' : ''}`} type="button" onClick={goHome}><Home size={18} aria-hidden="true" /> Home</button>
            <button className={`nav-item ${currentView !== 'home' ? 'nav-item-active' : ''}`} type="button" onClick={goToFolders}><Folder size={18} aria-hidden="true" /> My Folders</button>
          </nav>
        </div>
        <button className="create-folder-link" type="button" onClick={openCreateFolder}><FolderPlus size={18} aria-hidden="true" /> Create Folder <Plus size={16} aria-hidden="true" /></button>
      </aside>

      <main className={`main-content ${currentView === 'folder' ? 'main-content-folder' : ''} ${currentView === 'reader' ? 'main-content-reader' : ''}`}>
        <div className="content-wrap">
          {currentView === 'home' && !isLoadingFolders && folders.length === 0 && <span className="eyebrow main-label">Personal library</span>}

          {currentView === 'reader' && openPdfId ? <PdfReader key={openPdfId} pdfId={openPdfId} folder={folders.find((folder) => folder.id === pdfs.find((pdf) => pdf.id === openPdfId)?.folderId)} onBack={closePdfReader} /> : currentView === 'folder' && openFolder ? <FolderView folder={openFolder} pdfs={pdfs} isLoadingPdfs={loadedPdfFolderId !== openFolder.id} onBack={goToFolders} onUploadPdf={handleUploadPdf} onDeletePdf={handleDeletePdf} onRenamePdf={handleRenamePdf} onOpenPdf={openPdf} onNotifyError={setStorageError} search={pdfSearch} sort={pdfSort} onSearchChange={setPdfSearch} onSortChange={setPdfSort} /> : currentView === 'home' ? (isLoadingFolders ? <section className="loading-state" role="status">Loading your library...</section> : folders.length === 0 ? <EmptyState icon={<BookOpen size={30} />} eyebrow="A clear place to begin" title="Your PDF library is empty" description="Create a folder for your materials or choose a PDF to get started. Your library will stay on this device." titleId="empty-title" actions={<><button className="button button-primary" type="button" onClick={openCreateFolder}><FolderPlus size={18} aria-hidden="true" /> Create Folder</button><button className="button button-secondary" type="button" onClick={startUploadFromHome}><Upload size={18} aria-hidden="true" /> Upload PDF</button></>} /> : <HomeDashboard folders={folders} pdfs={homePdfs} annotationCount={annotationCount} isLoading={isLoadingHome} onOpenPdf={openPdf} onOpenFolder={openFolderById} onRenameFolder={openRenameFolder} onDeleteFolder={(folder) => setFolderToDelete(folder)} onGoToFolders={goToFolders} />) : isLoadingFolders ? <section className="loading-state" role="status">Loading your folders...</section> : folders.length === 0 ? <EmptyState icon={<Folder size={30} />} eyebrow="Your folders" title="Folders have not been created yet" description="Create a folder to organize your PDFs by subject." titleId="folders-empty-title" actions={<button className="button button-primary" type="button" onClick={openCreateFolder}><FolderPlus size={18} aria-hidden="true" /> Create Folder</button>} /> : <section className="folder-section" aria-labelledby="folders-heading"><div className="section-heading"><div><h1 id="folders-heading">Folders</h1><span>{folders.length} {folders.length === 1 ? 'folder' : 'folders'}</span></div><button className="button button-secondary" type="button" onClick={openCreateFolder}><FolderPlus size={17} aria-hidden="true" /> Create Folder</button></div><div className="folder-grid">{folders.map((folder) => <FolderCard key={folder.id} folder={folder} onOpen={() => openFolderById(folder)} onRename={() => openRenameFolder(folder)} onDelete={() => setFolderToDelete(folder)} />)}</div></section>}
        </div>
      </main>

      <CreateFolderModal key={`${folderModal}-${folderForAction?.id ?? 'new'}`} isOpen={folderModal !== null} onClose={() => { setFolderModal(null); setFolderForAction(null) }} onCreate={handleSaveFolder} initialName={folderForAction?.name} title={folderModal === 'rename' ? 'Rename Folder' : 'Create New Folder'} submitLabel={folderModal === 'rename' ? 'Save Changes' : 'Create Folder'} />
      <DeleteFolderDialog folder={folderToDelete} onClose={() => setFolderToDelete(null)} onConfirm={deleteFolder} />
      {successMessage && <SuccessToast message={successMessage} />}
      {storageError && <ErrorToast message={storageError} />}
    </div>
  )
}

export default App
