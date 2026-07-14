// apps/web/src/components/pages/Backup/BackupPage.tsx
import { useState, useEffect } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './BackupPage.module.css'

interface BackupPageProps {
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
}

interface BackupLog {
  id: string
  table_name: string
  record_count: number
  backup_type: 'auto' | 'manual' | 'scheduled'
  status: 'success' | 'failed'
  file_size: number
  created_at: string
}

export function BackupPage({ navigateTo, showToast }: BackupPageProps) {
  const { token } = useAuth()
  const [backups, setBackups] = useState<BackupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // ============================================================
  // FETCH BACKUPS
  // ============================================================
  useEffect(() => {
    const fetchBackups = async () => {
      setLoading(true)
      try {
        const result = await api.get<{ success: boolean; data: BackupLog[]; pagination: any }>(
          `/api/backup?page=${page}&limit=20`,
          token || undefined
        )
        if (result.success) {
          setBackups(result.data || [])
          setTotal(result.pagination?.total || 0)
        }
      } catch (error) {
        console.error('[Backup] Error:', error)
        showToast('❌ Gagal memuat daftar backup')
      } finally {
        setLoading(false)
      }
    }
    fetchBackups()
  }, [page, token, showToast])

  // ============================================================
  // CREATE BACKUP
  // ============================================================
  const createBackup = async () => {
    setCreating(true)
    try {
      const result = await api.post<{ success: boolean; total_records?: number; error?: string }>(
        '/api/backup',
        {},
        token || undefined
      )
      if (result.success) {
        showToast(`✅ Backup berhasil! ${result.total_records || 0} data tersimpan`)
        // Refresh list
        const refreshResult = await api.get<{ success: boolean; data: BackupLog[] }>(
          '/api/backup?page=1&limit=20',
          token || undefined
        )
        if (refreshResult.success) {
          setBackups(refreshResult.data || [])
          setPage(1)
        }
      } else {
        showToast(`❌ ${result.error || 'Gagal backup'}`)
      }
    } catch (error) {
      console.error('[Backup] Create error:', error)
      showToast('❌ Gagal membuat backup')
    } finally {
      setCreating(false)
    }
  }

  // ============================================================
  // RESTORE BACKUP
  // ============================================================
  const restoreBackup = async (id: string) => {
    if (!confirm('Yakin mau restore data ini? Data saat ini akan diganti!')) return

    try {
      const result = await api.post<{ success: boolean; records?: number; error?: string }>(
        `/api/backup/restore/${id}`,
        {},
        token || undefined
      )
      if (result.success) {
        showToast(`✅ Restore berhasil! ${result.records || 0} data dikembalikan`)
      } else {
        showToast(`❌ ${result.error || 'Gagal restore'}`)
      }
    } catch (error) {
      console.error('[Backup] Restore error:', error)
      showToast('❌ Gagal restore backup')
    }
  }

  // ============================================================
  // DELETE BACKUP
  // ============================================================
  const deleteBackup = async (id: string) => {
    if (!confirm('Yakin mau hapus backup ini?')) return

    try {
      await api.del(`/api/backup/${id}`, token || undefined)
      showToast('✅ Backup dihapus')
      setBackups(prev => prev.filter(b => b.id !== id))
    } catch (error) {
      console.error('[Backup] Delete error:', error)
      showToast('❌ Gagal hapus backup')
    }
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ============================================================
  // FORMAT FILE SIZE
  // ============================================================
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className={styles.backupPage}>
      {/* Header */}
      <div className={styles.backupHeader}>
        <div>
          <h1 className={styles.backupTitle}>💾 Backup & Restore</h1>
          <p className={styles.backupSubtitle}>Kelola backup data sistem</p>
        </div>
        <button 
          className={styles.backupCreateBtn}
          onClick={createBackup}
          disabled={creating}
        >
          <span className="material-symbols-outlined">backup</span>
          {creating ? 'Membuat...' : 'Buat Backup'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.backupStats}>
        <div className={styles.backupStatItem}>
          <span className={styles.backupStatLabel}>Total Backup</span>
          <span className={styles.backupStatValue}>{total}</span>
        </div>
        <div className={styles.backupStatItem}>
          <span className={styles.backupStatLabel}>Tabel</span>
          <span className={styles.backupStatValue}>5</span>
        </div>
        <div className={styles.backupStatItem}>
          <span className={styles.backupStatLabel}>Ukuran Total</span>
          <span className={styles.backupStatValue}>
            {backups.reduce((acc, b) => acc + (b.file_size || 0), 0) > 0 
              ? formatSize(backups.reduce((acc, b) => acc + (b.file_size || 0), 0))
              : '0 B'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className={styles.backupTableWrap}>
        {loading ? (
          <div className={styles.backupLoading}>
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <p>Memuat data...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className={styles.backupEmpty}>
            <span className="material-symbols-outlined">backup</span>
            <p>Belum ada backup</p>
            <span className={styles.backupEmptySub}>Klik "Buat Backup" untuk membuat backup pertama</span>
          </div>
        ) : (
          <table className={styles.backupTable}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Tabel</th>
                <th>Jumlah Data</th>
                <th>Ukuran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id} className={styles.backupRow}>
                  <td className={styles.backupTime}>{formatDate(backup.created_at)}</td>
                  <td>
                    <span className={styles.backupTableName}>{backup.table_name}</span>
                    <span className={styles.backupType}>{backup.backup_type}</span>
                  </td>
                  <td>{backup.record_count.toLocaleString()}</td>
                  <td>{formatSize(backup.file_size || 0)}</td>
                  <td>
                    <span className={`${styles.backupStatus} ${backup.status === 'success' ? styles.statusSuccess : styles.statusFailed}`}>
                      {backup.status === 'success' ? '✅ Sukses' : '❌ Gagal'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={styles.backupActionBtn}
                      onClick={() => restoreBackup(backup.id)}
                      disabled={backup.status !== 'success' || backup.record_count === 0}
                      title="Restore data"
                    >
                      <span className="material-symbols-outlined">restore</span>
                    </button>
                    <button 
                      className={styles.backupActionBtn}
                      onClick={() => deleteBackup(backup.id)}
                      title="Hapus backup"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.backupPagination}>
          <button 
            className={styles.backupPageBtn}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className={styles.backupPageInfo}>
            Halaman {page} dari {totalPages}
          </span>
          <button 
            className={styles.backupPageBtn}
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}