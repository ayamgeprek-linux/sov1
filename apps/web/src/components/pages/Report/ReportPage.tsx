// apps/web/src/components/pages/Report/ReportPage.tsx
import { useState, useRef, useEffect, useMemo } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import styles from './ReportPage.module.css'

interface ReportPageProps {
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

interface SizeData {
  size: string
  sistem: number
  real: number | null
  selisih: number | null
  status: 'belum' | 'sesuai' | 'minus' | 'plus' | 'kosong'
  lokasi_rak?: string | null
}

interface GroupedProduct {
  sku: string
  nama_barang: string
  kategori: string
  warna: string
  sizes: SizeData[]
  total_sistem: number
  total_real: number
  total_selisih: number
  isComplete: boolean
  lokasi_rak: string | null
}

export function ReportPage({ navigateTo, showToast }: ReportPageProps) {
  const { token } = useAuth()
  const reportRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [masterData, setMasterData] = useState<any[]>([]) // 🔥 MASTER DATA
  const [opnameData, setOpnameData] = useState<any[]>([]) // 🔥 OPNAME DATA
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState<'semua' | 'minus' | 'plus' | 'belum' | 'sesuai'>('semua')
  const [selectedKategori, setSelectedKategori] = useState<string>('semua')
  const hasFetched = useRef(false)

  // ============================================================
  // FETCH MASTER + OPNAME DATA
  // ============================================================
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const fetchData = async () => {
      setFetching(true)
      try {
        // 🔥 1. FETCH MASTER DATA
        console.log('[Report] Fetching master data...')
        const masterResult = await api.get<{ data: any[]; success?: boolean }>(
          '/api/products',
          token || undefined
        )
        
        let masterRaw: any[] = []
        if (masterResult) {
          if (Array.isArray(masterResult)) {
            masterRaw = masterResult
          } else if (masterResult.data && Array.isArray(masterResult.data)) {
            masterRaw = masterResult.data
          } else if (masterResult.success && masterResult.data && Array.isArray(masterResult.data)) {
            masterRaw = masterResult.data
          }
        }
        console.log('[Report] Master data:', masterRaw.length)
        setMasterData(masterRaw)

        // 🔥 2. FETCH OPNAME DATA
        console.log('[Report] Fetching opname data...')
        const opnameResult = await api.get<{ data: any[]; success?: boolean }>(
          '/api/opname',
          token || undefined
        )
        
        let opnameRaw: any[] = []
        if (opnameResult) {
          if (Array.isArray(opnameResult)) {
            opnameRaw = opnameResult
          } else if (opnameResult.data && Array.isArray(opnameResult.data)) {
            opnameRaw = opnameResult.data
          } else if (opnameResult.success && opnameResult.data && Array.isArray(opnameResult.data)) {
            opnameRaw = opnameResult.data
          }
        }
        console.log('[Report] Opname data:', opnameRaw.length)
        setOpnameData(opnameRaw)
        
      } catch (error) {
        console.error('[Report] Error fetching:', error)
        showToast('❌ Gagal memuat data')
      } finally {
        setFetching(false)
      }
    }

    fetchData()
  }, [token, showToast])

  // ============================================================
  // 🔥 GABUNGIN MASTER + OPNAME
  // ============================================================
  const mergedData = useMemo(() => {
    // 🔥 BUAT MAP OPNAME PER SKU-SIZE
    const opnameMap = new Map()
    opnameData.forEach((item: any) => {
      const key = `${item.sku}-${item.size || 'OS'}`
      opnameMap.set(key, item)
    })

    // 🔥 LOOP MASTER DATA (SEMUA PRODUK)
    const result = masterData.map((product: any) => {
      const key = `${product.sku}-${product.size || 'OS'}`
      const opname = opnameMap.get(key)
      
      return {
        sku: product.sku,
        size: product.size || 'OS',
        stock_sistem: product.stock_sistem || 0,
        stock_real: opname?.stock_real ?? null,
        selisih: opname?.selisih ?? null,
        status: opname?.status || 'belum',
        nama_barang: product.nama_barang || 'UNKNOWN',
        kategori: product.kategori || 'UNKNOWN',
        warna: product.warna || 'N/A',
        lokasi_rak: product.lokasi_rak || null,
        user_name: opname?.user_name || null,
        updated_at: opname?.updated_at || null
      }
    })

    console.log('[Report] Merged data (all products):', result.length)
    return result
  }, [masterData, opnameData])

  // ============================================================
  // GROUP BY SKU
  // ============================================================
  const groupedProducts = mergedData.reduce<Record<string, GroupedProduct>>((acc, curr) => {
    const sku = curr.sku
    if (!acc[sku]) {
      acc[sku] = {
        sku: sku,
        nama_barang: curr.nama_barang || 'UNKNOWN',
        kategori: curr.kategori || 'UNKNOWN',
        warna: curr.warna || 'N/A',
        sizes: [],
        total_sistem: 0,
        total_real: 0,
        total_selisih: 0,
        isComplete: true,
        lokasi_rak: curr.lokasi_rak || null
      }
    }

    const isOpnamed = curr.status !== 'belum' && curr.status !== undefined && curr.status !== null
    const selisih = curr.selisih ?? null
    const status = curr.status || 'belum'

    acc[sku].sizes.push({
      size: curr.size || 'OS',
      sistem: curr.stock_sistem || 0,
      real: isOpnamed ? (curr.stock_real || 0) : null,
      selisih: selisih,
      status: status === 'sesuai' ? 'sesuai' : 
              status === 'keluar' ? 'minus' : 
              status === 'masuk' ? 'plus' : 'belum',
      lokasi_rak: curr.lokasi_rak || null
    })

    acc[sku].total_sistem += curr.stock_sistem || 0

    if (isOpnamed) {
      acc[sku].total_real += curr.stock_real || 0
      acc[sku].total_selisih += selisih || 0
    }

    if (!isOpnamed) {
      acc[sku].isComplete = false
    }

    if (curr.lokasi_rak) {
      acc[sku].lokasi_rak = curr.lokasi_rak
    }

    return acc
  }, {})

  // ============================================================
  // GET UNIQUE KATEGORI
  // ============================================================
  const allKategori = ['semua', ...new Set(Object.values(groupedProducts).map(item => item.kategori))]

  // ============================================================
  // FORMAT SIZE DETAILS - PAKE ICON
  // ============================================================
  const formatSizeData = (sizes: SizeData[]): JSX.Element => {
    return (
      <div className={styles.sizeChipsContainer}>
        {sizes.map((s, idx) => {
          const selisih = s.selisih
          let icon = 'block'
          let colorClass = styles.sizeIconMuted
          let label = `${s.size}:${s.sistem}`

          if (s.status === 'belum') {
            icon = 'hourglass_empty'
            colorClass = styles.sizeIconPending
            label = `${s.size}:${s.sistem}`
          } else if (selisih === null) {
            icon = 'help_outline'
            colorClass = styles.sizeIconMuted
            label = `${s.size}:${s.sistem}`
          } else if (selisih === 0) {
            icon = 'check_circle'
            colorClass = styles.sizeIconOk
            label = `${s.size}:${s.sistem}`
          } else if (selisih < 0) {
            icon = 'arrow_downward'
            colorClass = styles.sizeIconMinus
            label = `${s.size}:${s.sistem} ${selisih}`
          } else {
            icon = 'arrow_upward'
            colorClass = styles.sizeIconPlus
            label = `${s.size}:${s.sistem} +${selisih}`
          }

          return (
            <span key={idx} className={`${styles.sizeChip} ${colorClass}`}>
              {label}
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {icon}
              </span>
            </span>
          )
        })}
      </div>
    )
  }

  // ============================================================
  // HITUNG STATS
  // ============================================================
  let allItems = Object.values(groupedProducts)
  
  if (selectedKategori !== 'semua') {
    allItems = allItems.filter(item => item.kategori === selectedKategori)
  }
  
  const opnameItems = allItems.filter((item: GroupedProduct) => {
    return item.sizes.some(s => s.status === 'sesuai' || s.status === 'minus' || s.status === 'plus')
  })
  
  const belumItems = allItems.filter((item: GroupedProduct) => {
    return !item.sizes.some(s => s.status === 'sesuai' || s.status === 'minus' || s.status === 'plus')
  })
  
  const minusItems = opnameItems.filter((item: GroupedProduct) => item.total_selisih < 0)
  const plusItems = opnameItems.filter((item: GroupedProduct) => item.total_selisih > 0)
  const zeroItems = opnameItems.filter((item: GroupedProduct) => item.total_selisih === 0)

  const totalItems = allItems.length
  const doneItems = opnameItems.length
  const remainingItems = belumItems.length
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
  const totalSelisih = opnameItems.reduce((acc: number, item: GroupedProduct) => acc + item.total_selisih, 0)

  const getFilteredData = (): GroupedProduct[] => {
    switch (activeTab) {
      case 'minus': return minusItems
      case 'plus': return plusItems
      case 'belum': return belumItems
      case 'sesuai': return zeroItems
      default: return allItems
    }
  }

  const filteredData = getFilteredData()

  const sizeStats = {
    total: 0,
    sesuai: 0,
    minus: 0,
    plus: 0,
    belum: 0
  }
  allItems.forEach(item => {
    item.sizes.forEach(s => {
      if (s.status === 'kosong') return
      sizeStats.total++
      if (s.status === 'sesuai') sizeStats.sesuai++
      else if (s.status === 'minus') sizeStats.minus++
      else if (s.status === 'plus') sizeStats.plus++
      else sizeStats.belum++
    })
  })

  // ============================================================
  // EXPORT PDF
  // ============================================================
  const handleExportPDF = async () => {
    if (allItems.length === 0) {
      showToast('❌ Tidak ada data untuk di-export')
      return
    }

    setLoading(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      
      doc.setFillColor(115, 92, 0)
      doc.rect(0, 0, 297, 12, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('LAPORAN STOCK OPNAME', 14, 8)
      
      doc.setTextColor(80, 80, 80)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { 
        weekday: 'long', 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      })}`, 14, 18)
      
      doc.text(`Total SKU: ${totalItems} | Selesai: ${doneItems} | Sisa: ${remainingItems} | Progress: ${progress}%`, 14, 23)
      doc.text(`Total Selisih: ${totalSelisih > 0 ? '+' : ''}${totalSelisih}`, 14, 28)
      
      doc.setDrawColor(200, 200, 200)
      doc.line(14, 30, 283, 30)
      
      const tableData: any[][] = []
      const dataToExport = activeTab === 'semua' ? allItems : filteredData
      
      dataToExport.forEach((item: GroupedProduct) => {
        const sizeDetails = item.sizes.map(s => {
          const selisih = s.selisih
          let symbol = ''
          
          if (s.status === 'belum') {
            symbol = '⏳'
          } else if (selisih === null) {
            symbol = '?'
          } else if (selisih === 0) {
            symbol = '✓'
          } else if (selisih < 0) {
            symbol = `${selisih}`
          } else {
            symbol = `+${selisih}`
          }
          
          return `${s.size}:${s.sistem}${symbol}`
        }).join(' ')
        
        let statusText = ''
        if (!item.isComplete) {
          statusText = 'BELUM'
        } else if (item.total_selisih < 0) {
          statusText = 'MINUS'
        } else if (item.total_selisih > 0) {
          statusText = 'PLUS'
        } else {
          statusText = 'COCOK'
        }
        
        const rak = item.lokasi_rak || item.sizes[0]?.lokasi_rak || '-'
        
        tableData.push([
          item.sku,
          item.nama_barang,
          item.kategori,
          sizeDetails,
          item.total_sistem,
          item.total_real || '-',
          item.total_selisih !== 0 ? (item.total_selisih > 0 ? `+${item.total_selisih}` : item.total_selisih) : '0',
          rak,
          statusText
        ])
      })
      
      autoTable(doc, {
        startY: 32,
        head: [['SKU', 'Nama Barang', 'Kategori', 'Size Details', 'Sistem', 'Real', 'Selisih', 'Rak', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [30, 30, 30],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: 26 },
          2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 55 },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 12, halign: 'center' },
          8: { cellWidth: 14, halign: 'center' },
        },
        didDrawCell: (data: any) => {
          if (!data || !data.cell || !data.cell.text || data.cell.text.length === 0) return
          const text = data.cell.text[0]
          if (!text) return
          
          if (data.section === 'body' && data.column.index === 8) {
            const status = String(text).toUpperCase()
            if (status === 'COCOK') {
              doc.setTextColor(5, 150, 105)
            } else if (status === 'MINUS') {
              doc.setTextColor(220, 38, 38)
            } else if (status === 'PLUS') {
              doc.setTextColor(217, 119, 6)
            } else {
              doc.setTextColor(150, 150, 150)
            }
          }
          
          if (data.section === 'body' && data.column.index === 6) {
            const selisihText = String(text)
            if (selisihText === '0') {
              doc.setTextColor(5, 150, 105)
            } else if (selisihText.startsWith('-')) {
              doc.setTextColor(220, 38, 38)
            } else if (selisihText.startsWith('+')) {
              doc.setTextColor(217, 119, 6)
            }
          }
          
          if (data.section === 'body' && data.column.index === 7) {
            const rakText = String(text)
            if (rakText !== '-') {
              doc.setTextColor(233, 195, 73)
              doc.setFont('helvetica', 'bold')
            } else {
              doc.setTextColor(150, 150, 150)
            }
          }
        }
      })
      
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(6)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Dicetak: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
          14,
          doc.internal.pageSize.getHeight() - 5
        )
      }
      
      doc.save(`laporan-opname-${new Date().toISOString().slice(0, 10)}.pdf`)
      showToast('✅ Laporan PDF berhasil di-download!')
      
    } catch (error) {
      console.error('[Export PDF] Error:', error)
      showToast('❌ Gagal generate PDF: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className={styles.reportPage}>
        <div className={styles.reportLoading}>
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <p>Memuat data...</p>
        </div>
      </div>
    )
  }

  // 🔥 CEK KALO DATA KOSONG
  if (!fetching && masterData.length === 0) {
    return (
      <div className={styles.reportPage}>
        <div className={styles.reportHeader}>
          <div>
            <h2 className={styles.reportTitle}>Laporan Stock Opname</h2>
            <p className={styles.reportSubtitle}>Ringkasan aktivitas audit inventaris operasional harian.</p>
          </div>
          <div className={styles.reportActions}>
            <button className={styles.reportBackBtn} onClick={() => navigateTo('dashboard')}>
              <span className="material-symbols-outlined">arrow_back</span>
              Kembali
            </button>
          </div>
        </div>
        <div className={styles.reportContent}>
          <div className={styles.reportEmpty}>
            <span className="material-symbols-outlined">database_off</span>
            <p>Belum ada data master</p>
            <p style={{ fontSize: '14px', color: 'rgba(77,70,53,0.3)', marginTop: '4px' }}>
              Import data master terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.reportPage}>
      <div className={styles.reportHeader}>
        <div>
          <h2 className={styles.reportTitle}>Laporan Stock Opname</h2>
          <p className={styles.reportSubtitle}>Ringkasan aktivitas audit inventaris operasional harian.</p>
        </div>
        <div className={styles.reportActions}>
          <button className={styles.reportBackBtn} onClick={() => navigateTo('dashboard')}>
            <span className="material-symbols-outlined">arrow_back</span>
            Kembali
          </button>
          <button className={styles.reportExportBtn} onClick={handleExportPDF} disabled={loading || allItems.length === 0}>
            <span className="material-symbols-outlined">picture_as_pdf</span>
            {loading ? '⏳ Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div ref={reportRef} className={styles.reportContent}>
        <div className={styles.reportSummary}>
          <div className={styles.reportSummaryItem}>
            <p className={styles.reportSummaryLabel}>Total SKU</p>
            <div className={styles.reportSummaryValue}>
              <span className={styles.reportSummaryNumber}>{totalItems}</span>
            </div>
          </div>
          <div className={styles.reportSummaryItem}>
            <p className={styles.reportSummaryLabel}>Selesai</p>
            <div className={styles.reportSummaryValue}>
              <span className={`${styles.reportSummaryNumber} ${styles.textPrimary}`}>{doneItems}</span>
            </div>
          </div>
          <div className={styles.reportSummaryItem}>
            <p className={styles.reportSummaryLabel}>Sisa</p>
            <div className={styles.reportSummaryValue}>
              <span className={`${styles.reportSummaryNumber} ${styles.textMuted}`}>{remainingItems}</span>
            </div>
          </div>
          <div className={styles.reportSummaryItem}>
            <p className={styles.reportSummaryLabel}>Progress</p>
            <div className={styles.reportSummaryValue}>
              <span className={styles.reportSummaryNumber}>{progress}%</span>
            </div>
            <div className={styles.reportSummaryBar}>
              <div className={styles.reportSummaryBarFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className={styles.reportSummaryItem}>
            <p className={styles.reportSummaryLabel}>Total Selisih</p>
            <div className={styles.reportSummaryValue}>
              <span className={`${styles.reportSummaryNumber} ${styles.textError}`}>
                {totalSelisih > 0 ? `+${totalSelisih}` : totalSelisih}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.reportFilters}>
          <label className={styles.reportFilterLabel}>Kategori:</label>
          <select className={styles.reportFilterSelect} value={selectedKategori} onChange={(e) => setSelectedKategori(e.target.value)}>
            {allKategori.map(kat => (
              <option key={kat} value={kat}>{kat === 'semua' ? 'Semua Kategori' : kat}</option>
            ))}
          </select>
        </div>

        <div className={styles.reportMetricsStrip}>
          <div className={styles.reportMetricsItem}>
            <span className={styles.reportMetricsLabel}>Total Size</span>
            <span className={styles.reportMetricsValue}>{sizeStats.total}</span>
          </div>
          <div className={styles.reportMetricsDivider}></div>
          <div className={styles.reportMetricsItem}>
            <span className={styles.reportMetricsLabel}>Cocok</span>
            <span className={`${styles.reportMetricsValue} ${styles.textPrimary}`}>{sizeStats.sesuai}</span>
          </div>
          <div className={styles.reportMetricsItem}>
            <span className={styles.reportMetricsLabel}>Minus</span>
            <span className={`${styles.reportMetricsValue} ${styles.textError}`}>{sizeStats.minus}</span>
          </div>
          <div className={styles.reportMetricsItem}>
            <span className={styles.reportMetricsLabel}>Plus</span>
            <span className={`${styles.reportMetricsValue} ${styles.textTertiary}`}>{sizeStats.plus}</span>
          </div>
          <div className={styles.reportMetricsItem}>
            <span className={styles.reportMetricsLabel}>Belum</span>
            <span className={`${styles.reportMetricsValue}`}>{sizeStats.belum}</span>
          </div>
          <div className={styles.reportMetricsDate}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        </div>

        <div className={styles.reportTabs}>
          <button className={`${styles.reportTab} ${activeTab === 'semua' ? styles.active : ''}`} onClick={() => setActiveTab('semua')}>
            Semua ({allItems.length})
          </button>
          <button className={`${styles.reportTab} ${activeTab === 'minus' ? styles.active : ''}`} onClick={() => setActiveTab('minus')}>
            Minus ({minusItems.length})
          </button>
          <button className={`${styles.reportTab} ${activeTab === 'plus' ? styles.active : ''}`} onClick={() => setActiveTab('plus')}>
            Plus ({plusItems.length})
          </button>
          <button className={`${styles.reportTab} ${activeTab === 'sesuai' ? styles.active : ''}`} onClick={() => setActiveTab('sesuai')}>
            Cocok ({zeroItems.length})
          </button>
          <button className={`${styles.reportTab} ${activeTab === 'belum' ? styles.active : ''}`} onClick={() => setActiveTab('belum')}>
            Belum ({belumItems.length})
          </button>
        </div>

        {filteredData.length > 0 ? (
          <div className={styles.reportTableWrapper}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>SKU</th>
                  <th>Nama Barang</th>
                  <th>Kategori</th>
                  <th>Size Details</th>
                  <th className={styles.textCenter}>Sistem</th>
                  <th className={styles.textCenter}>Real</th>
                  <th className={styles.textCenter}>Selisih</th>
                  <th className={styles.textCenter}>Rak</th>
                  <th className={styles.textRight}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item: GroupedProduct, i: number) => {
                  const isMinus = item.total_selisih < 0
                  const isPlus = item.total_selisih > 0
                  const isZero = item.total_selisih === 0 && item.isComplete
                  const isBelum = !item.isComplete

                  let rowClass = styles.rowZero
                  let statusText = 'Belum'
                  let statusBadgeClass = styles.statusBelum
                  
                  if (isMinus) { rowClass = styles.rowMinus; statusText = 'Minus'; statusBadgeClass = styles.statusMinus }
                  else if (isPlus) { rowClass = styles.rowPlus; statusText = 'Plus'; statusBadgeClass = styles.statusPlus }
                  else if (isZero) { rowClass = styles.rowZero; statusText = 'Cocok'; statusBadgeClass = styles.statusOk }

                  const rak = item.lokasi_rak || item.sizes[0]?.lokasi_rak || null

                  return (
                    <tr key={i} className={rowClass}>
                      <td>{i + 1}</td>
                      <td className={styles.sku}>{item.sku}</td>
                      <td>{item.nama_barang}</td>
                      <td>{item.kategori}</td>
                      <td className={styles.sizeDetails}>
                        {formatSizeData(item.sizes)}
                      </td>
                      <td className={styles.textCenter}>{item.total_sistem}</td>
                      <td className={styles.textCenter}>{item.total_real || '-'}</td>
                      <td className={`${styles.textCenter} ${isMinus ? styles.selisihMinus : isPlus ? styles.selisihPlus : styles.selisihZero}`}>
                        {isBelum ? (
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(77,70,53,0.3)' }}>remove</span>
                        ) : isMinus ? `${item.total_selisih}` : isPlus ? `+${item.total_selisih}` : '0'}
                      </td>
                      <td className={styles.textCenter}>
                        {rak ? (
                          <span className={styles.rakBadge}>
                            <span className="material-symbols-outlined">inventory_2</span>
                            {rak}
                          </span>
                        ) : (
                          <span className={styles.rakEmpty}>-</span>
                        )}
                      </td>
                      <td className={styles.textRight}>
                        <span className={`${styles.statusBadge} ${statusBadgeClass}`}>
                          {isBelum && <span className={styles.statusDot}></span>}
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.reportEmpty}>
            <span className="material-symbols-outlined">folder_open</span>
            <p>Tidak ada data</p>
          </div>
        )}

        <div className={styles.reportPagination}>
          <span className={styles.reportPaginationInfo}>
            Menampilkan 1-{filteredData.length} dari {allItems.length} data
          </span>
          <div className={styles.reportPaginationControls}>
            <button className={styles.reportPaginationBtn} disabled>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className={`${styles.reportPaginationPage} ${styles.active}`}>1</button>
            <button className={styles.reportPaginationPage}>2</button>
            <button className={styles.reportPaginationPage}>3</button>
            <span className={styles.reportPaginationDots}>...</span>
            <button className={styles.reportPaginationBtn}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}