import dns from 'node:dns';
import mongoose from 'mongoose';

// Some networks refuse SRV queries from Node's own resolver (mobile hotspots,
// restrictive routers, and local DNS proxies such as a VPN client, which show up
// as 127.0.0.1), so "mongodb+srv://" fails with querySrv ECONNREFUSED while the
// operating system still resolves A records. DNS_SERVERS lists public resolvers
// to use instead; the list is rotated on retry because a single resolver can be
// blocked or rate limited even when the others answer.
//
// The environment is read lazily because dotenv.config() runs in app.js, which
// is evaluated after this module.
const readDnsServers = () => (process.env.DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

const mongoUri = () => process.env.MONGO_URL || process.env.MONGODB;

const srvHost = () => {
  const uri = mongoUri() || '';
  return /^mongodb\+srv:\/\//i.test(uri) ? new URL(uri).hostname : '';
};

// A serverless invocation is killed at its duration limit, so the long retry
// schedule used on a long-running host would only turn a clear error into a
// gateway timeout there.
const isServerless = Boolean(process.env.VERCEL);
const DB_CONNECT_ATTEMPTS = isServerless ? 2 : 4;
const DB_RETRY_DELAY_MS = 3000;
const DB_SELECTION_TIMEOUT_MS = isServerless ? 6000 : 30000;

const rotateResolvers = (servers, offset) => {
  const start = offset % servers.length;
  return [...servers.slice(start), ...servers.slice(0, start)];
};

// Probe each resolver once and move the first one that answers SRV to the front,
// so a refusing entry in the list does not cost a full connection timeout before
// the retry rotates past it.
const promoteWorkingResolver = async (servers, host) => {
  if (!servers.length || !host) {
    return;
  }

  for (let index = 0; index < servers.length; index += 1) {
    dns.setServers([servers[index]]);
    try {
      await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
      servers.unshift(...servers.splice(index, 1));
      return;
    } catch {
      // resolver refused the query, try the next one
    }
  }
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const connect = async () => {
  const uri = mongoUri();
  if (!uri) {
    throw new Error('Missing MongoDB URI. Set MONGO_URL or MONGODB in the environment.');
  }

  const servers = readDnsServers();
  await promoteWorkingResolver(servers, srvHost());

  for (let attempt = 0; attempt < DB_CONNECT_ATTEMPTS; attempt += 1) {
    if (servers.length) {
      dns.setServers(rotateResolvers(servers, attempt));
    }

    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: DB_SELECTION_TIMEOUT_MS });
      console.log('MongoDB connection successful');
      return;
    } catch (error) {
      console.error(`MongoDB connection error (attempt ${attempt + 1}/${DB_CONNECT_ATTEMPTS}):`, error.message);
      if (attempt + 1 === DB_CONNECT_ATTEMPTS) {
        throw error;
      }
      await wait(DB_RETRY_DELAY_MS);
    }
  }
};

// One connection per process: a serverless instance is reused between
// invocations, so the attempt is cached instead of reconnecting per request.
// A failed attempt resets the cache so the next request can try again.
let connectionPromise = null;

export const connectToDatabase = () => {
  if (!connectionPromise) {
    connectionPromise = connect().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
};

// Resolves once the driver is connected, so a handler never runs against a
// disconnected database.
export const requireDatabase = (req, res, next) => {
  connectToDatabase().then(() => next(), next);
};
