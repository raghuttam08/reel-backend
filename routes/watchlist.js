const express = require('express')
const router = express.Router()
const { User } = require('../models')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'reel_dev_secret_change_in_prod'

// Middleware to authenticate requests
function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' })

    const token = header.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// GET /api/watchlist - Get user's watchlist
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ watchlist: user.watchlist || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/watchlist/add - Add show to watchlist
router.post('/add', authMiddleware, async (req, res) => {
  try {
    const { showName } = req.body
    if (!showName) return res.status(400).json({ error: 'showName is required' })

    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (!user.watchlist) user.watchlist = []
    if (!user.watchlist.includes(showName)) {
      user.watchlist.push(showName)
      await user.save()
    }

    res.json({ success: true, watchlist: user.watchlist })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/watchlist/remove - Remove show from watchlist
router.post('/remove', authMiddleware, async (req, res) => {
  try {
    const { showName } = req.body
    if (!showName) return res.status(400).json({ error: 'showName is required' })

    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (user.watchlist) {
      user.watchlist = user.watchlist.filter(show => show !== showName)
      await user.save()
    }

    res.json({ success: true, watchlist: user.watchlist })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/watchlist/check - Check if show is in watchlist
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const { showName } = req.body
    if (!showName) return res.status(400).json({ error: 'showName is required' })

    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const isInWatchlist = user.watchlist ? user.watchlist.includes(showName) : false
    res.json({ isInWatchlist })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
