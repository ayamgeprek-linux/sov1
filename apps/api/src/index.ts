// apps/api/src/index.ts
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config/index.js'
import authRoutes from './routes/auth.js'
import productsRoutes from './routes/products.js'
import opnameRoutes from './routes/opname.js'
import mappingRoutes from './routes/mapping.js'
import importRoutes from './routes/import.js'
import reportRoutes from './routes/report.js'
import auditRoutes from './routes/audit.js'
import sessionRoutes from './routes/session.js'
import backupRoutes from './routes/backup.js'
const app = express()
const PORT = config.port || 3001

// ============================================================
// ✅ CORS - PALING SIMPLE UNTUK NGROK
// ============================================================
app.use(cors({
  origin: '*',  // BIARKAN SEMUA DOMAIN
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}))

// ============================================================
// HELMET - MATIKAN CSP
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,  // 👈 MATIKAN CSP
}))

app.use(express.json())
app.use(morgan('dev'))

// ============================================================
// ROUTES
// ============================================================
app.use('/auth', authRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/opname', opnameRoutes)
app.use('/api/mapping', mappingRoutes)
app.use('/api/import', importRoutes)
app.use('/api/report', reportRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/backup', backupRoutes)
// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'StockOpname API',
    env: config.nodeEnv,
  })
})

app.get('/api/test', (req: Request, res: Response) => {
  res.json({ message: 'API is running! 🚀' })
})

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: `Route not found: ${req.method} ${req.path}`,
  })
})

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err.stack)
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  })
})

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 API running on http://localhost:${PORT}`)
  console.log(`📚 Environment: ${config.nodeEnv}`)
  console.log(`📍 Routes:`)
  console.log(`   POST /auth/login`)
  console.log(`   GET  /auth/me`)
  console.log(`   GET  /health`)
  console.log(`   GET  /api/test\n`)
})