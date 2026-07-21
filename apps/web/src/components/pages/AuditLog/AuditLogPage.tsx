// apps/web/src/components/pages/AuditLog/AuditLogPage.tsx
import { useState, useEffect } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './AuditLogPage.module.css'

interface AuditLogPageProps {
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

interface AuditLog {
  id: string
  user_id: string
  user_email: string
  user_role: string
  action: string
  entity_type: string
  entity_id: string
  old_data: any
  new_data: any
  changes: any
  ip_address: string
  user_agent: string
  duration_ms: number
  status_code: number
  created_at: string
}

export function AuditLogPage({ navigateTo, showToast }: AuditLogPageProps) {
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    from: '',
    to: ''
  })
  const [summary, setSummary] = useState<any>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // ============================================================
  // FETCH AUDIT LOGS
  // ============================================================
  useEffect(() => {
    const fetchLogs = async () => {
      if (!token) {
        console.log('[AuditLog] No token, skipping...')
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', page.toString())
        params.set('limit', limit.toString())
        if (filters.action) params.set('action', filters.action)
        if (filters.entity_type) params.set('entity_type', filters.entity_type)
        if (filters.from) params.set('from', filters.from)
        if (filters.to) params.set('to', filters.to)

        console.log('[AuditLog] Fetching with token:', token ? '✅ ada' : '❌ tidak ada')

        const result = await api.get<{ success: boolean; data: AuditLog[]; pagination: any }>(
          `/api/audit?${params.toString()}`,
          token
        )

        console.log('[AuditLog] Result:', result)

        if (result?.success) {
          setLogs(result.data || [])
          setTotal(result.pagination?.total || 0)
        } else {
          console.error('[AuditLog] Not success:', result)
        }
      } catch (error) {
        console.error('[AuditLog] Error:', error)
        showToast('❌ Gagal memuat audit log')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [page, limit, filters, token, showToast])

  // ============================================================
  // FETCH SUMMARY
  // ============================================================
  useEffect(() => {
    const fetchSummary = async () => {
      if (!token) return

      try {
        const result = await api.get<{ success: boolean; data: any }>(
          '/api/audit/summary/stats',
          token
        )
        if (result?.success) {
          setSummary(result.data)
        }
      } catch (error) {
        console.error('[AuditLog] Summary error:', error)
      }
    }
    fetchSummary()
  }, [token])

  // ============================================================
  // FORMAT DATE
  // ============================================================
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // ============================================================
  // GET ACTION BADGE
  // ============================================================
  const getActionBadge = (action: string) => {
    const actionMap: Record<string, string> = {
      'LOGIN': styles.badgeRead,
      'LOGOUT': styles.badgeRead,
      'BACKUP_CREATE': styles.badgeCreate,
      'BACKUP_DELETE': styles.badgeDelete,
      'RESTORE_EXECUTE': styles.badgeUpdate,
      'OPNAME_SCAN': styles.badgeCreate,
      'SIZE_ADD': styles.badgeCreate,
      'IMPORT_MASTER': styles.badgeCreate,
      'MAPPING_CREATE': styles.badgeCreate,
      'MAPPING_UPDATE': styles.badgeUpdate,
      'MAPPING_DELETE': styles.badgeDelete,
      'BARCODE_SCAN': styles.badgeRead,
      'RAK_UPDATE': styles.badgeUpdate, // 🔥 BARU
      'TEST': styles.badgeDefault,
    }
    return actionMap[action] || styles.badgeDefault
  }

  // ============================================================
  // GET ACTION LABEL
  // ============================================================
  const getActionLabel = (action: string) => {
    const labelMap: Record<string, string> = {
      'LOGIN': 'Login',
      'LOGOUT': 'Logout',
      'BACKUP_CREATE': 'Backup',
      'BACKUP_DELETE': 'Hapus Backup',
      'RESTORE_EXECUTE': 'Restore',
      'OPNAME_SCAN': 'Scan Opname',
      'SIZE_ADD': 'Tambah Size',
      'IMPORT_MASTER': 'Import Master',
      'MAPPING_CREATE': 'Mapping',
      'MAPPING_UPDATE': 'Update Mapping',
      'MAPPING_DELETE': 'Hapus Mapping',
      'BARCODE_SCAN': 'Scan Barcode',
      'RAK_UPDATE': 'Update Rak', // 🔥 BARU
      'TEST': 'Test',
    }
    return labelMap[action] || action
  }

  // ============================================================
  // GET ENTITY ICON
  // ============================================================
  const getEntityIcon = (entityType: string) => {
    const iconMap: Record<string, string> = {
      'auth': 'lock',
      'temp_master': 'inventory_2',
      'temp_opname': 'qr_code_scanner',
      'temp_barcode': 'barcode',
      'backup': 'backup',
      'users': 'person',
      'rak': 'inventory_2', // 🔥 BARU
    }
    return iconMap[entityType] || 'folder'
  }

  // ============================================================
  // FORMAT DETAIL - TAMPILKAN RAK
  // ============================================================
  const formatDetail = (log: AuditLog) => {
    if (log.action === 'RAK_UPDATE') {
      const oldRak = log.old_data?.lokasi_rak || '-'
      const newRak = log.new_data?.lokasi_rak || '-'
      return (
        <span className={styles.rakChange}>
          <span className={styles.rakOld}>{oldRak}</span>
          <span className={styles.rakArrow}>→</span>
          <span className={styles.rakNew}>{newRak}</span>
        </span>
      )
    }
    
    if (log.new_data) {
      return (
        <span className={styles.newData}>
          {JSON.stringify(log.new_data).slice(0, 50)}
          {JSON.stringify(log.new_data).length > 50 ? '...' : ''}
        </span>
      )
    }
    
    if (log.old_data) {
      return (
        <span className={styles.oldData}>
          {JSON.stringify(log.old_data).slice(0, 50)}
          {JSON.stringify(log.old_data).length > 50 ? '...' : ''}
        </span>
      )
    }
    
    return <span className={styles.detailEmpty}>-</span>
  }

  const totalPages = Math.ceil(total / limit)

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleRowClick = (log: AuditLog) => {
    setSelectedLog(log)
    setShowDetailModal(true)
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (!token) {
    return (
      <div className={styles.auditPage}>
        <div className={styles.auditLoading}>
          <span className="material-symbols-outlined">lock</span>
          <p>Silahkan login untuk melihat audit log</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.auditPage}>
      {/* Header */}
      <div className={styles.auditHeader}>
        <div>
          <h1 className={styles.auditTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>history</span>
            Audit Log
          </h1>
          <p className={styles.auditSubtitle}>Riwayat aktivitas sistem secara lengkap</p>
        </div>
        <button 
          className={styles.auditRefreshBtn}
          onClick={() => window.location.reload()}
        >
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className={styles.auditSummary}>
          <div className={styles.auditSummaryItem}>
            <span className={styles.auditSummaryLabel}>Hari Ini</span>
            <span className={styles.auditSummaryValue}>{summary.today || 0}</span>
          </div>
          <div className={styles.auditSummaryItem}>
            <span className={styles.auditSummaryLabel}>Minggu Ini</span>
            <span className={styles.auditSummaryValue}>{summary.week || 0}</span>
          </div>
          <div className={styles.auditSummaryItem}>
            <span className={styles.auditSummaryLabel}>Bulan Ini</span>
            <span className={styles.auditSummaryValue}>{summary.month || 0}</span>
          </div>
          <div className={styles.auditSummaryItem}>
            <span className={styles.auditSummaryLabel}>Total</span>
            <span className={styles.auditSummaryValue}>{total}</span>
          </div>
          <div className={styles.auditSummaryItem}>
            <span className={styles.auditSummaryLabel}>Update Rak</span>
            <span className={styles.auditSummaryValue}>
              {logs.filter(l => l.action === 'RAK_UPDATE').length}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.auditFilters}>
        <div className={styles.auditFilterGroup}>
          <label>Action</label>
          <select 
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
          >
            <option value="">Semua</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="BACKUP_CREATE">Backup</option>
            <option value="RESTORE_EXECUTE">Restore</option>
            <option value="OPNAME_SCAN">Opname</option>
            <option value="IMPORT_MASTER">Import</option>
            <option value="MAPPING_CREATE">Mapping</option>
            <option value="RAK_UPDATE">Update Rak</option> {/* 🔥 BARU */}
          </select>
        </div>
        <div className={styles.auditFilterGroup}>
          <label>Entity</label>
          <select 
            value={filters.entity_type}
            onChange={(e) => handleFilterChange('entity_type', e.target.value)}
          >
            <option value="">Semua</option>
            <option value="auth">Auth</option>
            <option value="temp_master">Master</option>
            <option value="temp_opname">Opname</option>
            <option value="temp_barcode">Barcode</option>
            <option value="backup">Backup</option>
            <option value="users">Users</option>
            <option value="rak">Rak</option> {/* 🔥 BARU */}
          </select>
        </div>
        <div className={styles.auditFilterGroup}>
          <label>Dari</label>
          <input 
            type="date" 
            value={filters.from}
            onChange={(e) => handleFilterChange('from', e.target.value)}
          />
        </div>
        <div className={styles.auditFilterGroup}>
          <label>Sampai</label>
          <input 
            type="date" 
            value={filters.to}
            onChange={(e) => handleFilterChange('to', e.target.value)}
          />
        </div>
        <button 
          className={styles.auditFilterBtn}
          onClick={() => setPage(1)}
        >
          <span className="material-symbols-outlined">filter_list</span>
          Filter
        </button>
      </div>

      {/* Table */}
      <div className={styles.auditTableWrap}>
        {loading ? (
          <div className={styles.auditLoading}>
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <p>Memuat data...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className={styles.auditEmpty}>
            <span className="material-symbols-outlined">inbox</span>
            <p>Tidak ada data audit</p>
            <span className={styles.auditEmptySub}>Lakukan aktivitas sistem untuk mengisi audit log</span>
          </div>
        ) : (
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Detail</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr 
                  key={log.id} 
                  className={styles.auditRow}
                  onClick={() => handleRowClick(log)}
                >
                  <td className={styles.auditTime}>{formatDate(log.created_at)}</td>
                  <td>
                    <div className={styles.auditUser}>
                      <span className={styles.auditUserName}>{log.user_email || 'System'}</span>
                      <span className={styles.auditUserRole}>{log.user_role}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.auditBadge} ${getActionBadge(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.auditEntity}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {getEntityIcon(log.entity_type)}
                      </span>
                      <span className={styles.auditEntityType}>{log.entity_type}</span>
                      <span className={styles.auditEntityId}>{log.entity_id}</span>
                    </div>
                  </td>
                  <td className={styles.auditDetail}>
                    {formatDetail(log)}
                  </td>
                  <td className={styles.auditIp}>{log.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.auditPagination}>
          <button 
            className={styles.auditPageBtn}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className={styles.auditPageInfo}>
            Halaman {page} dari {totalPages}
          </span>
          <button 
            className={styles.auditPageBtn}
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowDetailModal(false)} />
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <span className="material-symbols-outlined">info</span>
                Detail Audit Log
              </h3>
              <button 
                className={styles.modalClose}
                onClick={() => setShowDetailModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label>ID</label>
                <span className={styles.modalValue}>{selectedLog.id}</span>
              </div>
              <div className={styles.modalField}>
                <label>Waktu</label>
                <span className={styles.modalValue}>{formatDate(selectedLog.created_at)}</span>
              </div>
              <div className={styles.modalField}>
                <label>User</label>
                <span className={styles.modalValue}>{selectedLog.user_email || 'System'}</span>
              </div>
              <div className={styles.modalField}>
                <label>Action</label>
                <span className={`${styles.auditBadge} ${getActionBadge(selectedLog.action)}`}>
                  {getActionLabel(selectedLog.action)}
                </span>
              </div>
              <div className={styles.modalField}>
                <label>Entity</label>
                <span className={styles.modalValue}>{selectedLog.entity_type} - {selectedLog.entity_id}</span>
              </div>
              <div className={styles.modalField}>
                <label>IP Address</label>
                <span className={styles.modalValue}>{selectedLog.ip_address || '-'}</span>
              </div>
              <div className={styles.modalField}>
                <label>User Agent</label>
                <span className={styles.modalValue} style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                  {selectedLog.user_agent || '-'}
                </span>
              </div>
              
              {/* 🔥 Tampilkan perubahan Rak */}
              {selectedLog.action === 'RAK_UPDATE' && (
                <div className={styles.modalField}>
                  <label>Perubahan Rak</label>
                  <div className={styles.rakChangeDetail}>
                    <div className={styles.rakChangeOld}>
                      <span className={styles.rakChangeLabel}>Lama</span>
                      <span className={styles.rakChangeValue}>{selectedLog.old_data?.lokasi_rak || '-'}</span>
                    </div>
                    <span className={styles.rakChangeArrow}>→</span>
                    <div className={styles.rakChangeNew}>
                      <span className={styles.rakChangeLabel}>Baru</span>
                      <span className={styles.rakChangeValue}>{selectedLog.new_data?.lokasi_rak || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedLog.old_data && (
                <div className={styles.modalField}>
                  <label>Old Data</label>
                  <pre className={styles.modalJson}>{JSON.stringify(selectedLog.old_data, null, 2)}</pre>
                </div>
              )}
              {selectedLog.new_data && (
                <div className={styles.modalField}>
                  <label>New Data</label>
                  <pre className={styles.modalJson}>{JSON.stringify(selectedLog.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalConfirm}
                onClick={() => setShowDetailModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}