// server.js
import dotenv from "dotenv";
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log('☁️ Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME);

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import { analyzeEmotion, quickEmotionCheck } from './emotionAI.js';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow for now, can be configured later
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin resources
}));

// Sanitize data to prevent MongoDB injection
app.use(mongoSanitize());

// Rate limiting - prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Allow requests from frontend dev server (change FRONTEND_URL in .env if needed)
// Accept both localhost and 127.0.0.1 and allow Authorization header for XHR/fetch
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL, // Add Vercel deployment URL
  'http://localhost:3000', 
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
].filter(Boolean);

const corsOptions = { 
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, 
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'], 
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS']
};
app.use(cors(corsOptions));
// respond to preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());

// Load env variables
const { MONGO_URI, JWT_SECRET, PORT = 5000 } = process.env;

// --------------------
// MongoDB Models
// --------------------
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String, select: false }, // Exclude password by default
  hearts: { type: Number, default: 5 },
  avatar: String,
  favoriteWriters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  circles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Circle' }],
  // Heart gifting stats
  heartsGifted: { type: Number, default: 0 },
  heartsReceived: { type: Number, default: 0 },
  // Saved posts
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  // Enhanced reward system
  karma: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  badges: [{
    name: String,
    icon: String,
    description: String,
    earnedAt: { type: Date, default: Date.now },
    category: { type: String, enum: ['posting', 'trading', 'support', 'goals', 'mood', 'special'] }
  }],
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActivity: Date
  },
  tradeStats: {
    completed: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    totalRatings: { type: Number, default: 0 },
    successRate: { type: Number, default: 100 }
  }
});

// Badge Achievement System
const badgeSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  icon: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['posting', 'trading', 'support', 'goals', 'mood', 'special'], required: true },
  requirements: {
    type: { type: String, enum: ['count', 'streak', 'level', 'hearts', 'karma'] },
    target: Number,
    action: String // 'posts_created', 'trades_completed', 'hearts_received', etc.
  },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  rewards: {
    hearts: { type: Number, default: 0 },
    karma: { type: Number, default: 0 },
    experience: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
});
const Badge = mongoose.model('Badge', badgeSchema);

// Transaction History for all reward activities
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['hearts_earned', 'hearts_spent', 'karma_earned', 'experience_gained', 'badge_earned', 'trade_completed'], required: true },
  amount: { type: Number, default: 0 },
  source: { type: String, required: true }, // 'post_liked', 'goal_completed', 'trade_success', etc.
  description: String,
  relatedId: mongoose.Schema.Types.ObjectId, // ID of related post, goal, trade, etc.
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// Enhanced Trade System with Escrow and Ratings
const enhancedTradeSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // What is being offered
  offer: {
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    hearts: { type: Number, default: 0 },
    items: [String] // Custom items like badges, special privileges
  },
  // What is being requested
  request: {
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    hearts: { type: Number, default: 0 },
    items: [String]
  },
  message: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed', 'disputed', 'cancelled'], default: 'pending' },
  escrow: {
    isActive: { type: Boolean, default: false },
    fromUserDeposit: { type: Number, default: 0 },
    toUserDeposit: { type: Number, default: 0 }
  },
  ratings: {
    fromUserRating: { type: Number, min: 1, max: 5 },
    toUserRating: { type: Number, min: 1, max: 5 },
    fromUserComment: String,
    toUserComment: String
  },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const EnhancedTrade = mongoose.model('EnhancedTrade', enhancedTradeSchema);

// Marketplace Listings for better trade discovery
const marketplaceListingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  category: { type: String, enum: ['posts', 'hearts', 'services', 'collaboration'], required: true },
  offering: {
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    hearts: { type: Number, default: 0 },
    description: String
  },
  seeking: {
    posts: { type: String }, // Description of wanted posts
    hearts: { type: Number, default: 0 },
    description: String
  },
  tags: [String],
  status: { type: String, enum: ['active', 'paused', 'completed', 'expired'], default: 'active' },
  expiresAt: { type: Date },
  views: { type: Number, default: 0 },
  interests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const MarketplaceListing = mongoose.model('MarketplaceListing', marketplaceListingSchema);


// Advanced search with filters and simple highlights
app.get('/api/search', async (req, res) => {
  try{
    const {
      q = '', author = '', tags = '', categories = '', language = '',
      rarity = '', verified = '', priceMin = '', priceMax = '',
      dateFrom = '', dateTo = '', sort = 'relevance'
    } = req.query || {};

    const find = { visibility: { $ne: 'Private' } };
    const and = [];
    if(q){
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [ { title: rx }, { excerpt: rx }, { content: rx }, { tags: rx }, { categories: rx } ] });
    }
    if(author) and.push({ author: new RegExp(author, 'i') });
    if(language) and.push({ language });
    if(rarity) and.push({ rarity });
    if(verified){ and.push({ verified: verified === 'true' }); }
    if(tags){ const arr = tags.split(',').map(s=> s.trim()).filter(Boolean); if(arr.length) and.push({ tags: { $in: arr } }); }
    if(categories){ const arr = categories.split(',').map(s=> s.trim()).filter(Boolean); if(arr.length) and.push({ categories: { $in: arr } }); }
    // price range against priceHearts when not free
    const priceCond = {};
    const minV = parseInt(priceMin,10); const maxV = parseInt(priceMax,10);
    if(!Number.isNaN(minV)) priceCond.$gte = minV;
    if(!Number.isNaN(maxV)) priceCond.$lte = maxV;
    if(Object.keys(priceCond).length){ and.push({ free: { $ne: true }, priceHearts: priceCond }); }
    // date range
    const df = dateFrom ? new Date(dateFrom) : null; const dt = dateTo ? new Date(dateTo) : null;
    if(df || dt){
      const c = {};
      if(df) c.$gte = df; if(dt) c.$lte = dt;
      and.push({ createdAt: c });
    }
    if(and.length) find.$and = and;

    // sort
    let sortBy = {};
    if(sort === 'new') sortBy = { createdAt: -1 };
    else if(sort === 'price') sortBy = { priceHearts: 1 };
    else if(sort === 'trending') sortBy = { likes: -1, createdAt: -1 };
    else if(sort === 'relevance' && q){ /* keep default; we will score manually */ }
    else sortBy = { createdAt: -1 };

    const docs = await Post.find(find).limit(100).sort(sortBy).lean();

    // relevance scoring and highlights
    let results = docs;
    if(q){
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      results = docs.map(d => {
        const hay = `${d.title||''} ${d.excerpt||''} ${d.content||''}`;
        const match = hay.match(rx);
        let snippet = '';
        if(match){
          const i = Math.max(0, match.index - 30);
          const end = Math.min(hay.length, i + 120);
          snippet = hay.slice(i, end);
        }
        return { ...d, _score: (d.likes||0) + (match? 10:0), _highlight: snippet };
      }).sort((a,b)=> b._score - a._score);
    }

    res.json(results);
  }catch(err){
    console.error('Search error', err.message);
    res.status(500).json({ error:'Server error' });
  }
});

 
const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
  emotion: String,
  author: String,
  title: String,
  excerpt: String,
  content: String,
  cost: Number,
  free: Boolean,
  images: [String],
  createdAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, username: String, text: String, createdAt: { type: Date, default: Date.now } }],
  // Reactions (empathy, support, strength, hope)
  reactions: {
    empathy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    support: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    strength: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hope: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  // Voice Note
  voiceNote: {
    audioUrl: String,
    duration: Number, // in seconds
    transcript: String
  },
  // Circle fields
  circleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle' },
  isAnonymous: { type: Boolean, default: false },
  expiresAt: { type: Date }, // For auto-delete in circles
  // listing fields
  rarity: { type: String, enum: ['Common','Rare','Legendary'], default: 'Common' },
  verified: { type: Boolean, default: false },
  verification: { status: { type: String, enum: ['None','Pending','Approved','Rejected'], default: 'None' }, notes: String, files: [String] },
  visibility: { type: String, enum: ['Public','Private'], default: 'Public' },
  allowTrading: { type: Boolean, default: true },
  priceHearts: { type: Number, default: 0 },
  tags: [String],
  categories: [String],
  language: { type: String, default: 'en' },
  status: { type: String, enum: ['Published','PendingVerification','Draft'], default: 'Published' },
  hook: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // AI Analysis fields
  aiAnalysis: {
    emotionScore: { type: Number, default: 0 },
    detectedEmotions: [String],
    aiRating: { type: Number, default: 0 },
    authenticity: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    suggestedRarity: String,
    suggestedTags: [String],
    aiSummary: String,
    confidence: { type: Number, default: 0 },
    analyzedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'none' }
  }
});
const Post = mongoose.model("Post", postSchema);

// Circle model (Support Circles)
const circleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  icon: String, // emoji or icon name
  color: { type: String, default: '#8B5CF6' }, // default purple
  memberCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});
const Circle = mongoose.model('Circle', circleSchema);

// Listing model (sell)
const listingSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priceHearts: { type: Number, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Listing = mongoose.model('Listing', listingSchema);

// Trade offers model
const tradeOfferSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  offerPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  requestPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  message: String,
  status: { type: String, enum: ['pending','accepted','rejected','counter'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const TradeOffer = mongoose.model('TradeOffer', tradeOfferSchema);

// MoodEntry model (Mood Tracking)
const moodEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mood: { 
    type: String, 
    enum: ['happy', 'neutral', 'sad', 'anxious', 'angry', 'excited', 'peaceful', 'overwhelmed'],
    required: true 
  },
  intensity: { type: Number, min: 1, max: 10, required: true }, // 1-10 scale
  note: { type: String, maxlength: 500 },
  activities: [String], // e.g., ['exercise', 'meditation', 'socializing']
  triggers: [String], // e.g., ['work', 'family', 'health']
  aiInsight: String, // AI-generated insight about mood patterns
  createdAt: { type: Date, default: Date.now }
});
moodEntrySchema.index({ userId: 1, createdAt: -1 });
const MoodEntry = mongoose.model('MoodEntry', moodEntrySchema);

// HeartGift model (Heart Gifting)
const heartGiftSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  message: { type: String, maxlength: 200 },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // Optional: gift related to a post
  createdAt: { type: Date, default: Date.now }
});
heartGiftSchema.index({ toUserId: 1, createdAt: -1 });
heartGiftSchema.index({ fromUserId: 1, createdAt: -1 });
const HeartGift = mongoose.model('HeartGift', heartGiftSchema);

// WritingStreak model (Gamification)
const writingStreakSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastPostDate: Date,
  streakDates: [Date], // Array of dates when user posted
  totalPosts: { type: Number, default: 0 },
  badges: [{ 
    type: { type: String }, // '7-day', '30-day', '100-day', etc.
    earnedAt: Date 
  }],
  updatedAt: { type: Date, default: Date.now }
});
const WritingStreak = mongoose.model('WritingStreak', writingStreakSchema);

// Goal model (Emotional Wellness Goals)
const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  category: { 
    type: String, 
    enum: ['mood_improvement', 'stress_reduction', 'social_connection', 'self_care', 'emotional_awareness', 'coping_skills', 'other'],
    required: true 
  },
  targetType: {
    type: String,
    enum: ['daily_habit', 'weekly_target', 'milestone', 'streak'],
    required: true
  },
  targetValue: { type: Number }, // e.g., 7 for 7 days streak, 3 for 3 times per week
  targetUnit: { type: String }, // 'days', 'times', 'hours', 'sessions', etc.
  deadline: { type: Date },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'abandoned'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  milestones: [{
    title: String,
    targetValue: Number,
    achieved: { type: Boolean, default: false },
    achievedAt: Date
  }],
  currentProgress: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
const Goal = mongoose.model('Goal', goalSchema);

// GoalProgress model (Track daily/weekly progress)
const goalProgressSchema = new mongoose.Schema({
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  progressValue: { type: Number, required: true }, // Amount of progress made this day
  note: { type: String, maxlength: 300 },
  mood: { type: String }, // Link to mood for this day if available
  createdAt: { type: Date, default: Date.now }
});
const GoalProgress = mongoose.model('GoalProgress', goalProgressSchema);

// --------------------
// Middleware
// --------------------
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const token = authHeader ? authHeader.split(" ")[1] : null;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

// --------------------
// Routes
// --------------------

// Register user
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3-20 characters" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();
    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err.message);
    if (err.code === 11000) {
      res.status(400).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: "Registration failed" });
    }
  }
});

// Login user
app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    const user = await User.findOne({ username }).select('+password');
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    
    // NEVER send password in response
    res.json({ 
      token, 
      username: user.username, 
      hearts: user.hearts, 
      userId: user._id 
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// User search endpoint with suggestions
app.get('/api/users/search', async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    console.log('User search request:', { q, limit });
    
    if (!q || q.trim().length < 1) {
      console.log('Empty query, returning empty array');
      return res.json([]);
    }
    
    // Create case-insensitive regex for partial matching
    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    console.log('Searching with regex:', regex);
    
    // Search for users by username
    const users = await User.find(
      { username: regex },
      { username: 1, avatar: 1, hearts: 1 } // Only return necessary fields
    )
    .limit(parseInt(limit))
    .lean();
    
    console.log('Found users:', users.length);
    
    // Calculate relevance score (prioritize exact matches and starts-with matches)
    const results = users.map(user => {
      const username = user.username || '';
      const lowerQ = q.toLowerCase();
      const lowerUsername = username.toLowerCase();
      
      let score = 0;
      if (lowerUsername === lowerQ) score = 100; // Exact match
      else if (lowerUsername.startsWith(lowerQ)) score = 50; // Starts with
      else score = 10; // Contains somewhere
      
      return { ...user, _score: score };
    }).sort((a, b) => b._score - a._score);
    
    console.log('Returning results:', results);
    res.json(results);
  } catch (err) {
    console.error('User search error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 }).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's favorite writers
app.get('/api/favorites', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favoriteWriters', 'username avatar hearts').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.favoriteWriters || []);
  } catch (err) {
    console.error('Get favorites error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if user has favorited a writer
app.get('/api/favorites/check/:writerId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, { favoriteWriters: 1 }).lean();
    if (!user) {
      return res.json({ isFavorited: false });
    }
    const isFavorited = user.favoriteWriters?.some(id => id.toString() === req.params.writerId);
    res.json({ isFavorited });
  } catch (err) {
    console.error('Check favorite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add writer to favorites
app.post('/api/favorites/:writerId', authMiddleware, async (req, res) => {
  try {
    const { writerId } = req.params;
    console.log('Add to favorites:', { writerId, currentUser: req.user.id });
    
    // Can't favorite yourself
    if (writerId === req.user.id) {
      console.log('User trying to favorite themselves');
      return res.status(400).json({ error: 'Cannot favorite yourself' });
    }
    
    // Check if writer exists
    const writer = await User.findById(writerId);
    console.log('Writer found:', writer ? writer.username : 'NOT FOUND');
    
    if (!writer) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    // Add to favorites if not already there
    const result = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { favoriteWriters: writerId } },
      { new: true }
    );
    
    console.log('Added to favorites successfully');
    res.json({ ok: true, message: 'Writer added to favorites' });
  } catch (err) {
    console.error('Add favorite error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove writer from favorites
app.delete('/api/favorites/:writerId', authMiddleware, async (req, res) => {
  try {
    const { writerId } = req.params;
    
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { favoriteWriters: writerId } }
    );
    
    res.json({ ok: true, message: 'Writer removed from favorites' });
  } catch (err) {
    console.error('Remove favorite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// --------------------
// Saved Posts Endpoints
// --------------------

// Save a post
app.post('/api/posts/:id/save', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { savedPosts: postId } }, // $addToSet prevents duplicates
      { new: true }
    );
    
    res.json({ ok: true, message: 'Post saved', savedPosts: user.savedPosts });
  } catch (err) {
    console.error('Save post error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unsave a post
app.delete('/api/posts/:id/save', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { savedPosts: postId } },
      { new: true }
    );
    
    res.json({ ok: true, message: 'Post unsaved', savedPosts: user.savedPosts });
  } catch (err) {
    console.error('Unsave post error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all saved posts
app.get('/api/posts/saved', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedPosts').lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ posts: user.savedPosts || [] });
  } catch (err) {
    console.error('Get saved posts error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if post is saved
app.get('/api/posts/:id/saved-status', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const user = await User.findById(req.user.id);
    
    const isSaved = user.savedPosts.some(id => id.toString() === postId);
    
    res.json({ isSaved });
  } catch (err) {
    console.error('Check saved status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// --------------------
// Circle Endpoints
// --------------------

// Get all circles
app.get('/api/circles', async (req, res) => {
  try {
    const circles = await Circle.find({ isActive: true }).sort({ memberCount: -1 }).lean();
    res.json(circles);
  } catch (err) {
    console.error('Get circles error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single circle by slug
app.get('/api/circles/:slug', async (req, res) => {
  try {
    const circle = await Circle.findOne({ slug: req.params.slug, isActive: true }).lean();
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    res.json(circle);
  } catch (err) {
    console.error('Get circle error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a circle
app.post('/api/circles/:slug/join', authMiddleware, async (req, res) => {
  try {
    const circle = await Circle.findOne({ slug: req.params.slug });
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Add circle to user's circles
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { circles: circle._id } },
      { new: true }
    );

    // Check if actually added (not already in array)
    const wasAdded = user.circles.some(c => c.toString() === circle._id.toString());
    if (wasAdded && user.circles.filter(c => c.toString() === circle._id.toString()).length === 1) {
      // Increment member count only if newly added
      await Circle.findByIdAndUpdate(circle._id, { $inc: { memberCount: 1 } });
    }

    res.json({ ok: true, message: 'Joined circle successfully' });
  } catch (err) {
    console.error('Join circle error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave a circle
app.post('/api/circles/:slug/leave', authMiddleware, async (req, res) => {
  try {
    const circle = await Circle.findOne({ slug: req.params.slug });
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Remove circle from user's circles
    const user = await User.findById(req.user.id);
    const hadCircle = user.circles.some(c => c.toString() === circle._id.toString());
    
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { circles: circle._id } }
    );

    // Decrement member count if user actually had the circle
    if (hadCircle) {
      await Circle.findByIdAndUpdate(circle._id, { $inc: { memberCount: -1 } });
    }

    res.json({ ok: true, message: 'Left circle successfully' });
  } catch (err) {
    console.error('Leave circle error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's joined circles
app.get('/api/my-circles', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('circles').lean();
    res.json(user.circles || []);
  } catch (err) {
    console.error('Get my circles error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get posts in a specific circle
app.get('/api/circles/:slug/posts', async (req, res) => {
  try {
    const circle = await Circle.findOne({ slug: req.params.slug });
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // Get posts in this circle, exclude expired ones
    const now = new Date();
    const query = { 
      circleId: circle._id,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    };

    const total = await Post.countDocuments(query);
    let posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Hide author info for anonymous posts
    const origin = req.protocol + '://' + req.get('host');
    posts = posts.map(p => {
      const post = { ...p };
      if (post.isAnonymous) {
        post.author = 'Anonymous';
        post.userId = null;
      }
      post.images = (post.images || []).map(src => 
        src && src.startsWith('http') ? src : `${origin}${src}`
      );
      return post;
    });

    res.json({ posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Get circle posts error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all posts
app.get("/api/posts", async (req, res) => {
  try {
    // pagination: ?page=1&limit=10
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const total = await Post.countDocuments();
    let posts = await Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    // map images to absolute URLs
    const origin = req.protocol + '://' + req.get('host');
    posts = posts.map(p => ({ ...p, images: (p.images||[]).map(src => src && src.startsWith('http') ? src : `${origin}${src}`) }));
    res.json({ posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Fetch posts error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Create post (supports multipart images + verification proofs + voice notes)
app.post("/api/posts", authMiddleware, (req, res, next) => {
  const fields = upload.fields([ 
    { name:'images', maxCount:6 }, 
    { name:'proofs', maxCount:6 },
    { name:'audio', maxCount:1 }
  ]);
  fields(req, res, function(err){
    if(err) return next(err);
    next();
  });
}, async (req, res) => {
  try {
    const body = req.body || {};
    // Cloudinary returns the full URL in file.path
    const images = ((req.files && req.files.images) ? req.files.images : []).map(f => {
      console.log('📸 Image uploaded to Cloudinary:', f.path);
      return f.path; // Cloudinary URL
    });
    const proofs = ((req.files && req.files.proofs) ? req.files.proofs : []).map(f => {
      return f.path; // Cloudinary URL
    });
    
    // Handle audio file for voice notes
    let voiceNoteData = null;
    if (req.files && req.files.audio && req.files.audio[0]) {
      const audioFile = req.files.audio[0];
      const audioUrl = audioFile.path; // Cloudinary URL
      console.log('🎤 Audio uploaded to Cloudinary:', audioUrl);
      // TODO: Add Groq Whisper transcription here in future
      voiceNoteData = {
        audioUrl,
        duration: 0, // Can be calculated on frontend
        transcript: '' // Will add Whisper API later
      };
    }
    
    if (images.length > 0) {
      console.log('✅ Total images for post:', images.length, images);
    }
    
    const visibility = body.visibility === 'Private' ? 'Private' : 'Public';
    const allowTrading = body.allowTrading === 'true' || body.allowTrading === true;
    const free = body.free === 'true' || body.free === true;
    const priceHearts = free ? 0 : Math.max(0, parseInt(body.priceHearts || '0', 10) || 0);
    const tags = (body.tags || '').split(',').map(s=>s.trim()).filter(Boolean);
    const categories = (body.categories || '').split(',').map(s=>s.trim()).filter(Boolean);
    const language = (body.language || 'en').trim() || 'en';
    const content = body.content || '';
    const hook = (content || '').toString().slice(0, 160);

    // AI Emotion Analysis - Now determines rarity automatically!
    let aiAnalysisResult = null;
    let detectedEmotion = body.emotion || '✨';
    let rarity = 'Common'; // Default
    
    try {
      console.log('🤖 Running AI emotion analysis...');
      aiAnalysisResult = await analyzeEmotion(body.title || '', content);
      console.log('✅ AI Analysis complete:', aiAnalysisResult);
      
      // Use AI-detected emotion if available
      if (aiAnalysisResult && aiAnalysisResult.emotion) {
        detectedEmotion = quickEmotionCheck(aiAnalysisResult.emotion) + ' ' + aiAnalysisResult.emotion;
      }
      
      // Automatically set rarity based on AI analysis
      if (aiAnalysisResult && aiAnalysisResult.suggestedRarity) {
        rarity = aiAnalysisResult.suggestedRarity;
        console.log(`🎯 AI-determined rarity: ${rarity}`);
      }
    } catch (aiError) {
      console.error('⚠️ AI analysis failed, continuing without it:', aiError.message);
    }

    const postData = {
      emotion: detectedEmotion,
      title: body.title,
      excerpt: body.excerpt,
      content,
      cost: body.cost,
      free,
      images,
      userId: req.user.id,
      author: req.user.username,
      rarity,
      visibility,
      allowTrading,
      priceHearts,
      tags,
      categories,
      language,
      hook,
      ownerId: req.user.id,
      // Voice note
      voiceNote: voiceNoteData,
      // Circle support
      ownerId: req.user.id,
      // Circle support
      circleId: body.circleId || null,
      isAnonymous: body.isAnonymous || false
    };

    // Set expiration for circle posts (7 days)
    if (postData.circleId) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      postData.expiresAt = expiresAt;
      
      // Increment circle post count
      await Circle.findByIdAndUpdate(postData.circleId, { $inc: { postCount: 1 } });
    }

    // Add AI analysis if available
    if (aiAnalysisResult) {
      postData.aiAnalysis = {
        emotionScore: aiAnalysisResult.emotionScore,
        detectedEmotions: aiAnalysisResult.detectedEmotions,
        aiRating: aiAnalysisResult.aiRating,
        authenticity: aiAnalysisResult.authenticity,
        depth: aiAnalysisResult.depth,
        clarity: aiAnalysisResult.clarity,
        suggestedRarity: aiAnalysisResult.suggestedRarity,
        suggestedTags: aiAnalysisResult.suggestedTags,
        aiSummary: aiAnalysisResult.aiSummary,
        confidence: aiAnalysisResult.confidence,
        analyzedAt: new Date(),
        source: aiAnalysisResult.source
      };

      // Optionally use AI suggestions for tags and rarity
      if (aiAnalysisResult.suggestedTags && aiAnalysisResult.suggestedTags.length > 0 && tags.length === 0) {
        postData.tags = aiAnalysisResult.suggestedTags;
      }
    }

    // verification flow
    if(rarity === 'Common'){
      postData.status = 'Published';
      postData.verified = false;
      postData.verification = { status: 'None', notes: '', files: [] };
    }else{
      postData.status = 'PendingVerification';
      postData.verified = false;
      postData.verification = { status: 'Pending', notes: (body.verificationNotes||''), files: proofs };
    }
    const post = new Post(postData);
    await post.save();
    
    // Update writing streak
    await updateWritingStreak(req.user.id);
    
    // Award experience and check badges for post creation
    const expAmount = rarity === 'Legendary' ? 50 : rarity === 'Rare' ? 25 : 10;
    await awardExperience(req.user.id, expAmount, 'post_created', `Created a ${rarity} post`);
    
    // Award karma based on post quality
    const karmaAmount = rarity === 'Legendary' ? 20 : rarity === 'Rare' ? 10 : 5;
    await awardKarma(req.user.id, karmaAmount, 'post_created', `Quality content: ${rarity} post`);
    
    // Check for posting badges
    await checkBadges(req.user.id, 'post_created');
    
    res.json(post);
  } catch (err) {
    console.error("Create post error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a post (owner only)
app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Delete request for post:', req.params.id);
    console.log('User ID from token:', req.user.id);
    
    const post = await Post.findById(req.params.id);
    if (!post) {
      console.log('Post not found');
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log('Post found:', { 
      userId: post.userId, 
      ownerId: post.ownerId,
      title: post.title 
    });
    
    // Check if user is the owner - check both userId and ownerId fields
    const postUserId = (post.userId || '').toString();
    const postOwnerId = (post.ownerId || '').toString();
    const currentUserId = req.user.id;
    
    console.log('Ownership check:', {
      postUserId,
      postOwnerId,
      currentUserId,
      matchUserId: postUserId === currentUserId,
      matchOwnerId: postOwnerId === currentUserId
    });
    
    if (postUserId !== currentUserId && postOwnerId !== currentUserId) {
      console.log('Authorization failed');
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }
    
    console.log('Deleting associated listings...');
    // Delete associated listings first
    await Listing.deleteMany({ postId: post._id });
    
    console.log('Deleting post...');
    // Delete the post
    await Post.findByIdAndDelete(req.params.id);
    
    console.log('Post deleted successfully');
    res.json({ ok: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});

// Like/unlike a post (toggle)
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
  try{
    const post = await Post.findById(req.params.id);
    if(!post) return res.status(404).json({ error: 'Post not found' });
    const uid = req.user.id;
    const idx = (post.likedBy || []).findIndex(x => x.toString() === uid);
    let liked = false;
    if(idx >= 0){
      post.likedBy.splice(idx,1);
      post.likes = Math.max(0, (post.likes||0) - 1);
      liked = false;
    }else{
      post.likedBy = [...(post.likedBy||[]), uid];
      post.likes = (post.likes||0) + 1;
      liked = true;
      
      // Award rewards to post author when their post gets liked (not to the liker)
      if (post.ownerId && post.ownerId.toString() !== uid) {
        const heartReward = post.rarity === 'Legendary' ? 3 : post.rarity === 'Rare' ? 2 : 1;
        const karmaReward = post.rarity === 'Legendary' ? 5 : post.rarity === 'Rare' ? 3 : 2;
        
        // Award hearts to post author
        const author = await User.findById(post.ownerId);
        if (author) {
          author.hearts += heartReward;
          author.heartsReceived += heartReward;
          await author.save();
          
          // Create transaction for post author
          await new Transaction({
            userId: post.ownerId,
            type: 'hearts_earned',
            amount: heartReward,
            source: 'post_liked',
            description: `Your ${post.rarity} post received a like`,
            relatedId: post._id,
            metadata: { likedBy: uid, postTitle: post.title }
          }).save();
        }
        
        // Award karma to post author
        await awardKarma(post.ownerId, karmaReward, 'post_liked', `Post received a like`);
        
        // Award small experience to liker for engaging
        await awardExperience(uid, 1, 'liked_post', 'Engaged with community content');
        
        // Check badges for hearts received milestone
        await checkBadges(post.ownerId, 'hearts_received');
      }
    }
    await post.save();
    res.json({ ok:true, likes: post.likes, liked });
  }catch(err){ console.error('Like error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Get posts liked by a user (for trade browsing)
app.get('/api/users/:userId/liked-posts', async (req, res) => {
  try{
    const { userId } = req.params;
    if(!userId) return res.status(400).json({ error: 'User ID required' });
    const posts = await Post.find({ likedBy: userId, visibility: { $ne: 'Private' } }).sort({ createdAt: -1 }).limit(50).lean();
    const origin = req.protocol + '://' + req.get('host');
    const mapped = posts.map(p => ({ ...p, images: (p.images||[]).map(src => src && src.startsWith('http') ? src : `${origin}${src}`) }));
    res.json(mapped);
  }catch(err){ console.error('Liked posts error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Get my liked posts
app.get('/api/my-liked-posts', authMiddleware, async (req, res) => {
  try{
    const posts = await Post.find({ likedBy: req.user.id, visibility: { $ne: 'Private' } }).sort({ createdAt: -1 }).limit(50).lean();
    const origin = req.protocol + '://' + req.get('host');
    const mapped = posts.map(p => ({ ...p, images: (p.images||[]).map(src => src && src.startsWith('http') ? src : `${origin}${src}`) }));
    res.json(mapped);
  }catch(err){ console.error('My liked posts error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Get comments for a post
app.get('/api/posts/:id/comments', async (req,res)=>{
  try{
    const post = await Post.findById(req.params.id).lean();
    if(!post) return res.status(404).json({ error:'Post not found' });
    res.json({ comments: (post.comments||[]).slice(-100) });
  }catch(err){ console.error('Comments fetch error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Add a comment to a post
app.post('/api/posts/:id/comments', authMiddleware, async (req,res)=>{
  try{
    const { text } = req.body || {};
    if(!text || !text.trim()) return res.status(400).json({ error:'Empty comment' });
    const post = await Post.findById(req.params.id);
    if(!post) return res.status(404).json({ error:'Post not found' });
    const comment = { userId: req.user.id, username: req.user.username, text: text.trim(), createdAt: new Date() };
    post.comments = [...(post.comments||[]), comment];
    await post.save();
    res.json({ ok:true, comment, count: post.comments.length });
  }catch(err){ console.error('Add comment error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Create a listing (sell a post you own)
app.post('/api/listings', authMiddleware, async (req,res)=>{
  try{
    const { postId, priceHearts } = req.body || {};
    const post = await Post.findById(postId);
    if(!post) return res.status(404).json({ error:'Post not found' });
    const owner = (post.ownerId || post.userId || '').toString();
    if(owner !== req.user.id) return res.status(403).json({ error:'Not owner' });
    if(post.visibility === 'Private') return res.status(400).json({ error:'Private posts cannot be listed' });
    const price = Math.max(1, parseInt(priceHearts||'0',10));
    const listing = new Listing({ postId: post._id, sellerId: req.user.id, priceHearts: price, active: true });
    await listing.save();
    res.json({ ok:true, listing });
  }catch(err){ console.error('Create listing error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Browse active listings
app.get('/api/listings', async (req,res)=>{
  try{
    const { postId } = req.query || {};
    const q = { active: true };
    if(postId){ q.postId = postId };
    const list = await Listing.find(q).sort({ createdAt: -1 }).lean();
    const ids = list.map(l=> l.postId);
    const posts = await Post.find({ _id: { $in: ids } }).lean();
    const pmap = Object.fromEntries(posts.map(p=> [p._id.toString(), p]));
    res.json(list.map(l=> ({ ...l, post: pmap[l.postId.toString()] })));
  }catch(err){ console.error('List listings error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Purchase a listing: transfer hearts and ownership
app.post('/api/listings/:id/buy', authMiddleware, async (req,res)=>{
  try{
    const listing = await Listing.findById(req.params.id);
    if(!listing || !listing.active) return res.status(400).json({ error:'Listing not available' });
    const post = await Post.findById(listing.postId);
    if(!post) return res.status(404).json({ error:'Post not found' });
    if(post.visibility === 'Private') return res.status(400).json({ error:'Private posts cannot be bought' });
    const buyer = await User.findById(req.user.id);
    const seller = await User.findById(listing.sellerId);
    if(!buyer || !seller) return res.status(404).json({ error:'Users not found' });
    const price = Math.max(1, parseInt(listing.priceHearts||0,10));
    if(buyer.hearts < price) return res.status(400).json({ error:'Not enough hearts' });
    buyer.hearts -= price;
    seller.hearts += price;
    post.ownerId = buyer._id;
    listing.active = false;
    await Promise.all([ buyer.save(), seller.save(), post.save(), listing.save() ]);
    res.json({ ok:true, buyerHearts: buyer.hearts });
  }catch(err){ console.error('Buy listing error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Owned posts by current ownerId
app.get('/api/owned', authMiddleware, async (req,res)=>{
  try{
    let posts = await Post.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean();
    const origin = req.protocol + '://' + req.get('host');
    posts = posts.map(p => ({ ...p, images: (p.images||[]).map(src => src && src.startsWith('http') ? src : `${origin}${src}`) }));
    res.json(posts);
  }catch(err){ console.error('Owned fetch error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Create trade offer
app.post('/api/trades', authMiddleware, async (req,res)=>{
  try{
    const { offerPostId, requestPostId, message } = req.body || {};
    const offerPost = await Post.findById(offerPostId);
    const requestPost = await Post.findById(requestPostId);
    if(!offerPost || !requestPost) return res.status(404).json({ error:'Posts not found' });
    if((offerPost.ownerId||offerPost.userId)?.toString() !== req.user.id) return res.status(403).json({ error:'You do not own the offered post' });
    const toUserId = (requestPost.ownerId || requestPost.userId);
    const t = new TradeOffer({ fromUserId: req.user.id, toUserId, offerPostId, requestPostId, message });
    await t.save(); res.json({ ok:true, trade: t });
  }catch(err){ console.error('Trade create error', err.message); res.status(500).json({ error:'Server error' }) }
});

// List trade offers (incoming/outgoing)
app.get('/api/trades', authMiddleware, async (req,res)=>{
  try{
    const dir = req.query.dir === 'out' ? 'out' : 'in';
    const q = dir === 'in' ? { toUserId: req.user.id } : { fromUserId: req.user.id };
    const list = await TradeOffer.find(q).sort({ createdAt: -1 }).lean();
    res.json(list);
  }catch(err){ console.error('Trade list error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Update a trade offer; on accept, swap ownership
app.patch('/api/trades/:id', authMiddleware, async (req,res)=>{
  try{
    const { status } = req.body || {};
    const t = await TradeOffer.findById(req.params.id);
    if(!t) return res.status(404).json({ error:'Not found' });
    if(t.toUserId.toString() !== req.user.id) return res.status(403).json({ error:'Forbidden' });
    if(!['accepted','rejected','counter'].includes(status)) return res.status(400).json({ error:'Invalid status' });
    t.status = status; await t.save();
    if(status === 'accepted'){
      const a = await Post.findById(t.offerPostId);
      const b = await Post.findById(t.requestPostId);
      if(a && b){ const tmp = a.ownerId; a.ownerId = b.ownerId; b.ownerId = tmp; await a.save(); await b.save(); }
    }
    res.json({ ok:true, trade: t });
  }catch(err){ console.error('Trade update error', err.message); res.status(500).json({ error:'Server error' }) }
});

// Debug: list uploads folder
app.get('/api/uploads-list', (req, res) => {
  try{
    const files = fs.readdirSync(UPLOADS_DIR).map(name=>{
      const stat = fs.statSync(path.join(UPLOADS_DIR, name));
      return { name, size: stat.size, mtime: stat.mtime };
    });
    res.json({ ok:true, files });
  }catch(err){ res.status(500).json({ error: err.message }) }
});

// attach multer error handler after upload routes
app.use(multerErrorHandler);

// Unlock post
app.post("/api/unlock/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { cost } = req.body;
    if (user.hearts < cost) return res.status(400).json({ error: "Not enough hearts" });

    user.hearts -= cost;
    await user.save();
    res.json({ ok: true, hearts: user.hearts });
  } catch (err) {
    console.error("Unlock error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get posts for a specific user
app.get('/api/posts/user/:id', async (req, res) => {
  try {
    let posts = await Post.find({ userId: req.params.id }).sort({ createdAt: -1 }).lean();
    const origin = req.protocol + '://' + req.get('host');
    posts = posts.map(p => ({ ...p, images: (p.images||[]).map(src => src && src.startsWith('http') ? src : `${origin}${src}`) }));
    res.json(posts);
  } catch (err) {
    console.error('Fetch user posts error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get posts for the authenticated user
app.get('/api/my-posts', authMiddleware, async (req, res) => {
  try {
    // support pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const total = await Post.countDocuments({ userId: req.user.id });
    const posts = await Post.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit);
  let postsLean = await Post.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const origin = req.protocol + '://' + req.get('host');
  postsLean = postsLean.map(p => ({ ...p, images: (p.images||[]).map(src => src && src.startsWith('http') ? src : `${origin}${src}`) }));
  res.json({ posts: postsLean, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Fetch my posts error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve uploaded avatars and configure multer - compute __dirname reliably in ESM
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// compute __dirname reliably in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'emotionally-uploads', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'wav', 'm4a', 'mp4'],
    resource_type: 'auto', // Automatically detect file type (image, video, audio)
    transformation: [{ quality: 'auto', fetch_format: 'auto' }] // Auto-optimize images
  }
});
console.log('☁️ Using Cloudinary storage for uploads');

const fileFilter = (req, file, cb) => {
  // accept images and audio files
  const allowedImages = ['image/jpeg','image/png','image/gif','image/jpg','image/webp'];
  const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'];
  
  if(allowedImages.includes(file.mimetype) || allowedAudio.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and audio files are allowed'));
  }
};
const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 5 * 1024 * 1024 } // Reduced to 5MB to prevent timeouts
});

// middleware to handle multer errors cleanly
function multerErrorHandler(err, req, res, next){
  if(err instanceof multer.MulterError){
    // handle Multer-specific errors
    if(err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({error:'File too large (max 5MB)'});
    if(err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({error:'Unexpected file field'});
    return res.status(400).json({ error: err.message });
  }
  if(err){
    // Handle network errors during upload
    if(err.message && (err.message.includes('ECONNRESET') || err.message.includes('timeout'))){
      return res.status(503).json({error:'Upload service temporarily unavailable. Please try again.'});
    }
    if(err.message && err.message.includes('Only image and audio files are allowed')){
      return res.status(400).json({error:'Invalid file type. Only images and audio files allowed'});
    }
    return res.status(400).json({ error: err.message || 'Upload error' });
  }
  next();
}
// basic request logger for debugging uploads
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// temporary test upload route (no auth) to verify multer + static serving
app.post('/api/test-upload', upload.single('file'), (req, res) => {
  if(!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // return the absolute public url
  const origin = req.protocol + '://' + req.get('host');
  const publicUrl = `${origin}/uploads/${req.file.filename}`;
  res.json({ ok: true, file: req.file.filename, url: publicUrl });
});

// Upload avatar
app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // For Cloudinary uploads, use the secure_url from the uploaded file
    const avatarUrl = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    
    const user = await User.findById(req.user.id);
    if(!user) return res.status(404).json({ error: 'User not found' });
    
    user.avatar = avatarUrl;
    await user.save();
    
    console.log(`✅ Avatar uploaded for user ${user.username}: ${avatarUrl}`);
    res.json({ avatar: user.avatar, message: 'Avatar uploaded successfully' });
  }catch(err){ 
    console.error('❌ Avatar upload error:', err.message); 
    
    // Handle specific error types
    if(err.message.includes('ECONNRESET')) {
      return res.status(503).json({ error: 'Upload service temporarily unavailable. Please try again.' });
    }
    if(err.message.includes('timeout')) {
      return res.status(408).json({ error: 'Upload timed out. Please try with a smaller file.' });
    }
    
    res.status(500).json({ error: 'Upload failed. Please try again later.' });
  }
});



// Simple trade endpoint (create a trade request)
const tradeSchema = new mongoose.Schema({ fromUser: String, toUser: String, item: String, message: String, createdAt:{type:Date,default:Date.now} });
const Trade = mongoose.model('Trade', tradeSchema);
app.post('/api/trade', authMiddleware, async (req,res)=>{
  try{
    const t = new Trade({ fromUser: req.user.username, ...req.body });
    await t.save();
    res.json({ ok:true, trade: t });
  }catch(err){ console.error('Trade error', err.message); res.status(500).json({ error:'Server error' }) }
});

// --------------------
// Connect to MongoDB & Start Server
// --------------------
// Start the HTTP server immediately and bind to all interfaces (0.0.0.0 for production)
const HOST = process.env.HOST || '0.0.0.0';
// AI Emotion Analysis endpoint - re-analyze existing posts
app.post('/api/posts/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user owns the post
    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    console.log('🤖 Re-analyzing post:', post._id);
    const aiAnalysisResult = await analyzeEmotion(post.title || '', post.content || '');
    
    // Update post with AI analysis
    post.aiAnalysis = {
      emotionScore: aiAnalysisResult.emotionScore,
      detectedEmotions: aiAnalysisResult.detectedEmotions,
      aiRating: aiAnalysisResult.aiRating,
      authenticity: aiAnalysisResult.authenticity,
      depth: aiAnalysisResult.depth,
      clarity: aiAnalysisResult.clarity,
      suggestedRarity: aiAnalysisResult.suggestedRarity,
      suggestedTags: aiAnalysisResult.suggestedTags,
      aiSummary: aiAnalysisResult.aiSummary,
      confidence: aiAnalysisResult.confidence,
      analyzedAt: new Date(),
      source: aiAnalysisResult.source
    };

    // Update emotion with AI detection
    if (aiAnalysisResult.emotion) {
      post.emotion = quickEmotionCheck(aiAnalysisResult.emotion) + ' ' + aiAnalysisResult.emotion;
    }

    await post.save();
    
    res.json({
      success: true,
      analysis: post.aiAnalysis,
      updatedEmotion: post.emotion
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// Get AI analysis for a post (public endpoint)
app.get('/api/posts/:id/analysis', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select('aiAnalysis emotion title');
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      analysis: post.aiAnalysis || null,
      emotion: post.emotion,
      title: post.title
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to retrieve analysis' });
  }
});

// --------------------
// MOOD TRACKING ENDPOINTS
// --------------------

// Create mood entry
app.post('/api/moods', authMiddleware, async (req, res) => {
  try {
    const { mood, intensity, note, activities, triggers } = req.body;
    
    if (!mood || !intensity) {
      return res.status(400).json({ error: 'Mood and intensity are required' });
    }

    const moodEntry = new MoodEntry({
      userId: req.user.id,
      mood,
      intensity,
      note,
      activities: activities || [],
      triggers: triggers || []
    });

    await moodEntry.save();
    res.json({ ok: true, moodEntry });
  } catch (error) {
    console.error('Create mood error:', error);
    res.status(500).json({ error: 'Failed to create mood entry' });
  }
});

// Get mood history
app.get('/api/moods', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const moods = await MoodEntry.find({
      userId: req.user.id,
      createdAt: { $gte: since }
    }).sort({ createdAt: -1 });

    res.json({ moods });
  } catch (error) {
    console.error('Get moods error:', error);
    res.status(500).json({ error: 'Failed to retrieve mood history' });
  }
});

// Get AI insights about mood patterns
app.get('/api/moods/insights', authMiddleware, async (req, res) => {
  try {
    const moods = await MoodEntry.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    if (moods.length < 3) {
      return res.json({ insight: 'Track more moods to get personalized insights!' });
    }

    // Generate AI insight using Groq
    const moodSummary = moods.map(m => 
      `${m.mood} (intensity: ${m.intensity}/10) - ${m.note || 'no note'}`
    ).join('\n');

    const prompt = `Analyze these mood entries and provide a brief, empathetic insight about patterns and suggestions:

${moodSummary}

Provide a short, caring response (2-3 sentences) highlighting any patterns and offering gentle guidance.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    const data = await groqResponse.json();
    const insight = data.choices?.[0]?.message?.content || 'Unable to generate insights at this time.';

    res.json({ insight, totalEntries: moods.length });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// --------------------
// GOAL TRACKING ENDPOINTS
// --------------------

// Create a new goal
app.post('/api/goals', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, targetType, targetValue, targetUnit, deadline, priority, milestones } = req.body;

    if (!title || !category || !targetType) {
      return res.status(400).json({ error: 'Title, category, and target type are required' });
    }

    const goal = new Goal({
      userId: req.user.id,
      title: title.trim(),
      description: description?.trim(),
      category,
      targetType,
      targetValue,
      targetUnit,
      deadline: deadline ? new Date(deadline) : undefined,
      priority: priority || 'medium',
      milestones: milestones || []
    });

    await goal.save();
    res.status(201).json(goal);
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Get user's goals
app.get('/api/goals', authMiddleware, async (req, res) => {
  try {
    const { status, category } = req.query;
    
    let filter = { userId: req.user.id };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    res.json(goals);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Get progress statistics (must be before /:id route)
app.get('/api/goals/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await Goal.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalProgress: { $sum: '$currentProgress' }
        }
      }
    ]);

    const totalGoals = await Goal.countDocuments({ userId });
    const completedGoals = await Goal.countDocuments({ userId, status: 'completed' });
    const activeGoals = await Goal.countDocuments({ userId, status: 'active' });

    const recentProgress = await GoalProgress.find({ userId })
      .sort({ date: -1 })
      .limit(7)
      .populate('goalId', 'title category');

    res.json({
      totalGoals,
      completedGoals,
      activeGoals,
      completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
      statsBreakdown: stats,
      recentProgress
    });
  } catch (error) {
    console.error('Get goal stats error:', error);
    res.status(500).json({ error: 'Failed to fetch goal statistics' });
  }
});

// Get single goal with progress
app.get('/api/goals/:id', authMiddleware, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get progress entries for this goal
    const progressEntries = await GoalProgress.find({ 
      goalId: req.params.id,
      userId: req.user.id 
    }).sort({ date: -1 });

    res.json({ goal, progressEntries });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

// Update goal
app.put('/api/goals/:id', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id; // Prevent ID updates
    delete updates.userId; // Prevent user change

    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...updates, lastUpdated: new Date() },
      { new: true }
    );

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json(goal);
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// Delete goal
app.delete('/api/goals/:id', authMiddleware, async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Also delete associated progress entries
    await GoalProgress.deleteMany({ goalId: req.params.id });

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Add progress to a goal
app.post('/api/goals/:id/progress', authMiddleware, async (req, res) => {
  try {
    const { progressValue, note, date, mood } = req.body;

    if (progressValue === undefined || progressValue === null) {
      return res.status(400).json({ error: 'Progress value is required' });
    }

    // Check if goal exists and belongs to user
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const progressDate = date ? new Date(date) : new Date();
    
    // Check if progress for this date already exists
    const existingProgress = await GoalProgress.findOne({
      goalId: req.params.id,
      userId: req.user.id,
      date: {
        $gte: new Date(progressDate.toDateString()),
        $lt: new Date(new Date(progressDate.toDateString()).getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingProgress) {
      // Update existing progress
      existingProgress.progressValue = progressValue;
      existingProgress.note = note;
      if (mood) existingProgress.mood = mood;
      await existingProgress.save();
      
      // Update goal's current progress
      const totalProgress = await GoalProgress.aggregate([
        { $match: { goalId: new mongoose.Types.ObjectId(req.params.id) } },
        { $group: { _id: null, total: { $sum: '$progressValue' } } }
      ]);
      
      goal.currentProgress = totalProgress[0]?.total || 0;
      goal.lastUpdated = new Date();
      
      // Check if goal is completed
      if (goal.targetValue && goal.currentProgress >= goal.targetValue) {
        goal.status = 'completed';
      }
      
      await goal.save();
      return res.json({ progress: existingProgress, goal });
    }

    // Create new progress entry
    const progress = new GoalProgress({
      goalId: req.params.id,
      userId: req.user.id,
      date: progressDate,
      progressValue,
      note,
      mood
    });

    await progress.save();

    // Update goal's current progress
    const totalProgress = await GoalProgress.aggregate([
      { $match: { goalId: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: null, total: { $sum: '$progressValue' } } }
    ]);
    
    goal.currentProgress = totalProgress[0]?.total || 0;
    goal.lastUpdated = new Date();
    
    // Check milestones and completion
    if (goal.milestones) {
      goal.milestones.forEach(milestone => {
        if (!milestone.achieved && goal.currentProgress >= milestone.targetValue) {
          milestone.achieved = true;
          milestone.achievedAt = new Date();
        }
      });
    }
    
    // Check if goal is completed
    if (goal.targetValue && goal.currentProgress >= goal.targetValue) {
      goal.status = 'completed';
    }
    
    await goal.save();

    res.status(201).json({ progress, goal });
  } catch (error) {
    console.error('Add progress error:', error);
    res.status(500).json({ error: 'Failed to add progress' });
  }
});

// --------------------
// HEART GIFTING ENDPOINTS
// --------------------

// Send hearts as a gift
app.post('/api/gifts/send', authMiddleware, async (req, res) => {
  try {
    const { toUserId, amount, message, postId } = req.body;

    if (!toUserId || !amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid gift parameters' });
    }

    // Check if sender has enough hearts
    const sender = await User.findById(req.user.id);
    if (sender.hearts < amount) {
      return res.status(400).json({ error: 'Not enough hearts to gift' });
    }

    // Prevent self-gifting
    if (toUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot gift hearts to yourself' });
    }

    // Transfer hearts
    const receiver = await User.findById(toUserId);
    if (!receiver) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    sender.hearts -= amount;
    sender.heartsGifted += amount;
    receiver.hearts += amount;
    receiver.heartsReceived += amount;

    // Create gift record
    const gift = new HeartGift({
      fromUserId: req.user.id,
      toUserId,
      amount,
      message,
      postId
    });

    await Promise.all([sender.save(), receiver.save(), gift.save()]);

    res.json({ 
      ok: true, 
      remainingHearts: sender.hearts,
      message: 'Hearts sent successfully!' 
    });
  } catch (error) {
    console.error('Send gift error:', error);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Get received gifts
app.get('/api/gifts/received', authMiddleware, async (req, res) => {
  try {
    const gifts = await HeartGift.find({ toUserId: req.user.id })
      .populate('fromUserId', 'username avatar')
      .populate('postId', 'title emotion')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ gifts });
  } catch (error) {
    console.error('Get gifts error:', error);
    res.status(500).json({ error: 'Failed to retrieve gifts' });
  }
});

// Get sent gifts
app.get('/api/gifts/sent', authMiddleware, async (req, res) => {
  try {
    const gifts = await HeartGift.find({ fromUserId: req.user.id })
      .populate('toUserId', 'username avatar')
      .populate('postId', 'title emotion')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ gifts });
  } catch (error) {
    console.error('Get sent gifts error:', error);
    res.status(500).json({ error: 'Failed to retrieve sent gifts' });
  }
});

// --------------------
// POST REACTIONS ENDPOINTS
// --------------------

// Add/update reaction to post
app.post('/api/posts/:id/react', authMiddleware, async (req, res) => {
  try {
    const { reactionType } = req.body; // 'empathy', 'support', 'strength', 'hope'
    const validReactions = ['empathy', 'support', 'strength', 'hope'];

    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Initialize reactions if not exists
    if (!post.reactions) {
      post.reactions = { empathy: [], support: [], strength: [], hope: [] };
    }

    // Remove user from all reaction arrays first (toggle functionality)
    validReactions.forEach(type => {
      post.reactions[type] = post.reactions[type].filter(
        id => id.toString() !== req.user.id
      );
    });

    // Add user to the selected reaction
    post.reactions[reactionType].push(req.user.id);

    await post.save();

    res.json({ 
      ok: true, 
      reactions: {
        empathy: post.reactions.empathy.length,
        support: post.reactions.support.length,
        strength: post.reactions.strength.length,
        hope: post.reactions.hope.length
      },
      userReaction: reactionType
    });
  } catch (error) {
    console.error('React error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from post
app.delete('/api/posts/:id/react', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const validReactions = ['empathy', 'support', 'strength', 'hope'];
    validReactions.forEach(type => {
      if (post.reactions && post.reactions[type]) {
        post.reactions[type] = post.reactions[type].filter(
          id => id.toString() !== req.user.id
        );
      }
    });

    await post.save();
    res.json({ ok: true, message: 'Reaction removed' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// --------------------
// WRITING STREAKS ENDPOINTS
// --------------------

// Get user's writing streak
app.get('/api/streaks/my', authMiddleware, async (req, res) => {
  try {
    let streak = await WritingStreak.findOne({ userId: req.user.id });
    
    if (!streak) {
      streak = new WritingStreak({ userId: req.user.id });
      await streak.save();
    }

    res.json({ streak });
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json({ error: 'Failed to retrieve streak' });
  }
});

// Update streak (called when user creates a post)
async function updateWritingStreak(userId) {
  try {
    let streak = await WritingStreak.findOne({ userId });
    
    if (!streak) {
      streak = new WritingStreak({ 
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastPostDate: new Date(),
        streakDates: [new Date()],
        totalPosts: 1
      });
      await streak.save();
      return streak;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastPost = streak.lastPostDate ? new Date(streak.lastPostDate) : null;
    if (lastPost) {
      lastPost.setHours(0, 0, 0, 0);
    }

    // Check if already posted today
    if (lastPost && lastPost.getTime() === today.getTime()) {
      // Already posted today, just increment total
      streak.totalPosts += 1;
      await streak.save();
      return streak;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if streak continues
    if (lastPost && lastPost.getTime() === yesterday.getTime()) {
      // Consecutive day!
      streak.currentStreak += 1;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
    } else if (!lastPost || lastPost.getTime() < yesterday.getTime()) {
      // Streak broken, start new
      streak.currentStreak = 1;
    }

    streak.lastPostDate = today;
    streak.streakDates.push(today);
    streak.totalPosts += 1;

    // Award badges
    if (!streak.badges) streak.badges = [];
    const badgesToAward = [
      { type: '7-day', threshold: 7 },
      { type: '30-day', threshold: 30 },
      { type: '100-day', threshold: 100 },
      { type: '365-day', threshold: 365 }
    ];

    badgesToAward.forEach(badge => {
      if (streak.currentStreak >= badge.threshold) {
        const hasBadge = streak.badges.some(b => b.type === badge.type);
        if (!hasBadge) {
          streak.badges.push({ type: badge.type, earnedAt: new Date() });
        }
      }
    });

    await streak.save();
    return streak;
  } catch (error) {
    console.error('Update streak error:', error);
  }
}

// --------------------
// ENHANCED REWARD & TRADING SYSTEM
// --------------------

// Utility function to award experience and check level ups
async function awardExperience(userId, amount, source, description = '') {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const oldLevel = user.level;
    user.experience += amount;
    
    // Level calculation: 100 * level for next level
    const newLevel = Math.floor(user.experience / 100) + 1;
    if (newLevel > user.level) {
      user.level = newLevel;
      user.hearts += (newLevel - oldLevel) * 5; // Bonus hearts for leveling up
      
      // Create level up transaction
      await new Transaction({
        userId,
        type: 'hearts_earned',
        amount: (newLevel - oldLevel) * 5,
        source: 'level_up',
        description: `Level up bonus: ${oldLevel} → ${newLevel}`,
        metadata: { oldLevel, newLevel }
      }).save();
    }

    await user.save();

    // Create experience transaction
    await new Transaction({
      userId,
      type: 'experience_gained',
      amount,
      source,
      description,
      metadata: { oldLevel, newLevel: user.level }
    }).save();

    return { oldLevel, newLevel: user.level, experienceGained: amount };
  } catch (error) {
    console.error('Award experience error:', error);
  }
}

// Utility function to award karma
async function awardKarma(userId, amount, source, description = '') {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.karma += amount;
    await user.save();

    await new Transaction({
      userId,
      type: 'karma_earned',
      amount,
      source,
      description
    }).save();

    return user.karma;
  } catch (error) {
    console.error('Award karma error:', error);
  }
}

// Check and award badges
async function checkBadges(userId, action, metadata = {}) {
  try {
    const user = await User.findById(userId);
    const badges = await Badge.find({ isActive: true });
    const earnedBadges = [];

    for (const badge of badges) {
      // Check if user already has this badge
      const hasBadge = user.badges.some(b => b.name === badge.name);
      if (hasBadge) continue;

      let shouldAward = false;

      switch (badge.requirements.action) {
        case 'posts_created':
          if (action === 'post_created') {
            const postCount = await Post.countDocuments({ author: user.username });
            shouldAward = postCount >= badge.requirements.target;
          }
          break;
        case 'trades_completed':
          if (action === 'trade_completed') {
            shouldAward = user.tradeStats.completed >= badge.requirements.target;
          }
          break;
        case 'hearts_received':
          shouldAward = user.heartsReceived >= badge.requirements.target;
          break;
        case 'karma_earned':
          shouldAward = user.karma >= badge.requirements.target;
          break;
        case 'level_reached':
          shouldAward = user.level >= badge.requirements.target;
          break;
        case 'streak_achieved':
          if (action === 'streak_updated') {
            shouldAward = user.streak.current >= badge.requirements.target;
          }
          break;
      }

      if (shouldAward) {
        user.badges.push({
          name: badge.name,
          icon: badge.icon,
          description: badge.description,
          category: badge.category,
          earnedAt: new Date()
        });

        // Award badge rewards
        if (badge.rewards.hearts > 0) {
          user.hearts += badge.rewards.hearts;
          await new Transaction({
            userId,
            type: 'hearts_earned',
            amount: badge.rewards.hearts,
            source: 'badge_earned',
            description: `Badge reward: ${badge.name}`,
            metadata: { badgeName: badge.name }
          }).save();
        }

        if (badge.rewards.karma > 0) {
          user.karma += badge.rewards.karma;
        }

        if (badge.rewards.experience > 0) {
          await awardExperience(userId, badge.rewards.experience, 'badge_earned', `Badge: ${badge.name}`);
        }

        await new Transaction({
          userId,
          type: 'badge_earned',
          amount: 1,
          source: 'achievement',
          description: badge.description,
          metadata: { badgeName: badge.name, category: badge.category }
        }).save();

        earnedBadges.push(badge);
      }
    }

    await user.save();
    return earnedBadges;
  } catch (error) {
    console.error('Check badges error:', error);
    return [];
  }
}

// Get user's reward dashboard
app.get('/api/rewards/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const recentTransactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate progress to next level
    const currentLevelExp = (user.level - 1) * 100;
    const nextLevelExp = user.level * 100;
    const progressToNext = ((user.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

    // Get leaderboard position
    const usersAbove = await User.countDocuments({ karma: { $gt: user.karma } });
    const leaderboardPosition = usersAbove + 1;

    res.json({
      user: {
        hearts: user.hearts,
        karma: user.karma,
        level: user.level,
        experience: user.experience,
        badges: user.badges,
        streak: user.streak,
        tradeStats: user.tradeStats,
        progressToNext: Math.min(progressToNext, 100),
        leaderboardPosition
      },
      recentTransactions
    });
  } catch (error) {
    console.error('Get rewards dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch rewards dashboard' });
  }
});

// Get leaderboard
app.get('/api/rewards/leaderboard', async (req, res) => {
  try {
    const { type = 'karma', limit = 10 } = req.query;
    
    let sortField = {};
    if (type === 'karma') sortField = { karma: -1 };
    else if (type === 'level') sortField = { level: -1, experience: -1 };
    else if (type === 'hearts') sortField = { hearts: -1 };
    else if (type === 'trades') sortField = { 'tradeStats.completed': -1 };
    
    const users = await User.find({})
      .select('username avatar karma level hearts tradeStats badges')
      .sort(sortField)
      .limit(parseInt(limit));

    res.json({ users, type });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Create marketplace listing
app.post('/api/marketplace/listings', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, offering, seeking, tags, expiresAt } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const listing = new MarketplaceListing({
      userId: req.user.id,
      title: title.trim(),
      description: description?.trim(),
      category,
      offering: offering || {},
      seeking: seeking || {},
      tags: tags || [],
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
    });

    await listing.save();
    await awardExperience(req.user.id, 5, 'listing_created', 'Created marketplace listing');

    res.status(201).json(listing);
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Get marketplace listings
app.get('/api/marketplace/listings', async (req, res) => {
  try {
    const { category, search, limit = 20, page = 1 } = req.query;
    
    let filter = { status: 'active', expiresAt: { $gt: new Date() } };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') }
      ];
    }

    const listings = await MarketplaceListing.find(filter)
      .populate('userId', 'username avatar tradeStats karma level')
      .populate('offering.posts', 'title emotion rarity')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await MarketplaceListing.countDocuments(filter);

    res.json({ listings, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Express interest in a listing
app.post('/api/marketplace/listings/:id/interest', authMiddleware, async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.userId.toString() === req.user.id) {
      return res.status(400).json({ error: 'Cannot express interest in your own listing' });
    }

    if (!listing.interests.includes(req.user.id)) {
      listing.interests.push(req.user.id);
      await listing.save();
    }

    res.json({ message: 'Interest expressed successfully' });
  } catch (error) {
    console.error('Express interest error:', error);
    res.status(500).json({ error: 'Failed to express interest' });
  }
});

// Create enhanced trade offer
app.post('/api/trades/enhanced', authMiddleware, async (req, res) => {
  try {
    const { toUserId, offer, request, message, useEscrow } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: 'Recipient user ID is required' });
    }

    if (toUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot trade with yourself' });
    }

    // Validate user has the resources they're offering
    const user = await User.findById(req.user.id);
    if (offer.hearts && user.hearts < offer.hearts) {
      return res.status(400).json({ error: 'Insufficient hearts to offer' });
    }

    const trade = new EnhancedTrade({
      fromUserId: req.user.id,
      toUserId,
      offer: offer || {},
      request: request || {},
      message,
      escrow: {
        isActive: useEscrow || false
      }
    });

    await trade.save();
    await awardExperience(req.user.id, 2, 'trade_initiated', 'Initiated a trade offer');

    res.status(201).json(trade);
  } catch (error) {
    console.error('Create enhanced trade error:', error);
    res.status(500).json({ error: 'Failed to create trade offer' });
  }
});

// Get enhanced trades
app.get('/api/trades/enhanced', authMiddleware, async (req, res) => {
  try {
    const { type = 'all' } = req.query; // 'incoming', 'outgoing', 'all'
    
    let filter = {};
    if (type === 'incoming') filter.toUserId = req.user.id;
    else if (type === 'outgoing') filter.fromUserId = req.user.id;
    else filter.$or = [{ fromUserId: req.user.id }, { toUserId: req.user.id }];

    const trades = await EnhancedTrade.find(filter)
      .populate('fromUserId', 'username avatar tradeStats level')
      .populate('toUserId', 'username avatar tradeStats level')
      .populate('offer.posts', 'title emotion rarity author')
      .populate('request.posts', 'title emotion rarity author')
      .sort({ createdAt: -1 });

    res.json({ trades });
  } catch (error) {
    console.error('Get enhanced trades error:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Accept/reject enhanced trade
app.patch('/api/trades/enhanced/:id', authMiddleware, async (req, res) => {
  try {
    const { action, rating, comment } = req.body; // 'accept', 'reject', 'complete', 'rate'
    
    const trade = await EnhancedTrade.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.toUserId.toString() !== req.user.id && trade.fromUserId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this trade' });
    }

    if (action === 'accept' && trade.toUserId.toString() === req.user.id) {
      // Execute the trade
      const fromUser = await User.findById(trade.fromUserId);
      const toUser = await User.findById(trade.toUserId);

      // Transfer hearts
      if (trade.offer.hearts > 0) {
        fromUser.hearts -= trade.offer.hearts;
        toUser.hearts += trade.offer.hearts;
      }
      if (trade.request.hearts > 0) {
        toUser.hearts -= trade.request.hearts;
        fromUser.hearts += trade.request.hearts;
      }

      // Update trade stats
      fromUser.tradeStats.completed += 1;
      toUser.tradeStats.completed += 1;

      await fromUser.save();
      await toUser.save();

      trade.status = 'completed';
      trade.completedAt = new Date();

      // Award experience for successful trade
      await awardExperience(trade.fromUserId, 10, 'trade_completed', 'Completed trade successfully');
      await awardExperience(trade.toUserId, 10, 'trade_completed', 'Completed trade successfully');

      // Check for trade-related badges
      await checkBadges(trade.fromUserId, 'trade_completed');
      await checkBadges(trade.toUserId, 'trade_completed');

    } else if (action === 'reject' && trade.toUserId.toString() === req.user.id) {
      trade.status = 'rejected';
    } else if (action === 'rate') {
      const isFromUser = trade.fromUserId.toString() === req.user.id;
      
      if (isFromUser) {
        trade.ratings.fromUserRating = rating;
        trade.ratings.fromUserComment = comment;
      } else {
        trade.ratings.toUserRating = rating;
        trade.ratings.toUserComment = comment;
      }

      // Update user's trade rating
      const otherUserId = isFromUser ? trade.toUserId : trade.fromUserId;
      const otherUser = await User.findById(otherUserId);
      
      const totalRating = otherUser.tradeStats.rating * otherUser.tradeStats.totalRatings + rating;
      otherUser.tradeStats.totalRatings += 1;
      otherUser.tradeStats.rating = totalRating / otherUser.tradeStats.totalRatings;
      
      await otherUser.save();
    }

    trade.updatedAt = new Date();
    await trade.save();

    res.json({ trade, message: 'Trade updated successfully' });
  } catch (error) {
    console.error('Update enhanced trade error:', error);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// Initialize default badges (no auth required for initial setup)
app.post('/api/admin/init-badges', async (req, res) => {
  try {
    // Check if badges already exist
    const existingBadges = await Badge.countDocuments();
    if (existingBadges > 0) {
      return res.json({ message: 'Badges already initialized' });
    }

    const defaultBadges = [
      // Posting badges
      { name: 'First Steps', icon: '👶', description: 'Created your first post', category: 'posting', requirements: { type: 'count', target: 1, action: 'posts_created' }, rarity: 'common', rewards: { hearts: 5, karma: 10, experience: 20 } },
      { name: 'Prolific Writer', icon: '✍️', description: 'Created 10 posts', category: 'posting', requirements: { type: 'count', target: 10, action: 'posts_created' }, rarity: 'rare', rewards: { hearts: 15, karma: 30, experience: 50 } },
      { name: 'Master Storyteller', icon: '📖', description: 'Created 50 posts', category: 'posting', requirements: { type: 'count', target: 50, action: 'posts_created' }, rarity: 'epic', rewards: { hearts: 50, karma: 100, experience: 200 } },
      
      // Trading badges
      { name: 'First Trade', icon: '🤝', description: 'Completed your first trade', category: 'trading', requirements: { type: 'count', target: 1, action: 'trades_completed' }, rarity: 'common', rewards: { hearts: 10, karma: 15, experience: 25 } },
      { name: 'Merchant', icon: '💼', description: 'Completed 10 trades', category: 'trading', requirements: { type: 'count', target: 10, action: 'trades_completed' }, rarity: 'rare', rewards: { hearts: 25, karma: 50, experience: 100 } },
      { name: 'Trade Master', icon: '👑', description: 'Completed 25 trades', category: 'trading', requirements: { type: 'count', target: 25, action: 'trades_completed' }, rarity: 'epic', rewards: { hearts: 75, karma: 150, experience: 300 } },
      
      // Support badges
      { name: 'Supportive Soul', icon: '💝', description: 'Received 100 hearts from others', category: 'support', requirements: { type: 'count', target: 100, action: 'hearts_received' }, rarity: 'rare', rewards: { hearts: 20, karma: 40, experience: 75 } },
      { name: 'Beloved Helper', icon: '🌟', description: 'Received 500 hearts from others', category: 'support', requirements: { type: 'count', target: 500, action: 'hearts_received' }, rarity: 'epic', rewards: { hearts: 100, karma: 200, experience: 400 } },
      
      // Level badges
      { name: 'Rising Star', icon: '⭐', description: 'Reached level 5', category: 'special', requirements: { type: 'level', target: 5, action: 'level_reached' }, rarity: 'common', rewards: { hearts: 15, karma: 25, experience: 50 } },
      { name: 'Experienced Member', icon: '🎖️', description: 'Reached level 10', category: 'special', requirements: { type: 'level', target: 10, action: 'level_reached' }, rarity: 'rare', rewards: { hearts: 30, karma: 75, experience: 150 } },
      { name: 'Community Legend', icon: '🏆', description: 'Reached level 20', category: 'special', requirements: { type: 'level', target: 20, action: 'level_reached' }, rarity: 'legendary', rewards: { hearts: 100, karma: 300, experience: 500 } }
    ];

    await Badge.insertMany(defaultBadges);
    res.json({ message: 'Default badges initialized successfully', count: defaultBadges.length });
  } catch (error) {
    console.error('Initialize badges error:', error);
    res.status(500).json({ error: 'Failed to initialize badges' });
  }
});

// --------------------
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Backend running at http://${HOST}:${PORT}`);
});
server.on('error', (err) => console.error('Server error:', err));

// Connect to MongoDB in background; log errors but keep server running so frontend can load
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, family: 4 })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error (will keep retrying):', err.message || err));
