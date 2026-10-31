# Noteapp (Memo / NOTES)

A full-stack note-taking web app for capturing ideas with keywords, colored labels, pinning, search, trash, reminders, and social/email sharing. The frontend is React + Vite, the backend is Express + MongoDB (Mongoose), and the two talk over a REST JSON API authenticated with JWT bearer tokens.

## Features

**Notes**
- Create and edit notes with title (max 100 chars), free-text content, and keyword tags (add with Enter, remove individually).
- Custom text label (max 40 chars) plus a label color — 7 preset swatches, a native color picker, or the default neutral color.
- Pin / unpin a note; pinned notes sort first and have their own view with a live count.
- Notes are shown as a card grid with an "edited" date, label chip, tag chips, and a reminder chip.
- Full-screen note viewer (click a card; click the backdrop to close).

**Organization & search**
- Sidebar workspace sections: All notes, Pinned, Trash.
- Sidebar Labels list, auto-built from the current notes and color-coded; clicking one filters the grid to that label.
- Debounced (250 ms) top-bar search across title, content, tags, and labels, run server-side with escaped regex so special characters don't break the query.
- Contextual empty states per view and per search.

**Trash**
- Delete moves a note to trash (soft delete with `trashedAt`); trash supports restore and permanent delete (with a confirm dialog).

**Reminders**
- Optional per-note date/time reminder. The client polls active notes every 15 s and on window focus, then fires a browser Notification (falls back to an in-app toast if permission is denied). Fired reminders are remembered per user in `localStorage` so alerts don't repeat. Saving a reminder prompts for notification permission.

**Sharing**
- Per-card share menu: native Web Share (when available), WhatsApp, X, Bluesky, Reddit, email, and copy-to-clipboard. Shared text includes the title, content, and keywords.

**Account & UI**
- Sign up at `/signup` (first name, last name, email, password, confirm) and sign in at `/login` with email and password; profile avatar with initials, name, and email in the top bar.
- Passwords are hashed with bcrypt (12 salt rounds) and never returned by the API. Accounts created before hashing are upgraded transparently on their next successful sign-in.
- Show/hide toggle on every password field, plus a live checklist (at least 8 characters, a letter, a number) that turns green as each rule is met.
- Sign-up checks whether the email is already taken while you type (debounced 450 ms, in-flight check aborted on the next keystroke).
- Forgot password at `/forgot-password` emails a one-time reset link; `/reset-password/:token` verifies the link before showing the form, then reports success or "link expired". Links last 30 minutes and stop working once used.
- Field-level validation with inline errors: strict email rules (max 254 chars, max 64 before the @, a local part of letters/digits joined by single `.` `_` `%` `+` `-` so it can never start or end with a symbol or repeat one, hyphen-safe domain labels, letters-only TLD of 2+ chars) and name rules (letters, spaces, apostrophes, periods and hyphens, ≤50 chars). Malformed addresses like `_-00--@gmail.com` or `000-@gmail.com` are rejected.
- Light/dark theme toggle, persisted in `localStorage` (`memo-theme`).
- Protected routes; a 401/403 from the API clears the token and returns you to sign-in.
- Toast notifications and inline field errors for every action.

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, Vite 6, React Router 7, Axios, Tailwind CSS 3 (+ ~1.2k lines of custom CSS in `App.css`), react-icons, react-modal |
| Backend | Node.js (ESM), Express 4, Mongoose 7, JSON Web Token (HS256), bcryptjs, CORS, dotenv, nodemailer (SMTP), nodemon (dev) |
| Data | MongoDB; collections `users` and `notes` |
| Hosting | `Procfile` (`web: npm start`) in both packages; frontend serves its build with `serve -s dist -l $PORT` |

## Project structure

```
Noteapp/
├── backend/
│   ├── server.js              # Express app, all REST routes, CORS, JWT issuing, error handler
│   ├── utilities.js           # authenticationToken middleware (Bearer JWT verify)
│   ├── validation.js          # shared name/email/password rules + validation error responses
│   ├── mailer.js              # nodemailer SMTP sender for password reset links
│   ├── models/
│   │   ├── user.model.js      # firstName, lastName, email (unique), bcrypt password,
│   │   │                      # reset token digest + expiry, timestamps
│   │   └── note.model.js      # title, content, tags, label, labelColor, reminderAt,
│   │                          # isPinned, isTrashed, trashedAt, userId, timestamps
│   └── Procfile
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js     # primary #2B85FF, secondary #EF863E
    ├── .env.example           # VITE_BASE_URL
    └── src/
        ├── App.jsx            # routes: /, /dashboard (protected), /login, /signup,
        │                      # /forgot-password, /reset-password/:token
        ├── ProtectedRoute.jsx # token presence check
        ├── pages/
        │   ├── Home/Home.jsx           # dashboard: views, labels, search, actions, reminders
        │   ├── Login/Login.jsx         # email + password sign-in
        │   ├── SignUp/SignUp.jsx       # account creation with live email availability
        │   ├── ForgotPassword/ForgotPassword.jsx  # request a reset link
        │   ├── ResetPassword/ResetPassword.jsx    # verify the link, set a new password
        │   ├── AddEditNote/AddEditNote.jsx  # create/edit modal form
        │   └── ViewNote/ViewNote.jsx        # read-only note modal
        ├── components/
        │   ├── Navbar/Navbar.jsx
        │   ├── Cards/NoteCard.jsx, Cards/ProfileInfo.jsx
        │   ├── Input/PasswordInput.jsx  # password field with show/hide toggle
        │   ├── Input/TagInput.jsx
        │   ├── SearchBar/SearchBar.jsx
        │   └── Toasts/Toast.jsx
        └── utils/
            ├── axiosinstance.js  # base URL, 15 s timeout, Authorization interceptor
            └── helper.js         # validation rules (email/name/password) + getInitials()
```

## Getting started

### Prerequisites
- Node.js 18 or newer (ESM + Vite 6), npm
- A reachable MongoDB instance (local `mongod` or Atlas)

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (this file is git-ignored):

```env
MONGODB= your mongodb_url   # or MONGO_URL=... for an Atlas URI
ACCESS_TOKEN_SECRET=<long random string>
FRONTEND_URL=http://localhost:5173
PORT=3000
# only needed when the local resolver refuses SRV lookups (querySrv ECONNREFUSED)
DNS_SERVERS=8.8.8.8,1.1.1.1,9.9.9.9
# mail the password reset links; without these the link is only returned in the

```

Notes:
- `MONGO_URL` takes precedence over `MONGODB`; the server exits at boot if neither is set.
- The server exits at boot if `ACCESS_TOKEN_SECRET` is missing.
- `FRONTEND_URL` is a comma-separated allow-list. Each entry must be an exact origin (scheme + host + port, no trailing slash). If it is unset, every origin is allowed — set it in production.
- `DNS_SERVERS` overrides Node's own resolver for `mongodb+srv://` URIs. Some networks — mobile hotspots, restrictive routers, and local DNS proxies such as a VPN client or antivirus, which appear as `127.0.0.1` — refuse SRV queries, so the driver fails with `querySrv ECONNREFUSED` while the operating system still resolves fine. At boot the server probes the listed resolvers, promotes the first that answers, and retries the connection up to four times with the list rotated.
- The variable block above is the complete set the server reads. `SMTP_*` and `MAIL_FROM` carry the password reset links. For Gmail, use an App Password (16 characters, and the spaces Google shows are optional — the mailer strips them) with 2-Step Verification on; port 587 uses STARTTLS (`SMTP_SECURE=false`) and 465 uses implicit TLS (`SMTP_SECURE=true`), and the mailer derives `secure` from the port when the two disagree. Leaving `SMTP_HOST` empty skips delivery; outside production the reset link is then also returned in the API response. `RESET_PASSWORD_URL` overrides the origin used in the link (otherwise the allow-listed request origin, then the first `FRONTEND_URL` entry, then `http://localhost:5173`). `backend/.env` also contains `MONGODB_DB_NAME`, which the code does not read. Run `npm run mail:check` to test the account without starting the API — it prints the resolved settings (never the password), reports whether the login succeeds, and with an address (`npm run mail:check -- you@example.com`) also sends a real reset link.

Run it (dev reloads on change; `start` is what the Procfile uses):

```bash
npm run dev      # nodemon
# or
npm start        # node server.js — no auto-reload
```

Verify: `curl http://localhost:3000/` returns a hello message.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # VITE_BASE_URL=http://localhost:3000
npm run dev
```

Open http://localhost:5173. If `frontend/.env` is absent, the Axios client falls back to `http://localhost:3000`, which is correct for the default local backend port.

Other frontend scripts: `npm run build` (outputs `dist/`), `npm run preview`, `npm run lint`, `npm start` (serves the built app).

## API

Base URL is the backend root; every response is JSON with the shape `{ error: boolean, message: string, ...payload }`. Validation failures are 400 and additionally carry `fields`, a `{ fieldName: message }` map that the client renders as inline errors. Other errors use 400 (bad credentials / not found), 401 (no token), 403 (invalid or expired token), 404 (note or user not found), and 500 (unhandled).

`POST /create-user` and `POST /login` both return `{ user, accessToken }`. The token expires in 2 hours and is stored in `localStorage.token`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | – | Health / banner message |
| POST | `/create-user` | – | Create an account (`firstName`, `lastName`, `email`, `password`) and return a token |
| POST | `/login` | – | Sign in (`email`, `password`); wrong email and wrong password get the same `Incorrect email or password.` answer |
| POST | `/check-email` | – | `{ available: boolean }` for an address, used by the sign-up form |
| POST | `/forgot-password` | – | Create a 30-minute reset token (`email`) and mail the link. Always answers generically; the link is also returned as `resetUrl` only when delivery failed and `NODE_ENV` is not `production` |
| GET | `/verify-reset-token/:token` | – | Check that a reset link is still valid before showing the form |
| POST | `/reset-password` | – | Set a new password (`token`, `password`); the token is consumed |
| GET | `/user` | ✔ | Current profile |
| GET | `/get-notes` | ✔ | Active notes, newest first, pinned first (`?view=pinned`) |
| GET | `/search?q=` or `/search/:query` | ✔ | Case-insensitive match on title, content, tags, label |
| POST | `/create-note` | ✔ | Create a note |
| POST | `/edit-note/:noteId` | ✔ | Partial update; only the provided fields change |
| PUT | `/pin-note/:noteId` | ✔ | Toggle `isPinned` |
| DELETE | `/delete-note/:noteId` | ✔ | Soft delete → trash |
| GET | `/get-trash?q=` | ✔ | Trashed notes (optional search), newest trashed first |
| PUT | `/restore-note/:noteId` | ✔ | Restore from trash |
| DELETE | `/permanent-delete-note/:noteId` | ✔ | Hard delete |

Authenticated routes require `Authorization: Bearer <accessToken>` and every note operation is scoped to the token's `userId`, so one user cannot read or modify another user's notes.


## Data model

**User** — `firstName` (required), `lastName`, `email` (required, unique, stored lower-cased and trimmed), `password` (required, bcrypt hash at 12 rounds; cached in a pre-save hook and never double-hashed), `passwordResetTokenHash` (SHA-256 of the emailed token, `select: false`), `passwordResetExpiresAt`, `createdAt`/`updatedAt`. A password written in plaintext (an account created before hashing) is compared as-is once, then replaced with a hash on that successful sign-in.

**Note** — `title` and `content` (required), `tags: [String]`, `label` (≤40 chars), `labelColor` (must match `#RRGGBB`), `reminderAt: Date | null`, `isPinned`, `isTrashed`, `trashedAt`, `userId → User`, timestamps. Server-side validation also caps label length, checks the color format, and rejects unparseable reminder dates before writing.

Reset tokens are 32 random bytes (64 hex chars), valid for 30 minutes, and single use: only the digest is stored, so the raw token exists solely in the link that was mailed.

## Deployment

Both packages ship a `Procfile` with `web: npm start`, so they fit Procfile-based hosts (Render, Railway, Heroku-style).

- **Backend:** install, set `MONGO_URL`, `ACCESS_TOKEN_SECRET`, `FRONTEND_URL`, the `SMTP_*`/`MAIL_FROM` values, and let the platform inject `PORT`. MongoDB must be network-reachable from the app (use a URI string for Atlas; `mongodb://localhost` will not work once deployed). Without working SMTP nobody can receive a password reset link, and `resetUrl` is withheld in production.
- **Frontend:** `npm run build` then `npm start` serves `dist/` with SPA fallback on `$PORT`. Set `VITE_BASE_URL` to the deployed API origin **at build time** — Vite inlines it into the bundle, so changing it requires a rebuild.
- Browser origins must be added to `FRONTEND_URL`, otherwise the browser blocks API responses and the app reports a failed sign-in.

## Known limitations

- **Password reset depends on SMTP.** With `SMTP_HOST` unset nothing is emailed. Outside `production` the reset link is also returned in the `/forgot-password` response so the flow stays usable, but in production a missing or misconfigured mail account means a forgotten password cannot be recovered.
- **Accounts with a malformed email are locked out.** The strict email rule runs on sign-in and on reset requests, so an account created before the rule (an address that fails today's format check, e.g. `000-@gmail.com`) can no longer sign in or reset, and there is no in-app way to change an email address.
- **No rate limiting on the auth endpoints.** `/forgot-password` has no per-address throttle, so it can be asked repeatedly (each request issues a new token and invalidates the previous link) and reset mail volume is bounded only by the SMTP quota. Sign-in attempts are not limited either.
- **Legacy plaintext passwords are only upgraded on sign-in.** An account that has not signed in since the switch still holds its original password verbatim in the database.
- **The JWT lives in `localStorage`**, which is readable by any XSS payload, and there is no refresh token, logout invalidation, or expiry handling in the Axios interceptor — after 2 hours requests start failing until you sign in again.
- **Reminders only fire while the app is open** (client polling); there is no server-side scheduler or push service, and the fired-alert history is per browser.
- **Trash is manual** — no automatic purge after N days, and permanent delete has no undo.
- **No tests, CI, lint config for the backend, or seed script**; ESLint is configured for the frontend only (`.eslintrc.cjs`).
- `react-modal` is a declared dependency but never imported; `components/SearchBar/SearchBar.jsx` is defined and never used — `Home.jsx` renders its own overlay and `Navbar.jsx` embeds the search input directly.
