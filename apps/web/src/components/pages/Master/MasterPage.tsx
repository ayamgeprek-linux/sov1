import React, { useState, useMemo } from 'react'
import styles from './MasterPage.module.css'

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

interface MasterPageProps {
  products: Product[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

export function MasterPage({ products, navigateTo, showToast }: MasterPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [kategoriFilter, setKategoriFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')

  // Get unique categories and sizes
  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.kategori))].filter(Boolean)
  }, [products])

  const sizes = useMemo(() => {
    return [...new Set(products.map(p => p.size))].filter(Boolean).sort()
  }, [products])

  // Filter products
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      const matchKategori = !kategoriFilter || p.kategori === kategoriFilter
      const matchSize = !sizeFilter || p.size === sizeFilter
      return matchSearch && matchKategori && matchSize
    })
  }, [products, searchTerm, kategoriFilter, sizeFilter])

  // Stats
  const mappedCount = products.filter(p => p.status_mapping).length
  const mappedPercentage = products.length > 0 ? Math.round((mappedCount / products.length) * 100) : 0
  const totalCategories = categories.length

  const getCategoryBadgeClass = (kategori: string) => {
    const upper = kategori?.toUpperCase() || ''
    if (upper.includes('ACCESSORIES')) return styles.accessories
    if (upper.includes('BAG')) return styles.bag
    return styles.default
  }

  const handleMapClick = (product: Product) => {
    navigateTo('mapping')
    showToast(`Silahkan mapping barcode untuk: ${product.nama_barang} (${product.sku})`)
  }

  const handleAddClick = () => {
    showToast('Fitur tambah barang sedang dalam pengembangan')
  }

  return (
    <div className={styles.masterPage}>
      {/* Page Header & Filters */}
      <div className={styles.masterHeader}>
        <div className={styles.masterHeaderTop}>
          <h1 className={styles.masterTitle}>Data Master Barang</h1>
          <p className={styles.masterSubtitle}>Manage and audit your product catalog with precision.</p>
        </div>

        <div className={styles.masterControls}>
          {/* Search Bar */}
          <div className={styles.masterSearch}>
            
            <input
              type="text"
              placeholder="Cari SKU / Nama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className={styles.masterFilterWrapper}>
            <select 
              className={styles.masterFilter} 
              value={kategoriFilter} 
              onChange={(e) => setKategoriFilter(e.target.value)}
            >
              <option value="">Semua Kategori</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
           
          </div>

          {/* Size Filter */}
          <div className={styles.masterFilterWrapper}>
            <select 
              className={styles.masterFilter} 
              value={sizeFilter} 
              onChange={(e) => setSizeFilter(e.target.value)}
            >
              <option value="">Semua Size</option>
              {sizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            
          </div>

        </div>
      </div>

      {/* Table Card */}
      <div className={styles.masterTableWrap}>
        <div className={styles.masterTableScroll}>
          <table className={styles.masterTable}>
            <thead>
              <tr>
                <th>Article Code</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th>Warna</th>
                <th className={styles.textCenter}>Size</th>
                <th className={styles.textCenter}>Stock</th>
                <th className={styles.textRight}>Mapping</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    {products.length === 0 ? 
                      '📂 Belum ada data. Import data master terlebih dahulu.' : 
                      '🔍 Tidak ada data yang cocok dengan filter'
                    }
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={`${p.sku}-${p.size}`} className={styles.masterRow}>
                    <td className={`${styles.fontMono} ${styles.textXs}`}>{p.sku}</td>
                    <td>{p.nama_barang}</td>
                    <td>
                      <span className={`${styles.categoryBadge} ${getCategoryBadgeClass(p.kategori)}`}>
                        {p.kategori || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className={styles.textXs}>{p.warna || '-'}</td>
                    <td className={styles.textCenter}>
                      <span className={styles.sizeLabel}>{p.size || 'OS'}</span>
                    </td>
                    <td className={`${styles.textCenter} ${styles.fontMono}`}>
                      {p.stock_sistem}
                    </td>
                    <td className={styles.textRight}>
                      {p.status_mapping ? (
                        <span className={`${styles.status} ${styles.mapped}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                          MAPPED
                        </span>
                      ) : (
                        <span 
                          className={`${styles.status} ${styles.unmapped}`} 
                          onClick={() => handleMapClick(p)}
                        >
                          MAP
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className={styles.masterFooter}>
          <span className={styles.masterTotal}>
            Showing <strong>{filtered.length}</strong> of <strong>{products.length}</strong> items
          </span>
          
        </div>
      </div>
    </div>
  )
}