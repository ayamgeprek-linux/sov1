// apps/api/src/routes/backup.ts
import { Router, Request, Response } from 'express'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router = Router()

// ============================================================
// GET /api/backup - Ambil daftar backup
// ============================================================
router.get('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, page = 1 } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 50, 100)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    // Ambil data dari backup_log
    const { data, error, count } = await supabase
      .from('backup_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    if (error) throw error

    // Format data untuk frontend
    const formattedData = data?.map((item: any) => ({
      id: item.id,
      table_name: item.table_name || 'all',
      record_count: item.record_count || 0,
      backup_type: item.backup_type || 'manual',
      status: item.status || 'success',
      file_size: item.file_size || 0,
      created_at: item.created_at || new Date().toISOString()
    })) || []

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    })

  } catch (error) {
    console.error('[Backup] GET Error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// POST /api/backup - Buat backup baru (DENGAN AUDIT)
// ============================================================
router.post('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const startTime = Date.now()
  
  try {
    const { tables = ['temp_master', 'temp_opname', 'temp_barcode', 'users', 'audit_log'] } = req.body

    const results: any[] = []
    let totalRecords = 0
    let totalSize = 0
    let backupIds: string[] = []

    // Backup per tabel
    for (const tableName of tables) {
      try {
        console.log(`[Backup] 📦 Backing up ${tableName}...`)
        
        // Ambil semua data dari tabel
        const { data, error } = await supabase
          .from(tableName)
          .select('*')

        if (error) {
          console.error(`[Backup] ❌ Error fetching ${tableName}:`, error)
          results.push({
            table: tableName,
            status: 'failed',
            error: error.message
          })
          continue
        }

        const recordCount = data?.length || 0
        const backupData = JSON.stringify(data || [])
        const fileSize = backupData.length

        // Simpan ke backup_log
        const { data: inserted, error: insertError } = await supabase
          .from('backup_log')
          .insert({
            table_name: tableName,
            record_count: recordCount,
            backup_data: data || [],
            backup_type: 'manual',
            status: 'success',
            file_size: fileSize
          })
          .select('id')

        if (insertError) {
          console.error(`[Backup] ❌ Error inserting ${tableName}:`, insertError)
          results.push({
            table: tableName,
            status: 'failed',
            error: insertError.message
          })
          continue
        }

        if (inserted && inserted.length > 0) {
          backupIds.push(inserted[0].id)
        }

        results.push({
          table: tableName,
          records: recordCount,
          status: 'success',
          size: fileSize
        })
        
        totalRecords += recordCount
        totalSize += fileSize

        console.log(`[Backup] ✅ ${tableName}: ${recordCount} records, ${(fileSize / 1024).toFixed(1)} KB`)

      } catch (err) {
        console.error(`[Backup] ❌ Error backing up ${tableName}:`, err)
        results.push({
          table: tableName,
          status: 'failed',
          error: (err as Error).message
        })
      }
    }

    // ============================================================
    // 📝 AUDIT LOG - Backup berhasil
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'BACKUP_CREATE',
      entityType: 'backup',
      newData: {
        tables: results,
        total_records: totalRecords,
        total_size: totalSize,
        backup_ids: backupIds
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    // Ambil backup yang baru dibuat
    const { data: latestBackup, error: latestError } = await supabase
      .from('backup_log')
      .select('id, table_name, record_count, file_size, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    res.json({
      success: true,
      message: `Backup completed: ${totalRecords} records backed up`,
      results,
      total_records: totalRecords,
      total_size: totalSize,
      data: latestBackup?.[0] || null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    // ============================================================
    // 📝 AUDIT LOG - Backup gagal
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'BACKUP_FAILED',
      entityType: 'backup',
      newData: { error: (error as Error).message },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 500
    })

    console.error('[Backup] ❌ Error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// GET /api/backup/:id - Ambil detail backup
// ============================================================
router.get('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('backup_log')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // 📝 AUDIT LOG - View backup detail
    await logAudit({
      userId: req.user!.id,
      action: 'BACKUP_VIEW',
      entityType: 'backup',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ success: true, data })

  } catch (error) {
    console.error('[Backup] GET Detail Error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// POST /api/backup/restore/:id - Restore backup (DENGAN AUDIT)
// ============================================================
router.post('/restore/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const startTime = Date.now()
  
  try {
    const { id } = req.params

    // Ambil data backup
    const { data: backup, error: findError } = await supabase
      .from('backup_log')
      .select('*')
      .eq('id', id)
      .single()

    if (findError || !backup) {
      return res.status(404).json({ success: false, error: 'Backup not found' })
    }

    if (!backup.backup_data || backup.backup_data.length === 0) {
      return res.status(400).json({ success: false, error: 'No data to restore' })
    }

    const tableName = backup.table_name

    console.log(`[Restore] 📦 Restoring ${backup.record_count} records to ${tableName}`)

    // Hapus data lama
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      console.error('[Restore] ❌ Delete error:', deleteError)
      return res.status(500).json({ success: false, error: deleteError.message })
    }

    // Insert data backup dengan batch
    const backupData = backup.backup_data
    const batchSize = 100
    let insertedCount = 0

    for (let i = 0; i < backupData.length; i += batchSize) {
      const batch = backupData.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(batch)

      if (insertError) {
        console.error('[Restore] ❌ Insert error:', insertError)
        return res.status(500).json({ success: false, error: insertError.message })
      }
      
      insertedCount += batch.length
      console.log(`[Restore] ✅ Inserted ${insertedCount}/${backupData.length}`)
    }

    // ============================================================
    // 📝 AUDIT LOG - Restore berhasil
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'RESTORE_EXECUTE',
      entityType: 'backup',
      entityId: id,
      oldData: { table: tableName, records: backup.record_count },
      newData: { 
        table: tableName, 
        records_restored: insertedCount,
        backup_id: id 
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({
      success: true,
      message: `Restored ${insertedCount} records to ${tableName}`,
      table: tableName,
      records: insertedCount
    })

  } catch (error) {
    // ============================================================
    // 📝 AUDIT LOG - Restore gagal
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'RESTORE_FAILED',
      entityType: 'backup',
      entityId: req.params.id,
      newData: { error: (error as Error).message },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 500
    })

    console.error('[Backup] ❌ Restore error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// DELETE /api/backup/:id - Hapus backup (DENGAN AUDIT)
// ============================================================
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const startTime = Date.now()
  
  try {
    const { id } = req.params

    // Ambil data backup sebelum dihapus (buat audit)
    const { data: backup, error: findError } = await supabase
      .from('backup_log')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('backup_log')
      .delete()
      .eq('id', id)

    if (error) throw error

    // ============================================================
    // 📝 AUDIT LOG - Delete backup
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'BACKUP_DELETE',
      entityType: 'backup',
      entityId: id,
      oldData: backup ? {
        table: backup.table_name,
        records: backup.record_count,
        size: backup.file_size
      } : null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({ success: true, message: 'Backup deleted' })

  } catch (error) {
    console.error('[Backup] ❌ Delete error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// POST /api/backup/schedule - Schedule backup otomatis (DENGAN AUDIT)
// ============================================================
router.post('/schedule', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const startTime = Date.now()
  
  try {
    const { schedule = '0 1 * * *' } = req.body

    // ============================================================
    // 📝 AUDIT LOG - Schedule backup
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'BACKUP_SCHEDULE',
      entityType: 'backup',
      newData: { schedule },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({
      success: true,
      message: `Backup scheduled: ${schedule}`,
      schedule
    })

  } catch (error) {
    console.error('[Backup] ❌ Schedule error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router