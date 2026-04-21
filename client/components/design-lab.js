class DesignLab extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.storageKey = 'metatinis_theme_mode_v1';
    this.customColorsKey = 'metatinis_custom_colors_v1';
    this.mode = 'auto';
    this.autoEveryMs = 15000;
    this.franticDurationMs = 3000;
    this.maxCycles = 5;
    this.completedCycles = 0;
    this.autoIntervalId = null;
    this.countdownIntervalId = null;
    this.franticIntervalId = null;
    this.franticTimeoutId = null;
    this.nextCycleAt = 0;
    this.franticEndsAt = 0;
    this.runningCycle = false;
    this.customColors = {};

    this.colorTokens = [
      { token: '--ui-surface', label: 'Paneles' },
      { token: '--ui-border', label: 'Bordes' },
      { token: '--ui-text', label: 'Texto principal' },
      { token: '--ui-muted', label: 'Texto secundario' },
      { token: '--ui-primary', label: 'Boton primario' },
      { token: '--ui-secondary', label: 'Boton secundario' },
      { token: '--ui-on-primary', label: 'Texto en botones' },
      { token: '--ui-info-bg', label: 'Fondo info' },
      { token: '--ui-info-text', label: 'Texto info' },
      { token: '--ui-error-bg', label: 'Fondo error' },
      { token: '--ui-error-text', label: 'Texto error' },
      { token: '--ui-success-bg', label: 'Fondo exito' },
      { token: '--ui-success-text', label: 'Texto exito' }
    ];

    this.themes = {
      original: {
        '--ui-bg-a': 'radial-gradient(circle at 20% 10%, #fffaf1 0%, transparent 45%)',
        '--ui-bg-b': 'radial-gradient(circle at 80% 90%, #d8efe8 0%, transparent 40%)',
        '--ui-bg-c': 'linear-gradient(160deg, #16003a, #000000)',
        '--ui-surface': '#fffdf9',
        '--ui-border': '#dfd1bc',
        '--ui-text': '#1e1a14',
        '--ui-muted': '#6f6557',
        '--ui-primary': '#cc5b2a',
        '--ui-secondary': '#0d7a72',
        '--ui-on-primary': '#ffffff',
        '--ui-info-text': '#1f3b58',
        '--ui-error-text': '#7c1f1a',
        '--ui-success-text': '#134b2f',
        '--ui-info-bg': '#edf5ff',
        '--ui-error-bg': '#fdebea',
        '--ui-success-bg': '#e9f7ef',
        '--ui-radius': '18px',
        '--ui-shadow': '0 12px 40px rgba(60, 37, 20, 0.12)'
      },
      lightGlass: {
        '--ui-bg-a': 'radial-gradient(circle at 8% 0%, rgba(255, 255, 255, 0.95) 0%, transparent 50%)',
        '--ui-bg-b': 'radial-gradient(circle at 95% 100%, rgba(203, 240, 255, 0.45) 0%, transparent 42%)',
        '--ui-bg-c': 'linear-gradient(160deg, #e6edf4, #f8fbff)',
        '--ui-surface': 'rgba(255, 255, 255, 0.56)',
        '--ui-border': 'rgba(255, 255, 255, 0.75)',
        '--ui-text': '#101623',
        '--ui-muted': '#556178',
        '--ui-primary': '#2d6cff',
        '--ui-secondary': '#0c9c90',
        '--ui-on-primary': '#ffffff',
        '--ui-info-text': '#113c65',
        '--ui-error-text': '#7c1f1a',
        '--ui-success-text': '#125233',
        '--ui-info-bg': 'rgba(210, 233, 255, 0.7)',
        '--ui-error-bg': 'rgba(255, 228, 228, 0.72)',
        '--ui-success-bg': 'rgba(218, 248, 231, 0.7)',
        '--ui-radius': '20px',
        '--ui-shadow': '0 24px 48px rgba(12, 26, 44, 0.14)'
      },
      darkGlass: {
        '--ui-bg-a': 'radial-gradient(circle at 8% 0%, rgba(76, 94, 130, 0.38) 0%, transparent 48%)',
        '--ui-bg-b': 'radial-gradient(circle at 95% 100%, rgba(33, 194, 171, 0.24) 0%, transparent 40%)',
        '--ui-bg-c': 'linear-gradient(155deg, #05070d, #0d1320)',
        '--ui-surface': 'rgba(20, 27, 42, 0.6)',
        '--ui-border': 'rgba(150, 170, 210, 0.3)',
        '--ui-text': '#e8edf8',
        '--ui-muted': '#a5b2cb',
        '--ui-primary': '#53a4ff',
        '--ui-secondary': '#2ad1bf',
        '--ui-on-primary': '#06111f',
        '--ui-info-text': '#d5e8ff',
        '--ui-error-text': '#ffd0d0',
        '--ui-success-text': '#d4ffe4',
        '--ui-info-bg': 'rgba(59, 88, 125, 0.55)',
        '--ui-error-bg': 'rgba(117, 47, 47, 0.5)',
        '--ui-success-bg': 'rgba(36, 102, 74, 0.52)',
        '--ui-radius': '20px',
        '--ui-shadow': '0 24px 54px rgba(0, 0, 0, 0.42)'
      }
    };
  }

  connectedCallback() {
    this.loadState();
    if (this.mode === 'light') {
      this.activateFixedMode('light');
      return;
    }
    if (this.mode === 'dark') {
      this.activateFixedMode('dark');
      return;
    }
    this.activateAutoMode({ resetCycles: false });
  }

  disconnectedCallback() {
    this.stopAllTimers();
  }

  stopAllTimers() {
    if (this.autoIntervalId) {
      clearInterval(this.autoIntervalId);
      this.autoIntervalId = null;
    }
    if (this.franticIntervalId) {
      clearInterval(this.franticIntervalId);
      this.franticIntervalId = null;
    }
    if (this.franticTimeoutId) {
      clearTimeout(this.franticTimeoutId);
      this.franticTimeoutId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.nextCycleAt = 0;
    this.franticEndsAt = 0;
    this.runningCycle = false;
  }

  loadState() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      const parsedMode = String(parsed.mode || 'auto');
      if (['auto', 'light', 'dark'].includes(parsedMode)) {
        this.mode = parsedMode;
      }

      const intervalMs = Number.parseInt(parsed.autoEveryMs, 10);
      const franticMs = Number.parseInt(parsed.franticDurationMs, 10);
      const maxCycles = Number.parseInt(parsed.maxCycles, 10);

      if (!Number.isNaN(intervalMs)) {
        this.autoEveryMs = Math.min(120000, Math.max(5000, intervalMs));
      }
      if (!Number.isNaN(franticMs)) {
        this.franticDurationMs = Math.min(12000, Math.max(1000, franticMs));
      }
      if (!Number.isNaN(maxCycles)) {
        this.maxCycles = Math.min(30, Math.max(1, maxCycles));
      }
    } catch {
      // Ignore malformed localStorage state.
    }

    try {
      const rawCustom = window.localStorage.getItem(this.customColorsKey);
      if (!rawCustom) return;
      const parsedCustom = JSON.parse(rawCustom);
      if (!parsedCustom || typeof parsedCustom !== 'object') return;
      this.customColors = Object.fromEntries(
        Object.entries(parsedCustom).filter((entry) => /^#[0-9a-fA-F]{6}$/.test(String(entry[1] || '')))
      );
    } catch {
      this.customColors = {};
    }
  }

  saveState() {
    const state = {
      mode: this.mode,
      autoEveryMs: this.autoEveryMs,
      franticDurationMs: this.franticDurationMs,
      maxCycles: this.maxCycles
    };
    window.localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  saveCustomColors() {
    window.localStorage.setItem(this.customColorsKey, JSON.stringify(this.customColors));
  }

  applyCustomColors() {
    Object.entries(this.customColors).forEach(([token, value]) => {
      document.documentElement.style.setProperty(token, value);
    });
  }

  setCustomColor(token, value) {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
    this.customColors[token] = value;
    document.documentElement.style.setProperty(token, value);
    this.saveCustomColors();
  }

  clearCustomColors() {
    this.customColors = {};
    this.saveCustomColors();
    if (this.mode === 'light') this.applyTheme('lightGlass');
    if (this.mode === 'dark') this.applyTheme('darkGlass');
    if (this.mode === 'auto') this.applyTheme('original');
    this.render();
  }

  startCountdownTicker() {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
    }
    this.countdownIntervalId = setInterval(() => this.refreshDynamicText(), 250);
  }

  getSecondsUntil(timestamp) {
    if (!timestamp) return 0;
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  }

  getAutoButtonHint() {
    if (this.mode !== 'auto') {
      return 'Tras 5 repeticiones se detiene y vuelve al original.';
    }

    if (this.completedCycles >= this.maxCycles) {
      return 'Ciclo finalizado. Interfaz estable en tema original.';
    }

    if (this.runningCycle) {
      const remaining = this.getSecondsUntil(this.franticEndsAt);
      return `Glitch activo. Quedan ${remaining}s para pasar a oscuro.`;
    }

    const next = this.getSecondsUntil(this.nextCycleAt);
    return `Siguiente evento en ${next}s. Tras ${this.maxCycles} ciclos vuelve al original.`;
  }

  refreshDynamicText() {
    const autoHint = this.shadowRoot.querySelector('#autoHint');
    if (autoHint) {
      autoHint.textContent = this.getAutoButtonHint();
    }

    const statusEl = this.shadowRoot.querySelector('#statusText');
    if (statusEl) {
      statusEl.textContent = this.getStatusText();
    }
  }

  applyTheme(name) {
    const theme = this.themes[name];
    if (!theme) return;
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    this.applyCustomColors();
  }

  randomHexColor() {
    const value = Math.floor(Math.random() * 0xffffff);
    return `#${value.toString(16).padStart(6, '0')}`;
  }

  startFranticText() {
    const htmlEl = document.documentElement;
    htmlEl.classList.add('frantic-text');
    this.franticEndsAt = Date.now() + this.franticDurationMs;

    this.franticIntervalId = setInterval(() => {
      const randomColor = this.randomHexColor();
      const randomMuted = this.randomHexColor();
      document.documentElement.style.setProperty('--ui-text', randomColor);
      document.documentElement.style.setProperty('--ui-muted', randomMuted);
      document.documentElement.style.setProperty('--ui-on-primary', randomColor);
      document.documentElement.style.setProperty('--ui-info-text', randomColor);
      document.documentElement.style.setProperty('--ui-error-text', randomColor);
      document.documentElement.style.setProperty('--ui-success-text', randomColor);
    }, 70);

    this.franticTimeoutId = setTimeout(() => {
      if (this.franticIntervalId) {
        clearInterval(this.franticIntervalId);
        this.franticIntervalId = null;
      }
      this.franticTimeoutId = null;
      htmlEl.classList.remove('frantic-text');
      this.applyTheme('darkGlass');
      this.completedCycles += 1;
      this.runningCycle = false;
      this.franticEndsAt = 0;

      if (this.mode === 'auto' && this.completedCycles >= this.maxCycles) {
        if (this.autoIntervalId) {
          clearInterval(this.autoIntervalId);
          this.autoIntervalId = null;
        }
        if (this.countdownIntervalId) {
          clearInterval(this.countdownIntervalId);
          this.countdownIntervalId = null;
        }
        this.nextCycleAt = 0;
        this.applyTheme('original');
      } else if (this.mode === 'auto') {
        this.nextCycleAt = Date.now() + this.autoEveryMs;
      }

      this.refreshDynamicText();
      this.render();
    }, this.franticDurationMs);
  }

  runAutoCycle() {
    if (this.mode !== 'auto') return;
    if (this.runningCycle) return;
    if (this.completedCycles >= this.maxCycles) return;
    this.runningCycle = true;
    this.nextCycleAt = 0;
    this.startFranticText();
    this.refreshDynamicText();
    this.render();
  }

  startAutoLoop({ resetCycles }) {
    if (this.autoIntervalId) {
      clearInterval(this.autoIntervalId);
      this.autoIntervalId = null;
    }
    if (this.franticIntervalId) {
      clearInterval(this.franticIntervalId);
      this.franticIntervalId = null;
    }
    if (this.franticTimeoutId) {
      clearTimeout(this.franticTimeoutId);
      this.franticTimeoutId = null;
    }
    this.franticEndsAt = 0;
    this.runningCycle = false;
    this.mode = 'auto';
    if (resetCycles || this.completedCycles >= this.maxCycles) {
      this.completedCycles = 0;
    }
    this.applyTheme('original');
    this.nextCycleAt = Date.now() + this.autoEveryMs;
    this.autoIntervalId = setInterval(() => this.runAutoCycle(), this.autoEveryMs);
    this.startCountdownTicker();
    this.refreshDynamicText();
    this.render();
  }

  activateAutoMode(options = {}) {
    const { resetCycles = true } = options;
    this.startAutoLoop({ resetCycles });
    this.saveState();
  }

  activateFixedMode(modeName) {
    this.stopAllTimers();
    this.mode = modeName;
    if (modeName === 'light') this.applyTheme('lightGlass');
    if (modeName === 'dark') this.applyTheme('darkGlass');
    this.saveState();
    this.render();
  }

  applyAutomationSettings() {
    const intervalInput = this.shadowRoot.querySelector('#cfgInterval');
    const franticInput = this.shadowRoot.querySelector('#cfgFrantic');
    const maxCyclesInput = this.shadowRoot.querySelector('#cfgCycles');

    const intervalSeconds = Number.parseInt(intervalInput.value, 10);
    const franticSeconds = Number.parseInt(franticInput.value, 10);
    const maxCycles = Number.parseInt(maxCyclesInput.value, 10);

    const safeIntervalSeconds = Number.isNaN(intervalSeconds) ? 15 : Math.min(120, Math.max(5, intervalSeconds));
    const safeFranticSeconds = Number.isNaN(franticSeconds) ? 3 : Math.min(12, Math.max(1, franticSeconds));
    const safeMaxCycles = Number.isNaN(maxCycles) ? 5 : Math.min(30, Math.max(1, maxCycles));

    this.autoEveryMs = safeIntervalSeconds * 1000;
    this.franticDurationMs = safeFranticSeconds * 1000;
    this.maxCycles = safeMaxCycles;

    if (this.completedCycles > this.maxCycles) {
      this.completedCycles = this.maxCycles;
    }

    if (this.mode === 'auto') {
      this.startAutoLoop({ resetCycles: false });
    } else {
      this.render();
    }
    this.saveState();
  }

  getStatusText() {
    const autoDone = this.mode === 'auto' && this.completedCycles >= this.maxCycles;
    if (this.mode === 'auto') {
      if (autoDone) return 'Auto finalizado: tema original estable.';
      return `Auto activo: ${this.completedCycles}/${this.maxCycles} ciclos completados.`;
    }
    if (this.mode === 'light') return 'Modo claro fijo (sin ciclo).';
    return 'Modo oscuro fijo (sin ciclo).';
  }

  render() {
    const statusText = this.getStatusText();
    const autoHint = this.getAutoButtonHint();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 9999;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        }

        .stack {
          display: grid;
          gap: 8px;
          width: min(280px, 72vw);
        }

        button {
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 12px;
          min-height: 44px;
          padding: 10px 12px;
          text-align: left;
          cursor: pointer;
          font-weight: 700;
          color: #ffffff;
          backdrop-filter: blur(8px);
          background: rgba(19, 27, 42, 0.72);
          box-shadow: 0 10px 22px rgba(3, 7, 16, 0.35);
        }

        button:hover {
          transform: translateY(-1px);
        }

        button.active {
          border-color: rgba(105, 186, 255, 0.95);
          box-shadow: 0 0 0 2px rgba(105, 186, 255, 0.26), 0 14px 28px rgba(3, 7, 16, 0.45);
        }

        .status {
          margin: 2px 0 0;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 0.78rem;
          color: #d9e4f7;
          background: rgba(5, 12, 24, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.35);
        }

        .config {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: rgba(5, 12, 24, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.35);
          display: grid;
          gap: 7px;
        }

        .config h3 {
          margin: 0;
          font-size: 0.8rem;
          color: #e2ebfa;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 74px;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #c3d2ec;
        }

        .grid input {
          width: 100%;
          border-radius: 8px;
          border: 1px solid rgba(200, 214, 236, 0.32);
          background: rgba(8, 18, 34, 0.8);
          color: #f2f7ff;
          padding: 6px;
        }

        .apply {
          border-radius: 8px;
          border: 1px solid rgba(120, 185, 255, 0.85);
          background: rgba(38, 104, 179, 0.88);
          color: #ffffff;
          min-height: 34px;
          padding: 6px 8px;
          font-size: 0.75rem;
          text-align: center;
        }

        .hint {
          display: block;
          margin-top: 2px;
          font-size: 0.75rem;
          opacity: 0.86;
          font-weight: 500;
        }

        .palette {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: rgba(5, 12, 24, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.35);
          display: grid;
          gap: 7px;
        }

        .palette h3 {
          margin: 0;
          font-size: 0.8rem;
          color: #e2ebfa;
        }

        .palette .row {
          display: grid;
          grid-template-columns: 1fr 56px;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          color: #c3d2ec;
        }

        .palette input[type="color"] {
          width: 100%;
          height: 30px;
          border-radius: 8px;
          border: 1px solid rgba(200, 214, 236, 0.32);
          background: rgba(8, 18, 34, 0.8);
          padding: 2px;
          cursor: pointer;
        }

        .palette .reset {
          border-radius: 8px;
          border: 1px solid rgba(244, 114, 182, 0.85);
          background: rgba(168, 49, 106, 0.88);
          color: #ffffff;
          min-height: 34px;
          padding: 6px 8px;
          font-size: 0.75rem;
          text-align: center;
        }
      </style>

      <section class="stack">
        <button id="auto" class="${this.mode === 'auto' ? 'active' : ''}">
          Modo ciclo (15s + glitch + oscuro)
          <span class="hint" id="autoHint">${autoHint}</span>
        </button>
        <button id="light" class="${this.mode === 'light' ? 'active' : ''}">
          Modo claro fijo (glass)
          <span class="hint">Minimalista translúcido, sin cambios automáticos.</span>
        </button>
        <button id="dark" class="${this.mode === 'dark' ? 'active' : ''}">
          Modo oscuro fijo (glass)
          <span class="hint">Oscuro translúcido, sin cambios automáticos.</span>
        </button>
        <section class="config">
          <h3>Controles de automatizacion</h3>
          <label class="grid">
            <span>Evento cada (s)</span>
            <input id="cfgInterval" type="number" min="5" max="120" step="1" value="${Math.round(this.autoEveryMs / 1000)}" />
          </label>
          <label class="grid">
            <span>Duracion glitch (s)</span>
            <input id="cfgFrantic" type="number" min="1" max="12" step="1" value="${Math.round(this.franticDurationMs / 1000)}" />
          </label>
          <label class="grid">
            <span>Maximo de ciclos</span>
            <input id="cfgCycles" type="number" min="1" max="30" step="1" value="${this.maxCycles}" />
          </label>
          <button id="applyCfg" class="apply">Aplicar</button>
        </section>
        <section class="palette">
          <h3>Editor de colores por objeto</h3>
          ${this.colorTokens
            .map((item) => {
              const value = this.customColors[item.token] || this.themes.original[item.token] || '#ffffff';
              const safeId = item.token.replace(/[^a-z0-9]/gi, '');
              return `
                <label class="row" for="${safeId}">
                  <span>${item.label}</span>
                  <input id="${safeId}" type="color" data-token="${item.token}" value="${value}" />
                </label>
              `;
            })
            .join('')}
          <button id="resetPalette" class="reset">Restablecer colores</button>
        </section>
        <p class="status" id="statusText">${statusText}</p>
      </section>
    `;

    this.shadowRoot.querySelector('#auto').addEventListener('click', () => this.activateAutoMode({ resetCycles: true }));
    this.shadowRoot.querySelector('#light').addEventListener('click', () => this.activateFixedMode('light'));
    this.shadowRoot.querySelector('#dark').addEventListener('click', () => this.activateFixedMode('dark'));
    this.shadowRoot.querySelector('#applyCfg').addEventListener('click', () => this.applyAutomationSettings());
    this.shadowRoot.querySelector('#resetPalette').addEventListener('click', () => this.clearCustomColors());
    this.shadowRoot.querySelectorAll('input[type="color"][data-token]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const token = String(event.currentTarget.getAttribute('data-token') || '');
        const color = String(event.currentTarget.value || '');
        this.setCustomColor(token, color);
      });
    });
    this.refreshDynamicText();
  }
}

customElements.define('design-lab', DesignLab);
