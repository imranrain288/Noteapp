import app from './app.js';
import { connectToDatabase } from './database.js';

const port = process.env.PORT || 3000;

// The HTTP server comes up even when the database is unreachable, so a platform
// health check still answers; each request retries the connection itself.
connectToDatabase().catch((error) => {
  console.error('MongoDB connection failed:', error.message);
});

app.listen(port, () => console.log(`Server is running on port ${port}`));
