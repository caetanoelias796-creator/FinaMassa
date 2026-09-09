/* ==========================================================================
   PWA Config & Feature Flags - Fina Massa Pizzaria
   ========================================================================== */

window.PWA_CONFIG = {
  // Feature Flag Principal: permite ativar/desativar o PWA globalmente
  ENABLE_PWA: true,

  // Versão atual do PWA
  APP_VERSION: '2.6.0',
  CACHE_VERSION: 'fina-massa-v2.6.0',

  // Período de ocultamento do modal caso o usuário clique em "Continuar no Navegador" (em dias)
  DISMISS_DAYS: 30,

  // Chave de armazenamento no localStorage
  STORAGE_DISMISS_KEY: 'fina_massa_pwa_dismissed_until',

  // Função utilitária para verificar se a funcionalidade está ativada
  isEnabled: function () {
    return this.ENABLE_PWA && ('serviceWorker' in navigator);
  },

  // Verifica se o usuário optou por não ver o modal nos últimos 30 dias
  isDismissed: function () {
    try {
      const dismissedUntil = localStorage.getItem(this.STORAGE_DISMISS_KEY);
      if (!dismissedUntil) return false;
      return Date.now() < parseInt(dismissedUntil, 10);
    } catch (e) {
      return false;
    }
  },

  // Salva a preferência de ocultar o modal por 30 dias
  setDismissed: function () {
    try {
      const thirtyDaysInMs = this.DISMISS_DAYS * 24 * 60 * 60 * 1000;
      const until = Date.now() + thirtyDaysInMs;
      localStorage.setItem(this.STORAGE_DISMISS_KEY, until.toString());
    } catch (e) {
      console.warn('[PWA Config] Não foi possível salvar preferência:', e);
    }
  }
};
