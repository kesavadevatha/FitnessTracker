const crypto = require('crypto');
const { AUTH_TOKEN_SECRET, AUTH_TOKEN_EXPIRY_SECONDS } = require('../config');

function hashPassword(password) {
  return crypto
    .pbkdf2Sync(password, 'salt', 100000, 64, 'sha512')
    .toString('hex');
}

function createAuthToken(payload) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');

  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_EXPIRY_SECONDS
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function authenticateRequest(req, res, next) {
  const authorization = String(req.headers.authorization || '').trim();
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : null;

  const payload = verifyAuthToken(token);

  if (!payload || !payload.email) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  req.user = {
    email: String(payload.email).trim().toLowerCase(),
    isAdmin: Boolean(payload.isAdmin)
  };
  next();
}

module.exports = {
  hashPassword,
  createAuthToken,
  verifyAuthToken,
  authenticateRequest
};
