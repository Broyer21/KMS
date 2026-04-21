import { authApi } from './services/auth-api.js';
import './components/auth-shell.js';
import './components/main-page.js';

class AppRoot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.session = null;
    this.loading = true;
  }

  connectedCallback() {
    this.bootstrap();
  }

  async bootstrap() {
    try {
      const data = await authApi.getSession();
      this.session = data?.authenticated ? data.user : null;
    } catch {
      this.session = null;
    } finally {
      this.loading = false;
      this.render();
    }
  }

  render() {
    if (this.loading) {
      this.shadowRoot.innerHTML = '<p style="padding:24px">Cargando...</p>';
      return;
    }

    this.shadowRoot.innerHTML = '<div id="mount"></div>';
    const mount = this.shadowRoot.querySelector('#mount');

    if (this.session) {
      const page = document.createElement('main-page');
      page.setAttribute('email', this.session.email);
      page.addEventListener('session-ended', () => {
        this.session = null;
        this.render();
      });
      mount.appendChild(page);
      return;
    }

    const auth = document.createElement('auth-shell');
    auth.addEventListener('session-started', async () => {
      this.loading = true;
      this.render();
      await this.bootstrap();
    });
    mount.appendChild(auth);
  }
}

customElements.define('app-root', AppRoot);
