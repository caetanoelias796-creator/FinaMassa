/* ==========================================================================
   TrackingService.js - Módulo Centralizado de Tracking para Fina Massa Pizzaria
   Suporta Meta Pixel, Google Tag Manager (GTM) e Google Analytics 4 (GA4)
   ========================================================================== */

(function (window) {
    'use strict';

    var trackingConfig = {
        enabled: false,
        gtmEnabled: false,
        gtmId: '',
        isCustomGtm: false,
        metaPixelEnabled: false,
        metaPixelId: '',
        ga4Enabled: false,
        ga4Id: '',
        googleAdsEnabled: false,
        googleAdsId: '',
        googleAdsConversionLabels: {}
    };

    var isInitialized = false;

    var TrackingService = {
        _sanitizeId: function (str) {
            return (str || '').toString().trim();
        },

        _validateGtmId: function (id) {
            var clean = this._sanitizeId(id).toUpperCase();
            return /^GTM-[A-Z0-9]{4,12}$/.test(clean);
        },

        _validateMetaPixelId: function (id) {
            var clean = this._sanitizeId(id).replace(/\D/g, '');
            return /^\d{6,20}$/.test(clean);
        },

        _validateGa4Id: function (id) {
            var clean = this._sanitizeId(id).toUpperCase();
            return /^G-[A-Z0-9]{6,15}$/.test(clean);
        },

        _validateGoogleAdsId: function (id) {
            var clean = this._sanitizeId(id).toUpperCase();
            return /^AW-[0-9]{6,12}$/.test(clean);
        },

        /**
         * Formata um item bruto para o padrão estrito de e-commerce do GA4.
         */
        _formatItem: function (item) {
            if (!item) return null;

            var itemId = String(item.id || 'item');
            var itemName = item.name || (item.sizeName ? 'Item ' + item.sizeName : 'Produto');

            var category = 'Pizzas';
            if (item.category === 'bebidas') {
                category = 'Bebidas';
            } else if (item.category === 'porcoes') {
                category = 'Porções';
            } else if (item.category === 'sobremesas') {
                category = 'Sobremesas';
            } else if (item.category === 'pizzas_salgadas' || item.category === 'pizzas_doces') {
                category = 'Lanches';
            } else if (item.category) {
                category = String(item.category);
            }

            var variantParts = [];
            if (item.flavorNames && Array.isArray(item.flavorNames) && item.flavorNames.length > 0) {
                variantParts.push(item.flavorNames.join(', '));
            }
            if (item.borderName && item.borderName !== 'Sem Borda') {
                variantParts.push('Borda: ' + item.borderName);
            }
            var variant = variantParts.join(' | ');

            var qty = parseInt(item.quantity, 10);
            if (isNaN(qty) || qty <= 0) qty = 1;

            var price = parseFloat(item.singlePrice || item.price || (item.totalPrice ? item.totalPrice / qty : 0));
            if (isNaN(price)) price = 0;
            price = Number(price.toFixed(2));

            var formatted = {
                item_id: itemId,
                item_name: itemName,
                item_category: category,
                price: price,
                quantity: qty
            };

            if (variant) {
                formatted.item_variant = variant;
            }

            return formatted;
        },

        /**
         * Inicializa os scripts de rastreamento com base nas configurações passadas.
         * @param {Object} config - { enabled, gtmEnabled, gtmId, metaPixelEnabled, metaPixelId, ga4Enabled, ga4Id }
         * @param {Boolean} allowTestFallback - Se true, usa os IDs padrão caso nenhum seja configurado.
         */
        init: function (config, allowTestFallback) {
            try {
                if (typeof allowTestFallback === 'undefined') {
                    allowTestFallback = true;
                }

                config = config || {};

                var rawGtmId = this._sanitizeId(config.gtmId).toUpperCase();
                var rawMetaPixelId = this._sanitizeId(config.metaPixelId).replace(/\D/g, '');
                var rawGa4Id = this._sanitizeId(config.ga4Id || config.ga4MeasurementId).toUpperCase();
                var rawGoogleAdsId = this._sanitizeId(config.googleAdsId || config.googleAdsConversionId).toUpperCase();

                var isCustomGtmValid = this._validateGtmId(rawGtmId);
                var isPixelValid = this._validateMetaPixelId(rawMetaPixelId);
                var isGa4Valid = this._validateGa4Id(rawGa4Id);
                var isGoogleAdsValid = this._validateGoogleAdsId(rawGoogleAdsId);

                var targetGtmId = isCustomGtmValid && config.gtmEnabled !== false ? rawGtmId : '';
                var targetGa4Id = isGa4Valid && config.ga4Enabled !== false ? rawGa4Id : '';
                var isGtmActive = !!targetGtmId;
                var isGa4Active = !!targetGa4Id;
                var isGoogleAdsActive = isGoogleAdsValid && config.googleAdsEnabled !== false;
                var isPixelActive = isPixelValid && config.metaPixelEnabled !== false;

                var isAnyServiceActive = isGtmActive || isPixelActive || isGa4Active || isGoogleAdsActive;

                trackingConfig = {
                    enabled: isAnyServiceActive && config.enabled !== false,
                    gtmEnabled: isGtmActive,
                    gtmId: targetGtmId,
                    isCustomGtm: isCustomGtmValid,
                    metaPixelEnabled: isPixelActive,
                    metaPixelId: isPixelActive ? rawMetaPixelId : '',
                    ga4Enabled: isGa4Active,
                    ga4Id: targetGa4Id,
                    googleAdsEnabled: isGoogleAdsActive,
                    googleAdsId: isGoogleAdsActive ? rawGoogleAdsId : '',
                    googleAdsConversionLabels: (config.googleAdsConversionLabels && typeof config.googleAdsConversionLabels === 'object')
                        ? config.googleAdsConversionLabels
                        : {}
                };

                // 1. Garantir dataLayer global ANTES de qualquer carregamento
                window.dataLayer = window.dataLayer || [];

                // 2. Inicializar Google Tag Manager se ativo
                if (trackingConfig.gtmEnabled && trackingConfig.gtmId) {
                    this._initGTM(trackingConfig.gtmId);
                }

                // 3. Inicializar Meta Pixel se ativo e válido
                if (trackingConfig.metaPixelEnabled && trackingConfig.metaPixelId) {
                    this._initMetaPixel(trackingConfig.metaPixelId);
                }

                // 4. Inicializar GA4 direto via gtag.js para rastreamento automático direto no Google Analytics
                if (trackingConfig.ga4Enabled && trackingConfig.ga4Id) {
                    this._initGA4(trackingConfig.ga4Id);
                }

                // 5. Inicializar Google Ads (gtag.js) se ativo e com AW-ID válido
                if (trackingConfig.googleAdsEnabled && trackingConfig.googleAdsId) {
                    this._initGoogleAds(trackingConfig.googleAdsId);
                }

                isInitialized = true;
                console.log('[TrackingService] Inicializado com sucesso.', trackingConfig);

                // Disparar PageView inicial
                this.trackPageView();
            } catch (err) {
                console.error('[TrackingService] Erro na inicialização:', err);
            }
        },

        _initMetaPixel: function (pixelId) {
            try {
                if (!pixelId) return;

                if (window._metaPixelInitializedId === pixelId || (window.fbq && window._fbqLoaded)) {
                    console.log('[TrackingService] Meta Pixel já inicializado:', pixelId);
                    return;
                }

                if (!window.fbq) {
                    (function (f, b, e, v, n, t, s) {
                        if (f.fbq) return;
                        n = f.fbq = function () {
                            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
                        };
                        if (!f._fbq) f._fbq = n;
                        n.push = n;
                        n.loaded = !0;
                        n.version = '2.0';
                        n.queue = [];
                        t = b.createElement(e);
                        t.async = !0;
                        t.src = v;
                        s = b.getElementsByTagName(e)[0];
                        s.parentNode.insertBefore(t, s);
                    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
                }

                window.fbq('init', pixelId);
                window._metaPixelInitializedId = pixelId;
                window._fbqLoaded = true;
            } catch (err) {
                console.error('[TrackingService] Erro ao carregar Meta Pixel:', err);
            }
        },

        _initGTM: function (gtmId) {
            try {
                if (!gtmId) return;

                if (window._activeGtmContainerId === gtmId) {
                    console.log('[TrackingService] Container GTM já ativo:', gtmId);
                    return;
                }

                var existingScripts = document.getElementsByTagName('script');
                for (var i = 0; i < existingScripts.length; i++) {
                    var src = existingScripts[i].src || '';
                    if (src.indexOf('googletagmanager.com/gtm.js') !== -1) {
                        if (src.indexOf('id=' + gtmId) !== -1) {
                            console.log('[TrackingService] Script do GTM ' + gtmId + ' já se encontra no DOM.');
                            window._activeGtmContainerId = gtmId;
                            return;
                        }
                    }
                }

                (function (w, d, s, l, i) {
                    w[l] = w[l] || [];
                    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
                    var f = d.getElementsByTagName(s)[0],
                        j = d.createElement(s),
                        dl = l !== 'dataLayer' ? '&l=' + l : '';
                    j.async = true;
                    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
                    f.parentNode.insertBefore(j, f);
                })(window, document, 'script', 'dataLayer', gtmId);

                window._activeGtmContainerId = gtmId;
                console.log('[TrackingService] Container GTM ativado exclusivamente:', gtmId);
            } catch (err) {
                console.error('[TrackingService] Erro ao carregar GTM:', err);
            }
        },

        _initGA4: function (ga4Id) {
            try {
                if (!ga4Id) return;

                if (window._ga4InitializedId === ga4Id) {
                    console.log('[TrackingService] GA4 já inicializado:', ga4Id);
                    return;
                }

                window.dataLayer = window.dataLayer || [];
                function gtag() { window.dataLayer.push(arguments); }
                if (!window.gtag) {
                    window.gtag = gtag;
                }

                var scriptExists = document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + ga4Id + '"]');
                if (!scriptExists) {
                    var script = document.createElement('script');
                    script.async = true;
                    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga4Id;
                    document.head.appendChild(script);
                }

                window.gtag('js', new Date());
                window.gtag('config', ga4Id);
                window._ga4InitializedId = ga4Id;
            } catch (err) {
                console.error('[TrackingService] Erro ao carregar GA4:', err);
            }
        },

        /**
         * Inicializa o Google Ads (via gtag.js) usando o AW-ID configurado no painel.
         * Reaproveita o mesmo script global gtag.js carregado pelo GA4 quando possível;
         * caso o GA4 esteja desativado, carrega o gtag.js usando o próprio AW-ID.
         */
        _initGoogleAds: function (googleAdsId) {
            try {
                if (!googleAdsId) return;

                if (window._googleAdsInitializedId === googleAdsId) {
                    console.log('[TrackingService] Google Ads já inicializado:', googleAdsId);
                    return;
                }

                window.dataLayer = window.dataLayer || [];
                function gtag() { window.dataLayer.push(arguments); }
                if (!window.gtag) {
                    window.gtag = gtag;
                }

                // Só é preciso carregar o script gtag.js se ainda não houver
                // nenhuma tag gtag.js na página (nem a do GA4, nem outra do Ads).
                var scriptExists = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
                if (!scriptExists) {
                    var script = document.createElement('script');
                    script.async = true;
                    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + googleAdsId;
                    document.head.appendChild(script);
                }

                window.gtag('js', new Date());
                window.gtag('config', googleAdsId);
                window._googleAdsInitializedId = googleAdsId;
                console.log('[TrackingService] Google Ads ativado:', googleAdsId);
            } catch (err) {
                console.error('[TrackingService] Erro ao carregar Google Ads:', err);
            }
        },

        /**
         * Dispara um evento de conversão do Google Ads (gtag 'event' com send_to AW-ID/label).
         * Sem um conversion label configurado para o evento, o Ads ainda recebe a visita
         * vinculada à conta (via 'config'), mas a conversão específica não é registrada.
         */
        _fireGoogleAdsConversion: function (eventKey, params) {
            try {
                if (!trackingConfig.googleAdsEnabled || !trackingConfig.googleAdsId) return;
                if (!window.gtag) return;

                var label = trackingConfig.googleAdsConversionLabels
                    ? trackingConfig.googleAdsConversionLabels[eventKey]
                    : '';

                var sendTo = label ? (trackingConfig.googleAdsId + '/' + label) : trackingConfig.googleAdsId;
                var payload = Object.assign({}, params, { send_to: sendTo });

                window.gtag('event', 'conversion', payload);
                console.log('%c🎯 [Google Ads] Conversão disparada para ' + sendTo + ':', 'color: #4285F4; font-weight: bold;', payload);
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar conversão do Google Ads:', err);
            }
        },

        /**
         * Limpa o objeto ecommerce anterior na dataLayer para evitar vazamento de parâmetros entre eventos.
         */
        _clearDataLayerEcommerce: function () {
            try {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ ecommerce: null });
            } catch (e) {
                console.error('[TrackingService] Erro ao limpar dataLayer:', e);
            }
        },

        /**
         * Dispara o evento PageView / page_view.
         */
        trackPageView: function () {
            try {
                if (window.fbq && trackingConfig.metaPixelEnabled) {
                    window.fbq('track', 'PageView');
                }

                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ event: 'page_view' });
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar PageView:', err);
            }
        },

        /**
         * Dispara o evento ViewContent / view_item quando um produto/pizza é visualizado.
         * @param {Object} item - Informações do item/pizza
         */
        trackViewContent: function (item) {
            try {
                if (!item) return;
                window.dataLayer = window.dataLayer || [];

                var formattedItem = this._formatItem(item);
                if (!formattedItem) return;

                var value = parseFloat(item.price || item.totalPrice || item.basePrice || formattedItem.price || 0);
                if (isNaN(value)) value = 0;
                value = Number(value.toFixed(2));

                if (window.fbq && trackingConfig.metaPixelEnabled) {
                    window.fbq('track', 'ViewContent', {
                        content_ids: [formattedItem.item_id],
                        content_name: formattedItem.item_name,
                        content_type: 'product',
                        value: value,
                        currency: 'BRL'
                    });
                }

                this._clearDataLayerEcommerce();

                // 1. Envio para a dataLayer (GTM)
                window.dataLayer.push({
                    event: 'view_item',
                    ecommerce: {
                        currency: 'BRL',
                        value: value,
                        items: [formattedItem]
                    }
                });

                // 2. Envio direto ao GA4 (gtag) sem depender de configurações no GTM
                if (window.gtag && trackingConfig.ga4Enabled) {
                    window.gtag('event', 'view_item', {
                        currency: 'BRL',
                        value: value,
                        items: [formattedItem]
                    });
                }
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar ViewContent:', err);
            }
        },

        /**
         * Dispara o evento AddToCart / add_to_cart quando um produto é adicionado ao carrinho.
         * @param {Object} itemData - Item formatado do carrinho
         */
        trackAddToCart: function (itemData) {
            try {
                if (!itemData) return;
                window.dataLayer = window.dataLayer || [];

                var formattedItem = this._formatItem(itemData);
                if (!formattedItem) return;

                var totalPrice = parseFloat(itemData.totalPrice || (formattedItem.price * formattedItem.quantity));
                if (isNaN(totalPrice)) totalPrice = 0;
                totalPrice = Number(totalPrice.toFixed(2));

                if (window.fbq && trackingConfig.metaPixelEnabled) {
                    window.fbq('track', 'AddToCart', {
                        content_ids: [formattedItem.item_id],
                        content_name: formattedItem.item_name,
                        content_type: 'product',
                        value: totalPrice,
                        currency: 'BRL',
                        contents: [{
                            id: formattedItem.item_id,
                            quantity: formattedItem.quantity,
                            item_price: formattedItem.price
                        }]
                    });
                }

                this._clearDataLayerEcommerce();

                // 1. Envio para a dataLayer (GTM)
                window.dataLayer.push({
                    event: 'add_to_cart',
                    ecommerce: {
                        currency: 'BRL',
                        value: totalPrice,
                        items: [formattedItem]
                    }
                });

                // 2. Envio direto ao GA4 (gtag) sem depender de configurações no GTM
                if (window.gtag && trackingConfig.ga4Enabled) {
                    window.gtag('event', 'add_to_cart', {
                        currency: 'BRL',
                        value: totalPrice,
                        items: [formattedItem]
                    });
                }

                // 3. Conversão do Google Ads (se configurada para este evento)
                this._fireGoogleAdsConversion('add_to_cart', {
                    currency: 'BRL',
                    value: totalPrice
                });
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar AddToCart:', err);
            }
        },

        /**
         * Dispara o evento view_cart quando o usuário abre a gaveta do carrinho.
         * @param {Array} cart - Lista de itens no carrinho
         */
        trackViewCart: function (cart) {
            try {
                if (!cart) return;
                window.dataLayer = window.dataLayer || [];

                var self = this;
                var gtmItems = cart.map(function (item) {
                    return self._formatItem(item);
                }).filter(Boolean);

                var totalVal = cart.reduce(function (sum, item) {
                    return sum + (parseFloat(item.totalPrice) || 0);
                }, 0);
                totalVal = Number(totalVal.toFixed(2));

                this._clearDataLayerEcommerce();

                // 1. Envio para a dataLayer (GTM)
                window.dataLayer.push({
                    event: 'view_cart',
                    ecommerce: {
                        currency: 'BRL',
                        value: totalVal,
                        items: gtmItems
                    }
                });

                // 2. Envio direto ao GA4 (gtag) sem depender de configurações no GTM
                if (window.gtag && trackingConfig.ga4Enabled) {
                    window.gtag('event', 'view_cart', {
                        currency: 'BRL',
                        value: totalVal,
                        items: gtmItems
                    });
                }
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar ViewCart:', err);
            }
        },

        /**
         * Dispara o evento remove_from_cart ao diminuir ou remover um item do carrinho.
         * @param {Object} itemRemoved - Item sendo removido
         * @param {Number} qtyRemoved - Quantidade efetivamente removida
         */
        trackRemoveFromCart: function (itemRemoved, qtyRemoved) {
            try {
                if (!itemRemoved) return;
                window.dataLayer = window.dataLayer || [];

                var qty = parseInt(qtyRemoved, 10);
                if (isNaN(qty) || qty <= 0) qty = 1;

                var formattedItem = this._formatItem(itemRemoved);
                if (!formattedItem) return;

                formattedItem.quantity = qty;
                var totalVal = Number((formattedItem.price * qty).toFixed(2));

                this._clearDataLayerEcommerce();

                // 1. Envio para a dataLayer (GTM)
                window.dataLayer.push({
                    event: 'remove_from_cart',
                    ecommerce: {
                        currency: 'BRL',
                        value: totalVal,
                        items: [formattedItem]
                    }
                });

                // 2. Envio direto ao GA4 (gtag) sem depender de configurações no GTM
                if (window.gtag && trackingConfig.ga4Enabled) {
                    window.gtag('event', 'remove_from_cart', {
                        currency: 'BRL',
                        value: totalVal,
                        items: [formattedItem]
                    });
                }
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar RemoveFromCart:', err);
            }
        },

        /**
         * Dispara o evento InitiateCheckout / begin_checkout ao abrir a tela de checkout.
         * @param {Array} cart - Lista de itens no carrinho
         * @param {Number} totalValue - Valor total do carrinho
         */
        trackInitiateCheckout: function (cart, totalValue) {
            try {
                if (!cart || cart.length === 0) return;
                window.dataLayer = window.dataLayer || [];

                var self = this;
                var gtmItems = [];
                var contentIds = [];
                var contents = [];

                cart.forEach(function (item) {
                    var fItem = self._formatItem(item);
                    if (fItem) {
                        gtmItems.push(fItem);
                        contentIds.push(fItem.item_id);
                        contents.push({
                            id: fItem.item_id,
                            quantity: fItem.quantity,
                            item_price: fItem.price
                        });
                    }
                });

                var val = parseFloat(totalValue || 0);
                if (isNaN(val)) val = 0;
                val = Number(val.toFixed(2));

                if (window.fbq && trackingConfig.metaPixelEnabled) {
                    window.fbq('track', 'InitiateCheckout', {
                        content_ids: contentIds,
                        contents: contents,
                        value: val,
                        currency: 'BRL',
                        num_items: contents.length
                    });
                }

                this._clearDataLayerEcommerce();

                // 1. Envio para a dataLayer (GTM)
                window.dataLayer.push({
                    event: 'begin_checkout',
                    ecommerce: {
                        currency: 'BRL',
                        value: val,
                        items: gtmItems
                    }
                });

                // 2. Envio direto ao GA4 (gtag) sem depender de configurações no GTM
                if (window.gtag && trackingConfig.ga4Enabled) {
                    window.gtag('event', 'begin_checkout', {
                        currency: 'BRL',
                        value: val,
                        items: gtmItems
                    });
                }

                // 3. Conversão do Google Ads (se configurada para este evento)
                this._fireGoogleAdsConversion('begin_checkout', {
                    currency: 'BRL',
                    value: val
                });
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar InitiateCheckout:', err);
            }
        },

        /**
         * Dispara o evento Purchase / purchase após a confirmação/gravação com sucesso do pedido.
         * @param {Object} orderData - Dados oficiais do pedido gravado
         */
        trackPurchase: function (orderData) {
            try {
                if (!orderData) return;

                var rawOrderId = orderData.id || orderData.orderId || orderData.transaction_id;
                if (!rawOrderId && rawOrderId !== 0) {
                    console.error('[TrackingService] Evento purchase bloqueado: ausência de transaction_id (orderData.id inexistente).');
                    return;
                }

                var orderId = String(rawOrderId).trim();
                if (!orderId) {
                    console.error('[TrackingService] Evento purchase bloqueado: ausência de transaction_id válido.');
                    return;
                }

                window.dataLayer = window.dataLayer || [];

                var total = parseFloat(orderData.total || 0);
                if (isNaN(total)) total = 0;
                total = Number(total.toFixed(2));

                var shipping = parseFloat(orderData.deliveryFee || 0);
                if (isNaN(shipping)) shipping = 0;
                shipping = Number(shipping.toFixed(2));

                var self = this;
                var gtmItems = [];
                var contentIds = [];
                var contents = [];

                var cart = orderData.cart || [];
                cart.forEach(function (item) {
                    var fItem = self._formatItem(item);
                    if (fItem) {
                        gtmItems.push(fItem);
                        contentIds.push(fItem.item_id);
                        contents.push({
                            id: fItem.item_id,
                            quantity: fItem.quantity,
                            item_price: fItem.price
                        });
                    }
                });

                if (window.fbq && trackingConfig.metaPixelEnabled) {
                    window.fbq('track', 'Purchase', {
                        transaction_id: orderId,
                        value: total,
                        currency: 'BRL',
                        content_ids: contentIds,
                        contents: contents
                    });
                }

                this._clearDataLayerEcommerce();

                // 1. Envio para a dataLayer (GTM)
                window.dataLayer.push({
                    event: 'purchase',
                    ecommerce: {
                        transaction_id: orderId,
                        currency: 'BRL',
                        value: total,
                        tax: 0,
                        shipping: shipping,
                        items: gtmItems
                    }
                });

                // 2. Envio direto ao GA4 (gtag) sem depender de configurações no GTM
                if (window.gtag && trackingConfig.ga4Enabled) {
                    window.gtag('event', 'purchase', {
                        transaction_id: orderId,
                        currency: 'BRL',
                        value: total,
                        tax: 0,
                        shipping: shipping,
                        items: gtmItems
                    });
                }

                // 3. Conversão do Google Ads (transaction_id evita contagem duplicada da mesma compra)
                this._fireGoogleAdsConversion('purchase', {
                    currency: 'BRL',
                    value: total,
                    transaction_id: orderId
                });
            } catch (err) {
                console.error('[TrackingService] Erro ao disparar Purchase:', err);
            }
        }
    };

    window.TrackingService = TrackingService;
})(window);

