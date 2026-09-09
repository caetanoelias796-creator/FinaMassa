/* ==========================================================================
   Install Manager - Fina Massa Pizzaria PWA
   ========================================================================== */

window.PWAInstallManager = {
  deferredPrompt: null,

  // Verifica se o aplicativo já está rodando no modo standalone (instalado)
  isStandalone: function () {
    const isStandaloneMQ = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator.standalone === true;
    const isTWA = document.referrer && document.referrer.includes('android-app://');
    return isStandaloneMQ || isIOSStandalone || isTWA;
  },

  // Verifica se a plataforma é iOS (Safari)
  isIOS: function () {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
  },

  init: function () {
    // Se o aplicativo já estiver no modo instalado (standalone), não faz nada
    if (this.isStandalone()) {
      console.log('[PWA InstallManager] Aplicativo rodando no modo Standalone (Instalado).');
      this.hideAllInstallUI();
      return;
    }

    this.listenToInstallEvents();
    this.checkIOSGuidance();
  },

  listenToInstallEvents: function () {
    // Captura o evento nativo beforeinstallprompt do Chrome/Edge/Android/Desktop
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      // Se o usuário não optou por ocultar por 30 dias, exibe o modal elegante
      if (!window.PWA_CONFIG.isDismissed()) {
        // Exibe modal na primeira visita após pequeno delay para suavidade
        setTimeout(() => {
          this.showInstallModal();
        }, 1500);
      }

      // Exibe o botão de instalação flutuante/cabeçalho
      this.showInstallButton();
    });

    // Oculta tudo quando a instalação for concluída
    window.addEventListener('appinstalled', () => {
      console.log('[PWA InstallManager] PWA instalado com sucesso!');
      this.deferredPrompt = null;
      this.hideAllInstallUI();
    });
  },

  // Exibe o botão "📲 Instalar Aplicativo" no topo ou flutuante
  showInstallButton: function () {
    if (this.isStandalone()) return;
    if (window.location.pathname.includes('/painel') || window.location.pathname.endsWith('painel.html')) return;
    if (document.getElementById('pwa-header-install-btn')) return;

    // Procura por um contêiner no cabeçalho ou insere como botão flutuante elegante
    const header = document.querySelector('.header-top') || document.querySelector('.header-logo') || document.querySelector('.app-header') || document.querySelector('.admin-header');

    const btn = document.createElement('button');
    btn.id = 'pwa-header-install-btn';
    btn.innerHTML = '<span>📲 Instalar Aplicativo</span>';
    btn.style.cssText = `
      background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(229, 57, 53, 0.4);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: transform 0.2s, box-shadow 0.2s;
      margin-left: auto;
      z-index: 100;
      font-family: 'Outfit', sans-serif;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.03)';
      btn.style.boxShadow = '0 6px 16px rgba(229, 57, 53, 0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(229, 57, 53, 0.4)';
    });

    btn.addEventListener('click', () => {
      this.triggerNativeInstallPrompt();
    });

    if (header) {
      header.appendChild(btn);
    } else {
      // Fallback para botão flutuante se não encontrar cabeçalho
      btn.style.position = 'fixed';
      btn.style.top = '15px';
      btn.style.right = '15px';
      document.body.appendChild(btn);
    }
  },

  // Modal Elegante da Primeira Visita
  showInstallModal: function () {
    if (this.isStandalone()) return;
    if (window.location.pathname.includes('/painel') || window.location.pathname.endsWith('painel.html')) return;
    if (document.getElementById('pwa-install-modal')) return;

    const modalHtml = `
      <div id="pwa-install-modal" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(5px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: pwaFadeIn 0.3s ease-out forwards;
      ">
        <style>
          @keyframes pwaFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pwaPopUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        </style>
        <div style="
          background: #FFF9F2;
          border: 1px solid #E7DCCB;
          border-radius: 20px;
          max-width: 400px;
          width: 100%;
          padding: 28px 24px;
          background-color: #181B22;
          border: 1px solid rgba(245, 166, 35, 0.25);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
          text-align: center;
          font-family: 'Outfit', sans-serif;
          animation: pwaPopUp 0.3s ease-out forwards;
          color: #ffffff;
          position: relative;
        ">
          <img src="assets/logo.png" alt="Fina Massa Pizzaria Logo" style="
            width: 72px;
            height: 72px;
            border-radius: 50%;
            object-fit: contain;
            margin: 0 auto 16px auto;
            border: 2px solid #F5A623;
            box-shadow: 0 0 20px rgba(245, 166, 35, 0.4);
          ">

          <h3 style="
            font-family: 'Outfit', sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: #F5A623;
            margin: 0 0 10px 0;
          ">📱 Instale o aplicativo da Fina Massa Pizzaria</h3>

          <ul style="
            text-align: left;
            margin: 16px 0 24px 0;
            padding: 0 0 0 20px;
            color: #C7CAD1;
            font-size: 14px;
            line-height: 1.8;
          ">
            <li>🍕 Peça suas pizzas favoritas e calzones mais rápido.</li>
            <li>🎁 Receba promoções e novidades exclusivas.</li>
            <li>⚡ Tenha uma experiência ágil como app nativo no celular.</li>
          </ul>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="pwa-modal-btn-install" style="
              background: linear-gradient(135deg, #F5A623 0%, #D48806 100%);
              color: #0B0C0E;
              border: none;
              padding: 14px;
              border-radius: 12px;
              font-size: 15px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 4px 15px rgba(245, 166, 35, 0.35);
              transition: transform 0.15s;
            ">Instalar Agora</button>

            <button id="pwa-modal-btn-continue" style="
              background: transparent;
              color: #A0A5B1;
              border: 1px solid rgba(255, 255, 255, 0.15);
              padding: 12px;
              border-radius: 12px;
              font-size: 14px;
              cursor: pointer;
              transition: color 0.15s;
            ">Continuar no Navegador</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('pwa-modal-btn-install').addEventListener('click', () => {
      this.closeModal();
      this.triggerNativeInstallPrompt();
    });

    document.getElementById('pwa-modal-btn-continue').addEventListener('click', () => {
      window.PWA_CONFIG.setDismissed();
      this.closeModal();
    });
  },

  closeModal: function () {
    const modal = document.getElementById('pwa-install-modal');
    if (modal) modal.remove();
  },

  triggerNativeInstallPrompt: function () {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA InstallManager] Usuário aceitou a instalação.');
        } else {
          console.log('[PWA InstallManager] Usuário recusou a instalação.');
        }
        this.deferredPrompt = null;
      });
    } else if (this.isIOS()) {
      this.showIOSInstructionsModal();
    } else {
      alert('Para instalar o aplicativo do Fina Massa Pizzaria, utilize a opção "Adicionar à Tela Inicial" ou "Instalar Aplicativo" nas opções do seu navegador.');
    }
  },

  // Instruções de Instalação para iPhone / iOS Safari
  checkIOSGuidance: function () {
    if (this.isIOS() && !this.isStandalone() && !window.PWA_CONFIG.isDismissed()) {
      setTimeout(() => {
        this.showIOSInstructionsModal();
      }, 2000);
    }
  },

  showIOSInstructionsModal: function () {
    if (document.getElementById('pwa-ios-instructions')) return;

    const iosHtml = `
      <div id="pwa-ios-instructions" style="
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #18181b;
        border: 1px solid #e53935;
        color: #ffffff;
        padding: 18px 20px;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.7);
        z-index: 999999;
        max-width: 90%;
        width: 380px;
        font-family: 'Outfit', sans-serif;
        text-align: center;
        animation: pwaSlideUp 0.4s ease-out forwards;
      ">
        <div style="font-size: 20px; margin-bottom: 8px;">📲 Instale no seu iPhone</div>
        <div style="font-size: 13px; color: #d4d4d8; line-height: 1.5; margin-bottom: 14px;">
          Toque no botão <strong>Compartilhar</strong> <span style="font-size: 16px;">📤</span> na barra do Safari e selecione <strong>'Adicionar à Tela de Início'</strong> <span style="font-size: 16px;">➕</span>.
        </div>
        <button id="pwa-ios-btn-close" style="
          background: #e53935;
          color: #ffffff;
          border: none;
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        ">Entendi</button>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', iosHtml);

    document.getElementById('pwa-ios-btn-close').addEventListener('click', () => {
      window.PWA_CONFIG.setDismissed();
      const el = document.getElementById('pwa-ios-instructions');
      if (el) el.remove();
    });
  },

  hideAllInstallUI: function () {
    this.closeModal();
    const btn = document.getElementById('pwa-header-install-btn');
    if (btn) btn.remove();
    const ios = document.getElementById('pwa-ios-instructions');
    if (ios) ios.remove();
  }
};

