const express = require('express')
const jwt     = require('jsonwebtoken')
const router  = express.Router()
const { Post, Reaction } = require('../models')

const JWT_SECRET = process.env.JWT_SECRET || 'reel_dev_secret_change_in_prod'

// ─── Auth middleware ──────────────────────────────────────────────────────────
function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET)
    } catch {}
  }
  next()
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authentication required' })
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── GET /api/posts — global feed ────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'recent', format, show } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const query = {}
    if (format) query.format = format
    if (show)   query.show_name = show

    const sortObj = sort === 'trending'
      ? { likes: -1, created_at: -1 }
      : { created_at: -1 }

    const [posts, total] = await Promise.all([
      Post.find(query).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
      Post.countDocuments(query),
    ])

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/posts/show/:showName — posts for one show ──────────────────────
router.get('/show/:showName', optionalAuth, async (req, res) => {
  try {
    const show = decodeURIComponent(req.params.showName)
    const { spoiler, page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const query = { show_name: show }
    if (spoiler !== undefined) query.is_spoiler = spoiler === 'true'

    const posts = await Post.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()

    res.json(posts)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/posts/trending — top scoring Reddit posts ──────────────────────
router.get('/trending', async (req, res) => {
  try {
    const { limit = 30 } = req.query

    // Mix user posts + high-scoring scraped reactions
    const [userPosts, scrapedPosts] = await Promise.all([
      Post.find().sort({ likes: -1, created_at: -1 }).limit(parseInt(limit) / 2).lean(),
      Reaction.find({ score: { $gte: 50 } })
        .sort({ score: -1 })
        .limit(parseInt(limit) / 2)
        .lean(),
    ])

    // Normalize scraped posts to match user post shape
    const normalizedScraped = scrapedPosts.map(r => ({
      _id:        r._id,
      username:   r.subreddit ? `r/${r.subreddit}` : 'reddit',
      show_name:  r.film_name,
      format:     'verdict',
      text:       r.text || r.title,
      is_spoiler: false,
      likes:      r.score || 0,
      score:      r.score || 0,
      created_at: r.published || r.scraped_at,
      published:  r.published,
      source:     'reddit',
    }))

    const all = [...userPosts, ...normalizedScraped]
      .sort((a, b) => (b.likes || b.score || 0) - (a.likes || a.score || 0))

    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/posts — create post (auth required) ───────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { show_name, tmdb_id, format, text, is_spoiler } = req.body

    if (!show_name || !format || !text)
      return res.status(400).json({ error: 'show_name, format and text are required' })

    if (!['moment', 'verdict', 'discovery'].includes(format))
      return res.status(400).json({ error: 'format must be moment, verdict, or discovery' })

    if (text.length > 500)
      return res.status(400).json({ error: 'Text must be under 500 characters' })

    const post = await Post.create({
      user_id:    req.user.id,
      username:   req.user.username,
      show_name,
      tmdb_id,
      format,
      text,
      is_spoiler: !!is_spoiler,
    })

    res.status(201).json(post)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/posts/:id/like — like a post ──────────────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    )
    if (!post) return res.status(404).json({ error: 'Post not found' })
    res.json({ likes: post.likes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── PUT /api/posts/:id — update a post (auth required) ──────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { format, text, is_spoiler } = req.body

    // Get the post to check ownership
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    // Verify ownership
    if (post.user_id.toString() !== req.user.id)
      return res.status(403).json({ error: 'You can only edit your own posts' })

    // Validate input
    if (format && !['moment', 'verdict', 'discovery'].includes(format))
      return res.status(400).json({ error: 'format must be moment, verdict, or discovery' })

    if (text && text.length > 500)
      return res.status(400).json({ error: 'Text must be under 500 characters' })

    // Update allowed fields
    const updates = {}
    if (format) updates.format = format
    if (text) updates.text = text
    if (is_spoiler !== undefined) updates.is_spoiler = !!is_spoiler

    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    )

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── DELETE /api/posts/:id — delete a post (auth required) ────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    // Verify ownership
    if (post.user_id.toString() !== req.user.id)
      return res.status(403).json({ error: 'You can only delete your own posts' })

    await Post.findByIdAndDelete(req.params.id)

    res.json({ success: true, message: 'Post deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
