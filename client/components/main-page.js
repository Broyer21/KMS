import { authApi } from '../services/auth-api.js';

class MainPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.email = '';
  }

  connectedCallback() {
    this.email = this.getAttribute('email') || '';
    this.render();
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
          width: min(640px, 100%);
          background: var(--ui-surface, #fffdf9);
          border: 1px solid var(--ui-border, #dfd1bc);
          border-radius: var(--ui-radius, 18px);
          padding: 28px;
          box-shadow: var(--ui-shadow, 0 12px 40px rgba(60, 37, 20, 0.12));
        }
        h1 { margin: 0 0 8px; color: var(--ui-text, #1e1a14); }
        p { margin: 0 0 16px; color: var(--ui-muted, #6f6557); }
        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        button {
          border: 0;
          border-radius: calc(var(--ui-radius, 18px) - 8px);
          padding: 10px 14px;
          background: var(--ui-text, #1e1a14);
          color: var(--ui-on-primary, #fff);
          font-weight: 700;
          cursor: pointer;
        }
        #download {
          background: var(--ui-secondary, #0d7a72);
        }
        .status {
          margin-top: 10px;
          color: var(--ui-muted, #6f6557);
          font-size: 0.92rem;
        }
      </style>
      <section class="wrap">
        <article class="panel">
          <h1>Home principal</h1>
          <p>Sesion iniciada como <strong>${this.email}</strong>.</p>
          <p>Esta es la pantalla placeholder que luego reemplazaremos con la logica principal.</p>
          <div class="actions">
            <button id="download">Descargar aplicacion</button>
            <button id="logout">Cerrar sesion</button>
          </div>
          <p id="status" class="status"></p>
        </article>
      </section>
    `;

    const statusEl = this.shadowRoot.querySelector('#status');
    this.shadowRoot.querySelector('#download').addEventListener('click', async () => {
      statusEl.textContent = 'Preparando descarga...';
      try {
        const response = await fetch('/api/v1/app/download', { method: 'GET' });
        if (!response.ok) {
          statusEl.textContent = 'No hay ejecutable disponible para descargar.';
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'MetatinisSetup.exe';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        statusEl.textContent = 'Descarga iniciada.';
      } catch {
        statusEl.textContent = 'No se pudo iniciar la descarga.';
      }
    });

    this.shadowRoot.querySelector('#logout').addEventListener('click', async () => {
      await authApi.logout();
      this.dispatchEvent(new CustomEvent('session-ended', { bubbles: true, composed: true }));
    });
  }
}

customElements.define('main-page', MainPage);
