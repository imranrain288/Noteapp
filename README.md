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
- Sign up and sign in; profile avatar with initials, name, and email in the top bar.
- Light/dark theme toggle, persisted in `localStorage` (`memo-theme`).
- Protected routes; a 401/403 from the API clears the token and returns you to sign-in.
- Toast notifications and inline field errors for every action.

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, Vite 6, React Router 7, Axios, Tailwind CSS 3 (+ ~1.2k lines of custom CSS in `App.css`), react-icons, react-modal |
| Backend | Node.js (ESM), Express 4, Mongoose 7, JSON Web Token (HS256), CORS, dotenv, nodemon (dev) |
| Data | MongoDB; collections `users` and `notes` |
| Hosting | `Procfile` (`web: npm start`) in both packages; frontend serves its build with `serve -s dist -l $PORT` |

## Project structure

```
Noteapp/
├── backend/
│   ├── server.js              # Express app, all REST routes, CORS, JWT issuing, error handler
│   ├── utilities.js           # authenticationToken middleware (Bearer JWT verify)
│   ├── models/
│   │   ├── user.model.js      # firstName, lastName, email (unique), password, timestamps
│   │   └── note.model.js      # title, content, tags, label, labelColor, reminderAt,
│   │                          # isPinned, isTrashed, trashedAt, userId, timestamps
│   └── Procfile
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js     # primary #2B85FF, secondary #EF863E
    ├── .env.example           # VITE_BASE_URL
    └── src/
        ├── App.jsx            # routes: /, /dashboard (protected), /login, /signup
        ├── ProtectedRoute.jsx # token presence check
        ├── pages/
        │   ├── Home/Home.jsx           # dashboard: views, labels, search, actions, reminders
        │   ├── Login/Login.jsx
        │   ├── SignUp/SignUp.jsx
        │   ├── AddEditNote/AddEditNote.jsx  # create/edit modal form
        │   └── ViewNote/ViewNote.jsx        # read-only note modal
        ├── components/
        │   ├── Navbar/Navbar.jsx
        │   ├── Cards/NoteCard.jsx, Cards/ProfileInfo.jsx
        │   ├── Input/TagInput.jsx, Input/PasswordInput.jsx
        │   ├── SearchBar/SearchBar.jsx
        │   └── Toasts/Toast.jsx
        └── utils/
            ├── axiosinstance.js  # base URL, 15 s timeout, Authorization interceptor
            └── helper.js         # validEmail(), getInitials()
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
```

Notes:
- `MONGO_URL` takes precedence over `MONGODB`; the server exits at boot if neither is set.
- The server exits at boot if `ACCESS_TOKEN_SECRET` is missing.
- `FRONTEND_URL` is a comma-separated allow-list. Each entry must be an exact origin (scheme + host + port, no trailing slash). If it is unset, every origin is allowed — set it in production.
- `backend/.env` also contains `MONGODB_DB_NAME`, which the code does not read.

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

Base URL is the backend root; every response is JSON with the shape `{ error: boolean, message: string, ...payload }`. Errors use 400 (validation / bad credentials / not found), 401 (no token), 403 (invalid or expired token), 404 (note or user not found), and 500 (unhandled).

`POST /login` and `POST /create-user` return `{ user, accessToken }`; the token expires in 2 hours and is stored in `localStorage.token`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | – | Health / banner message |
| POST | `/create-user` | – | Register (`firstName`, `lastName`, `email`, `password`) and return a token |
| POST | `/login` | – | Sign in (`email`, `password`) and return a token |
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

**User** — `firstName` (required), `lastName`, `email` (required, unique, stored lower-cased and trimmed), `password`, `createdAt`/`updatedAt`.

**Note** — `title` and `content` (required), `tags: [String]`, `label` (≤40 chars), `labelColor` (must match `#RRGGBB`), `reminderAt: Date | null`, `isPinned`, `isTrashed`, `trashedAt`, `userId → User`, timestamps. Server-side validation also caps label length, checks the color format, and rejects unparseable reminder dates before writing.

## Deployment

Both packages ship a `Procfile` with `web: npm start`, so they fit Procfile-based hosts (Render, Railway, Heroku-style).

- **Backend:** install, set `MONGO_URL`, `ACCESS_TOKEN_SECRET`, `FRONTEND_URL`, and let the platform inject `PORT`. MongoDB must be network-reachable from the app (use a URI string for Atlas; `mongodb://localhost` will not work once deployed).
- **Frontend:** `npm run build` then `npm start` serves `dist/` with SPA fallback on `$PORT`. Set `VITE_BASE_URL` to the deployed API origin **at build time** — Vite inlines it into the bundle, so changing it requires a rebuild.
- Browser origins must be added to `FRONTEND_URL`, otherwise the browser blocks API responses and the app reports a failed sign-in.

## Known limitations

- **Passwords are stored and compared in plain text** — there is no bcrypt hashing, and the Mongoose schema has no pre-save hook. Login also returns a generic "User does not exist." / "Invalid credentials." 400 without rate limiting. Treat this as demo-grade auth before handling real user data.
- **The JWT lives in `localStorage`**, which is readable by any XSS payload, and there is no refresh token, logout invalidation, or expiry handling in the Axios interceptor — after 2 hours requests start failing until you sign in again.
- **Reminders only fire while the app is open** (client polling); there is no server-side scheduler or push service, and the fired-alert history is per browser.
- **Trash is manual** — no automatic purge after N days, and permanent delete has no undo.
- **No tests, CI, lint config for the backend, or seed script**; ESLint is configured for the frontend only (`.eslintrc.cjs`).
- `react-modal` is a declared dependency but never imported; `components/SearchBar/SearchBar.jsx` and `components/Input/PasswordInput.jsx` are defined and never used — `Home.jsx` renders its own overlay and `Navbar.jsx` embeds the search input directly.
