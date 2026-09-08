/* ==========================================================================
   Splash Screen - Fina Massa Pizzaria PWA
   ========================================================================== */

window.PWASplashScreen = {
  init: function () {
    // Exibe splash screen apenas se estiver no modo standalone ou no primeiro carregamento do PWA
    const isStandalone = window.PWAInstallManager && window.PWAInstallManager.isStandalone();
    
    // Se for standalone ou se a chave de indicação estiver ativa
    if (isStandalone && !sessionStorage.getItem('pwa_splash_shown')) {
      sessionStorage.setItem('pwa_splash_shown', 'true');
      this.showSplashScreen();
    }
  },

  showSplashScreen: function () {
    if (document.getElementById('pwa-splash-screen')) return;

    const splashHtml = `
      <div id="pwa-splash-screen" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: #0B0C0E;
        background: radial-gradient(circle at center, #181B22 0%, #0B0C0E 100%);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
        color: #ffffff;
        transition: opacity 0.5s ease-out, visibility 0.5s ease-out;
      ">
        <style>
          @keyframes pwaPulseLogo {
            0% { transform: scale(0.96); opacity: 0.9; }
            50% { transform: scale(1.04); opacity: 1; filter: drop-shadow(0 0 25px rgba(245, 166, 35, 0.65)); }
            100% { transform: scale(0.96); opacity: 0.9; }
          }
          @keyframes pwaSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        
        <img src="assets/logo.png" alt="Fina Massa Pizzaria" style="
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: contain;
          margin-bottom: 20px;
          border: 3px solid #F5A623;
          box-shadow: 0 4px 25px rgba(0, 0, 0, 0.6);
          animation: pwaPulseLogo 2.5s infinite ease-in-out;
        ">

        <h1 style="
          font-family: 'Outfit', sans-serif;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin: 0 0 6px 0;
          color: #F5A623;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
        ">Fina Massa Pizzaria</h1>
        
        <p style="
          font-size: 13px;
          color: #E2E4E9;
          margin: 0 0 32px 0;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: 600;
        ">Mais que Pizza, é Tradição!</p>

        <!-- Spinner Elegante Dourado -->
        <div style="
          width: 38px;
          height: 38px;
          border: 3px solid rgba(245, 166, 35, 0.2);
          border-top: 3px solid #F5A623;
          border-radius: 50%;
          animation: pwaSpin 0.8s linear infinite;
        "></div>
      </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', splashHtml);

    // Oculta a splash screen após a página carregar completamente
    const hide = () => {
      const splash = document.getElementById('pwa-splash-screen');
      if (splash) {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        setTimeout(() => splash.remove(), 500);
      }
    };

    if (document.readyState === 'complete') {
      setTimeout(hide, 800);
    } else {
      window.addEventListener('load', () => setTimeout(hide, 800));
    }
  }
};

