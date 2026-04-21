const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(dateIso, minutes) {
  return new Date(new Date(dateIso).getTime() + minutes * 60 * 1000).toISOString();
}

function addHours(dateIso, hours) {
  return new Date(new Date(dateIso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function randomCode(length = 6) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += crypto.randomInt(0, 10).toString();
  }
  return result;
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) return acc;
      const key = part.slice(0, index).trim();
      const value = decodeURIComponent(part.slice(index + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

module.exports = {
  nowIso,
  addMinutes,
  addHours,
  createId,
  randomCode,
  parseCookies,
  sanitizeEmail
};
