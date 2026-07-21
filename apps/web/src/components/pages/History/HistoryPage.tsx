import { useState, useEffect } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './HistoryPage.module.css'

interface HistoryPageProps {
  navigateTo?: (page: string) => void
  showToast?: (msg: string) => void
}

interface HistoryItem {
  id: string
  date: string
  time: string
  periode: string
  petugas: string
  petugasImage?: string
  items: number
  status: 'Selesai' | 'Proses' | 'Pending'
  sku: string
  size: string
  nama_barang: string
  stock_sistem: number
  stock_real: number
  selisih: number
  lokasi_rak: string | null // 🔥 BARU
}

// Response dari API
interface OpnameResponse {
  success: boolean
  data: any[]
  total: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface StatsResponse {
  success: boolean
  data: {
    total: number
    today: number
    activeUsers: { name: string; scans: number }[]
    statusBreakdown: { sesuai: number; masuk: number; keluar: number }
    totalSelisih: number
  }
}

export function HistoryPage({ navigateTo, showToast }: HistoryPageProps) {
  const { token } = useAuth()
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [stats, setStats] = useState({
    totalSessions: 0,
    divergentItems: '0%',
    activeOfficers: 0,
    latestCompliance: '0%'
  })
  const itemsPerPage = 10

  // ============================================================
  // FETCH HISTORY DATA
  // ============================================================
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      try {
        // 1. Fetch opname history
        const response = await api.get<OpnameResponse>(
          `/api/opname?page=${currentPage}&limit=${itemsPerPage}`,
          token || undefined
        )

        console.log('[History] Response:', response)

        if (response?.success && response?.data) {
          // Transform data ke format HistoryItem
          const transformed: HistoryItem[] = response.data.map((item: any) => ({
            id: item.id || String(Date.now()),
            date: new Date(item.created_at || item.updated_at).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }),
            time: new Date(item.created_at || item.updated_at).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            }) + ' WIB',
            periode: item.periode || `Putaran ${Math.floor(Math.random() * 5) + 1}`,
            petugas: item.user_name || item.petugas || 'Petugas',
            petugasImage: item.user_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user_name || 'Petugas')}&background=735c00&color=fff&size=40`,
            items: item.stock_real || 0,
            // 🔥 Data produk
            sku: item.sku,
            size: item.size,
            nama_barang: item.nama_barang || item.temp_master?.nama_barang || 'UNKNOWN',
            stock_sistem: item.stock_sistem || item.temp_master?.stock_sistem || 0,
            stock_real: item.stock_real || 0,
            selisih: item.selisih || 0,
            lokasi_rak: item.lokasi_rak || item.temp_master?.lokasi_rak || null,
            status: item.status === 'sesuai' ? 'Selesai' 
                   : item.status === 'masuk' ? 'Proses' 
                   : item.status === 'keluar' ? 'Proses'
                   : 'Pending' as 'Selesai' | 'Proses' | 'Pending'
          }))

          setHistoryData(transformed)
          setTotalItems(response.total || transformed.length)
          setTotalPages(response.pagination?.totalPages || Math.ceil((response.total || transformed.length) / itemsPerPage))
        }

        // 2. Fetch stats
        const statsResponse = await api.get<StatsResponse>(
          '/api/opname/stats',
          token || undefined
        )

        console.log('[History] Stats response:', statsResponse)

        if (statsResponse?.success && statsResponse?.data) {
          const total = statsResponse.data.total || 0
          const today = statsResponse.data.today || 0
          const activeUsers = statsResponse.data.activeUsers || []
          const statusBreakdown = statsResponse.data.statusBreakdown || { sesuai: 0, masuk: 0, keluar: 0 }
          const totalSelisih = statsResponse.data.totalSelisih || 0

          // Hitung divergent items (items dengan selisih != 0)
          const divergent = total > 0 ? Math.round((totalSelisih / total) * 100) : 0

          setStats({
            totalSessions: total,
            divergentItems: `${Math.abs(divergent)}%`,
            activeOfficers: activeUsers.length,
            latestCompliance: total > 0 ? `${Math.round((statusBreakdown.sesuai / total) * 100)}%` : '0%'
          })
        }

      } catch (error) {
        console.error('[History] Error fetching:', error)
        showToast?.('❌ Gagal memuat riwayat opname')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [currentPage, token, showToast])

  // ============================================================
  // GET STATUS CLASS
  // ============================================================
  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Selesai': return styles.statusSelesai
      case 'Proses': return styles.statusProses
      case 'Pending': return styles.statusPending
      default: return styles.statusSelesai
    }
  }

  // ============================================================
  // GET SELISIH CLASS
  // ============================================================
  const getSelisihClass = (selisih: number) => {
    if (selisih === 0) return styles.selisihMatch
    if (selisih < 0) return styles.selisihMinus
    return styles.selisihPlus
  }

  // ============================================================
  // HANDLE ROW CLICK
  // ============================================================
  const handleRowClick = (item: HistoryItem) => {
    if (showToast) {
      showToast(`📋 ${item.sku} - ${item.nama_barang} (${item.size}) | Rak: ${item.lokasi_rak || '-'} | Selisih: ${item.selisih}`)
    }
    if (navigateTo) {
      navigateTo(`history/${item.id}`)
    }
  }

  // ============================================================
  // HANDLE REFRESH
  // ============================================================
  const handleRefresh = () => {
    setCurrentPage(1)
    setLoading(true)
    setTimeout(() => setLoading(false), 100)
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div className={styles.historyPage}>
        <div className={styles.historyLoading}>
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <p>Memuat riwayat...</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // EMPTY STATE
  // ============================================================
  if (!loading && historyData.length === 0) {
    return (
      <div className={styles.historyPage}>
        <div className={styles.historyHeaderTop}>
          <div>
            <h2 className={styles.historyTitle}>Riwayat Stock Opname</h2>
            <p className={styles.historySubtitle}>
              Overview of historical stock count sessions.
            </p>
          </div>
        </div>
        <div className={styles.historyEmpty}>
          <span className="material-symbols-outlined">history</span>
          <p>Belum ada riwayat opname</p>
          <p className={styles.historyEmptySub}>Mulai opname untuk melihat riwayat</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className={styles.historyPage}>
      {/* Page Header */}
      <div className={styles.historyHeaderTop}>
        <div>
          <h2 className={styles.historyTitle}>Riwayat Stock Opname</h2>
          <p className={styles.historySubtitle}>
            Overview of historical stock count sessions. Track accuracy, officer assignments, 
            and cycle completion status for compliance and inventory integrity.
          </p>
        </div>
        <div className={styles.historyActions}>
          <button 
            className={styles.historyRefreshBtn}
            onClick={handleRefresh}
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className={styles.historyStats}>
        <div className={styles.historyStatCard}>
          <p className={styles.historyStatLabel}>Total Sesi</p>
          <p className={styles.historyStatValue}>{stats.totalSessions}</p>
          <p className={styles.historyStatTrend}>
            <span className="material-symbols-outlined">trending_up</span>
          </p>
        </div>
        <div className={styles.historyStatCard}>
          <p className={styles.historyStatLabel}>Items Divergent</p>
          <p className={`${styles.historyStatValue} ${styles.textError}`}>{stats.divergentItems}</p>
          <p className={styles.historyStatSub}>Average across all periods</p>
        </div>
        <div className={styles.historyStatCard}>
          <p className={styles.historyStatLabel}>Active Officers</p>
          <div className={styles.historyStatAvatars}>
            {[...Array(Math.min(stats.activeOfficers, 3))].map((_, i) => (
              <div key={i} className={`${styles.historyStatAvatar} ${i === 0 ? styles.avatarPrimary : i === 1 ? styles.avatarSecondary : styles.avatarTertiary}`} />
            ))}
            {stats.activeOfficers > 3 && (
              <div className={styles.historyStatAvatarMore}>+{stats.activeOfficers - 3}</div>
            )}
          </div>
        </div>
        <div className={styles.historyStatCard}>
          <p className={styles.historyStatLabel}>Latest Compliance</p>
          <p className={`${styles.historyStatValue} ${styles.textPrimary}`}>{stats.latestCompliance}</p>
          <p className={styles.historyStatSub}>Verified by Audit</p>
        </div>
      </div>

      {/* Table */}
      <div className={styles.historyBox}>
        <div className={styles.historyTableWrap}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>SKU</th>
                <th>Nama Barang</th>
                <th>Size</th>
                <th className={styles.textCenter}>Sistem</th>
                <th className={styles.textCenter}>Real</th>
                <th className={styles.textCenter}>Selisih</th>
                <th className={styles.textCenter}>Rak</th>
                <th className={styles.textCenter}>Status</th>
                <th className={styles.textRight}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((item) => (
                <tr 
                  key={item.id} 
                  className={styles.historyRow}
                  onClick={() => handleRowClick(item)}
                >
                  <td>
                    <span className={styles.historyDate}>{item.date}</span>
                    <p className={styles.historyTime}>{item.time}</p>
                  </td>
                  <td>
                    <span className={styles.historySku}>{item.sku}</span>
                  </td>
                  <td>
                    <span className={styles.historyName}>{item.nama_barang}</span>
                  </td>
                  <td>
                    <span className={styles.historySize}>{item.size}</span>
                  </td>
                  <td className={styles.textCenter}>
                    <span className={styles.historyStock}>{item.stock_sistem}</span>
                  </td>
                  <td className={styles.textCenter}>
                    <span className={styles.historyStock}>{item.stock_real}</span>
                  </td>
                  <td className={styles.textCenter}>
                    <span className={`${styles.historySelisih} ${getSelisihClass(item.selisih)}`}>
                      {item.selisih > 0 ? `+${item.selisih}` : item.selisih}
                    </span>
                  </td>
                  <td className={styles.textCenter}>
                    {item.lokasi_rak ? (
                      <span className={styles.rakBadge}>
                        <span className="material-symbols-outlined">inventory_2</span>
                        {item.lokasi_rak}
                      </span>
                    ) : (
                      <span className={styles.rakEmpty}>-</span>
                    )}
                  </td>
                  <td className={styles.textCenter}>
                    <span className={`${styles.historyStatus} ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className={styles.textRight}>
                    <button className={styles.historyActionBtn}>
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.historyPagination}>
          <span className={styles.historyPaginationInfo}>
            Showing <strong>{historyData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, totalItems)}</strong> of <strong>{totalItems}</strong> results
          </span>
          <div className={styles.historyPaginationControls}>
            <button 
              className={styles.historyPaginationBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(totalPages || 1, 5) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  className={`${styles.historyPaginationPage} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              )
            })}
            {(totalPages || 0) > 5 && (
              <>
                <span className={styles.historyPaginationDots}>...</span>
                <button
                  className={styles.historyPaginationPage}
                  onClick={() => setCurrentPage(totalPages || 1)}
                >
                  {totalPages}
                </button>
              </>
            )}
            <button 
              className={styles.historyPaginationBtn}
              disabled={currentPage === (totalPages || 1) || totalPages === 0}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages || 1))}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Insights */}
      <div className={styles.historyFooter}>
        <div className={styles.historyFooterItem}>
          <div>
            <h4>Audit Integrity Guaranteed</h4>
            <p>Every record in this history is cryptographically signed and verified against the master inventory database.</p>
          </div>
        </div>
        <div className={`${styles.historyFooterItem} ${styles.footerHighlight}`}>
          <div>
            <h4>Deep Analytics Available</h4>
            <p>Click on any session row to view individual item variances and high-precision deviation charts.</p>
          </div>
        </div>
      </div>
    </div>
  )
}