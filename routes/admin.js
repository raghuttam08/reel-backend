const express = require('express')
const router = express.Router()
const axios = require('axios')
const { Reaction, Show } = require('../models')

const NLP_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8001'

// POST /api/admin/process-all
// Calls Python NLP service to process all shows and saves results to MongoDB
router.post('/process-all', async (req, res) => {
  try {
    // Get distinct film names from raw reactions
    const showNames = await Reaction.distinct('film_name')
    const results = []

    for (const name of showNames) {
      const posts = await Reaction.find({ film_name: name }).lean()
      if (posts.length < 10) continue // skip films with too little data

      // Call Python NLP service
      const { data } = await axios.post(`${NLP_URL}/process`, {
        show_name: name,
        posts: posts.map(p => ({
          text: `${p.title || ''} ${p.text || ''}`.trim(),          
          score: p.score,
          created_utc: p.published,
        }))
      })

      // Upsert into shows collection
      await Show.findOneAndUpdate(
        { show_name: name },
        { ...data, show_name: name, processed_at: new Date() },
        { upsert: true, new: true }
      )
      results.push(name)
    }

    res.json({ processed: results.length, shows: results })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/process/:name — process a single show
router.post('/process/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const posts = await Reaction.find({ show_name: name }).lean()
    if (!posts.length) return res.status(404).json({ error: 'No data for this show' })

    const { data } = await axios.post(`${NLP_URL}/process`, {
      show_name: name,
      posts: posts.map(p => ({
        text: `${p.title || ''} ${p.text || ''}`.trim(),          
        score: p.score,
        created_utc: p.published,
      }))
    })

    await Show.findOneAndUpdate(
      { show_name: name },
      { ...data, show_name: name, processed_at: new Date() },
      { upsert: true, new: true }
    )

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/seed — seed mock data for dev/demo without running NLP
router.post('/seed', async (req, res) => {
  try {
    const mockShows = require('../seed.json')
    await Show.deleteMany({})
    await Show.insertMany(mockShows)
    res.json({ seeded: mockShows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
