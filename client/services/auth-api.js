async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });

  if (response.status === 204) return null;

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Request failed');
    error.status = response.status;
    error.code = payload?.error?.code;
    error.retryAfterSeconds = payload?.error?.retryAfterSeconds;
    error.fieldErrors = payload?.error?.fieldErrors || [];
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const authApi = {
  register(email, password) {
    return request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  login(email, password) {
    return request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  verifyEmail(email, code) {
    return request('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
  },
  resendVerification(email) {
    return request('/api/v1/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },
  getSession() {
    return request('/api/v1/auth/session', { method: 'GET' });
  },
  logout() {
    return request('/api/v1/auth/logout', { method: 'POST' });
  }
};
