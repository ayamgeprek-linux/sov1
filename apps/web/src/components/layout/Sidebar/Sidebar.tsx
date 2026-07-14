// apps/web/src/components/layout/Sidebar/Sidebar.tsx

import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './Sidebar.module.css'


interface SidebarProps {
  currentPage?: string
  navigateTo: (page: string) => void
  userRole?: string
  onLogout?: () => void
  isOpen?: boolean
  onClose?: () => void
}


export function Sidebar({
  currentPage,
  navigateTo,
  userRole,
  onLogout,
  isOpen,
  onClose
}: SidebarProps) {


  const { user } = useAuth()


  const userName =
    user?.name ||
    user?.email?.split('@')[0] ||
    'Pengguna'


  const userEmail =
    user?.email ||
    'user@email.com'


  const role =
    user?.role ||
    userRole ||
    'admin'



  const adminMenuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard'
    },
    {
      id: 'import',
      label: 'Import Master',
      icon: 'upload'
    },
    {
      id: 'master',
      label: 'Data Master',
      icon: 'inventory_2'
    },
    {
      id: 'mapping',
      label: 'Mapping Barcode',
      icon: 'qr_code_scanner'
    },
    {
      id: 'progress',
      label: 'Monitor Progress',
      icon: 'query_stats'
    },
    {
      id: 'history',
      label: 'Riwayat SO',
      icon: 'history'
    },
    {
      id: 'report',
      label: 'Laporan',
      icon: 'description'
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: 'list_alt'
    },
    {
      id: 'backup',
      label: 'Backup & Restore',
      icon: 'backup'
    }
  ]



  const petugasMenuItems = [
    {
      id: 'petugas-dashboard',
      label: 'Dashboard Petugas',
      icon: 'dashboard'
    },
    {
      id: 'petugas-so',
      label: 'Scan Barang',
      icon: 'barcode_scanner'
    },
    {
      id: 'petugas-progress',
      label: 'Riwayat Scan',
      icon: 'history'
    }
  ]



  const menuItems =
    role === 'admin'
      ? adminMenuItems
      : petugasMenuItems



  return (

    <aside
      className={`
        ${styles.sidebar}
        ${isOpen ? styles.sidebarOpen : styles.sidebarClosed}
      `}
    >


      {/* MOBILE CLOSE BUTTON */}
      <button
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Close menu"
      >

        <span className="material-symbols-outlined">
          close
        </span>

      </button>





      {/* LOGO */}

      <div className={styles.logo}>

        <div className={styles.logoIcon}>

          <span className="material-symbols-outlined">
            inventory_2
          </span>

        </div>


        <div>

          <span className={styles.logoText}>
            OPNAME
          </span>

          <span className={styles.logoSub}>
            Stock Opname System
          </span>

        </div>


        <span className={styles.version}>
          v2.0
        </span>


      </div>






      {/* ROLE */}

      <div className={styles.roleBadge}>

        <span className={styles.roleBadgeIcon}>

          <span className="material-symbols-outlined">

            {
              role === 'admin'
                ? 'admin_panel_settings'
                : 'badge'
            }

          </span>

        </span>



        <span className={styles.roleBadgeText}>

          {
            role === 'admin'
              ? 'Administrator'
              : 'Petugas'
          }

        </span>


      </div>








      {/* MENU */}

      <nav className={styles.nav}>

        <div className={styles.navLabel}>
          Menu Utama
        </div>


        {
          menuItems.map((item)=> (

            <button

              key={item.id}


              className={`
                ${styles.navLink}
                ${
                  currentPage === item.id
                    ? styles.active
                    : ''
                }
              `}



              onClick={()=>{

                // pindah halaman
                navigateTo(item.id)


                // jangan close desktop
                // mobile close otomatis tidak di sini

              }}

            >


              <span className="material-symbols-outlined">
                {item.icon}
              </span>


              <span>
                {item.label}
              </span>


            </button>


          ))
        }


      </nav>







      {/* USER */}

      <div className={styles.user}>


        <div className={styles.userAvatar}>

          {
            userName
              .charAt(0)
              .toUpperCase()
          }

        </div>



        <div className={styles.userInfo}>


          <span className={styles.userName}>
            {userName}
          </span>


          <span className={styles.userEmail}>
            {userEmail}
          </span>



          <span
            className={`
              ${styles.userRole}
              ${
                role === 'admin'
                  ? styles.roleAdmin
                  : styles.rolePetugas
              }
            `}
          >

            {
              role === 'admin'
                ? 'Admin'
                : 'Petugas'
            }

          </span>


        </div>





        <button
          className={styles.logoutBtn}
          onClick={onLogout}
        >

          <span className="material-symbols-outlined">
            logout
          </span>


          <span className={styles.logoutLabel}>
            Logout
          </span>


        </button>



      </div>


    </aside>

  )
}