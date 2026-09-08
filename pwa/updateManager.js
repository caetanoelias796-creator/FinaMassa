/* ==========================================================================
   Update Manager - Fina Massa Pizzaria PWA
   ========================================================================== */

window.PWAUpdateManager = {
  registration: null,
  refreshing: false,

  init: function (registration) {
    if (!registration) return;
    this.registration = registration;
    this.listenForUpdates();
    this.listenForControllerChange();
  },

  listenForUpdates: function () {
    const reg = this.registration;
    if (!reg) return;

    // Força checagem de atualização no servidor no carregamento
    if (typeof reg.update === 'function') {
      reg.update().catch(() => {});
    }

    // Se já houver um Service Worker aguardando ativação (waiting)
    if (reg.waiting) {
      this.showUpdateBanner(reg.waiting);
      return;
    }

    // Monitora quando um novo Service Worker for encontrado
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // Se o novo worker foi instalado com sucesso e já havia um controlador anterior
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.showUpdateBanner(newWorker);
        }
      });
    });
  },

  listenForControllerChange: function () {
    // Quando o controlador mudar (novo SW assumiu o controle), recarrega a página de forma segura
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.refreshing) return;
      this.refreshing = true;
      console.log('[UpdateManager] Novo controlador ativado com sucesso. Recarregando página para nova versão...');
      window.location.reload();
    });
  },

  showUpdateBanner: function (worker) {
    if (document.getElementById('pwa-update-banner')) return;

    const bannerHtml = `
      <div id="pwa-update-banner" style="
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #18181c;
        border: 1.5px solid #fb8500;
        color: #ffffff;
        padding: 16px 20px;
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.7);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        max-width: 92%;
        width: 440px;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
        animation: pwaSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      ">
        <style>
          @keyframes pwaSlideUp {
            from { opacity: 0; transform: translate(-50%, 40px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        </style>
        <div style="font-size: 26px; line-height: 1; display: flex; align-items: center;">🎉</div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 14px; color: #ffffff; margin-bottom: 2px;">Nova versão disponível!</div>
          <div style="font-size: 12px; color: #d4d4d8; line-height: 1.3;">Atualizamos o nosso cardápio para você.</div>
        </div>
        <div>
          <button id="pwa-btn-update-now" style="
            background: linear-gradient(135deg, #fb8500 0%, #ffb703 100%);
            color: #0c0c0e;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 12px rgba(251, 133, 0, 0.4);
            white-space: nowrap;
            transition: transform 0.15s, filter 0.15s;
          ">🔄 ATUALIZAR AGORA</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', bannerHtml);

    const updateBtn = document.getElementById('pwa-btn-update-now');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        updateBtn.disabled = true;
        updateBtn.style.opacity = '0.7';
        updateBtn.innerText = 'ATUALIZANDO...';

        const targetWorker = worker || (this.registration && this.registration.waiting);

        // 1. Envia comando SKIP_WAITING ao Worker
        if (targetWorker) {
          targetWorker.postMessage({ type: 'SKIP_WAITING' });
        }

        // 2. Fallback de recarregamento caso controllerchange não dispare em 1.5s
        setTimeout(() => {
          if (!this.refreshing) {
            this.refreshing = true;
            window.location.reload();
          }
        }, 1500);
      });
    }
  }
};

