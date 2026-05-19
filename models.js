const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

// ─── User ─────────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 30 },
  email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  created_at: { type: Date, default: Date.now },
  // Subscription fields
  isPremium: { type: Boolean, default: false },
  plan: { type: String, enum: ['premium', 'pro', null], default: null },
  subscriptionExpiry: { type: Date, default: null },
  paymentIntentId: { type: String, default: null },
  stripeCustomerId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
  // Watchlist
  watchlist: [{ type: String }], // Array of show names
})

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

const User = mongoose.model('User', UserSchema, 'users')

// ─── Show (processed NLP output) ─────────────────────────────────────────────
const ShowSchema = new mongoose.Schema({
  show_name:    { type: String, required: true, unique: true },
  release_year: Number,
  total_posts:  Number,
  processed_at: String,
  lifecycle:    Object,
  tone_tags:    [String],
  honest_stats: Object,
  top_posts:    [Object],
  tmdb_id:      Number,
})

const Show = mongoose.model('Show', ShowSchema, 'processed')

// ─── Raw reaction (scraped Reddit posts) ─────────────────────────────────────
const ReactionSchema = new mongoose.Schema({
  tmdb_id:      Number,
  film_name:    String,
  source:       String,
  subreddit:    String,
  title:        String,
  text:         String,
  score:        Number,
  num_comments: Number,
  url:          { type: String },
  published:    String,
  scraped_at:   String,
})

const Reaction = mongoose.model('Reaction', ReactionSchema, 'reactions')

// ─── User post (created on platform) ─────────────────────────────────────────
const PostSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:   { type: String, required: true },
  show_name:  { type: String, required: true },
  tmdb_id:    Number,
  format:     { type: String, enum: ['moment', 'verdict', 'discovery'], required: true },
  text:       { type: String, required: true, maxlength: 500 },
  is_spoiler: { type: Boolean, default: false },
  likes:      { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
})

const Post = mongoose.model('Post', PostSchema, 'posts')

module.exports = { User, Show, Reaction, Post }
