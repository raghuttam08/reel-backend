const express = require('express')
const router = express.Router()
const { Show, Post } = require('../models')

// GET /api/shows — all shows
router.get('/', async (req, res) => {
  try {
    const shows = await Show.find({}, '-__v').lean()
    res.json(shows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/shows/:name — single show + its posts
router.get('/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const show = await Show.findOne({ show_name: name }, '-__v').lean()
    if (!show) return res.status(404).json({ error: 'Show not found' })

    const posts = await Post.find({ show_name: name })
      .sort({ score: -1 })
      .limit(50)
      .lean()

    res.json({ ...show, posts })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
