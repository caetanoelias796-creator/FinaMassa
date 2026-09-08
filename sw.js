/* ==========================================================================
   Service Worker - Fina Massa Pizzaria PWA
   Versão Centralizada: fina-massa-v2.0.0
   ========================================================================== */

const CACHE_NAME = 'fina-massa-v2.5.0';
const CACHE_PREFIX = 'fina-massa-';

// Lista de ativos estáticos essenciais para funcionamento offline
const STATIC_ASSETS = [
    './',
    './index.html',
    './branding-theme.css',
    './index.css',
    './PizzaEngine.js',
    './app.js',
    './firebase-config.js',
    './TrackingService.js',
    './manifest.json',
    './assets/logo.png',
    './assets/hero_banner.jpg',
    './assets/pizza_hero.png',
    './assets/pizza_banner.png',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './pwa/config.js',
    './pwa/cacheManager.js',
    './pwa/updateManager.js',
    './pwa/installManager.js',
    './pwa/splashScreen.js',
    './pwa/pwa-init.js'
];

/* --------------------------------------------------------------------------
   1. INSTALL EVENT
   Pré-cacheia os ativos essenciais e ativa imediatamente a nova versão
   para resgatar clientes com versões antigas presas em cache.
   -------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(
                STATIC_ASSETS.map((url) => {
                    return cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
                        console.warn('[SW] Aviso no pré-cacheamento:', url, err);
                    });
                })
            );
        })
    );
    // Ativação imediata para garantir que clientes com versões antigas sejam atualizados
    self.skipWaiting();
});

/* --------------------------------------------------------------------------
   2. ACTIVATE EVENT
   Limpa automaticamente todos os caches antigos do sistema e assume o controle.
   -------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (
                        (cacheName.startsWith(CACHE_PREFIX) || cacheName.startsWith('roloff_')) &&
                        cacheName !== CACHE_NAME
                    ) {
                        console.log('[SW] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Novo Service Worker ativo e controlando clientes:', CACHE_NAME);
            return self.clients.claim();
        })
    );
});

/* --------------------------------------------------------------------------
   3. MESSAGE EVENT
   Recebe comando SKIP_WAITING enviado pelo updateManager.js ou painel.js
   -------------------------------------------------------------------------- */
self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (
        event.data.type === 'SKIP_WAITING' ||
        event.data.action === 'skipWaiting' ||
        event.data === 'SKIP_WAITING'
    ) {
        console.log('[SW] Comando SKIP_WAITING recebido. Ativando novo Service Worker imediatamente...');
        self.skipWaiting();
    }
});

/* --------------------------------------------------------------------------
   4. FETCH EVENT
   Estratégias segmentadas por tipo de recurso.
   -------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
    // Apenas requisições GET são tratadas pelo Service Worker
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    // 4.1. FIREBASE, PAINEL ADMINISTRATIVO & APIS DINÂMICAS: NETWORK ONLY (Bypass total do cache)
    if (
        requestUrl.pathname.startsWith('/painel') ||
        requestUrl.pathname.startsWith('/garcom') ||
        requestUrl.hostname.includes('firebaseio.com') ||
        requestUrl.hostname.includes('googleapis.com') ||
        requestUrl.hostname.includes('gstatic.com') ||
        requestUrl.hostname.includes('facebook.net') ||
        requestUrl.hostname.includes('googletagmanager.com') ||
        requestUrl.hostname.includes('google-analytics.com') ||
        requestUrl.pathname.startsWith('/api/')
    ) {
        return; // Requisição direta para a rede
    }

    // 4.2. PÁGINAS HTML / NAVEGAÇÃO: NETWORK FIRST
    // Garante que o usuário receba sempre o HTML mais atualizado quando online
    if (
        event.request.mode === 'navigate' ||
        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) ||
        requestUrl.pathname.endsWith('.html') ||
        requestUrl.pathname.endsWith('/')
    ) {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' })
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match('./index.html') || caches.match('./');
                    });
                })
        );
        return;
    }

    // 4.3. ARQUIVOS DE DADOS / CARDÁPIO LOCAL: NETWORK FIRST
    if (
        requestUrl.pathname.endsWith('menu.json') ||
        requestUrl.pathname.endsWith('configuracoes.json')
    ) {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' })
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 4.4. SCRIPTS JAVASCRIPT E ESTILOS CSS: STALE-WHILE-REVALIDATE
    // Carrega do cache instantaneamente e atualiza em background na rede
    if (
        requestUrl.pathname.endsWith('.js') ||
        requestUrl.pathname.endsWith('.css')
    ) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 4.5. IMAGENS E FONTES ESTÁTICAS: CACHE FIRST
    // Economiza banda e acelera o carregamento
    if (
        requestUrl.pathname.startsWith('/assets/') ||
        requestUrl.pathname.includes('/assets/') ||
        /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(requestUrl.pathname)
    ) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 4.6. DEMAIS RECURSOS ESTÁTICOS: NETWORK FIRST COM FALLBACK PARA CACHE
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request))
    );
});
