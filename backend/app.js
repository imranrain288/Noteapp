import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import { requireDatabase } from './database.js';
import { sendPasswordResetLink } from './mailer.js';
import Note from './models/note.model.js';
import User from './models/user.model.js';
import { authenticationToken } from './utilities.js';
import {
  normalizeEmail,
  normalizeName,
  sendValidationError,
  validateEmail,
  validateFields,
  validateName,
  validatePassword,
} from './validation.js';

// Read backend/.env next to this file rather than the current working directory,
// so the app boots the same way from backend/ (npm start) and from the
// repository root (the Vercel function). On Vercel there is no file and the
// variables come from the project settings.
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const app = express();
// The API routes live on their own router because they are mounted twice: at the
// root (the Vercel function strips /api before handing the request over) and
// under /api (a single service that also serves the built frontend).
const api = express.Router();
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(null, false);
};

app.use(express.json());
app.use(cors({ origin: corsOrigin }));

if (!process.env.ACCESS_TOKEN_SECRET) {
  throw new Error('Missing ACCESS_TOKEN_SECRET in the backend environment.');
}

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

const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

// Only a digest of the reset token is persisted, so a database leak cannot be
// replayed against the reset endpoint.
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const findUserByResetToken = (token) => {
  if (typeof token !== 'string' || !RESET_TOKEN_PATTERN.test(token)) return Promise.resolve(null);
  return User.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  });
};

// The reset link has to point at the deployed frontend, not at the API. An
// explicit RESET_PASSWORD_URL wins, then the caller's allow-listed origin, then
// the first FRONTEND_URL entry (local development).
const resetPasswordBaseUrl = (req) => {
  const origin = req.get('origin');
  const configured = process.env.RESET_PASSWORD_URL
    || (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) ? origin : '')
    || (process.env.FRONTEND_URL || '').split(',')[0]
    || 'http://localhost:5173';
  return configured.trim().replace(/\/+$/, '');
};

// When the mail cannot be delivered the link is handed back in the response so
// the flow stays usable in development; production only ever emails it.
const exposesResetLink = process.env.NODE_ENV !== 'production';

api.get('/', (req, res) => {
  res.json("Hello World! This is a note taking app's server.");
});

// Everything below needs the database, so it is connected once and awaited
// before the route runs. The banner above stays reachable during a cold start.
api.use(requireDatabase);

api.post('/create-user', asyncHandler(async (req, res) => {
  const firstName = normalizeName(req.body.firstName);
  const lastName = normalizeName(req.body.lastName);
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const fields = validateFields({
    firstName: validateName(firstName, 'First name'),
    lastName: validateName(lastName, 'Last name'),
    email: validateEmail(email),
    password: validatePassword(password),
  });
  if (Object.keys(fields).length) {
    return sendValidationError(res, fields);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendValidationError(res, { email: 'An account with this email already exists.' });
  }

  const user = new User({ firstName, lastName, email, password });
  try {
    await user.save();
  } catch (error) {
    // Two simultaneous signups can both pass the lookup above; the unique index
    // is the real guard, so translate it into a field error.
    if (error?.code === 11000) {
      return sendValidationError(res, { email: 'An account with this email already exists.' });
    }
    throw error;
  }

  return res.json({
    error: false,
    user: publicUser(user),
    accessToken: createAccessToken(user),
    message: 'User created successfully.',
  });
}));

api.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const fields = validateFields({
    email: validateEmail(email),
    password: password ? null : 'Please enter your password.',
  });
  if (Object.keys(fields).length) {
    return sendValidationError(res, fields);
  }

  const user = await User.findOne({ email });
  const invalidCredentials = { error: true, message: 'Incorrect email or password.' };
  if (!user) {
    return res.status(400).json(invalidCredentials);
  }

  if (!(await user.verifyPassword(password))) {
    return res.status(400).json(invalidCredentials);
  }

  // Seamless upgrade for accounts created while passwords were stored verbatim.
  if (user.hasLegacyPassword()) {
    user.password = await User.hashPassword(password);
    await user.save();
  }

  return res.json({
    error: false,
    user: publicUser(user),
    accessToken: createAccessToken(user),
    message: 'User logged in successfully.',
  });
}));

api.post('/check-email', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const emailError = validateEmail(email);
  if (emailError) {
    return sendValidationError(res, { email: emailError });
  }

  const existingUser = await User.exists({ email });
  return res.json({
    error: false,
    available: !existingUser,
    message: existingUser ? 'An account with this email already exists.' : 'This email is available.',
  });
}));

api.post('/forgot-password', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const emailError = validateEmail(email);
  if (emailError) {
    return sendValidationError(res, { email: emailError });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({
      error: false,
      message: `If an account exists for that email, a reset link is on its way. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await user.save();

  const resetUrl = `${resetPasswordBaseUrl(req)}/reset-password/${token}`;
  let delivered = false;
  try {
    ({ delivered } = await sendPasswordResetLink({
      to: email,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    }));
  } catch (error) {
    console.error('[forgot-password] Mail delivery failed:', error.message);
  }

  const response = {
    error: false,
    // Same answer whether or not the account exists, so this endpoint cannot be
    // used to find out which emails are registered.
    message: delivered
      ? `If an account exists for that email, a reset link is on its way. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`
      : `If an account exists for that email, a reset link has been created. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
  };

  if (!delivered) {
    console.warn(`[forgot-password] The reset link for ${email} was not emailed.`);
    // Development escape hatch: without working SMTP the link is unusable otherwise.
    if (exposesResetLink) response.resetUrl = resetUrl;
  }

  return res.json(response);
}));

api.get('/verify-reset-token/:token', asyncHandler(async (req, res) => {
  const user = await findUserByResetToken(req.params.token);
  if (!user) {
    return res.status(400).json({ error: true, message: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  return res.json({ error: false, message: 'Reset link is valid.' });
}));

api.post('/reset-password', asyncHandler(async (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const passwordError = validatePassword(password);
  if (passwordError) {
    return sendValidationError(res, { password: passwordError });
  }

  const user = await findUserByResetToken(req.body.token);
  if (!user) {
    return res.status(400).json({ error: true, message: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  user.password = password;
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  return res.json({ error: false, message: 'Your password has been updated. You can sign in now.' });
}));

api.post('/create-note', authenticationToken, asyncHandler(async (req, res) => {
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

api.post('/edit-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
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

api.get('/get-notes', authenticationToken, asyncHandler(async (req, res) => {
  const filter = { userId: req.user.user._id, isTrashed: { $ne: true } };
  if (req.query.view === 'pinned') filter.isPinned = true;

  const notes = await Note.find(filter).sort({ isPinned: -1, createdAt: -1 });
  return res.json({ error: false, notes, message: 'Notes retrieved successfully.' });
}));

api.get('/get-trash', authenticationToken, asyncHandler(async (req, res) => {
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

api.delete('/delete-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
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

api.put('/restore-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
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

api.delete('/permanent-delete-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
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

api.put('/pin-note/:noteId', authenticationToken, asyncHandler(async (req, res) => {
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

api.get('/search', authenticationToken, asyncHandler(searchNotes));
api.get('/search/:query', authenticationToken, asyncHandler(searchNotes));

api.get('/user', authenticationToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.user._id);
  if (!user) {
    return res.status(404).json({ error: true, message: 'User not found.' });
  }

  return res.json({ error: false, user: publicUser(user), message: 'User retrieved successfully.' });
}));

// When a frontend build sits next to this package the same process also serves
// it, with a fallback to index.html for client-side routes. On Vercel the build
// is served from the CDN and the function only ever receives /api requests, so
// this is limited to a standalone process.
const distDir = fileURLToPath(new URL('../frontend/dist', import.meta.url));
const spaIndex = join(distDir, 'index.html');
const servesSpa = !process.env.VERCEL && existsSync(spaIndex);

app.use('/api', api);
// The root mount is what the Vercel function needs, because it strips /api
// before handing the request over. It is skipped when this process owns "/",
// otherwise the API banner would shadow the app shell.
if (!servesSpa) {
  app.use('/', api);
}

if (servesSpa) {
  app.use(express.static(distDir));
  // Anything that is not an API path and not a real file gets the app shell.
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => res.sendFile(spaIndex));
}

// An unmatched path answers with JSON instead of Express's HTML page, which
// makes a mistyped route obvious from the client.
app.use((req, res) => {
  res.status(404).json({ error: true, message: `No route for ${req.method} ${req.originalUrl}.` });
});

app.use((error, req, res, next) => {
  console.error(`Request failed: ${req.method} ${req.path}`, error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: true, message: 'An unexpected server error occurred.' });
});

export default app;
