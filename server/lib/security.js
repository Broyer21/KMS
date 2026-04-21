const crypto = require('crypto');

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [saltHex, keyHex] = String(stored || '').split(':');
    if (!saltHex || !keyHex) {
      resolve(false);
      return;
    }
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      const expected = Buffer.from(keyHex, 'hex');
      if (expected.length !== derivedKey.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(expected, derivedKey));
    });
  });
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashCode
};
