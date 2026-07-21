// apps/web/src/components/pages/Opname/OpnamePage.tsx
import { useState, useEffect, useRef } from 'react'
import { useProducts } from '../../../hooks/useProducts'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './OpnamePage.module.css'
import { Html5Qrcode } from 'html5-qrcode'

interface OpnamePageProps {
  products: any[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
  refreshProducts: () => void
}

const READER_ELEMENT_ID = 'barcode-reader'

// ============================================================
// RAK / LOKASI PRESET
// ============================================================
const RAK_PRESETS = [
  'A1', 'A2', 'A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4', 'C5',
  'D1', 'D2', 'D3', 'D4', 'D5',
]

export function OpnamePage({ 
  products, 
  navigateTo, 
  showToast,
  refreshProducts
}: OpnamePageProps) {
  const { token } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [qtyFisik, setQtyFisik] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const { saveOpname } = useProducts()
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentSize, setCurrentSize] = useState('')
  
  const [showAddSizeModal, setShowAddSizeModal] = useState(false)
  const [newSize, setNewSize] = useState('')
  const [newSizeQty, setNewSizeQty] = useState('')

  // ===== CAMERA SCAN STATE =====
  const [showCamera, setShowCamera] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)
  const [scanLookupLoading, setScanLookupLoading] = useState(false)
  const html5QrCodeRef = useRef<any>(null)
  const isLookingUpRef = useRef(false)
  const isSavingRef = useRef(false)
  const [isAutoSave, setIsAutoSave] = useState(false)

  // ===== RAK STATE =====
  const [lokasiRak, setLokasiRak] = useState('')
  const [isSavingRak, setIsSavingRak] = useState(false)
  const [customRak, setCustomRak] = useState('')

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // 🔥 AUTO SAVE HANYA DARI SCAN
  useEffect(() => {
    if (selectedProduct && !loading && isAutoSave) {
      const autoSave = async () => {
        const qty = parseInt(qtyFisik) || 1
        if (qty >= 0) {
          await handleSave()
        }
      }
      
      const timer = setTimeout(() => {
        autoSave()
      }, 800)
      
      return () => clearTimeout(timer)
    }
  }, [selectedProduct, qtyFisik, isAutoSave])

  useEffect(() => {
    if (selectedProduct) {
      const qty = selectedProduct.qty_fisik || 1
      setQtyFisik(qty.toString())
      setCurrentSize(selectedProduct.size)
      setLokasiRak(selectedProduct.lokasi_rak || '')
    }
  }, [selectedProduct])

  useEffect(() => {
    if (selectedProduct) {
      const latestProduct = products.find(
        (p: any) => p.sku === selectedProduct.sku && p.size === selectedProduct.size
      )
      
      if (latestProduct) {
        const updatedAllSizes = selectedProduct.allSizes.map((s: any) => {
          const latest = products.find(
            (p: any) => p.sku === selectedProduct.sku && p.size === s.size
          )
          if (latest) {
            return {
              ...s,
              qty_fisik: latest.qty_fisik,
              isDone: latest.qty_fisik !== null && latest.qty_fisik !== undefined
            }
          }
          return s
        })

        setSelectedProduct({
          ...latestProduct,
          allSizes: updatedAllSizes
        })
      }
    }
  }, [products])

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

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setIsAutoSave(false)
    
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
        qty_fisik: curr.qty_fisik,
        status_mapping: curr.status_mapping || false,
        isDone: curr.qty_fisik !== null && curr.qty_fisik !== undefined,
        lokasi_rak: curr.lokasi_rak || ''
      })
      return acc
    }, {})

    setSuggestions(Object.values(grouped))
    setShowSuggestions(true)
  }

  const selectProduct = (group: any) => {
    setIsAutoSave(false)
    
    const sortedSizes = [...group.sizes].sort((a: any, b: any) => {
      if (!a.isDone && b.isDone) return -1
      if (a.isDone && !b.isDone) return 1
      if (a.stock_sistem > 0 && b.stock_sistem === 0) return -1
      if (a.stock_sistem === 0 && b.stock_sistem > 0) return 1
      return a.size.localeCompare(b.size)
    })

    const firstSize = sortedSizes[0]
    const fullProduct = products.find((p: any) => 
      p.sku === group.sku && p.size === firstSize.size
    )

    if (fullProduct) {
      const allSizesWithData = group.sizes.map((s: any) => {
        const productData = products.find((p: any) => 
          p.sku === group.sku && p.size === s.size
        )
        return {
          ...s,
          qty_fisik: productData?.qty_fisik || 0,
          isDone: productData?.qty_fisik !== null && productData?.qty_fisik !== undefined,
          lokasi_rak: productData?.lokasi_rak || ''
        }
      })

      setSelectedProduct({
        ...fullProduct,
        allSizes: allSizesWithData,
        lokasi_rak: fullProduct.lokasi_rak || ''
      })
      setQtyFisik(fullProduct.qty_fisik?.toString() || '1')
      setCurrentSize(fullProduct.size)
      setLokasiRak(fullProduct.lokasi_rak || '')
      setShowSuggestions(false)
      setSearchTerm('')
    }
  }

  const selectProductBySkuSize = (sku: string, size: string): boolean => {
    setIsAutoSave(true)
    
    const matchedProduct = products.find((p: any) => p.sku === sku && p.size === size)
    
    if (!matchedProduct) {
      showToast('⚠️ Produk tidak ditemukan')
      return false
    }

    const allSizesWithData = products
      .filter((p: any) => p.sku === sku)
      .map((p: any) => ({
        size: p.size || 'OS',
        stock_sistem: p.stock_sistem || 0,
        qty_fisik: p.qty_fisik,
        status_mapping: p.status_mapping || false,
        isDone: p.qty_fisik !== null && p.qty_fisik !== undefined,
        lokasi_rak: p.lokasi_rak || ''
      }))

    setSelectedProduct({
      ...matchedProduct,
      allSizes: allSizesWithData,
      lokasi_rak: matchedProduct.lokasi_rak || ''
    })

    setQtyFisik(
      matchedProduct.qty_fisik !== null && matchedProduct.qty_fisik !== undefined
        ? matchedProduct.qty_fisik.toString()
        : '1'
    )
    setCurrentSize(matchedProduct.size)
    setLokasiRak(matchedProduct.lokasi_rak || '')
    setShowSuggestions(false)
    setSearchTerm('')

    showToast(`✅ ${matchedProduct.nama_barang} (${matchedProduct.size})`)
    return true
  }

  const handleSizeChange = (size: string) => {
    const sizeData = selectedProduct?.allSizes?.find((s: any) => s.size === size)
    if (!sizeData) return

    setSelectedProduct({
      ...selectedProduct,
      size: sizeData.size,
      stock_sistem: sizeData.stock_sistem,
      qty_fisik: sizeData.qty_fisik,
      status_mapping: sizeData.status_mapping,
      lokasi_rak: sizeData.lokasi_rak || ''
    })
    setQtyFisik(sizeData.isDone ? (sizeData.qty_fisik ?? 0).toString() : '1')
    setCurrentSize(size)
    setLokasiRak(sizeData.lokasi_rak || '')
  }

  const handleSave = async () => {
    if (!selectedProduct || isSavingRef.current) return

    const qty = parseInt(qtyFisik) || 1
    if (qty < 0) return

    isSavingRef.current = true
    setLoading(true)
    try {
      const result = await saveOpname(selectedProduct.sku, selectedProduct.size, qty)
      if (result) {
        const selisih = qty - (selectedProduct.stock_sistem || 0)
        let statusMsg = ''
        if (selisih === 0) statusMsg = 'Sesuai'
        else if (selisih < 0) statusMsg = `Minus ${Math.abs(selisih)}`
        else statusMsg = `Plus ${selisih}`
        
        showToast(`✅ ${selectedProduct.sku} - ${selectedProduct.size}: ${statusMsg}`)
        
        const updatedAllSizes = selectedProduct.allSizes.map((s: any) => {
          if (s.size === selectedProduct.size) {
            return {
              ...s,
              qty_fisik: qty,
              isDone: true,
              lokasi_rak: lokasiRak || s.lokasi_rak || ''
            }
          }
          return s
        })

        setSelectedProduct({
          ...selectedProduct,
          qty_fisik: qty,
          allSizes: updatedAllSizes,
          lokasi_rak: lokasiRak || selectedProduct.lokasi_rak || ''
        })
        
        // 🔥 SAVE RAK ke database
        if (lokasiRak && lokasiRak !== selectedProduct.lokasi_rak) {
          await handleSaveRak(selectedProduct.sku, selectedProduct.size, lokasiRak)
        }
        
        if (typeof refreshProducts === 'function') {
          await refreshProducts()
        }
        
        setTimeout(() => {
          setSelectedProduct(null)
          setQtyFisik('')
          setCurrentSize('')
          setIsAutoSave(false)
          setLokasiRak('')
          if (inputRef.current) {
            inputRef.current.focus()
          }
        }, 500)
      }
    } catch (error) {
      showToast('❌ Gagal: ' + (error as Error).message)
    } finally {
      setLoading(false)
      isSavingRef.current = false
    }
  }

  // ============================================================
  // 🔥 SAVE RAK / LOKASI
  // ============================================================
  const handleSaveRak = async (sku: string, size: string, rak: string) => {
    if (!rak || rak.trim() === '') return
    
    setIsSavingRak(true)
    try {
      const result = await api.post<{ success: boolean; error?: string }>(
        '/api/opname/update-rak',
        { sku, size, lokasi_rak: rak },
        token || undefined
      )
      
      if (result.success) {
        showToast(`📍 Rak ${rak} disimpan`)
      } else {
        showToast(`⚠️ Gagal simpan rak: ${result.error}`)
      }
    } catch (error) {
      console.error('[Rak] Error:', error)
    } finally {
      setIsSavingRak(false)
    }
  }

  // ============================================================
  // 🔥 QTY + / - HANDLER
  // ============================================================
  const handleQtyIncrement = () => {
    const current = parseInt(qtyFisik) || 0
    setQtyFisik((current + 1).toString())
  }

  const handleQtyDecrement = () => {
    const current = parseInt(qtyFisik) || 0
    if (current > 0) {
      setQtyFisik((current - 1).toString())
    }
  }

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d+$/.test(value)) {
      setQtyFisik(value)
    }
  }

  // ============================================================
  // 🔥 RAK HANDLER
  // ============================================================
  const handleRakSelect = (rak: string) => {
    setLokasiRak(rak)
    setCustomRak('')
  }

  const handleCustomRakChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setCustomRak(value)
    setLokasiRak(value)
  }

  // ============================================================
  // 🔥 START CAMERA
  // ============================================================
  const startCamera = async () => {
    try {
      setShowCamera(true)
      setShowSuggestions(false)
      setCameraError(null)
      setDetectedBarcode(null)
      isLookingUpRef.current = false

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
        } catch (e) {}
        html5QrCodeRef.current = null
      }

      await new Promise(resolve => setTimeout(resolve, 250))

      const readerElement = document.getElementById(READER_ELEMENT_ID)
      
      if (!readerElement) {
        setCameraError('Elemen reader tidak ditemukan')
        showToast('❌ Elemen reader tidak ditemukan')
        setShowCamera(false)
        return
      }

      readerElement.innerHTML = ''

      if (typeof Html5Qrcode !== 'function') {
        setCameraError('Library barcode gagal dimuat')
        showToast('❌ Library barcode gagal dimuat')
        setShowCamera(false)
        return
      }

      html5QrCodeRef.current = new Html5Qrcode(READER_ELEMENT_ID, {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      } as any)

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 30,
          qrbox: { width: 400, height: 100 },
          aspectRatio: 1.777
        },
        (decodedText: string) => {
          console.log('[Opname] 🎯 BARCODE DETECTED:', decodedText)
          setDetectedBarcode(decodedText)
          handleBarcodeDetected(decodedText)
        },
        () => {}
      )

      showToast('📷 Arahkan ke barcode')

    } catch (error) {
      console.error('[Opname] Error:', error)
      setCameraError('Gagal akses kamera')
      showToast('❌ Gagal akses kamera')
      setShowCamera(false)
    }
  }

  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      }
      const readerElement = document.getElementById(READER_ELEMENT_ID)
      if (readerElement) {
        readerElement.innerHTML = ''
      }
    } catch (error) {
      console.error('[Opname] Stop error:', error)
    }
    setShowCamera(false)
    setDetectedBarcode(null)
    setCameraError(null)
  }

  const handleBarcodeDetected = async (barcode: string) => {
    if (isLookingUpRef.current) return
    
    const trimmed = barcode.trim()
    if (!trimmed) return

    isLookingUpRef.current = true
    setDetectedBarcode(trimmed)
    setScanLookupLoading(true)

    try {
      const result = await api.get<{ success: boolean; data?: any; error?: string }>(
        `/api/mapping/barcode/${trimmed}`,
        token || undefined
      )

      if (result?.success && result.data) {
        const { sku, size, lokasi } = result.data
        
        const allSizes = products.filter((p: any) => p.sku === sku)
        const sizeExists = allSizes.some((p: any) => p.size === size)
        
        if (!sizeExists) {
          showToast(`⚠️ Size ${size} tidak ditemukan di master`)
          setTimeout(() => { isLookingUpRef.current = false }, 1200)
          return
        }
        
        if (lokasi) {
          showToast(`📦 ${sku} - ${size} (Rak ${lokasi})`)
        }
        
        const found = selectProductBySkuSize(sku, size)

        if (found) {
          showToast(`📷 ${sku} - ${size} ditemukan`)
          await stopCamera()
        }
      } else {
        // 🔥 BARCODE BELUM DI-MAP
        await stopCamera()
        showToast(`⚠️ Barcode ${trimmed} belum di-map! Cari produk manual.`)
        setTimeout(() => { isLookingUpRef.current = false }, 500)
      }
    } catch (error) {
      console.error('[Opname] Error:', error)
      showToast('❌ Gagal mencari barcode')
      setTimeout(() => { isLookingUpRef.current = false }, 1200)
    } finally {
      setScanLookupLoading(false)
    }
  }

  const handleFinish = () => {
    setSelectedProduct(null)
    setQtyFisik('')
    setCurrentSize('')
    setShowSuggestions(false)
    setSearchTerm('')
    setShowAddSizeModal(false)
    setNewSize('')
    setNewSizeQty('')
    setIsAutoSave(false)
    setLokasiRak('')
    setCustomRak('')
    
    if (showCamera) {
      stopCamera()
    }

    if (inputRef.current) {
      inputRef.current.focus()
    }
    
    if (typeof refreshProducts === 'function') {
      refreshProducts()
    }
    
    showToast('🔍 Siap cari barang lagi')
  }

  const getSelisih = (s: any) => {
    return (s.qty_fisik || 0) - (s.stock_sistem || 0)
  }

  const getStatusClass = (s: any) => {
    if (!s.isDone) return styles.sizePending
    const selisih = getSelisih(s)
    if (selisih === 0) return styles.sizeMatch
    if (selisih < 0) return styles.sizeLess
    return styles.sizeMore
  }

  const getStatusText = (s: any) => {
    if (!s.isDone) return '⏳'
    const selisih = getSelisih(s)
    if (selisih === 0) return '✓'
    if (selisih < 0) return `${selisih}`
    return `+${selisih}`
  }

  const getStatusTitle = (s: any) => {
    if (!s.isDone) return `Size ${s.size}: Belum`
    const selisih = getSelisih(s)
    if (selisih === 0) return `Size ${s.size}: Sesuai`
    if (selisih < 0) return `Size ${s.size}: Kurang ${Math.abs(selisih)}`
    return `Size ${s.size}: Lebih ${selisih}`
  }

  const isDisplay = (sizes: any[]) => {
    return sizes.length === 1
  }

  const handleAddNewSize = async () => {
    if (!selectedProduct) {
      showToast('⚠️ Pilih barang dulu!')
      return
    }
    
    const qty = parseInt(newSizeQty)
    if (isNaN(qty) || qty < 0) {
      showToast('⚠️ Input jumlah yang bener!')
      return
    }
    
    if (!newSize || newSize.trim() === '') {
      showToast('⚠️ Masukkan size!')
      return
    }
    
    const existing = selectedProduct.allSizes.find(
      (s: any) => s.size === newSize.toUpperCase()
    )
    
    if (existing) {
      showToast(`⚠️ Size ${newSize.toUpperCase()} udah ada!`)
      return
    }
    
    setLoading(true)
    try {
      const result = await api.post<{ success: boolean; data?: any; error?: string }>(
        '/api/opname/size',
        {
          sku: selectedProduct.sku,
          size: newSize.toUpperCase(),
          qty_fisik: qty,
          nama_barang: selectedProduct.nama_barang,
          kategori: selectedProduct.kategori || 'UNKNOWN',
          warna: selectedProduct.warna || 'N/A',
          lokasi_rak: lokasiRak || ''
        },
        token || undefined
      )
      
      if (result.success) {
        showToast(`✅ Size ${newSize.toUpperCase()} (${qty}) ditambahkan!`)
        
        const newSizeData = {
          size: newSize.toUpperCase(),
          stock_sistem: 0,
          qty_fisik: qty,
          status_mapping: selectedProduct.status_mapping || false,
          isDone: true,
          lokasi_rak: lokasiRak || ''
        }
        
        setSelectedProduct({
          ...selectedProduct,
          allSizes: [...selectedProduct.allSizes, newSizeData]
        })
        
        if (typeof refreshProducts === 'function') {
          await refreshProducts()
        }
        
        setShowAddSizeModal(false)
        setNewSize('')
        setNewSizeQty('')
      } else {
        showToast(`❌ ${result.error || 'Gagal tambah size'}`)
      }
    } catch (error) {
      console.error('Error adding size:', error)
      showToast('❌ Gagal tambah size: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedProduct(null)
    setQtyFisik('')
    setCurrentSize('')
    setShowAddSizeModal(false)
    setNewSize('')
    setNewSizeQty('')
    setIsAutoSave(false)
    setLokasiRak('')
    setCustomRak('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className={styles.opnamePage}>
      <div className={styles.opnameContainer}>
        {/* HEADER */}
        <div className={styles.opnameHeader}>
          <button className={styles.opnameBack} onClick={() => navigateTo('dashboard')}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className={styles.opnameHeaderCenter}>
            <span className={styles.opnameBadge}>OPNAME</span>
          </div>
          <div className={styles.opnamePutaran}>
            <div className={styles.opnamePutaranNumber}>
              {products.filter((p: any) => p.qty_fisik !== null && p.qty_fisik !== undefined).length}
            </div>
            <div className={styles.opnamePutaranLabel}>DONE</div>
          </div>
        </div>

        {/* BODY */}
        <div className={styles.opnameBody}>
          {/* SEARCH + SCAN */}
          <div className={styles.opnameSearch}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari SKU / Nama..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              disabled={!!selectedProduct || showCamera}
              className={selectedProduct || showCamera ? styles.disabled : ''}
            />
            <button 
              className={styles.opnameScanBtn} 
              onClick={showCamera ? stopCamera : startCamera}
              disabled={!!selectedProduct}
            >
              <span className="material-symbols-outlined">
                {showCamera ? 'close' : 'qr_code_scanner'}
              </span>
              <span>{showCamera ? 'STOP' : 'SCAN'}</span>
            </button>
          </div>

          {/* CAMERA */}
          {showCamera && (
            <div className={styles.opnameCameraContainer}>
              <div id={READER_ELEMENT_ID} className={styles.opnameCameraReader}></div>
              <div className={styles.opnameCameraOverlay}>
                <div className={styles.opnameCameraFrame}>
                  <span className={styles.opnameCornerTL}></span>
                  <span className={styles.opnameCornerTR}></span>
                  <span className={styles.opnameCornerBL}></span>
                  <span className={styles.opnameCornerBR}></span>
                  <span className={styles.opnameScanLine}></span>
                </div>
                <p className={styles.opnameCameraHint}>
                  {scanLookupLoading ? (
                    <>⏳ Mencari produk...</>
                  ) : detectedBarcode ? (
                    <>✅ {detectedBarcode}</>
                  ) : (
                    <>Arahkan barcode ke kamera</>
                  )}
                </p>
                {cameraError && (
                  <p className={styles.opnameCameraError}>{cameraError}</p>
                )}
              </div>
            </div>
          )}

          {/* SUGGESTIONS */}
          {showSuggestions && suggestions.length > 0 && !selectedProduct && !showCamera && (
            <div className={styles.opnameSuggestions}>
              {suggestions.map((group: any, idx: number) => {
                const allDone = group.sizes.every((s: any) => s.isDone)
                const isDisplayMode = isDisplay(group.sizes)
                
                return (
                  <div 
                    key={idx} 
                    className={`${styles.opnameSuggestionItem} ${allDone ? styles.allDone : ''}`}
                    onClick={() => selectProduct(group)}
                  >
                    <div className={styles.suggestionLeft}>
                      <div className={styles.suggestionSku}>{group.sku}</div>
                      <div className={styles.suggestionName}>{group.nama_barang}</div>
                      <div className={styles.suggestionInfo}>
                        <span>{group.kategori}</span>
                        <span>•</span>
                        <span>{group.warna}</span>
                        <span className={styles.suggestionBadge}>
                          {isDisplayMode ? 'Display' : 'Multi'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.suggestionRight}>
                      <div className={styles.suggestionSizes}>
                        {group.sizes.map((s: any) => (
                          <span 
                            key={s.size} 
                            className={`${styles.sizeChip} ${getStatusClass(s)}`}
                            title={getStatusTitle(s)}
                          >
                            {s.size}
                            {s.isDone && <span className={styles.sizeCheck}>{getStatusText(s)}</span>}
                          </span>
                        ))}
                      </div>
                      <div className={styles.suggestionStatus}>
                        {allDone ? 'Selesai' : 'Proses'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* DETAIL */}
          {selectedProduct && (
            <div className={styles.opnameDetail}>
              <div className={styles.opnameDetailHeader}>
                <div>
                  <div className={styles.opnameDetailSku}>{selectedProduct.sku}</div>
                  <div className={styles.opnameDetailName}>{selectedProduct.nama_barang}</div>
                  <div className={styles.opnameDetailInfo}>
                    <span>{selectedProduct.kategori}</span>
                    <span>•</span>
                    <span>{selectedProduct.warna}</span>
                    <span className={styles.detailBadge}>
                      {isDisplay(selectedProduct.allSizes) ? 'Display' : 'Gudang'}
                    </span>
                  </div>
                  {isAutoSave && (
                    <div className={styles.autoSaveBadge}>
                      <span className="material-symbols-outlined">schedule</span>
                      Auto save...
                    </div>
                  )}
                </div>
                <button className={styles.opnameDetailClose} onClick={closeDetail}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* SIZE */}
              <div className={styles.opnameDetailSizes}>
                <div className={styles.opnameDetailSizesLabel}>
                  {isDisplay(selectedProduct.allSizes) ? 'Size' : 'Pilih Size'}
                </div>
                <div className={styles.opnameDetailSizesGrid}>
                  {selectedProduct.allSizes?.map((s: any, index: number) => {
                    const isActive = currentSize === s.size
                    const isDone = s.isDone
                    const uniqueKey = `${s.size}-${index}`
                    
                    return (
                      <button
                        key={uniqueKey}
                        className={`${styles.sizeSelectBtn} ${isActive ? styles.active : ''} ${isDone ? styles.sizeDone : ''}`}
                        onClick={() => handleSizeChange(s.size)}
                      >
                        <span className={styles.sizeSelectLabel}>{s.size}</span>
                        <span className={styles.sizeSelectStock}>{s.stock_sistem}</span>
                        {isDone && (
                          <span className={`${styles.sizeSelectStatus} ${getSelisih(s) === 0 ? styles.statusMatch : getSelisih(s) < 0 ? styles.statusLess : styles.statusMore}`}>
                            {getStatusText(s)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  
                  <button 
                    className={styles.addSizeBtn}
                    onClick={() => setShowAddSizeModal(true)}
                    title="Tambah size baru"
                  >
                    <span className={styles.addSizeIcon}>+</span>
                  </button>
                </div>
                <div className={styles.sizeSummary}>
                  {selectedProduct.allSizes?.map((s: any, index: number) => {
                    const uniqueKey = `summary-${s.size}-${index}`
                    return (
                      <span key={uniqueKey} className={styles.sizeSummaryItem}>
                        <span className={styles.sizeSummaryLabel}>{s.size}</span>
                        <span className={`${styles.sizeSummaryStatus} ${s.isDone ? styles.statusMatch : styles.statusPending}`}>
                          {s.isDone ? '✅' : '⏳'}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* 🔥 QTY with + and - buttons */}
              <div className={styles.opnameDetailQty}>
                <div className={styles.opnameDetailQtyRow}>
                  <span className={styles.opnameDetailQtyLabel}>Stock Sistem</span>
                  <span className={styles.opnameDetailQtyValue}>{selectedProduct.stock_sistem}</span>
                </div>
                
                <div className={styles.opnameDetailQtyInput}>
                  <span className={styles.opnameDetailQtyLabel}>Stock Real</span>
                  <div className={styles.qtyControl}>
                    <button 
                      className={styles.qtyBtn}
                      onClick={handleQtyDecrement}
                      disabled={parseInt(qtyFisik) <= 0 || qtyFisik === ''}
                    >
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <input
                      type="text"
                      className={styles.opnameDetailQtyField}
                      value={qtyFisik}
                      onChange={handleQtyChange}
                      placeholder="0"
                    />
                    <button 
                      className={styles.qtyBtn}
                      onClick={handleQtyIncrement}
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
                
                {qtyFisik !== '' && !isNaN(parseInt(qtyFisik)) && (
                  <div className={styles.opnameDetailSelisih}>
                    <span>Selisih:</span>
                    <span className={parseInt(qtyFisik) === selectedProduct.stock_sistem ? styles.selisihOk : parseInt(qtyFisik) < selectedProduct.stock_sistem ? styles.selisihMinus : styles.selisihPlus}>
                      {parseInt(qtyFisik) - selectedProduct.stock_sistem}
                    </span>
                  </div>
                )}
              </div>

              {/* 🔥 RAK / LOKASI - FORM PILIH RAK */}
              <div className={styles.opnameDetailRak}>
                <div className={styles.opnameDetailRakLabel}>
                  <span className="material-symbols-outlined">inventory_2</span>
                  Lokasi Rak
                </div>
                <div className={styles.rakGrid}>
                  {RAK_PRESETS.map((rak) => (
                    <button
                      key={rak}
                      className={`${styles.rakBtn} ${lokasiRak === rak ? styles.active : ''}`}
                      onClick={() => handleRakSelect(rak)}
                    >
                      {rak}
                    </button>
                  ))}
                </div>
                <div className={styles.customRakContainer}>
                  <input
                    type="text"
                    placeholder="Atau custom (contoh: Z1, RAK-01)"
                    value={customRak}
                    onChange={handleCustomRakChange}
                    className={styles.rakInput}
                  />
                </div>
                {lokasiRak && (
                  <div className={styles.rakStatus}>
                    <span className="material-symbols-outlined">check_circle</span>
                    Rak: <strong>{lokasiRak}</strong>
                    {isSavingRak && <span className={styles.rakSaving}>...menyimpan</span>}
                  </div>
                )}
              </div>

              {/* BARCODE STATUS */}
              <div className={styles.opnameDetailBarcode}>
                <div className={styles.opnameDetailBarcodeLabel}>Barcode</div>
                <div className={styles.opnameDetailBarcodeArea}>
                  <span className="material-symbols-outlined">barcode</span>
                  <div className={styles.opnameDetailBarcodeValue}>
                    {selectedProduct.status_mapping ? '✅ Sudah mapping' : '❌ Belum mapping'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMPTY */}
          {!selectedProduct && !showSuggestions && !showCamera && (
            <div className={styles.opnameEmpty}>
              <div className={styles.opnameEmptyIcon}>
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </div>
              <div className={styles.opnameEmptyText}>
                {products.length === 0 ? 'Import data master dulu' : 'Scan atau cari barang'}
              </div>
              {products.length > 0 && (
                <div className={styles.opnameEmptyTip}>
                  <span className="material-symbols-outlined">lightbulb</span>
                  <span>Arahkan kamera ke barcode atau cari manual</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className={styles.opnameFooter}>
          <button 
            className={styles.opnameSaveBtn} 
            onClick={handleSave} 
            disabled={!selectedProduct || loading}
          >
            <span className="material-symbols-outlined">save</span>
            {loading ? '...' : 'SIMPAN'}
          </button>
          <button 
            className={styles.opnameFinishBtn} 
            onClick={handleFinish}
          >
            <span className="material-symbols-outlined">check_circle</span>
            SELESAI
          </button>
        </div>
      </div>

      {/* MODAL ADD SIZE */}
      {showAddSizeModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowAddSizeModal(false)} />
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <span className="material-symbols-outlined">add_box</span>
                Tambah Size Baru
              </h3>
              <button 
                className={styles.modalClose}
                onClick={() => {
                  setShowAddSizeModal(false)
                  setNewSize('')
                  setNewSizeQty('')
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p className={styles.modalSubtitle}>
                Size ini ga ada di master, tapi ada di gudang
              </p>
              
              <div className={styles.modalField}>
                <label>Size</label>
                <input
                  type="text"
                  placeholder="Contoh: M, XL, 42"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value.toUpperCase())}
                  className={styles.modalInput}
                  maxLength={10}
                  autoFocus
                />
              </div>
              
              <div className={styles.modalField}>
                <label>Jumlah Stock Real</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newSizeQty}
                  onChange={(e) => setNewSizeQty(e.target.value)}
                  className={styles.modalInput}
                  min="0"
                />
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalCancel}
                onClick={() => {
                  setShowAddSizeModal(false)
                  setNewSize('')
                  setNewSizeQty('')
                }}
              >
                BATAL
              </button>
              <button 
                className={styles.modalConfirm}
                onClick={handleAddNewSize}
                disabled={!newSize || newSizeQty === '' || loading}
              >
                <span className="material-symbols-outlined">add</span>
                {loading ? '...' : 'TAMBAH'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}