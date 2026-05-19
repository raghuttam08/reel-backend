const express = require('express')
const jwt     = require('jsonwebtoken')
const router  = express.Router()
const { User } = require('../models')

const JWT_SECRET = process.env.JWT_SECRET || 'reel_dev_secret_change_in_prod'
const JWT_EXPIRY = '7d'

function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email and password are required' })

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const exists = await User.findOne({ $or: [{ username }, { email }] })
    if (exists)
      return res.status(409).json({ error: 'Username or email already taken' })

    const user = await User.create({ username, email, password })
    const token = signToken(user)

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium,
        plan: user.plan,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password)
      return res.status(400).json({ error: 'username and password are required' })

    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    })

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid username or password' })

    const token = signToken(user)

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium,
        plan: user.plan,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me — validate token
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token' })

    const token = header.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')

    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium,
        plan: user.plan,
      }
    })
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
})

module.exports = router
