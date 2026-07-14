// apps/web/src/components/pages/Report/ReportPage.tsx
import { useState, useRef, useEffect } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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
}

export function ReportPage({ navigateTo, showToast }: ReportPageProps) {
  const { token } = useAuth()
  const reportRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState<'semua' | 'minus' | 'plus' | 'belum' | 'sesuai'>('semua')

  // ============================================================
  // ✅ FETCH REPORT DARI API
  // ============================================================
  useEffect(() => {
    const fetchReport = async () => {
      setFetching(true)
      try {
        const result = await api.get<{ success: boolean; data: any[]; summary: any }>(
          '/api/report',
          token || undefined
        )
        
        console.log('[Report] Response data length:', result?.data?.length)
        
        if (result?.success && result?.data) {
          setReportData(result.data)
          setSummary(result.summary)
        } else if (result?.data) {
          setReportData(result.data)
        }
      } catch (error) {
        console.error('[Report] Error fetching:', error)
        showToast('❌ Gagal memuat laporan')
      } finally {
        setFetching(false)
      }
    }
    fetchReport()
  }, [token, showToast])

  // ============================================================
  // GROUP BY SKU - 1 BARIS PER SKU (SEMUA DATA)
  // ============================================================
  const groupedProducts = reportData.reduce<Record<string, GroupedProduct>>((acc, curr) => {
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
        isComplete: true
      }
    }

    const isOpnamed = curr.status !== 'belum' && curr.status !== undefined && curr.status !== null
    const selisih = curr.selisih ?? null
    const status = curr.status || 'belum'

    // 🔥 FIX: Tambahkan size ke SKU (termasuk yang belum)
    acc[sku].sizes.push({
      size: curr.size || 'OS',
      sistem: curr.stock_sistem || 0,
      real: isOpnamed ? (curr.stock_real || 0) : null,
      selisih: selisih,
      status: status === 'sesuai' ? 'sesuai' : 
              status === 'keluar' ? 'minus' : 
              status === 'masuk' ? 'plus' : 'belum'
    })

    // 🔥 FIX: TOTAL_SISTEM harus dihitung SEMUA (termasuk yang belum)
    acc[sku].total_sistem += curr.stock_sistem || 0

    // 🔥 FIX: TOTAL_REAL hanya untuk yang sudah opname
    if (isOpnamed) {
      acc[sku].total_real += curr.stock_real || 0
      acc[sku].total_selisih += selisih || 0
    }

    // 🔥 FIX: isComplete = false kalo ada size yang belum
    if (!isOpnamed) {
      acc[sku].isComplete = false
    }

    return acc
  }, {})

  // ============================================================
  // FORMAT SIZE DETAILS (pake Material Icons)
  // ============================================================
  const formatSizeData = (sizes: SizeData[]): JSX.Element[] => {
    return sizes.map((s, idx) => {
      const real = s.real !== null ? s.real : '0'
      const selisih = s.selisih

      let icon = 'block'
      let colorClass = styles.sizeIconMuted
      let label = ''

      if (s.status === 'kosong') {
        icon = 'block'
        colorClass = styles.sizeIconMuted
        label = `${s.size}: 0`
      } else if (s.status === 'belum') {
        icon = 'hourglass_empty'
        colorClass = styles.sizeIconPending
        label = `${s.size}: ${s.sistem}`
      } else if (selisih === null) {
        icon = 'help_outline'
        colorClass = styles.sizeIconMuted
        label = `${s.size}: ${real}`
      } else if (selisih === 0) {
        icon = 'check_circle'
        colorClass = styles.sizeIconOk
        label = `${s.size}: ${real}`
      } else if (selisih < 0) {
        icon = 'arrow_downward'
        colorClass = styles.sizeIconMinus
        label = `${s.size}: ${real}`
      } else {
        icon = 'arrow_upward'
        colorClass = styles.sizeIconPlus
        label = `${s.size}: ${real}`
      }

      return (
        <span key={idx} className={`${styles.sizeChip} ${colorClass}`}>
          <span className={styles.sizeLabel}>{s.size}</span>
          <span className={styles.sizeQty}>{s.sistem}</span>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            {icon}
          </span>
        </span>
      )
    })
  }

  // ============================================================
  // HITUNG STATS
  // ============================================================
  const allItems = Object.values(groupedProducts)
  console.log('[Report] Total SKU (grouped):', allItems.length)
  
  // Item yang sudah di-opname (minimal 1 size)
  const opnameItems = allItems.filter((item: GroupedProduct) => {
    return item.sizes.some(s => s.status === 'sesuai' || s.status === 'minus' || s.status === 'plus')
  })
  
  // Item yang belum di-opname sama sekali
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

  // ============================================================
  // SIZE STATS
  // ============================================================
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
    if (!reportRef.current) return
    setLoading(true)
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`laporan-opname-${new Date().toISOString().slice(0, 10)}.pdf`)
      showToast('✅ Laporan PDF berhasil di-download!')
    } catch (error) {
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
          <p>Memuat laporan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.reportPage}>
      {/* Header */}
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
          <button
            className={styles.reportExportBtn}
            onClick={handleExportPDF}
            disabled={loading || opnameItems.length === 0}
          >
            <span className="material-symbols-outlined">picture_as_pdf</span>
            {loading ? '⏳ Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div ref={reportRef} className={styles.reportContent}>
        {/* Summary */}
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
              <div className={styles.reportSummaryBarFill} style={{ width: `${progress}%` }}></div>
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

        {/* Size Stats */}
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

        {/* Tabs */}
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

        {/* Table */}
        {filteredData.length > 0 ? (
          <div className={styles.reportTableWrapper}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>SKU</th>
                  <th>Nama Barang</th>
                  <th>Size &amp; Data</th>
                  <th className={styles.textCenter}>T. Sistem</th>
                  <th className={styles.textCenter}>T. Real</th>
                  <th className={styles.textCenter}>Selisih</th>
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

                  return (
                    <tr key={i} className={rowClass}>
                      <td>{i + 1}</td>
                      <td className={styles.sku}>{item.sku}</td>
                      <td>{item.nama_barang}</td>
                      <td className={styles.sizeDetails}>
                        <div className={styles.sizeChips}>
                          {formatSizeData(item.sizes)}
                        </div>
                      </td>
                      <td className={styles.textCenter}>{item.total_sistem}</td>
                      <td className={styles.textCenter}>{item.total_real || '-'}</td>
                      <td className={`${styles.textCenter} ${
                        isMinus ? styles.selisihMinus :
                        isPlus ? styles.selisihPlus :
                        styles.selisihZero
                      }`}>
                        {isBelum ? (
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(77,70,53,0.3)' }}>
                            remove
                          </span>
                        ) : isMinus ? `${item.total_selisih}` :
                          isPlus ? `+${item.total_selisih}` :
                          '0'}
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

        {/* Pagination */}
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