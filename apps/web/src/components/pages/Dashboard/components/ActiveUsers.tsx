import React from 'react'
import styles from '../Dashboard.module.css'

const users = [
  { name: 'Rina Pratiwi', initial: 'RP', color: 'purple', scan: '18 items' },
  { name: 'Andi Saputra', initial: 'AS', color: 'orange', scan: 'Completed' },
  { name: 'Bambang K.', initial: 'BK', color: 'sky', scan: '42 items' },
]

interface ActiveUsersProps {
  navigateTo: (page: string) => void
}

export function ActiveUsers({ navigateTo }: ActiveUsersProps) {
  return (
    <div className={styles.activeUsers}>
      <div className={styles.activeUsersHeader}>
        <h3>
          <span className={styles.activeUsersDot}></span>
          Petugas Aktif
        </h3>
        <button onClick={() => navigateTo('progress')}>Lihat Semua</button>
      </div>
      <div className={styles.activeUsersGrid}>
        {users.map((user, i) => (
          <div key={i} className={styles.activeUserCard}>
            <div className={styles.activeUserAvatar}>
              <span className={styles[`avatar__${user.color}`]}>{user.initial}</span>
              <div className={styles.activeUserStatus}></div>
            </div>
            <div>
              <div className={styles.activeUserName}>{user.name}</div>
              <div className={`${styles.activeUserScan} ${user.scan === 'Completed' ? styles.completed : ''}`}>
                {user.scan}
              </div>
            </div>
          </div>
        ))}
        <div className={styles.activeUserAdd}>
          <i className="fa-solid fa-user-plus"></i>
          <div className={styles.activeUserAddLabel}>Undang Petugas</div>
          <div className={styles.activeUserAddDesc}>Assign shift baru</div>
        </div>
      </div>
    </div>
  )
}