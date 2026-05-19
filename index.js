const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
const path     = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') })

const app = express()

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://localhost:5175',
      'https://reel-lgba.onrender.com'
    ]
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))
app.use(express.json())

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reel'
console.log('MongoDB URI:', MONGODB_URI.substring(0, 50) + '...')
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB connection warning (will retry):', err.message) })

// Retry MongoDB connection every 10 seconds
setInterval(() => {
  if (mongoose.connection.readyState !== 1) {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reel')
      .catch(err => console.error('MongoDB reconnection attempt failed'))
  }
}, 10000)

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'))
app.use('/api/shows', require('./routes/shows'))
app.use('/api/posts', require('./routes/posts'))
app.use('/api/payments', require('./routes/payment'))
app.use('/api/watchlist', require('./routes/watchlist'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/admin', require('./routes/admin'))

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let nlpStatus = 'unreachable'
  try {
    const r = await fetch(`${process.env.NLP_SERVICE_URL || 'http://nlp:8001'}/health`)
    if (r.ok) nlpStatus = 'running'
  } catch {}
  res.json({
    node:  'running',
    nlp:   nlpStatus,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
