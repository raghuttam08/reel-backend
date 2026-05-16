require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

const showsRouter = require('./routes/shows')
const postsRouter = require('./routes/posts')
const adminRouter = require('./routes/admin')

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Routes
app.use('/api/shows', showsRouter)
app.use('/api/posts', postsRouter)
app.use('/api/admin', adminRouter)

// Connect DB then start
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected')
    const PORT = process.env.PORT || 3001
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err)
    process.exit(1)
  })
