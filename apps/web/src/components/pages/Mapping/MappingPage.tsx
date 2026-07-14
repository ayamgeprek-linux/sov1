// apps/web/src/components/pages/Mapping/MappingPage.tsx
import { useState, useMemo, useRef, useEffect } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './MappingPage.module.css'

interface Product {
  id: string
  sku: string
  nama_barang: string
  kategori: string
  warna: string
  size: string
  stock_sistem: number
  status_mapping?: boolean
}

interface MappingPageProps {
  products: Product[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

export function MappingPage({ products, navigateTo, showToast }: MappingPageProps) {
  const { token } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [barcode, setBarcode] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Stats
  const mappedToday = products.filter(p => p.status_mapping).length
  const totalProducts = products.length
  const accuracy = totalProducts > 0 ? Math.round((mappedToday / totalProducts) * 1000) / 10 : 0

  // Get unique sizes for selected product
  const availableSizes = useMemo(() => {
    if (!selectedProduct) return []
    const sizes = products
      .filter(p => p.sku === selectedProduct.sku)
      .map(p => p.size || 'OS')
    return [...new Set(sizes)].sort()
  }, [selectedProduct, products])

  // Focus input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    
    if (!value.trim()) {
      setShowResults(false)
      setSearchResults([])
      return
    }
    
    const results = products.filter(p => 
      p.nama_barang.toLowerCase().includes(value.toLowerCase()) ||
      p.sku.toLowerCase().includes(value.toLowerCase())
    )
    setSearchResults(results)
    setShowResults(true)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const card = document.querySelector(`.${styles.mappingCard}`)
      if (card) {
        card.classList.add(styles.cardPulse)
        setTimeout(() => card.classList.remove(styles.cardPulse), 300)
      }
    }
  }

  const selectProduct = (product: Product) => {
    setSelectedProduct(product)
    const sizes = products
      .filter(p => p.sku === product.sku)
      .map(p => p.size || 'OS')
    const uniqueSizes = [...new Set(sizes)].sort()
    setSelectedSize(uniqueSizes[0] || 'OS')
    setShowResults(false)
    setSearchTerm('')
    setBarcode('')
    
    setTimeout(() => {
      if (barcodeInputRef.current) barcodeInputRef.current.focus()
    }, 100)
  }

  const handleBarcodeChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '')
    setBarcode(cleaned)
  }

  // ============================================================
  // SAVE MAPPING - PAKE API
  // ============================================================
  const handleSave = async () => {
    if (!selectedProduct) {
      showToast('⚠️ Pilih barang terlebih dahulu')
      return
    }
    
    if (!selectedSize) {
      showToast('⚠️ Pilih size terlebih dahulu')
      return
    }
    
    if (!barcode || barcode.length < 8) {
      showToast('⚠️ Barcode tidak valid (minimal 8 digit)')
      return
    }
    
    setIsSaving(true)
    try {
      const result = await api.post<{ success: boolean; data?: any; error?: string }>(
        '/api/mapping',
        {
          sku: selectedProduct.sku,
          size: selectedSize,
          barcode: barcode
        },
        token || undefined
      )
      
      if (result.success) {
        showToast(`✅ Barcode berhasil dimapping untuk ${selectedProduct.nama_barang} - ${selectedSize}!`)
        setTimeout(() => {
          setSelectedProduct(null)
          setSelectedSize('')
          setBarcode('')
          setIsSaving(false)
          if (searchInputRef.current) searchInputRef.current.focus()
        }, 800)
      } else {
        showToast(`❌ ${result.error || 'Gagal menyimpan mapping'}`)
        setIsSaving(false)
      }
    } catch (error) {
      showToast('❌ Gagal: ' + (error as Error).message)
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setSelectedProduct(null)
    setSelectedSize('')
    setBarcode('')
    setSearchTerm('')
    setShowResults(false)
    setIsSaving(false)
    if (searchInputRef.current) searchInputRef.current.focus()
  }

  const formatBarcodeDisplay = (code: string) => {
    if (!code) return '—'
    const cleaned = code.replace(/\s/g, '')
    const chunks = cleaned.match(/.{1,3}/g) || []
    return chunks.join(' ')
  }

  // Check if this SKU+size already has mapping
  const isAlreadyMapped = useMemo(() => {
    if (!selectedProduct || !selectedSize) return false
    const productWithSize = products.find(
      p => p.sku === selectedProduct.sku && p.size === selectedSize
    )
    return productWithSize?.status_mapping || false
  }, [selectedProduct, selectedSize, products])

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className={styles.mappingPage}>
      {/* Main Card */}
      <div className={`${styles.mappingCard} ${styles.mappingCardGradient}`}>
        <div className={styles.mappingCardGlow}></div>
        
        <div className={styles.mappingCardContent}>
          {/* Header */}
          <div className={styles.mappingHeader}>
            
            <h2 className={styles.mappingTitle}>MAPPING BARCODE</h2>
            <p className={styles.mappingSubtitle}>Cari barang, pilih size, lalu scan barcode</p>
          </div>

          {/* Search */}
          <div className={styles.mappingSearch}>
            <div className={styles.mappingSearchWrapper}>
             
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ketik nama atau article code..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={!!selectedProduct}
              />
            </div>
          </div>

          {/* Results */}
          {showResults && !selectedProduct && (
            <div className={styles.mappingResults}>
              {searchResults.length > 0 ? (
                searchResults.slice(0, 10).map((p) => {
                  const allSizes = products
                    .filter(pp => pp.sku === p.sku)
                    .map(pp => pp.size || 'OS')
                  const mappedSizes = products
                    .filter(pp => pp.sku === p.sku && pp.status_mapping)
                    .map(pp => pp.size || 'OS')
                  const isFullyMapped = allSizes.every(s => mappedSizes.includes(s))
                  
                  return (
                    <div key={p.id} className={styles.mappingResultItem} onClick={() => selectProduct(p)}>
                      <div>
                        <div className={styles.mappingResultName}>{p.nama_barang}</div>
                        <div className={styles.mappingResultSku}>{p.sku}</div>
                        <div className={styles.mappingResultSizes}>
                          {allSizes.map(s => (
                            <span key={s} className={`${styles.sizeChip} ${mappedSizes.includes(s) ? styles.mapped : styles.unmapped}`}>
                              {s} {mappedSizes.includes(s) ? '✓' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`${styles.mappingResultStatus} ${isFullyMapped ? styles.mapped : styles.unmapped}`}>
                        {isFullyMapped ? '✅ All Mapped' : '⏳ Partial'}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className={styles.mappingNoResults}>
                  <span className="material-symbols-outlined">search_off</span>
                  <p>Tidak ditemukan</p>
                </div>
              )}
            </div>
          )}

          {/* Selected Product */}
          {selectedProduct && (
            <div className={styles.mappingSelected}>
              <div className={styles.mappingSelectedInfo}>
                {/* Left - Product Info */}
                <div className={styles.mappingSelectedLeft}>
                  <div className={styles.mappingSelectedLabel}>ARTICLE CODE</div>
                  <div className={styles.mappingSelectedSku}>{selectedProduct.sku}</div>
                  <div className={styles.mappingSelectedName}>{selectedProduct.nama_barang}</div>
                  
                  {/* Size Selection */}
                  <div className={styles.mappingSizeSelector}>
                    <div className={styles.mappingSelectedLabel}>PILIH SIZE</div>
                    <div className={styles.mappingSizeGrid}>
                      {availableSizes.map(size => {
                        const isMapped = products.some(
                          p => p.sku === selectedProduct.sku && p.size === size && p.status_mapping
                        )
                        const isActive = selectedSize === size
                        
                        return (
                          <button
                            key={size}
                            className={`${styles.sizeSelectBtn} ${isActive ? styles.active : ''} ${isMapped ? styles.mapped : ''}`}
                            onClick={() => {
                              setSelectedSize(size)
                              setBarcode('')
                              if (barcodeInputRef.current) barcodeInputRef.current.focus()
                            }}
                            disabled={isSaving}
                          >
                            <span className={styles.sizeSelectLabel}>{size}</span>
                            {isMapped && <span className={styles.sizeSelectCheck}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className={styles.mappingStatusInfo}>
                    <span className={`${styles.mappingStatusBadge} ${isAlreadyMapped ? styles.mapped : styles.unmapped}`}>
                      {isAlreadyMapped ? '✅ Sudah Mapping' : '⏳ Belum Mapping'}
                    </span>
                  </div>
                </div>

                {/* Right - Scanner */}
                <div className={styles.mappingScanner}>
                  <div className={styles.mappingScannerLabel}>
                    SCAN BARCODE
                    <span className={styles.mappingScannerSub}>untuk size {selectedSize || '...'}</span>
                  </div>
                  
                  <div className={styles.barcodeVisual}>
                    {barcode ? formatBarcodeDisplay(barcode) : '—'}
                  </div>
                  
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    className={styles.barcodeInput}
                    placeholder="Ketik barcode manual..."
                    value={barcode}
                    onChange={(e) => handleBarcodeChange(e.target.value)}
                    maxLength={13}
                    disabled={isSaving || !selectedSize}
                  />
                  
                  <button 
                    className={styles.saveBtn} 
                    onClick={handleSave} 
                    disabled={!barcode || barcode.length < 8 || isSaving || !selectedSize || isAlreadyMapped}
                  >
                   
                    {isSaving ? 'MENYIMPAN...' : isAlreadyMapped ? 'SUDAH MAPPED' : 'SIMPAN MAPPING'}
                  </button>
                  
                  <div className={styles.cancelBtn} onClick={handleCancel}>
                    batal
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scanner Status */}
          <div className={styles.mappingScannerStatus}>
            <div className={styles.mappingScannerDot}></div>
            <span className={styles.mappingScannerLabel}>
              {selectedProduct ? `Mapping: ${selectedProduct.sku}` : 'Scanner Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className={styles.mappingInfoGrid}>
        <div className={styles.mappingInfoItem}>
         
          <div>
            <p className={styles.mappingInfoLabel}>Recent Items</p>
            <p className={styles.mappingInfoValue}>{mappedToday} Mapped Today</p>
          </div>
        </div>
        <div className={styles.mappingInfoItem}>
          
          <div>
            <p className={styles.mappingInfoLabel}>Accuracy</p>
            <p className={styles.mappingInfoValue}>{accuracy}% Verified</p>
          </div>
        </div>
        <div className={styles.mappingInfoItem}>
          
          <div>
            <p className={styles.mappingInfoLabel}>System Status</p>
            <p className={styles.mappingInfoValue}>Online &amp; Syncing</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.mappingToast}>
        <span className={styles.mappingToastDot}></span>
        <span>System Online</span>
        <span className={styles.mappingToastDivider}>|</span>
        <span>Ver 1.2.0</span>
        <span className={styles.mappingToastDivider}>|</span>
        <span>{selectedProduct ? `${selectedProduct.sku} - ${selectedSize || 'pilih size'}` : 'Ready'}</span>
      </div>
    </div>
  )
}