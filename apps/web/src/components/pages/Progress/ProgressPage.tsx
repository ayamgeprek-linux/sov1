// apps/web/src/components/pages/Progress/ProgressPage.tsx
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './ProgressPage.module.css'

interface ProgressPageProps {
  products: any[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

interface ProgressItem {
  sku: string
  nama_barang: string
  kategori: string
  size: string
  stock_sistem: number
  stock_real: number
  selisih: number
  status: string
  lokasi_rak: string | null
  user_name: string
  updated_at: string
}

export function ProgressPage({ products, navigateTo, showToast }: ProgressPageProps) {
  const { token } = useAuth()
  const [opnameData, setOpnameData] = useState<ProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'semua' | 'aktif'>('semua')

  // ============================================================
  // HITUNG STATS DARI DATA
  // ============================================================
  const stats = useMemo(() => {
    const total = products?.length || 0
    const done = opnameData?.length || 0
    const remaining = Math.max(0, total - done)
    const progress = total > 0 ? Math.round((done / total) * 100) : 0
    const totalSelisih = opnameData?.reduce((acc: number, item: any) => acc + (item.selisih || 0), 0) || 0

    const userMap = new Map<string, { items: number; selisih: number }>()
    opnameData?.forEach((item: any) => {
      const name = item.user_name || 'Petugas'
      if (!userMap.has(name)) {
        userMap.set(name, { items: 0, selisih: 0 })
      }
      const user = userMap.get(name)!
      user.items += 1
      user.selisih += item.selisih || 0
    })

    const petugasList = Array.from(userMap.entries()).map(([name, data]) => ({
      name,
      items: data.items,
      selisih: data.selisih,
      progress: done > 0 ? Math.round((data.items / done) * 100) : 0,
      status: data.items > 0 ? 'active' : 'idle'
    }))

    return { total, done, remaining, progress, totalSelisih, petugasList }
  }, [products, opnameData])

  // ============================================================
  // FETCH DATA DARI API + GABUNGIN DENGAN PRODUCTS
  // ============================================================
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        console.log('[Progress] Fetching opname data...')
        const response = await api.get<{ data: any[]; success?: boolean }>('/api/opname', token || undefined)
        
        let rawData: any[] = []
        if (response) {
          if (Array.isArray(response)) {
            rawData = response
          } else if (response.data && Array.isArray(response.data)) {
            rawData = response.data
          } else if (response.success && response.data && Array.isArray(response.data)) {
            rawData = response.data
          }
        }
        
        console.log('[Progress] Raw data:', rawData.length)

        // 🔥 GABUNGIN DENGAN PRODUCTS
        const mergedData: ProgressItem[] = rawData.map((item: any) => {
          const product = products?.find((p: any) => p.sku === item.sku && p.size === item.size)
          return {
            sku: item.sku,
            nama_barang: product?.nama_barang || item.nama_barang || 'UNKNOWN',
            kategori: product?.kategori || item.kategori || 'UNKNOWN',
            size: item.size || 'OS',
            stock_sistem: product?.stock_sistem || item.stock_sistem || 0,
            stock_real: item.stock_real || 0,
            selisih: item.selisih || 0,
            status: item.status || 'belum',
            lokasi_rak: item.lokasi_rak || product?.lokasi_rak || null,
            user_name: item.user_name || 'Petugas',
            updated_at: item.updated_at || item.created_at || new Date().toISOString()
          }
        })

        setOpnameData(mergedData)
        console.log('[Progress] Merged data:', mergedData.length)

      } catch (error) {
        console.error('[Progress] Error fetching:', error)
        showToast?.('❌ Gagal memuat data progress')
        setOpnameData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token, showToast, products])

  const filteredPetugas = filter === 'aktif' 
    ? stats.petugasList.filter(p => p.status === 'active')
    : stats.petugasList

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return { label: 'Aktif', className: styles.statusActive }
      case 'idle': return { label: 'Istirahat', className: styles.statusIdle }
      default: return { label: 'Unknown', className: styles.statusIdle }
    }
  }

  const circumference = 2 * Math.PI * 88
  const offset = circumference - (stats.progress / 100) * circumference

  if (loading) {
    return (
      <div className={styles.progressPage}>
        <div className={styles.progressLoading}>
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <p>Memuat data...</p>
        </div>
      </div>
    )
  }

  const sortedPetugas = [...stats.petugasList].sort((a, b) => b.items - a.items)
  const topPerformers = sortedPetugas.slice(0, 3)

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  const totalSelisihDisplay = stats.totalSelisih > 0 ? `+${stats.totalSelisih}` : stats.totalSelisih

  return (
    <div className={styles.progressPage}>
      <div className={styles.meshBg}></div>

      <header className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>Monitoring progres sistem stock</h2>
          <p className={styles.headerSubtitle}>data real time production</p>
        </div>
        <div className={styles.headerFilter}>
          <button 
            className={`${styles.filterBtn} ${filter === 'semua' ? styles.active : ''}`}
            onClick={() => setFilter('semua')}
          >
            Semua Petugas
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'aktif' ? styles.active : ''}`}
            onClick={() => setFilter('aktif')}
          >
            Aktif Saja
          </button>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.glassCard}`}>
          <div className={styles.statCardHeader}>
            <div className={styles.statCardIcon}>
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <span className="material-symbols-outlined">more_vert</span>
          </div>
          <p className={styles.statCardLabel}>Total Barang</p>
          <div className={styles.statCardValue}>
            <h3>{stats.total.toLocaleString()}</h3>
            <span>{stats.total > 0 ? '100%' : '0%'}</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.glassCard} ${styles.cardSuccess}`}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statCardIcon} ${styles.iconSuccess}`}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>
          <p className={styles.statCardLabel}>Sudah Opname</p>
          <div className={styles.statCardValue}>
            <h3>{stats.done.toLocaleString()}</h3>
            <div className={styles.statCardBar}>
              <div className={styles.statCardBarFill} style={{ width: `${stats.progress}%` }} />
            </div>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.glassCard}`}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statCardIcon} ${styles.iconWarning}`}>
              <span className="material-symbols-outlined">hourglass_empty</span>
            </div>
          </div>
          <p className={styles.statCardLabel}>Sisa Barang</p>
          <div className={styles.statCardValue}>
            <h3 className={styles.textWarning}>{stats.remaining.toLocaleString()}</h3>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.glassCard}`}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statCardIcon} ${styles.iconDanger}`}>
              <span className="material-symbols-outlined">report</span>
            </div>
          </div>
          <p className={styles.statCardLabel}>Total Selisih</p>
          <div className={styles.statCardValue}>
            <h3 className={styles.textDanger}>{totalSelisihDisplay}</h3>
            <span className={styles.statCardSub}>Discrepancy</span>
          </div>
        </div>
      </div>

      <div className={styles.bentoGrid}>
        <div className={`${styles.gaugeCard} ${styles.glassCard}`}>
          <h4 className={styles.gaugeTitle}>Progress Overview</h4>
          <div className={styles.gaugeContainer}>
            <div className={styles.gauge}>
              <svg className={styles.gaugeSvg} viewBox="0 0 192 192">
                <circle className={styles.gaugeBg} cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="none" />
                <circle 
                  className={styles.gaugeProgress} 
                  cx="96" 
                  cy="96" 
                  r="88" 
                  stroke="currentColor" 
                  strokeWidth="12" 
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <span className={styles.gaugePercent}>{stats.progress}%</span>
                <span className={styles.gaugeLabel}>SELESAI</span>
              </div>
            </div>
            <div className={styles.gaugeStats}>
              <div className={styles.gaugeStatItem}>
                <p className={styles.gaugeStatLabel}>Items Selesai</p>
                <p className={styles.gaugeStatValue}>{stats.done.toLocaleString()} item</p>
              </div>
              <div className={styles.gaugeStatItem}>
                <p className={styles.gaugeStatLabel}>Total Items</p>
                <p className={`${styles.gaugeStatValue} ${styles.textPrimary}`}>{stats.total.toLocaleString()} item</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.performersCard} ${styles.glassCard}`}>
          <div className={styles.performersHeader}>
            <h4 className={styles.performersTitle}>Top Performers</h4>
            <button className={styles.performersViewAll}>View All</button>
          </div>
          <div className={styles.performersList}>
            {topPerformers.length === 0 ? (
              <div className={styles.performersEmpty}>
                <span className="material-symbols-outlined">person_search</span>
                <p>Belum ada petugas aktif</p>
              </div>
            ) : (
              topPerformers.map((p, idx) => {
                const percent = stats.done > 0 ? Math.round((p.items / stats.done) * 100) : 0
                const colors = ['primary', 'secondary', 'tertiary']
                const color = colors[idx] || 'primary'
                return (
                  <div key={idx} className={styles.performerItem}>
                    <div className={`${styles.performerAvatar} ${styles[`avatar${color.charAt(0).toUpperCase() + color.slice(1)}`]}`}>
                      {getInitials(p.name)}
                    </div>
                    <div className={styles.performerInfo}>
                      <div className={styles.performerRow}>
                        <span className={styles.performerName}>{p.name}</span>
                        <span className={styles.performerItems}>{p.items} Items</span>
                      </div>
                      <div className={styles.performerBar}>
                        <div className={`${styles.performerBarFill} ${styles[`bar${color.charAt(0).toUpperCase() + color.slice(1)}`]}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className={styles.performersFooter}>
            <div>
              <p className={styles.performersFooterLabel}>Team Target Achievement</p>
            </div>
            <div className={styles.performersFooterRight}>
              <span className={styles.performersFooterPercent}>{stats.progress}%</span>
              <p className={styles.performersFooterVs}>Progress</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.globalProgress} ${styles.glassCard}`}>
        <div className={styles.globalProgressHeader}>
          <h4 className={styles.globalProgressTitle}>Global Progress Tracker</h4>
          <div className={styles.globalProgressRight}>
            <span className={styles.globalProgressPercent}>{stats.progress}%</span>
            <span className={styles.globalProgressVerified}>Verified</span>
          </div>
        </div>
        <div className={styles.globalProgressBar}>
          <div className={styles.globalProgressFill} style={{ width: `${stats.progress}%` }} />
          <div className={styles.globalProgressMarkers}>
            <div className={styles.globalProgressMarker} />
            <div className={styles.globalProgressMarker} />
            <div className={styles.globalProgressMarker} />
            <div className={styles.globalProgressMarker} />
          </div>
        </div>
        <div className={styles.globalProgressFooter}>
          <div className={styles.globalProgressLeft}>
            <span className={styles.globalProgressDot} />
            <span>
              {stats.done.toLocaleString()} item dari {stats.total.toLocaleString()} item selesai 
              ({stats.progress}%)
            </span>
          </div>
          <div className={styles.globalProgressRight}>
            <span className={styles.globalProgressError}>
              {stats.totalSelisih !== 0 ? `Total selisih: ${totalSelisihDisplay}` : 'Tidak ada selisih'}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE - dengan data lengkap */}
      <div className={`${styles.tableCard} ${styles.glassCard}`}>
        <div className={styles.tableHeader}>
          <h4 className={styles.tableTitle}>Detail Progress Opname</h4>
          <div className={styles.tableActions}>
            <button className={styles.tableActionBtn}>
              <span className="material-symbols-outlined">filter_list</span>
            </button>
            <button className={styles.tableActionBtn}>
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nama Barang</th>
                <th>Size</th>
                <th className={styles.textCenter}>Sistem</th>
                <th className={styles.textCenter}>Real</th>
                <th className={styles.textCenter}>Selisih</th>
                <th className={styles.textCenter}>Rak</th>
                <th className={styles.textCenter}>Status</th>
                <th>Petugas</th>
              </tr>
            </thead>
            <tbody>
              {opnameData.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.tableEmpty}>
                    <span className="material-symbols-outlined">inbox</span>
                    <p>Belum ada data opname</p>
                  </td>
                </tr>
              ) : (
                opnameData.map((item, idx) => {
                  const isMinus = item.selisih < 0
                  const isPlus = item.selisih > 0
                  const isMatch = item.selisih === 0

                  return (
                    <tr key={idx} className={styles.tableRow}>
                      <td>
                        <span className={styles.tableSku}>{item.sku}</span>
                      </td>
                      <td>
                        <span className={styles.tableName}>{item.nama_barang}</span>
                      </td>
                      <td>
                        <span className={styles.tableSize}>{item.size}</span>
                      </td>
                      <td className={styles.textCenter}>
                        <span className={styles.tableStock}>{item.stock_sistem}</span>
                      </td>
                      <td className={styles.textCenter}>
                        <span className={styles.tableStock}>{item.stock_real}</span>
                      </td>
                      <td className={styles.textCenter}>
                        <span className={`${styles.tableSelisih} ${
                          isMatch ? styles.selisihMatch :
                          isMinus ? styles.selisihMinus :
                          styles.selisihPlus
                        }`}>
                          {isMinus ? item.selisih : isPlus ? `+${item.selisih}` : '0'}
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
                        <span className={`${styles.statusBadge} ${
                          isMatch ? styles.statusMatch :
                          isMinus ? styles.statusMinus :
                          styles.statusPlus
                        }`}>
                          {isMatch ? (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                              Cocok
                            </>
                          ) : isMinus ? (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_downward</span>
                              Minus
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_upward</span>
                              Plus
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={styles.tablePetugas}>{item.user_name || 'Petugas'}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter}>
          <div className={styles.tablePagination}>
            <button className={styles.paginationBtn}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className={styles.paginationBtn}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}