const express = require('express')
const router = express.Router()
const { Post } = require('../models')

// GET /api/posts?sort=trending|recent&limit=20
router.get('/', async (req, res) => {
  try {
    const { sort = 'trending', limit = 20, show } = req.query
    const query = show ? { show_name: decodeURIComponent(show) } : {}
    const sortField = sort === 'trending' ? { score: -1 } : { createdAt: -1 }

    const posts = await Post.find(query)
      .sort(sortField)
      .limit(Number(limit))
      .lean()

    res.json(posts)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/posts — create a post
router.post('/', async (req, res) => {
  try {
    const { username, show_name, format, text, is_spoiler } = req.body
    if (!username || !show_name || !format || !text)
      return res.status(400).json({ error: 'Missing required fields' })

    const post = await Post.create({ username, show_name, format, text, is_spoiler })
    res.status(201).json(post)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/posts/:id/upvote
router.post('/:id/upvote', async (req, res) => {
  try {
    const { username } = req.body
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    if (post.voters.includes(username)) {
      // undo vote
      post.score -= 1
      post.voters.pull(username)
    } else {
      post.score += 1
      post.voters.push(username)
    }
    await post.save()
    res.json({ score: post.score })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
