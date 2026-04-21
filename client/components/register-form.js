class RegisterForm extends HTMLElement {
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
              background: var(--ui-primary, #cc5b2a);
          color: var(--ui-on-primary, #fff);
          font-weight: 700;
          cursor: pointer;
        }
        button:disabled { opacity: 0.65; cursor: not-allowed; }
      </style>
      <form id="form">
        <label>Correo
          <input type="email" name="email" required autocomplete="email" />
        </label>
        <label>Contrasena
          <input type="password" name="password" required minlength="8" autocomplete="new-password" />
        </label>
        <label>Confirmar contrasena
          <input type="password" name="passwordConfirm" required minlength="8" autocomplete="new-password" />
        </label>
        <button ${this.loading ? 'disabled' : ''} type="submit">${this.loading ? 'Creando...' : 'Crear cuenta'}</button>
      </form>
    `;

    this.shadowRoot.querySelector('#form').addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') || '').trim();
      const password = String(formData.get('password') || '');
      const passwordConfirm = String(formData.get('passwordConfirm') || '');
      this.dispatchEvent(
        new CustomEvent('register-submit', {
          bubbles: true,
          composed: true,
          detail: { email, password, passwordConfirm }
        })
      );
    });
  }
}

customElements.define('register-form', RegisterForm);
