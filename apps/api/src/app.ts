// apps/api/src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import dotenv from 'dotenv'
import userRoutes from './routes/users.js'
import authRoutes from './routes/auth.js'
import productsRoutes from './routes/products.js'
import opnameRoutes from './routes/opname.js'
import mappingRoutes from './routes/mapping.js'
import importRoutes from './routes/import.js'
import reportRoutes from './routes/report.js'
import auditRoutes from './routes/audit.js'
import sessionRoutes from './routes/session.js'
import backupRoutes from './routes/backup.js'

dotenv.config()

const app = express()

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}))

app.use(compression())

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
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
app.use('/api/users', userRoutes)

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'StockOpname API',
    env: process.env.NODE_ENV || 'development',
  })
})

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is running! 🚀',
    timestamp: new Date().toISOString()
  })
})

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`)
  res.status(404).json({ 
    success: false,
    error: `Route not found: ${req.method} ${req.path}` 
  })
})

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Error]', err.stack)
  
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

export default app