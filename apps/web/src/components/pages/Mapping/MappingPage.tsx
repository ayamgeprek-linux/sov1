// apps/web/src/components/pages/Mapping/MappingPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './MappingPage.module.css'
import { Html5Qrcode } from 'html5-qrcode'

interface MappingPageProps {
  products: any[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

const READER_ELEMENT_ID = 'barcode-reader'

export function MappingPage({ products, navigateTo, showToast }: MappingPageProps) {
  const { token } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  // Grup SKU yang lagi nunggu dipilih size-nya (kalau SKU punya >1 size)
  const [pendingSizeGroup, setPendingSizeGroup] = useState<any | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanMode, setScanMode] = useState<'search' | 'camera'>('search')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mappedCount, setMappedCount] = useState(0)
  const [unmappedCount, setUnmappedCount] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const html5QrCodeRef = useRef<any>(null)
  const readerRef = useRef<HTMLDivElement>(null)
  const isSavingRef = useRef(false)

  // ============================================================
  // AMBIL DATA
  // ============================================================
  const fetchUnmapped = useCallback(async () => {
    try {
      const result = await api.get<{ success: boolean; data: any[]; total: number }>(
        `/api/mapping/unmapped?limit=5`,
        token || undefined
      )
      if (result?.success) {
        setUnmappedCount(result.total || 0)
      }
    } catch (error) {
      console.error('[Mapping] Fetch unmapped error:', error)
    }
  }, [token])

  const fetchMapped = useCallback(async () => {
    try {
      const result = await api.get<{ success: boolean; total: number }>(
        `/api/mapping/mapped?limit=1`,
        token || undefined
      )
      if (result?.success) {
        setMappedCount(result.total || 0)
      }
    } catch (error) {
      console.error('[Mapping] Fetch mapped error:', error)
    }
  }, [token])

  useEffect(() => {
    fetchUnmapped()
    fetchMapped()
  }, [fetchUnmapped, fetchMapped])

  // ============================================================
  // SEARCH
  // ============================================================
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setScanMode('search')
    setPendingSizeGroup(null)

    if (value.length < 2) {
      setShowSuggestions(false)
      setSuggestions([])
      return
    }

    const matches = products.filter((p: any) =>
      p.nama_barang.toLowerCase().includes(value.toLowerCase()) ||
      p.sku.toLowerCase().includes(value.toLowerCase())
    )

    const grouped = matches.reduce((acc: any, curr: any) => {
      if (!acc[curr.sku]) {
        acc[curr.sku] = {
          sku: curr.sku,
          nama_barang: curr.nama_barang,
          kategori: curr.kategori,
          warna: curr.warna,
          sizes: []
        }
      }
      acc[curr.sku].sizes.push({
        size: curr.size || 'OS',
        stock_sistem: curr.stock_sistem || 0,
        status_mapping: curr.status_mapping || false
      })
      return acc
    }, {})

    setSuggestions(Object.values(grouped))
    setShowSuggestions(true)
  }

  // Klik hasil pencarian: kalau SKU cuma punya 1 size, langsung lanjut.
  // Kalau lebih dari 1 size, tampilkan panel pilih size dulu — karena
  // barcode beda-beda tiap size, jadi harus jelas size mana yang dipilih.
  const selectProduct = (group: any) => {
    if (group.sizes.length === 1) {
      finalizeSelection(group.sku, group.sizes[0].size)
    } else {
      setPendingSizeGroup(group)
      setShowSuggestions(false)
      setSearchTerm('')
    }
  }

  const finalizeSelection = (sku: string, size: string) => {
    const fullProduct = products.find((p: any) =>
      p.sku === sku && p.size === size
    )

    if (fullProduct) {
      setSelectedProduct(fullProduct)
      setPendingSizeGroup(null)
      setBarcodeInput('')
      setDetectedBarcode(null)
      setShowSuggestions(false)
      setSearchTerm('')

      setTimeout(() => {
        const barcodeInputEl = document.getElementById('barcode-input') as HTMLInputElement
        if (barcodeInputEl) barcodeInputEl.focus()
      }, 300)
    } else {
      showToast('❌ Produk dengan size tersebut tidak ditemukan')
    }
  }

  const cancelSizePicker = () => {
    setPendingSizeGroup(null)
  }

  // ============================================================
  // SAVE MAPPING
  // ============================================================
  const handleSaveMapping = useCallback(async () => {
    if (isSavingRef.current) return
    if (!selectedProduct) {
      showToast('⚠️ Pilih produk dulu!')
      return
    }

    const barcode = barcodeInput.trim()
    if (!barcode || barcode.length < 4) {
      showToast('⚠️ Masukkan barcode minimal 4 digit')
      return
    }

    isSavingRef.current = true
    setLoading(true)
    try {
      const result = await api.post<{ success: boolean; data?: any; error?: string }>(
        '/api/mapping',
        {
          sku: selectedProduct.sku,
          size: selectedProduct.size,
          barcode: barcode
        },
        token || undefined
      )

      if (result?.success) {
        showToast(`✅ ${barcode} → ${selectedProduct.nama_barang} (${selectedProduct.size})`)
        setSelectedProduct(null)
        setBarcodeInput('')
        setDetectedBarcode(null)
        fetchUnmapped()
        fetchMapped()
        if (scanMode === 'camera') {
          await stopCamera()
        }
        if (inputRef.current) {
          inputRef.current.focus()
        }
      } else {
        showToast(`❌ ${result?.error || 'Gagal mapping'}`)
      }
    } catch (error) {
      console.error('[Mapping] Save error:', error)
      showToast('❌ Gagal mapping: ' + (error as Error).message)
    } finally {
      setLoading(false)
      isSavingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, barcodeInput, token, scanMode])

  // ============================================================
  // 🔥 CAMERA SCAN
  // ============================================================
  const startCamera = async () => {
    try {
      setScanMode('camera')
      setCameraError(null)
      setDetectedBarcode(null)

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
        } catch (e) {}
        html5QrCodeRef.current = null
      }

      await new Promise(resolve => setTimeout(resolve, 250))

      const readerElement = document.getElementById(READER_ELEMENT_ID)
      if (!readerElement) {
        console.error('[Camera] Reader element not found')
        setCameraError('Elemen reader tidak ditemukan, coba refresh halaman')
        showToast('❌ Elemen reader tidak ditemukan')
        setScanMode('search')
        return
      }

      readerElement.innerHTML = ''

      if (typeof Html5Qrcode !== 'function') {
        console.error('[Camera] Html5Qrcode not a constructor')
        setCameraError('Library barcode gagal dimuat')
        showToast('❌ Library barcode gagal dimuat')
        setScanMode('search')
        return
      }

      html5QrCodeRef.current = new Html5Qrcode(READER_ELEMENT_ID)

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.777
        },
        (decodedText: string) => {
          console.log('[Barcode] Detected:', decodedText)
          setDetectedBarcode(decodedText)
          setBarcodeInput(decodedText)
          showToast(`📷 Barcode: ${decodedText}`)

          if (selectedProduct && !isSavingRef.current) {
            setTimeout(() => {
              handleSaveMapping()
            }, 1000)
          }
        },
        () => {}
      )

      showToast('📷 Kamera aktif, arahkan ke barcode')

    } catch (error) {
      console.error('[Camera] Error:', error)
      const errorMsg = (error as Error).message || 'Unknown error'
      setCameraError('Gagal akses kamera: ' + errorMsg)
      showToast('❌ Gagal akses kamera: ' + errorMsg)
      setScanMode('search')
    }
  }

  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState?.()
        if (state === undefined || state === 2 /* SCANNING */) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear?.()
        html5QrCodeRef.current = null
      }
      const readerElement = document.getElementById(READER_ELEMENT_ID)
      if (readerElement) {
        readerElement.innerHTML = ''
      }
    } catch (error) {
      console.error('[Camera] Stop error:', error)
    }
    setScanMode('search')
    setDetectedBarcode(null)
    showToast('📷 Kamera dimatikan')
  }

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
      const readerElement = document.getElementById(READER_ELEMENT_ID)
      if (readerElement) {
        readerElement.innerHTML = ''
      }
    }
  }, [])

  // ============================================================
  // STATS
  // ============================================================
  const totalProducts = products.length
  const mappedPercentage = totalProducts > 0 ? Math.round((mappedCount / totalProducts) * 100) : 0

  return (
    <div className={styles.mappingPage}>
      {/* HEADER */}
      <div className={styles.mappingHeader}>
        <div>
          <h1 className={styles.mappingTitle}>🔗 Mapping Barcode</h1>
          <p className={styles.mappingSubtitle}>Scan barcode atau cari produk untuk mapping</p>
        </div>
        <div className={styles.mappingStats}>
          <div className={styles.mappingStatItem}>
            <span className={styles.mappingStatLabel}>Total Produk</span>
            <span className={styles.mappingStatValue}>{totalProducts}</span>
          </div>
          <div className={styles.mappingStatItem}>
            <span className={styles.mappingStatLabel}>Sudah Mapping</span>
            <span className={`${styles.mappingStatValue} ${styles.textGreen}`}>{mappedCount}</span>
          </div>
          <div className={styles.mappingStatItem}>
            <span className={styles.mappingStatLabel}>Belum Mapping</span>
            <span className={`${styles.mappingStatValue} ${styles.textOrange}`}>{unmappedCount}</span>
          </div>
          <div className={styles.mappingStatItem}>
            <span className={styles.mappingStatLabel}>Progress</span>
            <span className={styles.mappingStatValue}>{mappedPercentage}%</span>
          </div>
        </div>
      </div>

      {/* MODE TOGGLE */}
      <div className={styles.mappingModeToggle}>
        <button
          className={`${styles.modeBtn} ${scanMode === 'search' ? styles.active : ''}`}
          onClick={() => {
            if (scanMode === 'camera') stopCamera()
            setScanMode('search')
          }}
        >
          <span className="material-symbols-outlined">search</span>
          Search
        </button>
        <button
          className={`${styles.modeBtn} ${scanMode === 'camera' ? styles.active : ''}`}
          onClick={scanMode === 'camera' ? stopCamera : startCamera}
        >
          <span className="material-symbols-outlined">qr_code_scanner</span>
          {scanMode === 'camera' ? 'Stop Camera' : 'Scan Barcode'}
        </button>
      </div>

      {/* CAMERA VIEW */}
      {scanMode === 'camera' && (
        <div className={styles.cameraContainer}>
          <div ref={readerRef} id={READER_ELEMENT_ID} className={styles.cameraReader}></div>
          <div className={styles.cameraOverlay}>
            <div className={styles.cameraFrame}>
              <span className={styles.cornerTL}></span>
              <span className={styles.cornerTR}></span>
              <span className={styles.cornerBL}></span>
              <span className={styles.cornerBR}></span>
              <span className={styles.scanLine}></span>
            </div>
            <p className={styles.cameraHint}>
              {detectedBarcode ? (
                <>✅ {detectedBarcode}</>
              ) : (
                <>Arahkan barcode ke kamera</>
              )}
            </p>
            {cameraError && (
              <p className={styles.cameraError}>{cameraError}</p>
            )}
          </div>
        </div>
      )}

      {/* SEARCH */}
      {scanMode === 'search' && (
        <div className={styles.mappingSearch}>
          <input
            ref={inputRef}
            type="text"
            placeholder="🔍 Cari SKU / Nama..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className={styles.mappingSearchInput}
          />
          {selectedProduct && (
            <button
              className={styles.mappingClearBtn}
              onClick={() => {
                setSelectedProduct(null)
                setBarcodeInput('')
                setDetectedBarcode(null)
                if (inputRef.current) inputRef.current.focus()
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* SUGGESTIONS */}
      {showSuggestions && suggestions.length > 0 && !selectedProduct && !pendingSizeGroup && scanMode === 'search' && (
        <div className={styles.mappingSuggestions}>
          {suggestions.map((group: any, idx: number) => {
            const allMapped = group.sizes.every((s: any) => s.status_mapping)
            return (
              <div
                key={idx}
                className={`${styles.mappingSuggestionItem} ${allMapped ? styles.allMapped : ''}`}
                onClick={() => selectProduct(group)}
              >
                <div className={styles.suggestionLeft}>
                  <div className={styles.suggestionSku}>{group.sku}</div>
                  <div className={styles.suggestionName}>{group.nama_barang}</div>
                  <div className={styles.suggestionInfo}>
                    <span>{group.kategori}</span>
                    <span>•</span>
                    <span>{group.warna}</span>
                  </div>
                </div>
                <div className={styles.suggestionRight}>
                  <div className={styles.suggestionSizes}>
                    {group.sizes.map((s: any) => (
                      <span
                        key={s.size}
                        className={`${styles.sizeChip} ${s.status_mapping ? styles.mapped : styles.unmapped}`}
                      >
                        {s.size}
                        {s.status_mapping ? '✅' : '⏳'}
                      </span>
                    ))}
                  </div>
                  <div className={styles.suggestionStatus}>
                    {allMapped ? '✅ Selesai' : '⏳ Proses'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PILIH SIZE — muncul kalau SKU yang dipilih punya lebih dari 1 size */}
      {pendingSizeGroup && scanMode === 'search' && (
        <div className={styles.sizePickerPanel}>
          <div className={styles.sizePickerHeader}>
            <div>
              <div className={styles.mappingDetailSku}>{pendingSizeGroup.sku}</div>
              <div className={styles.mappingDetailName}>{pendingSizeGroup.nama_barang}</div>
              <div className={styles.mappingDetailInfo}>
                <span>{pendingSizeGroup.kategori}</span>
                <span>•</span>
                <span>{pendingSizeGroup.warna}</span>
              </div>
            </div>
            <button className={styles.mappingClearBtn} onClick={cancelSizePicker}>✕</button>
          </div>

          <div className={styles.sizePickerLabel}>Pilih size (barcode beda tiap size)</div>
          <div className={styles.sizePickerGrid}>
            {pendingSizeGroup.sizes.map((s: any) => (
              <button
                key={s.size}
                className={`${styles.sizePickerChip} ${s.status_mapping ? styles.sizePickerChipMapped : ''}`}
                onClick={() => finalizeSelection(pendingSizeGroup.sku, s.size)}
              >
                <span className={styles.sizePickerChipSize}>{s.size}</span>
                <span className={styles.sizePickerChipStatus}>
                  {s.status_mapping ? '✅ Sudah' : '⏳ Belum'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SELECTED PRODUCT */}
      {selectedProduct && (
        <div className={styles.mappingDetail}>
          <div className={styles.mappingDetailHeader}>
            <div>
              <div className={styles.mappingDetailSku}>{selectedProduct.sku}</div>
              <div className={styles.mappingDetailName}>{selectedProduct.nama_barang}</div>
              <div className={styles.mappingDetailInfo}>
                <span>{selectedProduct.kategori}</span>
                <span>•</span>
                <span>{selectedProduct.warna}</span>
                <span className={styles.detailSize}>{selectedProduct.size}</span>
              </div>
            </div>
          </div>

          <div className={styles.mappingBarcodeInput}>
            <label>Scan / Masukkan Barcode</label>
            <div className={styles.barcodeInputWrapper}>
              <input
                id="barcode-input"
                type="text"
                placeholder="Scan atau ketik barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveMapping()
                }}
                className={styles.barcodeInput}
                autoFocus
              />
              <button
                className={styles.barcodeScanBtn}
                onClick={startCamera}
                title="Scan dengan kamera"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </button>
            </div>
            {detectedBarcode && (
              <div className={styles.detectedBarcode}>
                ✅ Barcode terdeteksi: <strong>{detectedBarcode}</strong>
              </div>
            )}
          </div>

          <div className={styles.mappingActions}>
            <button
              className={styles.mappingSaveBtn}
              onClick={handleSaveMapping}
              disabled={loading || !barcodeInput.trim()}
            >
              {loading ? '⏳ ...' : '💾 Simpan Mapping'}
            </button>
            <button
              className={styles.mappingCancelBtn}
              onClick={() => {
                setSelectedProduct(null)
                setBarcodeInput('')
                setDetectedBarcode(null)
                if (scanMode === 'camera') stopCamera()
                if (inputRef.current) inputRef.current.focus()
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!selectedProduct && !pendingSizeGroup && !showSuggestions && scanMode === 'search' && (
        <div className={styles.mappingEmpty}>
          <div className={styles.mappingEmptyIcon}>
            <span className="material-symbols-outlined">qr_code_2</span>
          </div>
          <div className={styles.mappingEmptyText}>
            {totalProducts === 0 ? '📂 Import data master dulu' : 'Cari produk atau scan barcode'}
          </div>
          {totalProducts > 0 && (
            <div className={styles.mappingEmptyTip}>
              <span className="material-symbols-outlined">tips_and_updates</span>
              <span>Tips: ketik SKU atau nama, lalu scan barcode fisik</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}