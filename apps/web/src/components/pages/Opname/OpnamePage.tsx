import { useState, useEffect, useRef } from 'react'
import { useProducts } from '../../../hooks/useProducts'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './OpnamePage.module.css'

interface OpnamePageProps {
  products: any[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
  refreshProducts: () => void
}

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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      const qty = selectedProduct.qty_fisik || 0
      setQtyFisik(qty.toString())
      setCurrentSize(selectedProduct.size)
    }
  }, [selectedProduct])

  // SYNC data dari props ke selectedProduct
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

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    
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
        isDone: curr.qty_fisik !== null && curr.qty_fisik !== undefined
      })
      return acc
    }, {})

    setSuggestions(Object.values(grouped))
    setShowSuggestions(true)
  }

  const selectProduct = (group: any) => {
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
          isDone: productData?.qty_fisik !== null && productData?.qty_fisik !== undefined
        }
      })

      setSelectedProduct({
        ...fullProduct,
        allSizes: allSizesWithData
      })
      setQtyFisik(fullProduct.qty_fisik?.toString() || '')
      setCurrentSize(fullProduct.size)
      setShowSuggestions(false)
      setSearchTerm('')
      
      setTimeout(() => {
        const qtyInput = document.getElementById('qty-input') as HTMLInputElement
        if (qtyInput) qtyInput.focus()
      }, 300)
    }
  }

  const handleSizeChange = (size: string) => {
    const sizeData = selectedProduct?.allSizes?.find((s: any) => s.size === size)
    if (!sizeData) return

    setSelectedProduct({
      ...selectedProduct,
      size: sizeData.size,
      stock_sistem: sizeData.stock_sistem,
      qty_fisik: sizeData.qty_fisik,
      status_mapping: sizeData.status_mapping
    })
    setQtyFisik(sizeData.isDone ? (sizeData.qty_fisik ?? 0).toString() : '')
    setCurrentSize(size)
  }

  const handleSave = async () => {
    if (!selectedProduct) {
      showToast('⚠️ Pilih barang dulu!')
      return
    }

    const qty = parseInt(qtyFisik)
    if (isNaN(qty) || qty < 0) {
      showToast('⚠️ Input qty real dulu!')
      return
    }

    setLoading(true)
    try {
      const result = await saveOpname(selectedProduct.sku, selectedProduct.size, qty)
      if (result) {
        const selisih = qty - (selectedProduct.stock_sistem || 0)
        let statusMsg = ''
        if (selisih === 0) statusMsg = '✅ Sesuai'
        else if (selisih < 0) statusMsg = `⬇️ Minus ${Math.abs(selisih)}`
        else statusMsg = `⬆️ Plus ${selisih}`
        
        showToast(`✅ ${selectedProduct.sku} - ${selectedProduct.size}: ${statusMsg}`)
        
        const updatedAllSizes = selectedProduct.allSizes.map((s: any) => {
          if (s.size === selectedProduct.size) {
            return {
              ...s,
              qty_fisik: qty,
              isDone: true
            }
          }
          return s
        })

        setSelectedProduct({
          ...selectedProduct,
          qty_fisik: qty,
          allSizes: updatedAllSizes
        })
        
        if (typeof refreshProducts === 'function') {
          await refreshProducts()
        }
        
        setQtyFisik('')
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }
    } catch (error) {
      showToast('❌ Gagal: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
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
          warna: selectedProduct.warna || 'N/A'
        },
        token || undefined
      )
      
      if (result.success) {
        showToast(`✅ Size ${newSize.toUpperCase()} (${qty}) ditambahkan! ➕`)
        
        const newSizeData = {
          size: newSize.toUpperCase(),
          stock_sistem: 0,
          qty_fisik: qty,
          status_mapping: selectedProduct.status_mapping || false,
          isDone: true
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
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleScan = () => {
    const available = products.filter((p: any) => 
      p.stock_sistem > 0 && (p.qty_fisik === null || p.qty_fisik === undefined)
    )
    const pool = available.length > 0 ? available : products.filter((p: any) => p.stock_sistem > 0)
    
    if (pool.length === 0) {
      showToast('⚠️ Gak ada barang buat di-scan')
      return
    }

    const random = pool[Math.floor(Math.random() * pool.length)]
    const group = suggestions.find((s: any) => s.sku === random.sku) || {
      sku: random.sku,
      nama_barang: random.nama_barang,
      kategori: random.kategori,
      warna: random.warna,
      sizes: products.filter((p: any) => p.sku === random.sku).map((p: any) => ({
        size: p.size || 'OS',
        stock_sistem: p.stock_sistem || 0,
        qty_fisik: p.qty_fisik,
        status_mapping: p.status_mapping || false,
        isDone: p.qty_fisik !== null && p.qty_fisik !== undefined
      }))
    }
    
    selectProduct(group)
    showToast(`📷 Scan: ${random.sku} - ${random.size || 'OS'}`)
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
    if (!s.isDone) return `Size ${s.size}: Belum di-opname`
    const selisih = getSelisih(s)
    if (selisih === 0) return `Size ${s.size}: ✅ Sesuai`
    if (selisih < 0) return `Size ${s.size}: ⬇️ Kurang ${Math.abs(selisih)}`
    return `Size ${s.size}: ⬆️ Lebih ${selisih}`
  }

  const isDisplay = (sizes: any[]) => {
    return sizes.length === 1
  }

  return (
    <div className={styles.opnamePage}>
      <div className={styles.opnameContainer}>
        {/* HEADER */}
        <div className={styles.opnameHeader}>
          <button className={styles.opnameBack} onClick={() => navigateTo('dashboard')}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className={styles.opnameHeaderCenter}>
            <span className={styles.opnameBadge}>📦 OPNAME</span>
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
          {/* SEARCH */}
          <div className={styles.opnameSearch}>
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 Cari SKU / Nama..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              disabled={!!selectedProduct}
              className={selectedProduct ? styles.disabled : ''}
            />
            <button 
              className={styles.opnameScanBtn} 
              onClick={handleScan}
              disabled={!!selectedProduct}
            >
              <i className="fa-solid fa-camera"></i>
              <span>SCAN</span>
            </button>
          </div>

          {/* SUGGESTIONS */}
          {showSuggestions && suggestions.length > 0 && !selectedProduct && (
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
                          {isDisplayMode ? '🏪 Display' : '📦 Multi'}
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
                        {allDone ? '✅ Selesai' : '⏳ Proses'}
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
                      {isDisplay(selectedProduct.allSizes) ? '🏪 Display' : '📦 Gudang'}
                    </span>
                  </div>
                </div>
                <button className={styles.opnameDetailClose} onClick={closeDetail}>✕</button>
              </div>

              {/* SIZE SELECTOR + TOMBOL + */}
              <div className={styles.opnameDetailSizes}>
                <div className={styles.opnameDetailSizesLabel}>
                  {isDisplay(selectedProduct.allSizes) ? 'Size:' : 'Pilih Size:'}
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
                    title="Tambah size baru yang ga ada di master"
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

              {/* QTY INPUT */}
              <div className={styles.opnameDetailQty}>
                <div className={styles.opnameDetailQtyRow}>
                  <span className={styles.opnameDetailQtyLabel}>📊 Stock Sistem</span>
                  <span className={styles.opnameDetailQtyValue}>{selectedProduct.stock_sistem}</span>
                </div>
                <div className={styles.opnameDetailQtyInput}>
                  <span className={styles.opnameDetailQtyLabel}>📦 Stock Real</span>
                  <input
                    id="qty-input"
                    type="number"
                    className={styles.opnameDetailQtyField}
                    value={qtyFisik}
                    onChange={(e) => setQtyFisik(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
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

              {/* BARCODE STATUS */}
              <div className={styles.opnameDetailBarcode}>
                <div className={styles.opnameDetailBarcodeLabel}>🏷️ BARCODE</div>
                <div className={styles.opnameDetailBarcodeArea}>
                  <i className="fa-solid fa-barcode"></i>
                  <div className={styles.opnameDetailBarcodeValue}>
                    {selectedProduct.status_mapping ? '✅ Sudah mapping' : '⚠️ Belum mapping'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMPTY */}
          {!selectedProduct && !showSuggestions && (
            <div className={styles.opnameEmpty}>
              <div className={styles.opnameEmptyIcon}>
                <i className="fa-solid fa-qrcode"></i>
              </div>
              <div className={styles.opnameEmptyText}>
                {products.length === 0 ? '📂 Import data master dulu' : 'Scan atau cari barang'}
              </div>
              {products.length > 0 && (
                <div className={styles.opnameEmptyTip}>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Tips: ketik SKU atau nama</span>
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
            disabled={!selectedProduct || loading || qtyFisik === ''}
          >
            {loading ? '⏳ ...' : '💾 SIMPAN'}
          </button>
          <button 
            className={styles.opnameFinishBtn} 
            onClick={handleFinish}
          >
            SELESAI
          </button>
        </div>
      </div>

      {/* MODAL TAMBAH SIZE */}
      {showAddSizeModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowAddSizeModal(false)} />
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>+ TAMBAH SIZE BARU</h3>
              <button 
                className={styles.modalClose}
                onClick={() => {
                  setShowAddSizeModal(false)
                  setNewSize('')
                  setNewSizeQty('')
                }}
              >
                ✕
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
                {loading ? '⏳ ...' : '+ TAMBAH'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}