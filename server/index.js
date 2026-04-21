require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs/promises');
const { OAuth2Client } = require('google-auth-library');
const config = require('./lib/config');
const { initializeStore, readStore, writeStore } = require('./lib/store');
const { hashPassword, verifyPassword, hashCode } = require('./lib/security');
const { sendVerificationCode } = require('./lib/email');
const {
  nowIso,
  addMinutes,
  addHours,
  createId,
  randomCode,
  parseCookies,
  sanitizeEmail
} = require('./lib/utils');

const googleClient = new OAuth2Client(config.google.clientId || undefined);

function getRequestUrl(req) {
  return new URL(req.url, config.appOrigin);
}

function googleOAuthReady() {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function badRequest(res, code, message, fieldErrors) {
  sendJson(res, 400, {
    error: {
      code,
      message,
      fieldErrors: fieldErrors || undefined
    }
  });
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function setSessionCookie(res, token, expiresAt) {
  const isSecure = config.appOrigin.startsWith('https://');
  const cookie = [
    `${config.sessionCookieName}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
    `Expires=${new Date(expiresAt).toUTCString()}`
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  const isSecure = config.appOrigin.startsWith('https://');
  const cookie = [
    `${config.sessionCookieName}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}

function findUserBySession(store, req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[config.sessionCookieName];
  if (!token) return null;

  const now = new Date(nowIso()).getTime();
  const session = store.sessions.find((s) => s.token === token && new Date(s.expiresAt).getTime() > now);
  if (!session) return null;

  return store.users.find((u) => u.id === session.userId) || null;
}

function cleanupStore(store) {
  const now = new Date(nowIso()).getTime();
  store.sessions = store.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  store.verificationCodes = store.verificationCodes.filter((v) => new Date(v.expiresAt).getTime() > now && !v.usedAt);
  store.oauthStates = (store.oauthStates || []).filter((s) => new Date(s.expiresAt).getTime() > now && !s.usedAt);
}

let storeWriteQueue = Promise.resolve();

async function withStoreWriteLock(task) {
  const previous = storeWriteQueue;
  let release;
  storeWriteQueue = new Promise((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

async function handleRegister(req, res) {
  const body = await parseBody(req);
  const email = sanitizeEmail(body.email);
  const password = String(body.password || '');

  const fieldErrors = [];
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    fieldErrors.push({ field: 'email', message: 'Correo invalido' });
  }
  if (password.length < 8) {
    fieldErrors.push({ field: 'password', message: 'La contrasena debe tener al menos 8 caracteres' });
  }
  if (fieldErrors.length > 0) {
    return badRequest(res, 'VALIDATION_ERROR', 'Datos invalidos', fieldErrors);
  }

  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);

    const existingUser = store.users.find((u) => u.email === email);

    if (existingUser) {
      if (existingUser.emailVerified) {
        return sendJson(res, 409, {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'No se pudo completar el registro'
          }
        });
      }

      if (existingUser.oauthProvider === 'google' && !existingUser.passwordHash) {
        return sendJson(res, 409, {
          error: {
            code: 'GOOGLE_ACCOUNT',
            message: 'Este correo ya existe con acceso de Google. Usa el boton de Google para entrar.'
          }
        });
      }

      existingUser.passwordHash = await hashPassword(password);

      const code = randomCode(6);
      const now = nowIso();
      store.verificationCodes = store.verificationCodes.filter((v) => v.email !== email || v.usedAt);
      store.verificationCodes.push({
        id: createId('verify'),
        email,
        codeHash: hashCode(code),
        createdAt: now,
        expiresAt: addMinutes(now, config.verificationTtlMinutes),
        attempts: 0,
        usedAt: null,
        resendAllowedAt: addMinutes(now, config.resendCooldownSeconds / 60)
      });

      await writeStore(store);
      await sendVerificationCode({ email, code });

      return sendJson(res, 200, {
        userId: existingUser.id,
        email,
        requiresVerification: true,
        resendAfterSeconds: config.resendCooldownSeconds
      });
    }

    const userId = createId('user');
    const passwordHash = await hashPassword(password);
    const user = {
      id: userId,
      email,
      passwordHash,
      oauthProvider: 'local',
      googleSub: null,
      displayName: null,
      avatarUrl: null,
      emailVerified: false,
      createdAt: nowIso()
    };
    store.users.push(user);

    const code = randomCode(6);
    const now = nowIso();
    store.verificationCodes = store.verificationCodes.filter((v) => v.email !== email || v.usedAt);
    store.verificationCodes.push({
      id: createId('verify'),
      email,
      codeHash: hashCode(code),
      createdAt: now,
      expiresAt: addMinutes(now, config.verificationTtlMinutes),
      attempts: 0,
      usedAt: null,
      resendAllowedAt: addMinutes(now, config.resendCooldownSeconds / 60)
    });

    await writeStore(store);
    await sendVerificationCode({ email, code });

    return sendJson(res, 201, {
      userId,
      email,
      requiresVerification: true,
      resendAfterSeconds: config.resendCooldownSeconds
    });
  });
}

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const email = sanitizeEmail(body.email);
  const password = String(body.password || '');

  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);

    const user = store.users.find((u) => u.email === email);
    if (user && !user.passwordHash) {
      return sendJson(res, 401, {
        error: {
          code: 'GOOGLE_ACCOUNT',
          message: 'Esta cuenta usa acceso con Google. Usa el boton de Google para iniciar sesion.'
        }
      });
    }
    const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordOk) {
      return sendJson(res, 401, {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales invalidas'
        }
      });
    }

    if (!user.emailVerified) {
      return sendJson(res, 403, {
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Debes verificar tu correo antes de continuar'
        },
        requiresVerification: true,
        email: user.email
      });
    }

    const now = nowIso();
    const token = createId('session');
    const expiresAt = addHours(now, config.sessionTtlHours);
    store.sessions.push({
      id: createId('sess'),
      token,
      userId: user.id,
      createdAt: now,
      expiresAt
    });

    await writeStore(store);
    setSessionCookie(res, token, expiresAt);

    return sendJson(res, 200, {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  });
}

async function handleVerifyEmail(req, res) {
  const body = await parseBody(req);
  const email = sanitizeEmail(body.email);
  const code = String(body.code || '').trim();

  if (!email || !code) {
    return badRequest(res, 'VALIDATION_ERROR', 'Correo y codigo son requeridos');
  }

  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);
    const user = store.users.find((u) => u.email === email);

    if (!user) {
      return sendJson(res, 400, {
        error: {
          code: 'INVALID_OR_EXPIRED_CODE',
          message: 'Codigo invalido o expirado'
        }
      });
    }

    const verification = store.verificationCodes
      .filter((v) => v.email === email && !v.usedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!verification) {
      return sendJson(res, 400, {
        error: {
          code: 'INVALID_OR_EXPIRED_CODE',
          message: 'Codigo invalido o expirado'
        }
      });
    }

    if (verification.attempts >= config.maxVerifyAttempts) {
      return sendJson(res, 429, {
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Demasiados intentos. Solicita un nuevo codigo.'
        }
      });
    }

    const matches = hashCode(code) === verification.codeHash;
    verification.attempts += 1;

    if (!matches) {
      await writeStore(store);
      return sendJson(res, 400, {
        error: {
          code: 'INVALID_OR_EXPIRED_CODE',
          message: 'Codigo invalido o expirado'
        }
      });
    }

    verification.usedAt = nowIso();
    user.emailVerified = true;

    const now = nowIso();
    const token = createId('session');
    const expiresAt = addHours(now, config.sessionTtlHours);
    store.sessions.push({
      id: createId('sess'),
      token,
      userId: user.id,
      createdAt: now,
      expiresAt
    });

    await writeStore(store);
    setSessionCookie(res, token, expiresAt);

    return sendJson(res, 200, {
      verified: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true
      }
    });
  });
}

async function handleResendCode(req, res) {
  const body = await parseBody(req);
  const email = sanitizeEmail(body.email);

  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);
    const user = store.users.find((u) => u.email === email);

    if (!user || user.emailVerified) {
      return sendJson(res, 202, {
        sent: true,
        resendAfterSeconds: config.resendCooldownSeconds
      });
    }

    const latest = store.verificationCodes
      .filter((v) => v.email === email && !v.usedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (latest && new Date(latest.resendAllowedAt).getTime() > new Date(nowIso()).getTime()) {
      const diffMs = new Date(latest.resendAllowedAt).getTime() - new Date(nowIso()).getTime();
      return sendJson(res, 429, {
        error: {
          code: 'RATE_LIMITED',
          message: 'Debes esperar antes de reenviar el codigo',
          retryAfterSeconds: Math.ceil(diffMs / 1000)
        }
      });
    }

    const code = randomCode(6);
    const now = nowIso();
    store.verificationCodes.push({
      id: createId('verify'),
      email,
      codeHash: hashCode(code),
      createdAt: now,
      expiresAt: addMinutes(now, config.verificationTtlMinutes),
      attempts: 0,
      usedAt: null,
      resendAllowedAt: addMinutes(now, config.resendCooldownSeconds / 60)
    });

    await writeStore(store);
    await sendVerificationCode({ email, code });

    return sendJson(res, 202, {
      sent: true,
      resendAfterSeconds: config.resendCooldownSeconds
    });
  });
}

async function handleSession(req, res) {
  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);
    const user = findUserBySession(store, req);

    if (!user) {
      return sendJson(res, 401, {
        authenticated: false
      });
    }

    await writeStore(store);

    return sendJson(res, 200, {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  });
}

async function handleLogout(req, res) {
  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[config.sessionCookieName];

    if (token) {
      store.sessions = store.sessions.filter((s) => s.token !== token);
      await writeStore(store);
    }

    clearSessionCookie(res);
    res.writeHead(204);
    res.end();
  });
}

async function handleGoogleStart(req, res) {
  if (!googleOAuthReady()) {
    return sendJson(res, 500, {
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth no esta configurado en el servidor.'
      }
    });
  }

  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);
    const now = nowIso();
    const stateToken = createId('gstate');
    const nonceToken = createId('gnonce');

    store.oauthStates = store.oauthStates || [];
    store.oauthStates.push({
      id: createId('oauth'),
      provider: 'google',
      stateToken,
      nonceToken,
      createdAt: now,
      expiresAt: addMinutes(now, config.oauthStateTtlMinutes),
      usedAt: null
    });
    await writeStore(store);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', config.google.clientId);
    authUrl.searchParams.set('redirect_uri', config.google.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', stateToken);
    authUrl.searchParams.set('nonce', nonceToken);
    authUrl.searchParams.set('prompt', 'select_account');

    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
  });
}

async function handleGoogleCallback(req, res, requestUrl) {
  const code = requestUrl.searchParams.get('code');
  const stateToken = requestUrl.searchParams.get('state');

  if (!code || !stateToken) {
    return sendJson(res, 400, {
      error: {
        code: 'GOOGLE_CALLBACK_INVALID',
        message: 'Faltan parametros de autenticacion de Google.'
      }
    });
  }

  if (!googleOAuthReady()) {
    return sendJson(res, 500, {
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth no esta configurado en el servidor.'
      }
    });
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenResponse.ok) {
    return sendJson(res, 400, {
      error: {
        code: 'GOOGLE_TOKEN_EXCHANGE_FAILED',
        message: 'No se pudo intercambiar el token de Google.'
      }
    });
  }

  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.id_token) {
    return sendJson(res, 400, {
      error: {
        code: 'GOOGLE_ID_TOKEN_MISSING',
        message: 'Google no devolvio id_token.'
      }
    });
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokenPayload.id_token,
    audience: config.google.clientId
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    return sendJson(res, 400, {
      error: {
        code: 'GOOGLE_ID_TOKEN_INVALID',
        message: 'El id_token de Google no contiene identidad valida.'
      }
    });
  }

  return withStoreWriteLock(async () => {
    const store = await readStore();
    cleanupStore(store);

    const oauthState = (store.oauthStates || []).find(
      (item) => item.provider === 'google' && item.stateToken === stateToken && !item.usedAt
    );

    if (!oauthState) {
      return sendJson(res, 400, {
        error: {
          code: 'GOOGLE_STATE_INVALID',
          message: 'State de Google invalido o expirado.'
        }
      });
    }

    if (payload.nonce !== oauthState.nonceToken) {
      return sendJson(res, 400, {
        error: {
          code: 'GOOGLE_NONCE_INVALID',
          message: 'Nonce de Google invalido.'
        }
      });
    }

    if (!payload.email_verified) {
      return sendJson(res, 400, {
        error: {
          code: 'GOOGLE_EMAIL_NOT_VERIFIED',
          message: 'Google reporta correo sin verificar.'
        }
      });
    }

    const email = sanitizeEmail(payload.email);
    let user = store.users.find((u) => u.googleSub && u.googleSub === payload.sub) || null;

    if (!user) {
      const byEmail = store.users.find((u) => u.email === email) || null;
      if (byEmail) {
        if (byEmail.googleSub && byEmail.googleSub !== payload.sub) {
          return sendJson(res, 409, {
            error: {
              code: 'GOOGLE_ACCOUNT_CONFLICT',
              message: 'Ya existe una cuenta con ese correo y otro identificador de Google.'
            }
          });
        }

        byEmail.googleSub = payload.sub;
        byEmail.oauthProvider = 'google';
        byEmail.emailVerified = true;
        byEmail.displayName = payload.name || byEmail.displayName || null;
        byEmail.avatarUrl = payload.picture || byEmail.avatarUrl || null;
        user = byEmail;
      }
    }

    if (!user) {
      user = {
        id: createId('user'),
        email,
        passwordHash: null,
        oauthProvider: 'google',
        googleSub: payload.sub,
        displayName: payload.name || null,
        avatarUrl: payload.picture || null,
        emailVerified: true,
        createdAt: nowIso()
      };
      store.users.push(user);
    }

    oauthState.usedAt = nowIso();

    const now = nowIso();
    const token = createId('session');
    const expiresAt = addHours(now, config.sessionTtlHours);
    store.sessions.push({
      id: createId('sess'),
      token,
      userId: user.id,
      createdAt: now,
      expiresAt
    });

    await writeStore(store);
    setSessionCookie(res, token, expiresAt);

    res.writeHead(302, { Location: '/' });
    res.end();
  });
}

async function handleDownloadExecutable(req, res) {
  const fallbackPath = path.join(__dirname, '..', 'downloads', 'MetatinisSetup.exe');
  const executablePath = config.executablePath ? path.resolve(config.executablePath) : fallbackPath;

  try {
    const stat = await fs.stat(executablePath);
    if (!stat.isFile()) {
      throw new Error('Executable path is not a file');
    }

    const fileName = path.basename(executablePath);
    const data = await fs.readFile(executablePath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=\"${fileName}\"`,
      'Content-Length': data.length
    });
    res.end(data);
  } catch {
    return sendJson(res, 404, {
      error: {
        code: 'EXECUTABLE_NOT_FOUND',
        message: 'No hay ejecutable disponible para descarga.'
      }
    });
  }
}

async function handleDownloadConnectionProfile(req, res) {
  const profile = {
    appName: 'Metatinis',
    apiBaseUrl: config.appOrigin,
    generatedAt: nowIso()
  };

  const data = Buffer.from(JSON.stringify(profile, null, 2), 'utf-8');
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="kms-connection-profile.json"',
    'Content-Length': data.length
  });
  res.end(data);
}

async function serveStatic(requestPath, res) {
  const requestedPath = requestPath === '/' ? '/index.html' : requestPath;
  const normalized = path.posix.normalize(requestedPath);
  const relativePath = normalized.replace(/^\/+/, '');
  const clientRoot = path.join(__dirname, '..', 'client');
  const filePath = path.join(clientRoot, relativePath || 'index.html');

  if (!filePath.startsWith(clientRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

async function handler(req, res) {
  try {
    const requestUrl = getRequestUrl(req);
    const pathname = requestUrl.pathname;

    if (req.method === 'POST' && pathname === '/api/v1/auth/register') return await handleRegister(req, res);
    if (req.method === 'POST' && pathname === '/api/v1/auth/login') return await handleLogin(req, res);
    if (req.method === 'POST' && pathname === '/api/v1/auth/verify-email') return await handleVerifyEmail(req, res);
    if (req.method === 'POST' && pathname === '/api/v1/auth/resend-verification') return await handleResendCode(req, res);
    if (req.method === 'GET' && pathname === '/api/v1/auth/session') return await handleSession(req, res);
    if (req.method === 'GET' && pathname === '/api/v1/auth/google/start') return await handleGoogleStart(req, res);
    if (req.method === 'GET' && pathname === '/api/v1/auth/google/callback') return await handleGoogleCallback(req, res, requestUrl);
    if (req.method === 'GET' && pathname === '/api/v1/app/download') return await handleDownloadExecutable(req, res);
    if (req.method === 'GET' && pathname === '/api/v1/app/download-profile') return await handleDownloadConnectionProfile(req, res);
    if (req.method === 'POST' && pathname === '/api/v1/auth/logout') return await handleLogout(req, res);

    return await serveStatic(pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
}

const server = http.createServer(handler);

async function start() {
  try {
    if (config.storeMode === 'mysql') {
      console.log(
        `[DB config] host=${config.mysql.host} port=${config.mysql.port} user=${config.mysql.user} database=${config.mysql.database} passwordLength=${(config.mysql.password || '').length}`
      );
    }

    await initializeStore();
    server.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('No se pudo conectar/inicializar MySQL.', error.message);
    process.exit(1);
  }
}

start();
