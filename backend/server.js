import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { authenticationToken } from './utilities.js';
import User from './models/user.model.js';
import Note from './models/note.model.js';

dotenv.config();

const app = express();
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

const mongoUri = process.env.MONGO_URL || process.env.MONGODB;
if (!mongoUri) {
  throw new Error('Missing MongoDB URI. Set MONGO_URL or MONGODB in the backend environment.');
}

if (!process.env.ACCESS_TOKEN_SECRET) {
  throw new Error('Missing ACCESS_TOKEN_SECRET in the backend environment.');
}

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connection successful'))
  .catch((error) => console.error('MongoDB connection error:', error));

const createAccessToken = (user) => jwt.sign(
  { user: { _id: user._id } },
  process.env.ACCESS_TOKEN_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' },
);

const publicUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  createdAt: user.createdAt,
});

app.get('/', (req, res) => {
  res.json("Hello World! This is a note taking app's server.");
});

app.post('/create-user', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: true, message: 'Please fill in all fields.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(400).json({ error: true, message: 'User already exists.' });
  }

  const user = new User({ firstName, lastName, email: normalizedEmail, password });
  await user.save();

  return res.json({
    error: false,
    user: publicUser(user),
    accessToken: createAccessToken(user),
    message: 'User created successfully.',
  });
}));

app.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'Please fill in all fields.' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    return res.status(400).json({ error: true, message: 'User does not exist.' });
  }

  if (user.password !== password) {
    return res.status(400).json({ error: true, message: 'Invalid credentials.' });
  }

  return res.json({
    error: false,
    user: publicUser(user),
    accessToken: createAccessToken(user),
    message: 'User logged in successfully.',
  });
}));

app.post('/create-note', authenticationToken, asyncHandler(async (req, res) => {
  const { title, content, tags = [], label = '', labelColor = '#F9FBFC', reminderAt = null } = req.body;
  const userId = req.user.user._id;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: true, message: 'Please fill in all required fields.' });
  }
  if (typeof label !== 'string' || label.length > 40) {
    return res.status(400).json({ error: true, message: 'Labels must be 40 characters or fewer.' });
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(labelColor)) {
    return res.status(400).json({ error: true, message: 'Please choose a valid note color.' });
  }
  if (reminderAt !== null && (typeof reminderAt !== 'string' || Number.isNaN(Date.parse(reminderAt)))) {
    return res.status(400).json({ error: true, message: 'Please provide a valid reminder date and time.' });
  }

  const note = await Note.create({
    title: title.trim(),
    content,
    tags: Array.isArray(tags) ? tags : [],
    label: label.trim(),
    labelColor,
    reminderAt: reminderAt ? new Date(reminderAt) : null,
    userId,
  });

  return res.json({ error: false, note, message: 'Note created successfully.' });
}));

app.post('/edit-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
  const { title, content, tags, isPinned, label, labelColor, reminderAt } = req.body;
  const updates = {};

  if (typeof title === 'string') updates.title = title.trim();
  if (typeof content === 'string') updates.content = content;
  if (Array.isArray(tags)) updates.tags = tags;
  if (typeof isPinned === 'boolean') updates.isPinned = isPinned;
  if (typeof label === 'string' && label.length <= 40) updates.label = label.trim();
  else if (label !== undefined) {
    return res.status(400).json({ error: true, message: 'Labels must be 40 characters or fewer.' });
  }
  if (typeof labelColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(labelColor)) updates.labelColor = labelColor;
  else if (labelColor !== undefined) {
    return res.status(400).json({ error: true, message: 'Please choose a valid note color.' });
  }
  if (reminderAt === null) updates.reminderAt = null;
  else if (typeof reminderAt === 'string' && !Number.isNaN(Date.parse(reminderAt))) {
    updates.reminderAt = new Date(reminderAt);
  } else if (reminderAt !== undefined) {
    return res.status(400).json({ error: true, message: 'Please provide a valid reminder date and time.' });
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: true, message: 'No changes made.' });
  }

  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, userId: req.user.user._id, isTrashed: { $ne: true } },
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!note) {
    return res.status(404).json({ error: true, message: 'Note not found.' });
  }

  return res.json({ error: false, note, message: 'Note updated successfully.' });
}));

app.get('/get-notes', authenticationToken, asyncHandler(async (req, res) => {
  const filter = { userId: req.user.user._id, isTrashed: { $ne: true } };
  if (req.query.view === 'pinned') filter.isPinned = true;

  const notes = await Note.find(filter).sort({ isPinned: -1, createdAt: -1 });
  return res.json({ error: false, notes, message: 'Notes retrieved successfully.' });
}));

app.get('/get-trash', authenticationToken, asyncHandler(async (req, res) => {
  const filter = {
    userId: req.user.user._id,
    isTrashed: true,
  };
  if (req.query.q) {
    const escapedQuery = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escapedQuery, $options: 'i' } },
      { content: { $regex: escapedQuery, $options: 'i' } },
      { tags: { $regex: escapedQuery, $options: 'i' } },
      { label: { $regex: escapedQuery, $options: 'i' } },
    ];
  }
  const notes = await Note.find(filter).sort({ trashedAt: -1, createdAt: -1 });
  return res.json({ error: false, notes, message: 'Trash retrieved successfully.' });
}));

app.delete('/delete-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, userId: req.user.user._id, isTrashed: { $ne: true } },
    { $set: { isTrashed: true, trashedAt: new Date() } },
    { new: true },
  );
  if (!note) {
    return res.status(404).json({ error: true, message: 'Note not found.' });
  }

  return res.json({ error: false, message: 'Note moved to trash.' });
}));

app.put('/restore-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, userId: req.user.user._id, isTrashed: true },
    { $set: { isTrashed: false }, $unset: { trashedAt: 1 } },
    { new: true },
  );
  if (!note) {
    return res.status(404).json({ error: true, message: 'Trashed note not found.' });
  }

  return res.json({ error: false, note, message: 'Note restored.' });
}));

app.delete('/permanent-delete-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({
    _id: req.params.noteId,
    userId: req.user.user._id,
    isTrashed: true,
  });
  if (!note) {
    return res.status(404).json({ error: true, message: 'Trashed note not found.' });
  }

  return res.json({ error: false, message: 'Note permanently deleted.' });
}));

app.put('/pin-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.noteId,
    userId: req.user.user._id,
    isTrashed: { $ne: true },
  });
  if (!note) {
    return res.status(404).json({ error: true, message: 'Note not found.' });
  }

  note.isPinned = !note.isPinned;
  await note.save();
  return res.json({ error: false, note, message: note.isPinned ? 'Note pinned.' : 'Note unpinned.' });
}));

const searchNotes = async (req, res) => {
  const query = String(req.params.query || req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: true, message: 'Please enter a search query.' });
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const notes = await Note.find({
    userId: req.user.user._id,
    isTrashed: { $ne: true },
    $or: [
      { title: { $regex: escapedQuery, $options: 'i' } },
      { content: { $regex: escapedQuery, $options: 'i' } },
      { tags: { $regex: escapedQuery, $options: 'i' } },
      { label: { $regex: escapedQuery, $options: 'i' } },
    ],
  }).sort({ isPinned: -1, createdAt: -1 });

  return res.json({ error: false, notes, message: 'Notes retrieved successfully.' });
};

app.get('/search', authenticationToken, asyncHandler(searchNotes));
app.get('/search/:query', authenticationToken, asyncHandler(searchNotes));

app.get('/user', authenticationToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.user._id);
  if (!user) {
    return res.status(404).json({ error: true, message: 'User not found.' });
  }

  return res.json({ error: false, user: publicUser(user), message: 'User retrieved successfully.' });
}));

app.use((error, req, res, next) => {
  console.error(`Request failed: ${req.method} ${req.path}`, error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: true, message: 'An unexpected server error occurred.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
