const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
require('dotenv').config()

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reel')
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB error:', err); process.exit(1) })

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'))
app.use('/api/shows', require('./routes/shows'))
app.use('/api/posts', require('./routes/posts'))
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
