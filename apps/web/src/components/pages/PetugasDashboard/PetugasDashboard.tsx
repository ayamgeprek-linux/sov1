import React from 'react'
import styles from './PetugasDashboard.module.css'

interface PetugasDashboardProps {
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
  userName?: string
}

export function PetugasDashboard({ navigateTo, showToast, userName = 'Rina Pratiwi' }: PetugasDashboardProps) {
  return (
    <div className={styles.petugasDashboard}>
      {/* Hero Greeting Section */}
      <div className={styles.heroSection}>
        <div className={styles.onlineBadge}>
          <div className={styles.onlineDot}></div>
          ONLINE
        </div>
        <div className={styles.heroText}>
          <h1 className={styles.title}>HALO, {userName.toUpperCase()}</h1>
          <p className={styles.subtitle}>
            Petugas Opname • <span className={styles.subtitleHighlight}>Shift Pagi</span>
          </p>
        </div>
      </div>

      {/* Primary Action Cards */}
      <div className={styles.menuGrid}>
        {/* Scan Barang */}
        <div className={styles.menuCard} onClick={() => navigateTo('petugas-so')}>
        
          <h3 className={styles.menuLabel}>Scan Barang</h3>
          <p className={styles.menuDesc}>Mulai opname</p>
        </div>

        {/* Lihat Progress */}
        <div className={`${styles.menuCard} ${styles.menuCardLight}`} onClick={() => navigateTo('petugas-progress')}>
       
          <h3 className={`${styles.menuLabel} ${styles.menuLabelLight}`}>Lihat Progress</h3>
          <p className={styles.menuDesc}>Hari ini</p>
        </div>
      </div>

      {/* Progress Insight Card */}
      <div className={styles.statsBox}>
        <div className={styles.statsHeader}>
          <div>
            <p className={styles.statsHeaderLabel}>Status Inventaris</p>
            <h4 className={styles.statsHeaderTitle}>Barang sudah dihitung</h4>
          </div>
          <div className={styles.statsCountWrapper}>
            <span className={styles.statsCount}>18</span>
            <span className={styles.statsCountTotal}> / 40</span>
          </div>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statsFill} style={{ width: '45%' }}>
            <div className={styles.statsShimmer}></div>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statsItem}>
            <div className={styles.statsNumber}>18</div>
            <div className={styles.statsLabel}>Terinput</div>
          </div>
          <div className={styles.statsItem}>
            <div className={`${styles.statsNumber} ${styles.textOrange}`}>4</div>
            <div className={styles.statsLabel}>Selisih</div>
          </div>
          <div className={styles.statsItem}>
            <div className={styles.statsNumber}>22</div>
            <div className={styles.statsLabel}>Total Scan</div>
          </div>
        </div>
      </div>

      {/* Bottom Meta Info */}
      <div className={styles.footer}>
        
        <div className={styles.footerRight}>
          <span className={styles.footerDot}></span>
          System Synced at 01:44
        </div>
      </div>
    </div>
  )
}