'use strict';

const crypto = require('crypto');
const { User } = require('../models');

/* ============================================================================
   AUTH
   ----------------------------------------------------------------------------
   Email + password sessions for the app (AGENT/FEATURES.md F1.1).

   Design notes
   - Passwords are hashed with scrypt from Node's own crypto module. No native
     addon, so there is nothing to compile and no bcrypt binary mismatch to
     debug on a fresh clone.
   - Sessions are stateless HMAC-signed JWTs (HS256). The payload carries only
     the user id, email and name — never the hash.
   - `AUTH_SECRET` is required in production. In development we fall back to a
     fixed constant so a fresh clone boots, and we say so loudly on the console:
     a predictable secret means anyone can mint a token for any user id.
   ========================================================================= */

const DEV_FALLBACK_SECRET = 'creatorai-dev-only-insecure-secret';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    // Refusing to boot is the honest option: silently running on a known
    // constant would hand every deployment the same forgery key.
    throw new Error('AUTH_SECRET must be set (>=16 chars) when NODE_ENV=production');
  }
  if (!global.__creatoraiAuthSecretWarned) {
    global.__creatoraiAuthSecretWarned = true;
    console.warn('[auth] AUTH_SECRET not set — using the development fallback secret. Never do this in production.');
  }
  return DEV_FALLBACK_SECRET;
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signToken(payload, ttlSeconds = TOKEN_TTL_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedBody = b64url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;
  const sig = b64url(crypto.createHmac('sha256', secret()).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedBody, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', secret()).update(`${encodedHeader}.${encodedBody}`).digest());
  // Compare in constant time, then check expiry. Both must pass.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(encodedBody, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!body || typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

/** Extract a bearer token from the standard header, or the dev cookie. */
function readToken(req) {
  const header = req.headers?.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * requireAuth — rejects the request unless a live token maps to a real user.
 * Mounted in front of every data route, so an unauthenticated client gets 401
 * instead of the entire workspace.
 */
async function requireAuth(req, res, next) {
  const claims = verifyToken(readToken(req));
  if (!claims?.sub) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  try {
    const user = await User.findByPk(claims.sub);
    if (!user) {
      return res.status(401).json({ error: 'This account no longer exists.' });
    }
    req.user = { id: user.id, email: user.email, name: user.name };
    return next();
  } catch (e) {
    return res.status(500).json({ error: `Could not verify the session: ${e.message}` });
  }
}

/**
 * optionalAuth — attaches req.user when a valid token is present and otherwise
 * carries on. Used by /api/health so the login page can personalise the
 * "signed in as" strip without forcing auth on a public endpoint.
 */
async function optionalAuth(req, _res, next) {
  const claims = verifyToken(readToken(req));
  if (claims?.sub) {
    try {
      const user = await User.findByPk(claims.sub);
      if (user) req.user = { id: user.id, email: user.email, name: user.name };
    } catch {
      /* an unreachable DB must not fail a public request */
    }
  }
  return next();
}

/* ---- password hashing ---------------------------------------------------- */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  // self-describing string so the parameters can change later without
  // invalidating existing hashes.
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length, { N: Number(N), r: Number(r), p: Number(p) });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** The shape we are willing to hand back to a client. Never the hash. */
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name || u.email.split('@')[0] });

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  hashPassword,
  verifyPassword,
  publicUser,
  TOKEN_TTL_SECONDS,
};
