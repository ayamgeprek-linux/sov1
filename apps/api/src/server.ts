// apps/api/src/server.ts
import app from './app.js'

// 🔥 PARSE PORT KE NUMBER
const PORT = parseInt(process.env.PORT || '7860', 10)

// 🔥 START SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DOCTOR SO API running on port ${PORT}`)
  console.log(`📍 Health check: http://localhost:${PORT}/health`)
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🕐 Started at: ${new Date().toISOString()}`)
})