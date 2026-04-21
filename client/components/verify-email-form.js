class VerifyEmailForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.loading = false;
    this.email = '';
    this.code = '';
    this.cooldown = 0;
    this.intervalId = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  setModel({ loading, email, cooldown }) {
    this.loading = Boolean(loading);
    this.email = email || '';
    if (typeof cooldown === 'number') this.setCooldown(cooldown);
    this.render();
  }

  setCooldown(seconds) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.cooldown = Math.max(0, Math.floor(seconds));
    if (this.cooldown > 0) {
      this.intervalId = setInterval(() => {
        this.cooldown -= 1;
        if (this.cooldown <= 0) {
          clearInterval(this.intervalId);
          this.intervalId = null;
          this.cooldown = 0;
        }
        this.render();
      }, 1000);
    }
  }

  render() {
    const canResend = this.cooldown === 0 && !this.loading;
    this.shadowRoot.innerHTML = `
      <style>
        form { display: grid; gap: 12px; }
        label { display: grid; gap: 6px; font-size: 0.95rem; }
        input {
          border: 1px solid var(--ui-border, #d9cdb8);
          border-radius: calc(var(--ui-radius, 18px) - 8px);
          padding: 12px;
          background: #fff;
          color: var(--ui-text, #1e1a14);
        }
        .actions { display: grid; gap: 8px; }
        button {
          border: 0;
          border-radius: calc(var(--ui-radius, 18px) - 8px);
          padding: 12px;
          color: var(--ui-on-primary, #fff);
          font-weight: 700;
          cursor: pointer;
        }
        .verify { background: var(--ui-primary, #cc5b2a); }
        .resend { background: var(--ui-text, #1e1a14); }
        button:disabled { opacity: 0.65; cursor: not-allowed; }
      </style>
      <form id="form">
        <label>Correo
          <input type="email" value="${this.email}" readonly />
        </label>
        <label>Codigo de verificacion
          <input type="text" name="code" value="${this.code}" required minlength="6" maxlength="6" inputmode="numeric" />
        </label>
        <div class="actions">
          <button class="verify" ${this.loading ? 'disabled' : ''} type="submit">${this.loading ? 'Verificando...' : 'Verificar y entrar'}</button>
          <button class="resend" id="resend" ${canResend ? '' : 'disabled'} type="button">${canResend ? 'Reenviar codigo' : `Reenviar en ${this.cooldown}s`}</button>
        </div>
      </form>
    `;

    const codeInput = this.shadowRoot.querySelector('input[name="code"]');
    codeInput.addEventListener('input', (event) => {
      const typed = String(event.target.value || '');
      const sanitized = typed.replace(/\D/g, '').slice(0, 6);
      this.code = sanitized;
      if (sanitized !== typed) {
        event.target.value = sanitized;
      }
    });

    this.shadowRoot.querySelector('#form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.dispatchEvent(
        new CustomEvent('verify-submit', {
          bubbles: true,
          composed: true,
          detail: { email: this.email, code: this.code }
        })
      );
    });

    this.shadowRoot.querySelector('#resend').addEventListener('click', () => {
      this.dispatchEvent(
        new CustomEvent('resend-submit', {
          bubbles: true,
          composed: true,
          detail: { email: this.email }
        })
      );
    });
  }
}

customElements.define('verify-email-form', VerifyEmailForm);
