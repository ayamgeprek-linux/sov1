// apps/web/src/components/pages/Import/ImportPage.tsx
import { useState } from 'react'
import { parseExcelFile, validateItems } from '../../../utils/excelParser'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './ImportPage.module.css'

interface ImportPageProps {
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

export function ImportPage({ navigateTo, showToast }: ImportPageProps) {
  const { token } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('Pilih file Excel...')
  const [importProgress, setImportProgress] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [isDragover, setIsDragover] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    
    setFile(selected)
    setFileName(selected.name)
    setImportProgress(0)
    setTotalItems(0)
    
    try {
      const parsed = await parseExcelFile(selected)
      console.log('[Import] Parsed data:', parsed.length)
      
      if (parsed.length === 0) {
        showToast('⚠️ Tidak ada data yang terbaca. Cek format file.')
        setPreview([])
        return
      }
      
      setTotalItems(parsed.length)
      setPreview(parsed.slice(0, 10))
      showToast(`✅ Data berhasil divalidasi. ${parsed.length} baris siap diimport.`)
    } catch (error) {
      console.error('[Import] Error:', error)
      showToast('❌ Gagal membaca file: ' + (error as Error).message)
    }
  }

  // ============================================================
  // ✅ IMPORT - PAKE API BACKEND
  // ============================================================
  const handleImport = async () => {
    if (!file) {
      showToast('⚠️ Pilih file terlebih dahulu')
      return
    }
    
    setLoading(true)
    setImportProgress(0)
    
    try {
      const parsed = await parseExcelFile(file)
      
      if (parsed.length === 0) {
        showToast('⚠️ Tidak ada data yang valid untuk diimport')
        return
      }
      
      const validation = validateItems(parsed)
      if (!validation.valid) {
        showToast('❌ Validasi gagal: ' + validation.errors.join(', '))
        return
      }
      
      const batchSize = 100
      let inserted = 0
      const total = parsed.length
      
      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize)
        const progress = Math.min(100, Math.round(((i + batch.length) / total) * 100))
        setImportProgress(progress)
        
        const result = await api.post<{ success: boolean; inserted: number; error?: string }>(
          '/api/import',
          { data: batch },
          token || undefined
        )
        
        if (result.success) {
          inserted += result.inserted || 0
        } else {
          console.error('[Import] Batch error:', result.error)
        }
      }
      
      setImportProgress(100)
      showToast(`✅ ${inserted} data master berhasil diimport!`)
      setTimeout(() => navigateTo('master'), 1500)
    } catch (error) {
      console.error('[Import] Error:', error)
      showToast('❌ Gagal import: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setPreview([])
    setFile(null)
    setFileName('Pilih file Excel...')
    setImportProgress(0)
    setTotalItems(0)
    showToast('🔄 Import data direset')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragover(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragover(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragover(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const fakeEvent = { target: { files: [droppedFile] } } as any
      handleFileChange(fakeEvent)
    }
  }

  const handleDropzoneClick = () => {
    document.getElementById('file-input')?.click()
  }

  const hasData = preview.length > 0 && file !== null

  return (
    <div className={styles.importPage}>
      {/* Header */}
      <div className={styles.importHeader}>
       
        <div>
          <h2 className={styles.importTitle}>Import Data Master</h2>
          <p className={styles.importSubtitle}>Effortlessly synchronize your inventory database with Excel integration.</p>
        </div>
      </div>

      {/* Bento Grid */}
      <div className={styles.importGrid}>
        {/* Left Section: Upload Zone */}
        <div className={styles.importUpload}>
          <div className={styles.importUploadBg}></div>
          
          <div 
            className={`${styles.dropzone} ${isDragover ? styles.dragover : ''}`}
            onClick={handleDropzoneClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
           
            <div className={styles.dropzoneText}>Drop Excel Inventory Balancing</div>
            <div className={styles.dropzoneSub}>.xlsx or .csv files are supported for automated mapping</div>
            <button className={styles.dropzoneBtn}>
              
              Pilih file Excel...
            </button>
            
          </div>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className={styles.fileInput}
          />

          <div className={styles.importBtnWrap}>
            <button 
              className={styles.importBtn} 
              onClick={handleImport} 
              disabled={loading || !file || preview.length === 0}
            >
              
              {loading ? `PROSES ${importProgress}%` : 'PROSES & VALIDASI'}
            </button>
          </div>

          {loading && (
            <div className={styles.progressBarWrapper}>
              <div className={styles.progressBarTrack}>
                <div 
                  className={styles.progressBarFill} 
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <div className={styles.progressBarText}>
                <span>{importProgress}%</span>
                <span>{totalItems} item</span>
              </div>
            </div>
          )}

          <div className={styles.importStatus}>
            <div className={styles.statusItem}>
              <div className={`${styles.statusDot} ${styles.valid}`}></div>
              <div>
                <span>Format benar</span>
                <small>{file ? '✓' : '—'}</small>
              </div>
            </div>
            <div className={styles.statusItem}>
              <div className={`${styles.statusDot} ${file ? styles.valid : styles.warning}`}></div>
              <div>
                <span>Validasi data</span>
                <small>{file ? `${totalItems} item` : '—'}</small>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Preview Table */}
        <div className={styles.importPreview}>
          <div className={styles.previewHeader}>
            <div className={styles.previewLabel}>
             
              PREVIEW {preview.length} 
            </div>
            <button className={styles.previewClear} onClick={handleClear}>
              
              BATAL
            </button>
          </div>

          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama Barang</th>
                  <th>Kategori</th>
                  <th>Warna</th>
                  <th>Size</th>
                  <th className={styles.textRight}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {preview.length > 0 ? (
                  preview.map((item, i) => (
                    <tr key={i}>
                      <td className={styles.fontMono}>{item.sku || '-'}</td>
                      <td>{item.nama_barang || '-'}</td>
                      <td>{item.kategori || '-'}</td>
                      <td>{item.warna || '-'}</td>
                      <td>
                        <span className={styles.sizeBadge}>{item.size || 'OS'}</span>
                      </td>
                      <td className={`${styles.textRight} ${styles.fontMono}`}>
                        {item.stock_sistem || 0}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.emptyState}>
                      
                      <p>{file ? '⏳ Memproses data...' : 'Belum ada data di-preview'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.previewFooter}>
            <div className={styles.previewValid}>
              <div className={`${styles.previewDot} ${file ? styles.valid : ''}`}></div>
              <span>{file ? `${totalItems} baris valid` : 'Belum ada file'}</span>
            </div>
            <button 
              className={`${styles.previewImport} ${hasData ? styles.active : ''}`}
              onClick={handleImport}
              disabled={!hasData || loading}
            >
              
              {loading ? 'IMPORTING...' : 'IMPORT KE DATABASE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}