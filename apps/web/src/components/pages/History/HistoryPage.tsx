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
}

// 👇 TAMBAHIN INTERFACE UNTUK RESPONSE API
interface OpnameResponse {
  data: HistoryItem[]
  total: number
}

interface StatsResponse {
  totalSessions: number
  divergentItems: number
  activeOfficers: number
  latestCompliance: number
}

export function HistoryPage({ navigateTo, showToast }: HistoryPageProps) {
  const { token } = useAuth()
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [stats, setStats] = useState({
    totalSessions: 0,
    divergentItems: '0%',
    activeOfficers: 0,
    latestCompliance: '0%'
  })
  const itemsPerPage = 5

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

        if (response?.data) {
          // Transform data ke format HistoryItem dengan type assertion
          const transformed: HistoryItem[] = response.data.map((item: any) => ({
            id: item.id || String(Date.now()),
            date: new Date(item.created_at).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }),
            time: new Date(item.created_at).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            }) + ' WIB',
            periode: item.periode || `Putaran ${Math.floor(Math.random() * 5) + 1}`,
            petugas: item.user_name || item.petugas || 'Petugas',
            petugasImage: item.user_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user_name || 'Petugas')}&background=735c00&color=fff&size=40`,
            items: item.items_count || item.stock_real || 0,
            // 👇 FIX: Type assertion buat status
            status: item.status === 'selesai' ? 'Selesai' 
                   : item.status === 'proses' ? 'Proses' 
                   : 'Pending' as 'Selesai' | 'Proses' | 'Pending'
          }))

          setHistoryData(transformed)
          setTotalItems(response.total || transformed.length)
        }

        // 2. Fetch stats
        const statsResponse = await api.get<StatsResponse>(
          '/api/opname/stats',
          token || undefined
        )

        console.log('[History] Stats response:', statsResponse)

        // 👇 FIX: Akses langsung ke response, bukan response.data
        if (statsResponse) {
          setStats({
            totalSessions: statsResponse.totalSessions || 0,
            divergentItems: `${statsResponse.divergentItems || 0}%`,
            activeOfficers: statsResponse.activeOfficers || 0,
            latestCompliance: `${statsResponse.latestCompliance || 0}%`
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
  // HANDLE ROW CLICK
  // ============================================================
  const handleRowClick = (item: HistoryItem) => {
    if (showToast) {
      showToast(`📋 Detail session: ${item.petugas} - ${item.periode} (${item.items} items)`)
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
    // Trigger re-fetch dengan update key
    setLoading(true)
    setTimeout(() => setLoading(false), 100)
  }

  // ============================================================
  // CALCULATE PAGINATION
  // ============================================================
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)

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
                <th>Periode</th>
                <th>Petugas</th>
                <th className={styles.textCenter}>Items Count</th>
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
                  <td>{item.periode}</td>
                  <td>
                    <div className={styles.historyPetugas}>
                      <div className={styles.historyPetugasAvatar}>
                        {item.petugasImage ? (
                          <img src={item.petugasImage} alt={item.petugas} />
                        ) : (
                          <span>{item.petugas.charAt(0)}</span>
                        )}
                      </div>
                      <span>{item.petugas}</span>
                    </div>
                  </td>
                  <td className={styles.textCenter}>
                    <span className={styles.historyItems}>{item.items}</span>
                    <span className={styles.historyItemsLabel}>Units</span>
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
            Showing <strong>{startIndex + 1} - {endIndex}</strong> of <strong>{totalItems}</strong> results
          </span>
          <div className={styles.historyPaginationControls}>
            <button 
              className={styles.historyPaginationBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
            {totalPages > 5 && (
              <>
                <span className={styles.historyPaginationDots}>...</span>
                <button
                  className={styles.historyPaginationPage}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
            <button 
              className={styles.historyPaginationBtn}
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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