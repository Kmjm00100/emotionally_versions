// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import { analyzeEmotion, quickEmotionCheck } from './emotionAI.js';

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow for now, can be configured later
  crossOriginEmbedderPolicy: false
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
  circles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Circle' }]
});


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

// Create post (supports multipart images + verification proofs)
app.post("/api/posts", authMiddleware, (req, res, next) => {
  const fields = upload.fields([ { name:'images', maxCount:6 }, { name:'proofs', maxCount:6 } ]);
  fields(req, res, function(err){
    if(err) return next(err);
    next();
  });
}, async (req, res) => {
  try {
    const body = req.body || {};
    const images = ((req.files && req.files.images) ? req.files.images : []).map(f => {
      const p = `/uploads/${f.filename}`;
      return p.startsWith('/') ? p : '/' + p;
    });
    const proofs = ((req.files && req.files.proofs) ? req.files.proofs : []).map(f => {
      const p = `/uploads/${f.filename}`;
      return p.startsWith('/') ? p : '/' + p;
    });
    
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
import multer from 'multer';
import fs from 'fs';
// compute __dirname reliably in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');
// ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));
// configure multer with basic file type and size checks
const storage = multer.diskStorage({
  destination: function(req, file, cb){ cb(null, UPLOADS_DIR) },
  filename: function(req, file, cb){ const ext = path.extname(file.originalname); cb(null, Date.now() + ext) }
});
const fileFilter = (req, file, cb) => {
  // accept based on mimetype for stronger validation
  const allowed = ['image/jpeg','image/png','image/gif','image/jpg','image/webp'];
  if(allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// middleware to handle multer errors cleanly
function multerErrorHandler(err, req, res, next){
  if(err instanceof multer.MulterError){
    // handle Multer-specific errors
    return res.status(400).json({ error: err.message });
  }
  if(err){
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
    if(!req.file) return res.status(400).json({ error: 'No file' });
    const user = await User.findById(req.user.id);
  user.avatar = `/uploads/${req.file.filename}`.startsWith('/') ? `/uploads/${req.file.filename}` : '/' + `/uploads/${req.file.filename}`;
    await user.save();
    res.json({ avatar: user.avatar });
  }catch(err){ console.error('Avatar upload error', err.message); res.status(500).json({ error: 'Server error' }) }
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

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Backend running at http://${HOST}:${PORT}`);
});
server.on('error', (err) => console.error('Server error:', err));

// Connect to MongoDB in background; log errors but keep server running so frontend can load
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, family: 4 })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error (will keep retrying):', err.message || err));
