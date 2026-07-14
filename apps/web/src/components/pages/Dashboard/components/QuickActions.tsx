import React from 'react'
import styles from '../Dashboard.module.css'

interface QuickActionsProps {
  navigateTo: (page: string) => void
}

export function QuickActions({ navigateTo }: QuickActionsProps) {
  return (
    <div className={styles.quickActions}>
      <div className={styles.quickActionsLabel}>Mulai sekarang</div>
      <div className={styles.quickActionsTitle}>
        Stock Opname<br/>Putaran 02
      </div>
      <button className={styles.quickActionsBtn} onClick={() => navigateTo('sop')}>
        <i className="fa-solid fa-play"></i>
        <span>MULAI SCAN BARCODE</span>
      </button>
      <div className={styles.quickActionsOr}>Atau</div>
      <div className={styles.quickActionsMapping} onClick={() => navigateTo('mapping')}>
        <i className="fa-solid fa-link"></i>
        <span>Mapping Barcode Baru</span>
      </div>
    </div>
  )
}