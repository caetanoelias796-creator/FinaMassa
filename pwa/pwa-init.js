/* ==========================================================================
   PWA Master Initializer - Fina Massa Pizzaria
   ========================================================================== */

(function () {
  'use strict';

  // 1. REGISTRO IMEDIATO DO SERVICE WORKER (Não depende de outros scripts)
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    // Listener global para controllerchange: recarrega a página assim que o novo SW assumir o controle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[PWA Init] Novo Service Worker assumiu o controle. Atualizando aplicação...');
      window.location.reload();
    });

    const startSW = () => {
      navigator.serviceWorker
        .register('./sw.js', { scope: './', updateViaCache: 'none' })
        .then((registration) => {
          console.log('[PWA Init] Service Worker registrado. Scope:', registration.scope);

          // Força verificação imediata de nova versão no servidor
          if (typeof registration.update === 'function') {
            registration.update().catch(() => {});
          }

          // Inicializa o Update Manager se já carregado
          if (window.PWAUpdateManager) {
            window.PWAUpdateManager.init(registration);
          } else {
            window._pendingSWRegistration = registration;
          }

          // Re-checa quando o app for reaberto ou a aba ganhar foco
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          });

          window.addEventListener('pageshow', () => {
            registration.update().catch(() => {});
          });
        })
        .catch((err) => {
          console.warn('[PWA Init] Falha no registro do Service Worker:', err);
        });
    };

    // Executa imediatamente
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startSW);
    } else {
      startSW();
    }
  }

  // 2. CARREGAMENTO DOS MÓDULOS AUXILIARES (Config, Cache, Banners, Splash)
  function loadScript(src, callback) {
    if (document.querySelector(`script[src="${src}"]`)) {
      if (callback) callback();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = callback;
    script.onerror = function (e) {
      console.warn('[PWA Init] Falha ao carregar script auxiliar:', src, e);
    };
    document.head.appendChild(script);
  }

  function initUIModules() {
    if (window.PWASplashScreen) {
      window.PWASplashScreen.init();
    }
    if (window.PWAInstallManager) {
      window.PWAInstallManager.init();
    }
    if (window.PWAUpdateManager && window._pendingSWRegistration) {
      window.PWAUpdateManager.init(window._pendingSWRegistration);
    }
  }

  let pwaBase = 'pwa/';
  const initScript = document.querySelector('script[src*="pwa-init.js"]');
  if (initScript) {
    const src = initScript.getAttribute('src');
    pwaBase = src.substring(0, src.lastIndexOf('/') + 1);
  }

  loadScript(pwaBase + 'config.js', function () {
    loadScript(pwaBase + 'cacheManager.js', function () {
      loadScript(pwaBase + 'updateManager.js', function () {
        loadScript(pwaBase + 'installManager.js', function () {
          loadScript(pwaBase + 'splashScreen.js', function () {
            initUIModules();
          });
        });
      });
    });
  });

})();
