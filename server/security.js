import crypto from 'crypto';

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algorithm, saltHex, hashHex] = String(stored || '').split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function tokenDigest(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function isStrongPassword(password) {
  const value = String(password || '');
  return value.length >= 12 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separator = item.indexOf('=');
      if (separator === -1) return cookies;
      const key = item.slice(0, separator).trim();
      const value = item.slice(separator + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

export function safeText(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function nullableText(value, maxLength = 1000) {
  const text = safeText(value, maxLength);
  return text || null;
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

export function maskPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length < 5) return digits;
  return `${digits.slice(0, 2)} *****-${digits.slice(-4)}`;
}
