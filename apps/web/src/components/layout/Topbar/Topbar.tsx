// apps/web/src/components/layout/Topbar/Topbar.tsx
import React from 'react'
import styles from './Topbar.module.css'

interface TopbarProps {
  userRole: 'admin' | 'petugas'
  onToggleSidebar: () => void
  onQuickSearch: () => void
  userName: string
  isMobile?: boolean
  isSidebarOpen?: boolean // 👈 TAMBAHKAN INI
}

export function Topbar({ 
  userRole, 
  onToggleSidebar, 
  onQuickSearch, 
  userName, 
  isMobile = false,
  isSidebarOpen = false // 👈 DEFAULT
}: TopbarProps) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <button className={styles.hamburgerBtn} onClick={onToggleSidebar}>
          <span className="material-symbols-outlined">
            {isSidebarOpen ? 'close' : 'menu'}
          </span>
        </button>

        <div className={styles.topbarStoreBadge}>
          <span className={styles.topbarStoreIcon}>
            <i className="fa-solid fa-store"></i>
          </span>
          <span className={styles.topbarStoreName}>
            {isMobile ? 'semarang' : 'Semarang • Indonesia'}
          </span>
        </div>
      </div>

      <div className={styles.topbarRight}>
        

        
      </div>
    </div>
  )
}