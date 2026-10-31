// Catch-all sibling of api/index.js: it lets /api/<anything> reach the Express
// app directly, without depending on the /api rewrite in vercel.json.
export { default } from './index.js';
