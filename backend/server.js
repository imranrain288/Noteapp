import crypto from 'node:crypto';
import dns from 'node:dns';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { authenticationToken } from './utilities.js';
import User from './models/user.model.js';
import Note from './models/note.model.js';
import { sendPasswordResetLink } from './mailer.js';
import {
  normalizeEmail,
  normalizeName,
  sendValidationError,
  validateEmail,
  validateFields,
  validateName,
  validatePassword,
} from './validation.js';

dotenv.config();

const app = express();
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

const mongoUri = process.env.MONGO_URL || process.env.MONGODB;
if (!mongoUri) {
  throw new Error('Missing MongoDB URI. Set MONGO_URL or MONGODB in the backend environment.');
}

// Some networks refuse SRV queries from Node's own resolver (mobile hotspots,
// restrictive routers, and local DNS proxies such as a VPN client, which show up
// as 127.0.0.1), so "mongodb+srv://" fails with querySrv ECONNREFUSED while the
// operating system still resolves A records. DNS_SERVERS lists public resolvers
// to use instead; the list is rotated on retry because a single resolver can be
// blocked or rate limited even when the others answer.
const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

const DB_CONNECT_ATTEMPTS = 4;
const DB_RETRY_DELAY_MS = 3000;

const srvHost = /^mongodb\+srv:\/\//i.test(mongoUri) ? new URL(mongoUri).hostname : '';

const rotateResolvers = (servers, offset) => {
  const start = offset % servers.length;
  return [...servers.slice(start), ...servers.slice(0, start)];
};

// Probe each resolver once and move the first one that answers SRV to the front,
// so a refusing entry in the list does not cost a full connection timeout before
// the retry rotates past it.
const promoteWorkingResolver = async () => {
  if (!dnsServers.length || !srvHost) {
    return;
  }

  for (let index = 0; index < dnsServers.length; index += 1) {
    dns.setServers([dnsServers[index]]);
    try {
      await dns.promises.resolveSrv(`_mongodb._tcp.${srvHost}`);
      dnsServers.unshift(...dnsServers.splice(index, 1));
      return;
    } catch {
      // resolver refused the query, try the next one
    }
  }
};

if (!process.env.ACCESS_TOKEN_SECRET) {
  throw new Error('Missing ACCESS_TOKEN_SECRET in the backend environment.');
}

const connectToDatabase = async (attempt = 0) => {
  if (dnsServers.length) {
    dns.setServers(rotateResolvers(dnsServers, attempt));
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connection successful');
  } catch (error) {
    console.error(`MongoDB connection error (attempt ${attempt + 1}/${DB_CONNECT_ATTEMPTS}):`, error.message);
    if (attempt + 1 < DB_CONNECT_ATTEMPTS) {
      setTimeout(() => connectToDatabase(attempt + 1), DB_RETRY_DELAY_MS);
    }
  }
};

await promoteWorkingResolver();
connectToDatabase();

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

app.get('/', (req, res) => {
  res.json("Hello World! This is a note taking app's server.");
});

app.post('/create-user', asyncHandler(async (req, res) => {
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

app.post('/login', asyncHandler(async (req, res) => {
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

app.post('/check-email', asyncHandler(async (req, res) => {
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

app.post('/forgot-password', asyncHandler(async (req, res) => {
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

app.get('/verify-reset-token/:token', asyncHandler(async (req, res) => {
  const user = await findUserByResetToken(req.params.token);
  if (!user) {
    return res.status(400).json({ error: true, message: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  return res.json({ error: false, message: 'Reset link is valid.' });
}));

app.post('/reset-password', asyncHandler(async (req, res) => {
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
