const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aniverse_secret_2024';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:LTXKFwQdJlBKatbluwqKziRVJuOWQOEh@yamanote.proxy.rlwy.net:26057/aniverse';

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== MONGODB CONNECT =====
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ===== SCHEMAS =====
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:    { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['member','admin'], default: 'member' },
}, { timestamps: true });

const episodeSchema = new mongoose.Schema({
  name:         { type: String, default: '' },
  description:  { type: String, default: '' },
  videoUrl:     { type: String, default: '' },
  downloadLink: { type: String, default: '' },
});

const seasonSchema = new mongoose.Schema({
  name:     { type: String, default: 'Season 1' },
  episodes: [episodeSchema],
});

const replySchema = new mongoose.Schema({
  userId:   mongoose.Schema.Types.ObjectId,
  username: String,
  userRole: { type: String, default: 'member' },
  text:     String,
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  animeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Anime', required: true },
  userId:   mongoose.Schema.Types.ObjectId,
  username: String,
  userRole: { type: String, default: 'member' },
  text:     { type: String, required: true },
  rating:   { type: Number, min: 0, max: 5, default: 0 },
  replies:  [replySchema],
}, { timestamps: true });

const animeSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  category:     { type: String, default: 'Action' },
  type:         { type: String, enum: ['Series','Movie'], default: 'Series' },
  description:  { type: String, default: '' },
  cover:        { type: String, default: '' },
  banner:       { type: String, default: '' },
  uploaderName: { type: String, default: 'AniVerse' },
  seasons:      [seasonSchema],
  avgRating:    { type: Number, default: 0 },
  ratingCount:  { type: Number, default: 0 },
}, { timestamps: true });

const requestSchema = new mongoose.Schema({
  userId:    mongoose.Schema.Types.ObjectId,
  username:  String,
  animeName: { type: String, required: true },
  info:      { type: String, default: '' },
}, { timestamps: true });

const User    = mongoose.model('User', userSchema);
const Anime   = mongoose.model('Anime', animeSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Request = mongoose.model('Request', requestSchema);

// ===== AUTH MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ success: false, message: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.json({ success: false, message: 'Invalid token' }); }
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ success: false, message: 'No token' });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== 'admin') return res.json({ success: false, message: 'Admin only' });
    req.user = user;
    next();
  } catch { res.json({ success: false, message: 'Invalid token' }); }
}

function softAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

// ===========================
// ===== AUTH ROUTES =====
// ===========================

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    if (!username || !email || !phone || !password)
      return res.json({ success: false, message: 'All fields required' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      if (exists.email === email.toLowerCase())
        return res.json({ success: false, message: 'Email already registered' });
      return res.json({ success: false, message: 'Username already taken' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, phone, password: hashed });
    await user.save();
    res.json({ success: true, message: 'Account created!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.json({ success: false, message: 'Email not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: 'Wrong password' });

    const token = jwt.sign(
      { _id: user._id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({
      success: true,
      user: { _id: user._id, username: user.username, email: user.email, role: user.role, token }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ADMIN LOGIN
app.post('/api/admin/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier?.toLowerCase() }, { phone: identifier }]
    });
    if (!user || user.role !== 'admin')
      return res.json({ success: false, message: 'Admin not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: 'Wrong password' });

    const token = jwt.sign(
      { _id: user._id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ success: true, user: { _id: user._id, username: user.username, email: user.email, role: user.role, token } });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===========================
// ===== ANIME ROUTES =====
// ===========================

// GET ALL
app.get('/api/anime', async (req, res) => {
  try {
    const anime = await Anime.find().sort({ createdAt: -1 });
    res.json({ success: true, anime });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// GET ONE
app.get('/api/anime/:id', async (req, res) => {
  try {
    const anime = await Anime.findById(req.params.id);
    if (!anime) return res.json({ success: false, message: 'Not found' });
    res.json({ success: true, anime });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// CREATE (admin)
app.post('/api/anime', adminMiddleware, async (req, res) => {
  try {
    const { name, category, type, description, cover, banner, uploaderName, seasons } = req.body;
    if (!name) return res.json({ success: false, message: 'Name required' });
    const anime = new Anime({ name, category, type, description, cover, banner, uploaderName, seasons: seasons||[] });
    await anime.save();
    res.json({ success: true, anime });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// DELETE (admin)
app.delete('/api/anime/:id', adminMiddleware, async (req, res) => {
  try {
    await Anime.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ animeId: req.params.id });
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// ===========================
// ===== COMMENT ROUTES =====
// ===========================

// GET comments for anime
app.get('/api/comments/:animeId', async (req, res) => {
  try {
    const comments = await Comment.find({ animeId: req.params.animeId }).sort({ createdAt: -1 });
    res.json({ success: true, comments });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// POST comment
app.post('/api/comments', authMiddleware, async (req, res) => {
  try {
    const { animeId, text, rating } = req.body;
    if (!text) return res.json({ success: false, message: 'Text required' });

    const comment = new Comment({
      animeId, text, rating: rating||0,
      userId: req.user._id,
      username: req.user.username,
      userRole: req.user.role
    });
    await comment.save();

    // Update anime avg rating
    if (rating && rating > 0) {
      const anime = await Anime.findById(animeId);
      if (anime) {
        const newCount = anime.ratingCount + 1;
        const newAvg = ((anime.avgRating * anime.ratingCount) + rating) / newCount;
        await Anime.findByIdAndUpdate(animeId, { avgRating: newAvg, ratingCount: newCount });
      }
    }

    res.json({ success: true, comment });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// POST reply
app.post('/api/comments/:id/reply', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.json({ success: false, message: 'Comment not found' });

    comment.replies.push({
      userId: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      text
    });
    await comment.save();
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// DELETE comment (admin or owner)
app.delete('/api/comments/:id', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.json({ success: false, message: 'Not found' });
    if (req.user.role !== 'admin' && comment.userId.toString() !== req.user._id.toString())
      return res.json({ success: false, message: 'Unauthorized' });
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// GET all comments (admin)
app.get('/api/admin/comments', adminMiddleware, async (req, res) => {
  try {
    const comments = await Comment.find().sort({ createdAt: -1 }).limit(200);
    // Attach anime names
    const animeIds = [...new Set(comments.map(c => c.animeId.toString()))];
    const animes = await Anime.find({ _id: { $in: animeIds } }).select('name');
    const animeMap = {};
    animes.forEach(a => animeMap[a._id.toString()] = a.name);
    const result = comments.map(c => ({ ...c.toObject(), animeName: animeMap[c.animeId?.toString()] || 'Unknown' }));
    res.json({ success: true, comments: result });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// ===========================
// ===== USER ROUTES (admin) =====
// ===========================
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

app.put('/api/admin/users/:id/role', adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    await User.findByIdAndUpdate(req.params.id, { role });
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// ===========================
// ===== REQUEST ROUTES =====
// ===========================
app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { animeName, info } = req.body;
    if (!animeName) return res.json({ success: false, message: 'Anime name required' });
    const request = new Request({
      animeName, info,
      userId: req.user._id,
      username: req.user.username
    });
    await request.save();
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

app.get('/api/requests', adminMiddleware, async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

app.delete('/api/requests/:id', adminMiddleware, async (req, res) => {
  try {
    await Request.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// ===========================
// ===== SERVE HTML FILES =====
// ===========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 AniVerse server running on http://localhost:${PORT}`);
});

module.exports = app;
