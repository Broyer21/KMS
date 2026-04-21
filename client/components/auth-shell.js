import { authApi } from '../services/auth-api.js';
import './register-form.js';
import './login-form.js';
import './verify-email-form.js';

class AuthShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.mode = 'login';
    this.pendingEmail = '';
    this.cooldown = 0;
    this.loading = false;
    this.message = '';
    this.messageType = 'info';
  }

  connectedCallback() {
    this.render();
  }

  setMessage(type, text) {
    this.messageType = type;
    this.message = text;
  }

  setLoading(value) {
    this.loading = value;
    this.render();
  }

  async onRegisterSubmit(detail) {
    if (detail.password !== detail.passwordConfirm) {
      this.setMessage('error', 'Las contrasenas no coinciden.');
      this.render();
      return;
    }

    try {
      this.setLoading(true);
      const data = await authApi.register(detail.email, detail.password);
      this.pendingEmail = data.email;
      this.cooldown = data.resendAfterSeconds || 60;
      this.mode = 'verify';
      if (data.emailDeliveryFailed) {
        this.setMessage('info', 'La cuenta quedo creada, pero el correo no salio en este intento. Usa Reenviar codigo.');
      } else {
        this.setMessage('success', 'Cuenta creada. Revisa tu correo e ingresa el codigo.');
      }
    } catch (error) {
      let text = error?.fieldErrors?.[0]?.message || error.message || 'No se pudo crear la cuenta.';
      if (error?.code === 'EMAIL_ALREADY_EXISTS') {
        text = 'Ese correo ya tiene una cuenta. Inicia sesion con ese correo.';
      }
      if (error?.code === 'GOOGLE_ACCOUNT') {
        text = 'Ese correo ya existe con Google. Usa el boton de Google para iniciar sesion.';
      }
      if (error?.code === 'EMAIL_DELIVERY_FAILED') {
        text = 'No pudimos enviar el correo ahora mismo. Intenta de nuevo en unos segundos.';
      }
      this.setMessage('error', text);
    } finally {
      this.setLoading(false);
    }
  }

  async onLoginSubmit(detail) {
    try {
      this.setLoading(true);
      await authApi.login(detail.email, detail.password);
      this.dispatchEvent(new CustomEvent('session-started', { bubbles: true, composed: true }));
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        this.pendingEmail = error.payload?.email || detail.email;
        this.mode = 'verify';
        this.setMessage('info', 'Tu correo no esta verificado. Ingresa el codigo.');
      } else {
        this.setMessage('error', error.message || 'No se pudo iniciar sesion.');
      }
    } finally {
      this.setLoading(false);
    }
  }

  async onVerifySubmit(detail) {
    try {
      this.setLoading(true);
      await authApi.verifyEmail(detail.email, detail.code);
      this.dispatchEvent(new CustomEvent('session-started', { bubbles: true, composed: true }));
    } catch (error) {
      this.setMessage('error', error.message || 'No se pudo verificar el codigo.');
    } finally {
      this.setLoading(false);
    }
  }

  async onResendSubmit(detail) {
    try {
      const data = await authApi.resendVerification(detail.email);
      this.cooldown = data.resendAfterSeconds || 60;
      this.setMessage('success', 'Te enviamos un nuevo codigo.');
      this.render();
    } catch (error) {
      if (error.retryAfterSeconds) {
        this.cooldown = error.retryAfterSeconds;
      }
      this.setMessage('error', error.message || 'No se pudo reenviar el codigo.');
      this.render();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .wrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .panel {
          width: min(520px, 100%);
          background: var(--ui-surface, #fffdf9);
          border: 1px solid var(--ui-border, #dfd1bc);
          border-radius: calc(var(--ui-radius, 18px) + 2px);
          padding: 28px;
          box-shadow: var(--ui-shadow, 0 12px 40px rgba(60, 37, 20, 0.12));
          animation: rise 360ms ease;
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        h1 { margin: 0; font-size: 1.9rem; color: var(--ui-text, #1e1a14); }
        p.top { margin: 8px 0 20px; color: var(--ui-muted, #6f6557); }
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .tabs button {
          flex: 1;
          border: 1px solid var(--ui-border, #dfd1bc);
          border-radius: calc(var(--ui-radius, 18px) - 8px);
          background: #fff;
          padding: 10px;
          cursor: pointer;
          font-weight: 700;
          color: var(--ui-text, #1e1a14);
        }
        .tabs button.active {
          background: var(--ui-text, #1e1a14);
          color: var(--ui-on-primary, #fff);
          border-color: var(--ui-text, #1e1a14);
        }
        .msg {
          margin: 0 0 14px;
          border-radius: calc(var(--ui-radius, 18px) - 8px);
          padding: 10px 12px;
          font-size: 0.92rem;
        }
        .msg.info { background: var(--ui-info-bg, #edf5ff); color: var(--ui-info-text, #1f3b58); }
        .msg.error { background: var(--ui-error-bg, #fdebea); color: var(--ui-error-text, #7c1f1a); }
        .msg.success { background: var(--ui-success-bg, #e9f7ef); color: var(--ui-success-text, #134b2f); }
      </style>
      <section class="wrap">
        <article class="panel">
          <h1>Ingresa a KMS(nombre provisional)</h1>
          <p class="top">Crea tu cuenta o inicia sesion para continuar.</p>
          ${this.mode !== 'verify' ? `
            <div class="tabs">
              <button id="toLogin" class="${this.mode === 'login' ? 'active' : ''}">Iniciar sesion</button>
              <button id="toRegister" class="${this.mode === 'register' ? 'active' : ''}">Crear cuenta</button>
            </div>
          ` : ''}
          ${this.message ? `<p class="msg ${this.messageType}">${this.message}</p>` : ''}
          <div id="view"></div>
        </article>
      </section>
    `;

    const view = this.shadowRoot.querySelector('#view');
    if (this.mode === 'login') {
      const el = document.createElement('login-form');
      el.setLoading(this.loading);
      el.addEventListener('login-submit', (event) => this.onLoginSubmit(event.detail));
      view.appendChild(el);
    }

    if (this.mode === 'register') {
      const el = document.createElement('register-form');
      el.setLoading(this.loading);
      el.addEventListener('register-submit', (event) => this.onRegisterSubmit(event.detail));
      view.appendChild(el);
    }

    if (this.mode === 'verify') {
      const el = document.createElement('verify-email-form');
      el.setModel({ loading: this.loading, email: this.pendingEmail, cooldown: this.cooldown });
      el.addEventListener('verify-submit', (event) => this.onVerifySubmit(event.detail));
      el.addEventListener('resend-submit', (event) => this.onResendSubmit(event.detail));
      view.appendChild(el);
    }

    const toLogin = this.shadowRoot.querySelector('#toLogin');
    if (toLogin) {
      toLogin.addEventListener('click', () => {
        this.mode = 'login';
        this.setMessage('info', '');
        this.render();
      });
    }

    const toRegister = this.shadowRoot.querySelector('#toRegister');
    if (toRegister) {
      toRegister.addEventListener('click', () => {
        this.mode = 'register';
        this.setMessage('info', '');
        this.render();
      });
    }
  }
}

customElements.define('auth-shell', AuthShell);
