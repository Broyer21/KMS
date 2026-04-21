function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBool(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeEmailProvider(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return ['resend', 'smtp', 'console'].includes(normalized) ? normalized : '';
}

function normalizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function resolveEmailProvider() {
  const direct = normalizeEmailProvider(process.env.EMAIL_PROVIDER || '');
  if (direct) return direct;

  const legacy = normalizeEmailProvider(process.env.EMAIL_MODE || '');
  return legacy || 'console';
}

const config = {
  port: toInt(process.env.PORT, 3000),
  appOrigin: normalizeString(process.env.APP_ORIGIN, 'http://localhost:3000'),
  storeMode: 'mysql',
  mysql: {
    host: normalizeString(process.env.MYSQL_HOST, 'mysql.railway.internal'),
    port: toInt(process.env.MYSQL_PORT, 3306),
    user: normalizeString(process.env.MYSQL_USER, 'root'),
    password: normalizeString(process.env.MYSQL_PASSWORD, ''),
    database: normalizeString(process.env.MYSQL_DATABASE, 'metatinis_auth')
  },
  executablePath: process.env.EXECUTABLE_PATH || '',
  oauthStateTtlMinutes: toInt(process.env.OAUTH_STATE_TTL_MINUTES, 10),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'metatinis_session',
  sessionTtlHours: toInt(process.env.SESSION_TTL_HOURS, 24),
  verificationTtlMinutes: toInt(process.env.VERIFICATION_TTL_MINUTES, 10),
  resendCooldownSeconds: toInt(process.env.RESEND_COOLDOWN_SECONDS, 60),
  maxVerifyAttempts: toInt(process.env.MAX_VERIFY_ATTEMPTS, 5),
  emailProvider: resolveEmailProvider(),
  emailMode: process.env.EMAIL_MODE || 'console',
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || process.env.SMTP_FROM || 'no-reply@example.com'
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: toInt(process.env.SMTP_PORT, 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@example.com'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || ''
  }
};

module.exports = config;
