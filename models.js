const mongoose = require('mongoose')

// ── Raw Reddit post ──────────────────────────────────────────────
const reactionSchema = new mongoose.Schema({
  show_name:   { type: String, required: true, index: true },
  title:       String,
  body:        String,
  score:       { type: Number, default: 0 },
  url:         { type: String, unique: true, sparse: true },
  created_utc: Date,
  subreddit:   String,
}, { timestamps: true })

// ── Processed show data (output of NLP) ─────────────────────────
const showSchema = new mongoose.Schema({
  show_name:    { type: String, required: true, unique: true },
  tmdb_id:      Number,
  release_year: Number,
  tone_tags:    [String],
  honest_stats: {
    finished_pct:        Number,
    rewatch_pct:         Number,
    top_word:            String,
    overall_positive_pct: Number,
  },
  lifecycle: {
    release:     { dominant_word: String, sentiment: String },
    settled:     { dominant_word: String, sentiment: String },
    rediscovery: { dominant_word: String, sentiment: String },
    legacy:      { dominant_word: String, sentiment: String },
  },
  processed_at: { type: Date, default: Date.now },
}, { timestamps: true })

// ── User post (moment / verdict / discovery) ─────────────────────
const postSchema = new mongoose.Schema({
  username:   { type: String, required: true },
  show_name:  { type: String, required: true, index: true },
  format:     { type: String, enum: ['moment', 'verdict', 'discovery'], required: true },
  text:       { type: String, required: true, maxlength: 280 },
  is_spoiler: { type: Boolean, default: false },
  score:      { type: Number, default: 0 },
  voters:     [String],
}, { timestamps: true })

module.exports = {
  Reaction: mongoose.model('Reaction', reactionSchema),
  Show:     mongoose.model('Show',     showSchema),
  Post:     mongoose.model('Post',     postSchema),
}
