// apps/api/src/index.ts
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import productsRoutes from '../routes/products.ts'
// Load .env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

console.log('🔍 Environment check:')
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`)
console.log(`   SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✅' : '❌'}`)

// 👇 IMPORT .ts BUKAN .js (karena pake tsx)
import app from './app.js'  // 👈 TETAP .js KARENA ESM

const PORT = process.env.PORT || 3001
app.use('/api/products', productsRoutes)
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`)
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`)
})