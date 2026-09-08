/* ==========================================================================
   Cache Manager - Fina Massa Pizzaria PWA
   ========================================================================== */

window.PWACacheManager = {
  // Retorna informações sobre o status do cache estático
  getCacheInfo: async function () {
    if (!('caches' in window)) return null;
    try {
      const keys = await caches.keys();
      return {
        hasCache: keys.length > 0,
        cacheKeys: keys
      };
    } catch (e) {
      console.warn('[CacheManager] Erro ao consultar cache:', e);
      return null;
    }
  },

  // Limpa caches antigos do sistema com segurança
  clearOldCaches: async function (currentCacheName) {
    if (!('caches' in window)) return;
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if ((key.startsWith('roloff-') || key.startsWith('roloff_')) && key !== currentCacheName) {
            console.log('[CacheManager] Removendo cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    } catch (e) {
      console.warn('[CacheManager] Erro ao limpar caches:', e);
    }
  }
};

