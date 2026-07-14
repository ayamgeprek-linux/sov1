// apps/web/src/components/pages/Dashboard/Dashboard.tsx
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './Dashboard.module.css'

interface DashboardProps {
  products: any[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
  isPetugas?: boolean
}

interface ScanLog {
  id: string
  sku: string
  nama_barang: string
  size: string
  qty: number
  selisih: number
  status: string
  user_name?: string
  created_at: string
}

interface ActiveUser {
  name: string
  scans: number
  avatar: string
}

export function Dashboard({ products, navigateTo, showToast, isPetugas = false }: DashboardProps) {
  const { token, user } = useAuth()
  const [stats, setStats] = useState({
    total: 0,
    mapped: 0,
    unmapped: 0,
    progress: 0,
    verified: 0,
    quarantined: 0,
    pending: 0,
    totalSelisih: 0,
    opnamed: 0,
    doneItems: 0,
    remainingItems: 0
  })
  const [recentScans, setRecentScans] = useState<ScanLog[]>([])
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [loading, setLoading] = useState(true)

  // ============================================================
  // GET GREETING BASED ON TIME
  // ============================================================
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  // ============================================================
  // GET USER NAME FROM AUTH
  // ============================================================
  const userName = user?.name || user?.email?.split('@')[0] || 'Pengguna'
  const userRole = user?.role || 'admin'

  // ============================================================
  // FETCH USERS - AMBIL DARI OPNAME + USER LOGIN (NAMA ASLI)
  // ============================================================
 // ============================================================
// FETCH USERS - AMBIL DARI OPNAME + USER LOGIN
// ============================================================
const fetchUsers = useCallback(async () => {
  try {
    console.log('[Dashboard] Fetching users from opname + current user...')
    
    // Ambil data opname
    const result = await api.get<{ data: any[] }>('/api/opname', token || undefined)
    const opnameData = result.data || []
    
    console.log('[Dashboard] Opname data:', opnameData.length)
    
    // Map user dari opname (pake user_name)
    const userMap = new Map<string, { name: string; scans: number }>()
    opnameData.forEach((item: any) => {
      const name = item.user_name || 'Petugas'
      if (userMap.has(name)) {
        userMap.get(name)!.scans += 1
      } else {
        userMap.set(name, { name, scans: 1 })
      }
    })
    
    // TAMBAHKAN USER YANG SEDANG LOGIN
    if (user?.name) {
      const existing = userMap.get(user.name)
      if (existing) {
        existing.scans += 1
      } else {
        userMap.set(user.name, { name: user.name, scans: 1 })
      }
      console.log('[Dashboard] Current user added:', user.name)
    }
    
    // Convert ke array
    const users: ActiveUser[] = Array.from(userMap.entries()).map(([key, value]) => ({
      name: value.name,
      scans: value.scans,
      avatar: value.name.charAt(0).toUpperCase()
    }))
    
    // Urutkan berdasarkan scan terbanyak
    users.sort((a, b) => b.scans - a.scans)
    
    // 🔥 FILTER: HANYA HAPUS "admin" dan "system" (TAPI "Petugas" TETAP MUNCUL)
    const filteredUsers = users.filter(u => {
      const lowerName = u.name.toLowerCase()
      return lowerName !== 'admin' && lowerName !== 'system'
    })
    
    console.log('[Dashboard] Final users:', filteredUsers)
    setActiveUsers(filteredUsers)
    
  } catch (error) {
    console.error('[Dashboard] Fetch users error:', error)
    
    // FALLBACK: tampilin user login (kecuali admin)
    if (user?.name && user.name.toLowerCase() !== 'admin') {
      setActiveUsers([{
        name: user.name,
        scans: 0,
        avatar: user.name.charAt(0).toUpperCase()
      }])
    } else {
      setActiveUsers([])
    }
  }
}, [token, user])
  // ============================================================
  // FETCH ALL DATA
  // ============================================================
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch opname data
      const result = await api.get<{ data: ScanLog[] }>('/api/opname', token || undefined)
      const opnameData = result.data || []

      console.log('[Dashboard] Opname data:', opnameData.length)

      // 2. Hitung stats
      const total = products.length || 0
      const opnamed = opnameData.length
      const progress = total > 0 ? Math.round((opnamed / total) * 100) : 0
      const totalSelisih = opnameData.reduce((acc, item) => acc + (item.selisih || 0), 0)
      const mapped = products.filter(p => p.status_mapping).length || 0
      const unmapped = total - mapped

      setStats({
        total,
        mapped,
        unmapped,
        progress,
        verified: Math.round(total * 0.75),
        quarantined: 42,
        pending: total - Math.round(total * 0.75) - 42,
        totalSelisih,
        opnamed,
        doneItems: opnamed,
        remainingItems: total - opnamed
      })

      // 3. Process scan logs
      if (opnameData.length > 0) {
        const logs = opnameData.map((item: any) => {
          const product = products.find((p: any) => p.sku === item.sku && p.size === item.size)
          return {
            ...item,
            nama_barang: product?.nama_barang || 'Unknown',
            qty: item.stock_real || 0,
          }
        })
        setRecentScans(logs)
      }

      // 4. ✅ FETCH USERS
      await fetchUsers()

    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error)
      // Fallback: pake products
      const total = products.length
      const opnamed = products.filter(p => p.qty_fisik !== null && p.qty_fisik !== undefined).length
      const progress = total > 0 ? Math.round((opnamed / total) * 100) : 0
      setStats(prev => ({
        ...prev,
        total,
        opnamed,
        progress,
        doneItems: opnamed,
        remainingItems: total - opnamed
      }))
    } finally {
      setLoading(false)
    }
  }, [products, token, fetchUsers])

  // ============================================================
  // AUTO REFRESH
  // ============================================================
  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 30000)
    return () => clearInterval(interval)
  }, [fetchAllData])

  // ============================================================
  // FORMAT TIME
  // ============================================================
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      if (diff < 60000) return 'Baru saja'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch {
      return '-'
    }
  }

  // ============================================================
  // GET STATUS BADGE
  // ============================================================
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'sesuai': 
        return { 
          label: 'Sesuai', 
          icon: 'check_circle',
          className: styles.statusMatch 
        }
      case 'masuk': 
        return { 
          label: 'Lebih', 
          icon: 'trending_up',
          className: styles.statusPlus 
        }
      case 'keluar': 
        return { 
          label: 'Kurang', 
          icon: 'priority_high',
          className: styles.statusMinus 
        }
      default: 
        return { 
          label: 'Belum', 
          icon: 'hourglass_empty',
          className: styles.statusPending 
        }
    }
  }

  // ============================================================
  // PETUGAS VIEW
  // ============================================================
  if (isPetugas) {
    return (
      <div className={styles.dashboardPetugas}>
        <div className={styles.petugasHeader}>
          <div className={styles.petugasOnline}>
            <div className={styles.petugasDot}></div>
            ONLINE
          </div>
          <h2 className={styles.petugasTitle}>
            {getGreeting()}, {userName} 👋
          </h2>
          <p className={styles.petugasSubtitle}>
            Petugas Opname • {userRole === 'admin' ? 'Administrator' : 'Staff'}
          </p>
        </div>

        <div className={styles.petugasGrid}>
          <div className={styles.petugasCard} onClick={() => navigateTo('petugas-so')}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>qr_code_scanner</span>
            <div className={styles.petugasCardLabel}>Scan Barang</div>
            <div className={styles.petugasCardDesc}>Mulai opname</div>
          </div>
          <div className={styles.petugasCard} onClick={() => navigateTo('petugas-progress')}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>query_stats</span>
            <div className={styles.petugasCardLabel}>Lihat Progress</div>
            <div className={styles.petugasCardDesc}>Hari ini</div>
          </div>
        </div>

        <div className={styles.petugasStats}>
          <div className={styles.petugasStatsHeader}>
            <span>Barang sudah dihitung</span>
            <span className={styles.petugasStatsCount}>
              {recentScans.length} / {products.filter(p => p.stock_sistem > 0).length}
            </span>
          </div>
          <div className={styles.petugasStatsBar}>
            <div className={styles.petugasStatsFill} style={{ 
              width: `${products.filter(p => p.stock_sistem > 0).length > 0 ? Math.round((recentScans.length / products.filter(p => p.stock_sistem > 0).length) * 100) : 0}%` 
            }}></div>
          </div>
          <div className={styles.petugasStatsGrid}>
            <div className={styles.petugasStatsItem}>
              <div className={styles.petugasStatsNumber}>{recentScans.length}</div>
              <div className={styles.petugasStatsLabel}>Terinput</div>
            </div>
            <div className={styles.petugasStatsItem}>
              <div className={`${styles.petugasStatsNumber} ${styles.textOrange}`}>
                {recentScans.filter(s => s.selisih !== 0).length}
              </div>
              <div className={styles.petugasStatsLabel}>Selisih</div>
            </div>
            <div className={styles.petugasStatsItem}>
              <div className={styles.petugasStatsNumber}>{recentScans.length}</div>
              <div className={styles.petugasStatsLabel}>Total scan</div>
            </div>
          </div>
        </div>

        <div className={styles.petugasFooter}>PWA ready • {userName}</div>
      </div>
    )
  }

  // ============================================================
  // ADMIN VIEW
  // ============================================================
  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.headerTitle}>
            {getGreeting()}, <span className={styles.headerTitleAccent}>{userName}</span>
          </h2>
          <p className={styles.headerSubtitle}>
            {userRole === 'admin' ? 'Administrator' : 'Staff'} • {new Date().toLocaleDateString('id-ID', { 
              weekday: 'long', 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Content Canvas */}
      <div className={styles.contentCanvas}>
        <section className={styles.statsSection}>
          {/* Left Column: Main Stats */}
          <div className={styles.mainStats}>
            <div className={styles.mainStatsGlow}></div>
            <div className={styles.mainStatsContent}>
              <div className={styles.mainStatsHeader}>
                <span className={styles.mainStatsIndicator}></span>
                <p className={styles.mainStatsLabel}>Total Inventaris Terdaftar</p>
              </div>
              <div className={styles.mainStatsValue}>
                <h3 className={styles.mainStatsNumber}>{stats.total.toLocaleString()}</h3>
              </div>
              <div className={styles.mainStatsGrid}>
                <div className={styles.mainStatsGridItem}>
                  <p className={styles.mainStatsGridLabel}>Terverifikasi</p>
                  <p className={styles.mainStatsGridValue}>{stats.verified.toLocaleString()}</p>
                </div>
                <div className={styles.mainStatsGridItem}>
                  <p className={styles.mainStatsGridLabel}>Karantina</p>
                  <p className={`${styles.mainStatsGridValue} ${styles.textError}`}>{stats.quarantined}</p>
                </div>
                <div className={styles.mainStatsGridItem}>
                  <p className={styles.mainStatsGridLabel}>Pending</p>
                  <p className={`${styles.mainStatsGridValue} ${styles.textPrimary}`}>{stats.pending}</p>
                </div>
                <div className={styles.mainStatsGridItem}>
                  <p className={styles.mainStatsGridLabel}>Sudah Opname</p>
                  <p className={`${styles.mainStatsGridValue} ${styles.textGreen}`}>{stats.opnamed}</p>
                </div>
                <div className={styles.mainStatsGridItem}>
                  <p className={styles.mainStatsGridLabel}>Selisih</p>
                  <p className={`${styles.mainStatsGridValue} ${stats.totalSelisih === 0 ? styles.textGreen : styles.textOrange}`}>
                    {stats.totalSelisih > 0 ? `+${stats.totalSelisih}` : stats.totalSelisih}
                  </p>
                </div>
              </div>

              {/* PROGRESS CARD */}
              <div className={styles.mainStatsProgress}>
                <div className={styles.mainStatsProgressLeft}>
                  <p className={styles.mainStatsProgressLabel}>Progress Opname</p>
                  <p className={styles.mainStatsProgressTitle}>
                    {stats.progress}% Selesai
                  </p>
                  <div className={styles.mainStatsProgressBar}>
                    <div className={styles.mainStatsProgressFill} style={{ width: `${stats.progress}%` }}></div>
                  </div>
                  <div className={styles.mainStatsProgressDetail}>
                    <span>{stats.opnamed} dari {stats.total} item</span>
                    <span>Sisa: {stats.total - stats.opnamed} item</span>
                  </div>
                </div>
                <div className={styles.mainStatsProgressRight}>
                  <p className={styles.mainStatsProgressNumber}>{stats.progress}%</p>
                  <p className={styles.mainStatsProgressRemaining}>
                    {stats.progress >= 100 ? '✅ Selesai!' : '⏳ Berjalan...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Active Users */}
          <div className={styles.petugasList}>
            <div className={styles.petugasListHeader}>
              <div>
                <h4 className={styles.petugasListTitle}>Petugas Lapangan</h4>
                <p className={styles.petugasListSubtitle}>Status tim aktif saat ini</p>
              </div>
              <span className={styles.petugasListBadge}>
                <span className={styles.petugasListDot}></span>
                {activeUsers.length} Online
              </span>
            </div>
            <div className={styles.petugasListItems}>
              {activeUsers.length > 0 ? (
                activeUsers.map((user, idx) => (
                  <div key={idx} className={styles.petugasListItem}>
                    <div className={styles.petugasListAvatar}>
                      <span>{user.avatar}</span>
                    </div>
                    <div className={styles.petugasListInfo}>
                      <p className={styles.petugasListName}>{user.name}</p>
                      <p className={styles.petugasListLocation}>
                        {user.scans} scan • {user.scans > 0 ? '🟢 Aktif' : '⚪ Belum Scan'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.petugasListEmpty}>
                  <span className="material-symbols-outlined">person_off</span>
                  <p>Belum ada petugas terdaftar</p>
                </div>
              )}
            </div>
            <button 
              className={styles.petugasListBtn}
              onClick={() => navigateTo('progress')}
            >
              Lihat Semua Petugas
            </button>
          </div>
        </section>

        {/* Recent Scans Section */}
        <section className={styles.logsSection}>
          <div className={styles.logsContainer}>
            <div className={styles.logsHeader}>
              <div className={styles.logsHeaderLeft}>
                <div>
                  <h4 className={styles.logsTitle}>Riwayat Scan Terkini</h4>
                  <p className={styles.logsSubtitle}>Monitoring data pemindaian sinkron secara real-time</p>
                </div>
              </div>
              <div className={styles.logsHeaderRight}>
                <button className={styles.logsFilterBtn} onClick={() => navigateTo('history')}>
                  Filter Data
                </button>
                <button className={styles.logsFullBtn} onClick={() => navigateTo('history')}>
                  Log Lengkap
                </button>
              </div>
            </div>
            
            {/* Recent Scans List */}
            {loading ? (
              <div className={styles.logsLoading}>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                <p>Memuat data...</p>
              </div>
            ) : recentScans.length > 0 ? (
              <div className={styles.logsList}>
                {recentScans.slice(0, 10).map((scan) => {
                  const status = getStatusBadge(scan.status)
                  return (
                    <div key={scan.id} className={styles.logsItem}>
                      <div className={styles.logsItemLeft}>
                        <div className={styles.logsItemInfo}>
                          <p className={styles.logsItemName}>{scan.nama_barang}</p>
                          <p className={styles.logsItemSku}>{scan.sku} • {scan.size}</p>
                        </div>
                      </div>
                      <div className={styles.logsItemRight}>
                        <span className={styles.logsItemQty}>{scan.qty}</span>
                        <span className={`${styles.logsItemStatus} ${status.className}`}>
                          <span className="material-symbols-outlined">{status.icon}</span>
                          {status.label}
                        </span>
                        <span className={styles.logsItemTime}>{formatTime(scan.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.logsEmpty}>
                <div className={styles.logsEmptyIcon}>
                  <span className="material-symbols-outlined">data_exploration</span>
                  <div className={styles.logsEmptySync}>
                    <span className="material-symbols-outlined">sync</span>
                  </div>
                </div>
                <div className={styles.logsEmptyContent}>
                  <h5 className={styles.logsEmptyTitle}>Menunggu Sinkronisasi Data</h5>
                  <p className={styles.logsEmptyDesc}>
                    Sistem pusat sedang memindai aktivitas perangkat petugas. Data log akan diperbarui secara otomatis setiap ada pemindaian masuk.
                  </p>
                </div>
                <div className={styles.logsEmptyActions}>
                  <button className={styles.logsEmptyPrimary} onClick={() => navigateTo('petugas-so')}>
                    Mulai Scan
                  </button>
                  <button className={styles.logsEmptySecondary}>
                    Panduan Operator
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}