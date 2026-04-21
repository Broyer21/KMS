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

  extractFileName(contentDisposition, fallbackName) {
    const raw = String(contentDisposition || '');
    const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1].replace(/"/g, '').trim());
      } catch {
        return utf8Match[1].replace(/"/g, '').trim();
      }
    }

    const quotedMatch = raw.match(/filename="([^"]+)"/i);
    if (quotedMatch && quotedMatch[1]) return quotedMatch[1].trim();

    const plainMatch = raw.match(/filename=([^;]+)/i);
    if (plainMatch && plainMatch[1]) return plainMatch[1].replace(/"/g, '').trim();

    return fallbackName;
  }

  triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
          <p>La descarga incluye el instalador local y un perfil para conectarlo a este mismo servidor en linea.</p>
          <div class="actions">
            <button id="download">Descargar instalador local</button>
            <button id="logout">Cerrar sesion</button>
          </div>
          <p id="status" class="status"></p>
        </article>
      </section>
    `;

    const statusEl = this.shadowRoot.querySelector('#status');
    this.shadowRoot.querySelector('#download').addEventListener('click', async () => {
      statusEl.textContent = 'Preparando instalador y perfil de conexion...';
      try {
        const response = await fetch('/api/v1/app/download', { method: 'GET' });
        if (!response.ok) {
          statusEl.textContent = 'No hay ejecutable disponible para descargar.';
          return;
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          const payload = await response.json();
          if (payload?.downloadUrl) {
            const directLink = document.createElement('a');
            directLink.href = payload.downloadUrl;
            directLink.target = '_blank';
            directLink.rel = 'noopener';
            document.body.appendChild(directLink);
            directLink.click();
            directLink.remove();
          } else {
            statusEl.textContent = 'No hay ejecutable disponible para descargar.';
            return;
          }
        } else {
          const blob = await response.blob();
          const installerName = this.extractFileName(
            response.headers.get('content-disposition'),
            'MetatinisSetup.exe'
          );
          this.triggerDownload(blob, installerName);
        }

        const profileResponse = await fetch('/api/v1/app/download-profile', { method: 'GET' });
        if (profileResponse.ok) {
          const profileBlob = await profileResponse.blob();
          const profileName = this.extractFileName(
            profileResponse.headers.get('content-disposition'),
            'kms-connection-profile.json'
          );
          this.triggerDownload(profileBlob, profileName);
          statusEl.textContent = 'Descarga iniciada: instalador + perfil de conexion.';
          return;
        }

        statusEl.textContent = 'Instalador descargado. No se pudo descargar el perfil de conexion.';
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
