import React from 'react'
import styles from '../Dashboard.module.css'

interface RecentScansProps {
  products: any[]
  navigateTo: (page: string) => void
}

export function RecentScans({ products, navigateTo }: RecentScansProps) {
  const scans = products.filter(p => p.qty_fisik !== null).slice(0, 4)

  return (
    <div className={styles.recentScans}>
      <div className={styles.recentScansHeader}>
        <span>Barang Terakhir Di-scan</span>
        <button onClick={() => navigateTo('petugas-so')}>
          Lihat semua scan <i className="fa-solid fa-arrow-right"></i>
        </button>
      </div>
      <div className={styles.recentScansList}>
        {scans.length === 0 ? (
          <div className={styles.recentScansEmpty}>Belum ada scan</div>
        ) : (
          scans.map((p, i) => (
            <div key={i} className={styles.recentScanItem}>
              <div>
                <div className={styles.recentScanName}>{p.nama_barang}</div>
                <div className={styles.recentScanSku}>{p.sku}</div>
              </div>
              <div className={styles.recentScanRight}>
                <div className={styles.recentScanQty}>+{p.qty_fisik}</div>
                <div className={styles.recentScanTime}>11:{40 + i * 4}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}