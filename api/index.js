import app from '../backend/app.js';

// Vercel routes every /api/* request to this function, while the Express routes
// are declared without the prefix. The prefix is removed only when it is still
// part of req.url, so the handler works whether or not the rewrite already
// stripped it.
const stripApiPrefix = (url = '/') => {
  const stripped = url.replace(/^\/api(?=\/|$|\?)/, '');
  return stripped || '/';
};

export default function handler(req, res) {
  const requestedUrl = req.url;
  req.url = stripApiPrefix(requestedUrl);
  // Keep the URL the caller actually used, so log lines and 404 messages show
  // the /api path instead of the stripped one.
  req.originalUrl = requestedUrl;
  app(req, res);
}
