class LoginForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.loading = false;
  }

  connectedCallback() {
    this.render();
  }

  setLoading(value) {
    this.loading = value;
    this.render();
  }

  render() {
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
        button {
          border: 0;
          border-radius: calc(var(--ui-radius, 18px) - 8px);
          padding: 12px;
          background: var(--ui-secondary, #0d7a72);
          color: var(--ui-on-primary, #fff);
          font-weight: 700;
          cursor: pointer;
        }
        .google {
          background: #ffffff;
          color: var(--ui-text, #1e1a14);
          border: 1px solid var(--ui-border, #d9cdb8);
        }
        button:disabled { opacity: 0.65; cursor: not-allowed; }
      </style>
      <form id="form">
        <label>Correo
          <input type="email" name="email" required autocomplete="email" />
        </label>
        <label>Contrasena
          <input type="password" name="password" required autocomplete="current-password" />
        </label>
        <button ${this.loading ? 'disabled' : ''} type="submit">${this.loading ? 'Entrando...' : 'Iniciar sesion'}</button>
        <button class="google" id="google-login" type="button">Continuar con Google</button>
      </form>
    `;

    this.shadowRoot.querySelector('#form').addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') || '').trim();
      const password = String(formData.get('password') || '');
      this.dispatchEvent(
        new CustomEvent('login-submit', {
          bubbles: true,
          composed: true,
          detail: { email, password }
        })
      );
    });

    this.shadowRoot.querySelector('#google-login').addEventListener('click', () => {
      window.location.href = '/api/v1/auth/google/start';
    });
  }
}

customElements.define('login-form', LoginForm);
