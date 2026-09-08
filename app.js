/* ==========================================================================
   Fina Massa Pizzaria - Motor do CardÃ¡pio & Delivery Online
   ========================================================================== */

// Firebase Initialization (Centralizada e segura)
if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && firebase.apps && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Global State
let menuData = null;
let cart = []; // Array of cart items
let checkoutType = 'delivery'; // 'delivery' or 'pickup'
let customerLocation = null;
let currentCustomizingProduct = null;
let customizerQuantity = 1;

// State para Customizador Dinâmico de Produtos e Pizzas Fina Massa
let currentConfiguredProduct = null;
let currentConfiguredSelections = {};
let currentConfiguredQuantity = 1;
let currentConfiguredComment = '';

// Storage key isolada para Fina Massa Pizzaria
const CART_STORAGE_KEY = 'fina_massa_cart';

// Fallback Menu Neutro â€” Fina Massa Pizzaria
const DEFAULT_MENU_FALLBACK = {
    "menu_items": {
        "pizzas_salgadas": [],
        "pizzas_doces": [],
        "calzones": [],
        "bebidas": []
    },
    "pizza_config": {
        "sizes": {
            "media": { "id": "media", "name": "MÃ©dia", "slices": 8, "maxFlavors": 2, "active": true, "description": "8 fatias â€¢ atÃ© 2 sabores" },
            "grande": { "id": "grande", "name": "Grande", "slices": 12, "maxFlavors": 3, "active": true, "description": "12 fatias â€¢ atÃ© 3 sabores" }
        },
        "flavors": {},
        "borders": {},
        "extras": {},
        "pricingRules": {
            "default": "HIGHEST",
            "available": ["HIGHEST", "AVERAGE"]
        }
    },
    "adicionais": {},
    "settings": {
        "companyName": "Fina Massa Pizzaria",
        "pixKey": "",
        "slogan": "Pizzas Artesanais | Delivery & SalÃ£o",
        "whatsapp": "",
        "whatsappFormatted": "",
        "address": "",
        "operatingHours": "TerÃ§a a Domingo das 18h Ã s 23h30",
        "deliveryFees": {},
        "tracking": {
            "metaPixelId": "",
            "gtmId": "",
            "ga4MeasurementId": "",
            "googleAdsConversionId": ""
        }
    },
    "promo_config": {
        "show_popup": false,
        "facebook_url": ""
    }
};
/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadCartFromStorage();
    fetchMenu();
    listenToStoreStatus();
    initTracking();
});

function initTracking() {
    if (typeof TrackingService !== 'undefined') {
        const trConfig = menuData?.settings?.tracking || {};
        TrackingService.init(trConfig);
        TrackingService.trackPageView();
    }
}

function listenToStoreStatus() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('status/isOpen').on('value', (snapshot) => {
            const isOpen = snapshot.val();
            updateStoreStatusUI(isOpen !== false);
        });
    }
}

function updateStoreStatusUI(isOpen) {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;
    if (isOpen) {
        badge.className = 'status-badge open';
        badge.innerHTML = '<span class="dot animate-pulse"></span> Aberto agora para pedidos';
    } else {
        badge.className = 'status-badge closed';
        badge.innerHTML = '<span class="dot closed-dot"></span> Fechado no momento';
    }
}

/* ==========================================================================
   Data Fetching & Menu Synchronization
   ========================================================================== */
function mergeDefaultMenuItems(remoteMenu) {
    if (!remoteMenu || typeof remoteMenu !== 'object') return DEFAULT_MENU_FALLBACK;
    const merged = { ...remoteMenu };
    if (!merged.menu_items || typeof merged.menu_items !== 'object') {
        merged.menu_items = {};
    }

    // NormalizaÃ§Ã£o: se o Firebase contiver menu_items.pizzas
    if (merged.menu_items.pizzas && Array.isArray(merged.menu_items.pizzas)) {
        if (!merged.menu_items.pizzas_salgadas || merged.menu_items.pizzas_salgadas.length === 0) {
            merged.menu_items.pizzas_salgadas = merged.menu_items.pizzas.filter(p => p.category === 'salgadas');
        }
        if (!merged.menu_items.pizzas_doces || merged.menu_items.pizzas_doces.length === 0) {
            merged.menu_items.pizzas_doces = merged.menu_items.pizzas.filter(p => p.category === 'doces');
        }
    }

    if (!merged.pizza_prices && merged.pizza_config?.pizza_prices) {
        merged.pizza_prices = merged.pizza_config.pizza_prices;
    }
    if (!merged.borders && merged.pizza_config?.borders) {
        merged.borders = merged.pizza_config.borders;
    }

    if (!merged.adicionais || typeof merged.adicionais !== 'object') {
        merged.adicionais = {};
    }
    if (!merged.settings || typeof merged.settings !== 'object') {
        merged.settings = { ...DEFAULT_MENU_FALLBACK.settings };
    }
    return merged;
}

function fetchMenu() {
    showGlobalLoading('Carregando cardÃ¡pio...');
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const menuRef = firebase.database().ref('menu');
        menuRef.on('value', (snapshot) => {
            const val = snapshot.val();
            if (val && val.menu_items && Object.keys(val.menu_items).length > 0) {
                menuData = mergeDefaultMenuItems(val);
            } else {
                loadLocalMenuFallback();
                return;
            }
            applyMenuSettings();
            renderAllSections();
            hideGlobalLoading();
        }, (err) => {
            console.warn("Erro ao ler Firebase, usando fallback:", err);
            loadLocalMenuFallback();
        });
    } else {
        loadLocalMenuFallback();
    }
}

function loadLocalMenuFallback() {
    fetch('menu.json', { cache: 'no-cache' })
        .then(res => res.json())
        .then(data => {
            menuData = mergeDefaultMenuItems(data || DEFAULT_MENU_FALLBACK);
            applyMenuSettings();
            renderAllSections();
            hideGlobalLoading();
        })
        .catch(() => {
            menuData = DEFAULT_MENU_FALLBACK;
            applyMenuSettings();
            renderAllSections();
            hideGlobalLoading();
        });
}

function applyMenuSettings() {
    const s = menuData?.settings || {};
    
    if (s.companyName) {
        const hTitle = document.getElementById('headerCompanyName');
        const fTitle = document.getElementById('footerCompanyName');
        if (hTitle) hTitle.innerText = s.companyName;
        if (fTitle) fTitle.innerText = s.companyName;
    }
    if (s.slogan) {
        const hSlogan = document.getElementById('headerCompanySlogan');
        const fSlogan = document.getElementById('footerCompanySlogan');
        if (hSlogan) hSlogan.innerText = s.slogan;
        if (fSlogan) fSlogan.innerText = s.slogan;
    }
    if (s.address) {
        const fAddr = document.getElementById('footerAddress');
        if (fAddr) fAddr.innerHTML = `<span class="material-symbols-rounded">location_on</span> ${s.address}`;
    }
    if (s.whatsappFormatted || s.whatsapp) {
        const fPhone = document.getElementById('footerCompanyPhone');
        if (fPhone) fPhone.innerHTML = `<span class="material-symbols-rounded">phone</span> ${s.whatsappFormatted || s.whatsapp}`;
    }
    if (s.operatingHours) {
        const fHours = document.getElementById('footerHours');
        if (fHours) fHours.innerHTML = `<span class="material-symbols-rounded">schedule</span> ${s.operatingHours}`;
    }
    if (s.pixKey) {
        const pixDisplay = document.getElementById('checkoutPixKeyDisplay');
        if (pixDisplay) pixDisplay.innerText = s.pixKey;
    }

    populateNeighborhoodSelect(s.deliveryFees);
}

function populateNeighborhoodSelect(deliveryFees) {
    const select = document.getElementById('addressBairro');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Selecione seu bairro</option>';
    
    if (deliveryFees && typeof deliveryFees === 'object' && Object.keys(deliveryFees).length > 0) {
        const sortedKeys = Object.keys(deliveryFees).sort((a, b) => {
            const itemA = deliveryFees[a];
            const itemB = deliveryFees[b];
            const nameA = typeof itemA === 'object' && itemA ? (itemA.name || a) : a;
            const nameB = typeof itemB === 'object' && itemB ? (itemB.name || b) : b;
            return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        });

        let hasActive = false;
        sortedKeys.forEach(key => {
            const item = deliveryFees[key];
            if (!item) return;

            const isActive = typeof item === 'object' ? (item.active !== false) : true;
            if (!isActive) return;

            const name = (typeof item === 'object' && item.name) ? item.name : key;
            const rawFee = typeof item === 'object' ? (item.fee !== undefined ? item.fee : (item.valor !== undefined ? item.valor : 0)) : item;
            const fee = isNaN(Number(rawFee)) ? 0 : Number(rawFee);
            const feeStr = fee === 0 ? 'GrÃ¡tis' : `R$ ${fee.toFixed(2).replace('.', ',')}`;

            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = `${name} (${feeStr})`;
            opt.dataset.fee = fee;
            opt.dataset.id = key;
            select.appendChild(opt);
            hasActive = true;
        });

        if (!hasActive) {
            const opt = document.createElement('option');
            opt.value = "Centro";
            opt.innerText = "Centro (Taxa a combinar)";
            opt.dataset.fee = "0";
            select.appendChild(opt);
        }
    } else {
        const opt = document.createElement('option');
        opt.value = "Centro";
        opt.innerText = "Centro (Taxa a combinar)";
        opt.dataset.fee = "0";
        select.appendChild(opt);
    }
}

/* ==========================================================================
   Catalog Rendering
   ========================================================================== */
function resolveProductImage(item, categoryKey) {
    if (item && item.image && typeof item.image === 'string' && item.image.trim() !== '') {
        return item.image;
    }
    if (categoryKey === 'pizzas_salgadas') {
        return 'assets/pizza_hero.png';
    }
    if (categoryKey === 'pizzas_doces') {
        return 'assets/gourmet_doce_morango.png';
    }
    if (categoryKey === 'calzones') {
        return 'assets/pizza_media.jpg';
    }
    if (categoryKey === 'bebidas') {
        return 'assets/gourmet_bebida.png';
    }
    return 'assets/pizza_hero.png';
}

function renderAllSections() {
    // Categorias Oficiais Fina Massa
    renderCatalogCategorySection('pizzas_tradicionais', 'pizzasTradicionaisGrid');
    renderCatalogCategorySection('pizzas_especiais', 'pizzasEspeciaisGrid');
    renderCategoryGrid('calzones', 'calzonesGrid');
    renderCategoryGrid('bebidas', 'bebidasGrid');

    // Retrocompatibilidade para dados legados (caso existam no Firebase)
    if (document.getElementById('pizzasSalgadasGrid')) {
        renderPizzasSection('pizzas_salgadas', 'pizzasSalgadasGrid');
    }
    if (document.getElementById('pizzasDocesGrid')) {
        renderPizzasSection('pizzas_doces', 'pizzasDocesGrid');
    }

    updateCartUI();
}

function renderCatalogCategorySection(categoryKey, gridElementId) {
    const grid = document.getElementById(gridElementId);
    if (!grid) return;
    grid.innerHTML = '';

    const itemsObj = menuData?.menu_items?.[categoryKey];
    let items = [];
    if (itemsObj) {
        items = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj);
    }

    if (items.length === 0) {
        grid.innerHTML = '<p class="empty-category" style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1; text-align: center; padding: 24px;">Nenhum produto cadastrado nesta categoria no momento.</p>';
        return;
    }

    items.forEach(product => {
        if (product.available === false) return;
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        card.onclick = (e) => {
            if (!e.target.closest('button')) {
                openGenericProductCustomizer(product.id, categoryKey);
            }
        };

        const displayPrice = product.displayPrice !== undefined ? product.displayPrice : (product.basePrice !== undefined ? product.basePrice : (product.price || 0));
        const priceFormatted = Number(displayPrice).toFixed(2).replace('.', ',');
        const imgSrc = resolveProductImage(product, categoryKey);

        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${imgSrc}" alt="${product.name}" loading="lazy" onerror="this.src='assets/pizza_hero.png'">
                ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
            </div>
            <div class="product-details">
                <h3 class="product-title">${product.name}</h3>
                <p class="product-desc">${product.description || ''}</p>
                <div class="product-footer">
                    <div class="product-price-wrapper">
                        <span class="product-price-prefix">A partir de R$</span>
                        <span class="product-price">${priceFormatted}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary" onclick="openGenericProductCustomizer('${product.id}', '${categoryKey}')" title="Montar Pizza">
                        <span class="material-symbols-rounded">local_pizza</span>
                        <span>Montar</span>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderPizzasSection(categoryKey, gridElementId) {
    const grid = document.getElementById(gridElementId);
    if (!grid) return;
    grid.innerHTML = '';

    const itemsObj = menuData?.menu_items?.[categoryKey];
    let items = [];
    if (itemsObj) {
        items = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj);
    }

        if (items.length === 0) {
        grid.innerHTML = '<p class="empty-category" style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1; text-align: center; padding: 24px;">Nenhum produto cadastrado nesta categoria no momento.</p>';
        return;
    }

    items.forEach(flavor => {
        if (flavor.available === false) return;
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        card.onclick = (e) => {
            if (!e.target.closest('button')) {
                openPizzaCustomizer(flavor.id);
            }
        };

        const prices = menuData?.pizza_prices || menuData?.pizza_config?.pizza_prices;
        const isEsp = (flavor.categoryType || '').toLowerCase() === 'especial';
        const basePrice = isEsp ? (prices?.media?.especial || 69) : (prices?.media?.tradicional || 59);
        const displayPrice = flavor.price || basePrice;
        const priceFormatted = Number(displayPrice).toFixed(2).replace('.', ',');
        const imgSrc = flavor.image || (categoryKey === 'pizzas_doces' ? 'assets/gourmet_doce_morango.png' : 'assets/pizza_hero.png');

        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${imgSrc}" alt="${flavor.name}" loading="lazy" onerror="this.src='assets/pizza_hero.png'">
                ${flavor.badge ? `<span class="product-badge">${flavor.badge}</span>` : ''}
            </div>
            <div class="product-details">
                <h3 class="product-title">${flavor.name}</h3>
                <p class="product-desc">${flavor.description || ''}</p>
                <div class="product-footer">
                    <div class="product-price-wrapper">
                        <span class="product-price-prefix">A partir de R$</span>
                        <span class="product-price">${priceFormatted}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary" onclick="openPizzaCustomizer('${flavor.id}')" title="Montar Pizza">
                        <span class="material-symbols-rounded">local_pizza</span>
                        <span>Montar</span>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderCategoryGrid(categoryKey, gridElementId) {
    const grid = document.getElementById(gridElementId);
    if (!grid) return;

    const itemsObj = menuData?.menu_items?.[categoryKey] || DEFAULT_MENU_FALLBACK.menu_items[categoryKey] || [];
    const items = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj);

    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = '<p class="empty-category" style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1; text-align: center; padding: 24px;">Nenhum item cadastrado nesta categoria no momento.</p>';
        return;
    }

    items.forEach(item => {
        if (item.available === false) return;
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        const hasOptions = (item.optionGroups && item.optionGroups.length > 0) || item.commentEnabled || item.type === 'pizza';
        card.onclick = (e) => {
            if (!e.target.closest('button')) {
                if (hasOptions) {
                    openGenericProductCustomizer(item.id, categoryKey);
                } else {
                    openProductCustomizer(categoryKey, item.id);
                }
            }
        };

        const badgeHTML = item.badge ? `<span class="product-badge">${item.badge}</span>` : '';
        const displayPrice = item.displayPrice !== undefined ? item.displayPrice : (item.price !== undefined ? item.price : (item.basePrice || 0));
        const priceFormatted = Number(displayPrice || 0).toFixed(2).replace('.', ',');
        const fallbackImg = resolveProductImage(item, categoryKey);
        const imgSrc = resolveProductImage(item, categoryKey);

        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${imgSrc}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackImg}'">
                ${badgeHTML}
            </div>
            <div class="product-details">
                <h3 class="product-title">${item.name}</h3>
                <p class="product-desc">${item.description || ''}</p>
                <div class="product-footer">
                    <div class="product-price-wrapper">
                        <span class="product-price-prefix">R$</span>
                        <span class="product-price">${priceFormatted}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary" onclick="${hasOptions ? `openGenericProductCustomizer('${item.id}', '${categoryKey}')` : `openProductCustomizer('${categoryKey}', '${item.id}')`}" title="Personalizar e pedir">
                        <span class="material-symbols-rounded">${hasOptions ? 'tune' : 'add'}</span>
                        <span>${hasOptions ? 'Montar' : 'Pedir'}</span>
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

/* ==========================================================================
   Motor de Pizzas â€” IntegraÃ§Ã£o Centralizada com PizzaEngine.js
   ========================================================================== */
const DEFAULT_PIZZA_CONFIG = {
    sizes: {
        'media': { id: 'media', name: 'MÃ©dia', slices: 8, maxFlavors: 2, active: true, description: '8 fatias â€¢ atÃ© 2 sabores' },
        'grande': { id: 'grande', name: 'Grande', slices: 12, maxFlavors: 3, active: true, description: '12 fatias â€¢ atÃ© 3 sabores' }
    },
    flavors: {},
    borders: {},
    extras: {}
};

function getActivePizzaConfig() {
    const remoteCfg = menuData?.pizza_config || DEFAULT_MENU_FALLBACK.pizza_config || {};
    const remotePrices = menuData?.pizza_prices || remoteCfg.pizza_prices;
    
    // Tamanhos configurados (MÃ©dia mÃ¡x 2 sabores, Grande mÃ¡x 3 sabores)
    const sizes = Object.assign({}, DEFAULT_PIZZA_CONFIG.sizes, remoteCfg.sizes || {});
        
    // Sabores configurados vindos do cardÃ¡pio / pizza_config
    let flavors = Object.assign({}, remoteCfg.flavors || {});
    const salgadas = menuData?.menu_items?.pizzas_salgadas || [];
    const doces = menuData?.menu_items?.pizzas_doces || [];
    const all = [
        ...(Array.isArray(salgadas) ? salgadas : Object.values(salgadas)),
        ...(Array.isArray(doces) ? doces : Object.values(doces))
    ];
    if (all.length > 0) {
        all.forEach(f => {
            if (f && f.id) {
                const isEsp = (f.categoryType || '').toLowerCase() === 'especial';
                const basePrice = isEsp ? (remotePrices?.media?.especial || 69) : (remotePrices?.media?.tradicional || 59);
                flavors[f.id] = {
                    ...f,
                    price: typeof f.price === 'number' && f.price > 0 ? f.price : basePrice
                };
            }
        });
    }
    
    // Bordas configuradas
    const rawBorders = menuData?.borders || remoteCfg.borders || {};
    const borders = {};
    Object.keys(rawBorders).forEach(bId => {
        const b = rawBorders[bId];
        borders[bId] = {
            id: bId,
            name: b.name || bId,
            price: Number(b.price || 0),
            available: b.available !== false
        };
    });
    if (!borders['sem-borda']) {
        borders['sem-borda'] = { id: 'sem-borda', name: 'Sem Borda', price: 0, available: true };
    }
        
    // Extras configurados
    const extras = Object.assign({}, remoteCfg.extras || {});
        
    return { sizes, flavors, borders, extras };
}

let currentPizzaState = {
    selectedSize: 'grande',
    selectedFlavors: [],
    // REGRA COMERCIAL PROVISÃ“RIA â€” AGUARDANDO CONFIRMAÃ‡ÃƒO DA FINA MASSA
    pricingRule: 'HIGHEST',
    selectedBorder: '',
    selectedExtras: [],
    quantity: 1,
    notes: ''
};

function openPizzaCustomizer(preSelectedFlavorId) {
    const config = getActivePizzaConfig();
    const sizeKeys = Object.keys(config.sizes);
    const flavorKeys = Object.keys(config.flavors);

    if (flavorKeys.length === 0 || sizeKeys.length === 0) {
        showToast('Nenhum sabor ou tamanho de pizza disponÃ­vel no momento.', 'info');
        return;
    }

    currentPizzaState.selectedSize = sizeKeys.includes('grande') ? 'grande' : (sizeKeys[0] || 'media');
    
    if (preSelectedFlavorId && config.flavors[preSelectedFlavorId]) {
        currentPizzaState.selectedFlavors = [preSelectedFlavorId];
    } else if (flavorKeys.length > 0) {
        currentPizzaState.selectedFlavors = [flavorKeys[0]];
    } else {
        currentPizzaState.selectedFlavors = [];
    }

    // REGRA COMERCIAL PROVISÃ“RIA â€” AGUARDANDO CONFIRMAÃ‡ÃƒO DA FINA MASSA
    currentPizzaState.pricingRule = 'HIGHEST';
    
    const borderKeys = Object.keys(config.borders);
    currentPizzaState.selectedBorder = borderKeys.includes('sem-borda') ? 'sem-borda' : (borderKeys[0] || '');
    currentPizzaState.selectedExtras = [];
    currentPizzaState.quantity = 1;
    currentPizzaState.notes = '';

    const notesInput = document.getElementById('pizzaCustomNotes');
    if (notesInput) notesInput.value = '';
    const qtySpan = document.getElementById('pizzaCustomQty');
    if (qtySpan) qtySpan.innerText = '1';

    renderPizzaSizesList();
    renderPizzaFlavorsList();
    renderPizzaBordersList();
    renderPizzaExtrasList();
    updatePizzaPricePreview();

    const modal = document.getElementById('pizzaCustomizerModal');
    if (modal) modal.classList.add('active');
}

function closePizzaCustomizer() {
    currentConfiguredProduct = null;
    currentConfiguredSelections = {};
    currentConfiguredComment = '';
    currentConfiguredQuantity = 1;

    const modal = document.getElementById('pizzaCustomizerModal');
    if (modal) modal.classList.remove('active');
}

function renderPizzaSizesList() {
    const container = document.getElementById('pizzaSizesList');
    if (!container) return;
    container.innerHTML = '';

    const config = getActivePizzaConfig();
    Object.values(config.sizes).forEach(size => {
        const isChecked = size.id === currentPizzaState.selectedSize ? 'checked' : '';
        const row = document.createElement('label');
        row.className = 'adicional-checkbox-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="pizza_size_radio" value="${size.id}" ${isChecked} onchange="onPizzaSizeChange('${size.id}')">
                <span style="font-weight: 600;">${size.name} (${size.slices} fatias)</span>
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">${size.description || (size.slices + ' fatias â€¢ atÃ© ' + size.maxFlavors + ' sabores')}</span>
        `;
        container.appendChild(row);
    });
}

function renderPizzaFlavorsList() {
    const container = document.getElementById('pizzaFlavorsList');
    if (!container) return;
    container.innerHTML = '';

    const config = getActivePizzaConfig();
    const size = config.sizes[currentPizzaState.selectedSize] || { maxFlavors: 3, name: 'PadrÃ£o' };
    const maxFlavors = size.maxFlavors || (currentPizzaState.selectedSize === 'grande' ? 3 : 2);

    const badge = document.getElementById('pizzaFlavorLimitBadge');
    if (badge) badge.innerText = `Até ${maxFlavors} sabor(es)`;

    const notice = document.getElementById('pizzaFlavorLimitNotice');
    if (notice) notice.innerText = `Tamanho ${size.name}: selecione até ${maxFlavors} sabor(es) para sua pizza.`;

    const flavorList = Object.values(config.flavors);
    if (flavorList.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">Nenhum sabor cadastrado no momento.</p>';
        return;
    }

    flavorList.forEach(flavor => {
        const isChecked = currentPizzaState.selectedFlavors.includes(flavor.id);
        const row = document.createElement('label');
        row.className = 'adicional-checkbox-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" name="pizza_flavor_cb" value="${flavor.id}" ${isChecked ? 'checked' : ''} onchange="onPizzaFlavorChange('${flavor.id}')">
                <div>
                    <div style="font-weight: 600; font-size: 14px;">${flavor.name}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${flavor.description || ''}</div>
                </div>
            </div>
            <strong style="font-size: 13px; color: var(--primary, #e65100); white-space: nowrap;">R$ ${Number(flavor.price || 0).toFixed(2).replace('.', ',')}</strong>
        `;
        container.appendChild(row);
    });
}

function renderPizzaBordersList() {
    const container = document.getElementById('pizzaBordersList');
    if (!container) return;
    container.innerHTML = '';

    const config = getActivePizzaConfig();
    Object.values(config.borders).forEach(border => {
        const isChecked = border.id === currentPizzaState.selectedBorder ? 'checked' : '';
        const priceLabel = border.price > 0 ? `<strong>+ R$ ${border.price.toFixed(2).replace('.', ',')}</strong>` : '<span style="color: var(--text-muted); font-size: 12px;">GrÃ¡tis</span>';

        const row = document.createElement('label');
        row.className = 'adicional-checkbox-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="pizza_border_radio" value="${border.id}" ${isChecked} onchange="onPizzaBorderChange('${border.id}')">
                <span>${border.name}</span>
            </div>
            ${priceLabel}
        `;
        container.appendChild(row);
    });
}

function renderPizzaExtrasList() {
    const container = document.getElementById('pizzaExtrasList');
    if (!container) return;
    container.innerHTML = '';

    const config = getActivePizzaConfig();
    Object.values(config.extras).forEach(extra => {
        const isChecked = currentPizzaState.selectedExtras.some(e => e.id === extra.id);
        const priceLabel = `<strong>+ R$ ${extra.price.toFixed(2).replace('.', ',')}</strong>`;

        const row = document.createElement('label');
        row.className = 'adicional-checkbox-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" name="pizza_extra_checkbox" value="${extra.id}" ${isChecked ? 'checked' : ''} onchange="onPizzaExtraChange()">
                <span>${extra.name}</span>
            </div>
            ${priceLabel}
        `;
        container.appendChild(row);
    });
}

function onPizzaSizeChange(sizeId) {
    currentPizzaState.selectedSize = sizeId;
    const config = getActivePizzaConfig();
    const size = config.sizes[sizeId] || { maxFlavors: 2 };

    if (currentPizzaState.selectedFlavors.length > size.maxFlavors) {
        currentPizzaState.selectedFlavors = currentPizzaState.selectedFlavors.slice(0, size.maxFlavors);
    }
    renderPizzaFlavorsList();
    updatePizzaPricePreview();
}

function onPizzaFlavorChange(flavorId) {
    const config = getActivePizzaConfig();
    const size = config.sizes[currentPizzaState.selectedSize] || { maxFlavors: 2 };
    const maxFlavors = size.maxFlavors || 2;

    const index = currentPizzaState.selectedFlavors.indexOf(flavorId);
    if (index > -1) {
        if (currentPizzaState.selectedFlavors.length === 1) {
            showToast('A pizza precisa ter pelo menos 1 sabor selecionado.', 'warning');
            renderPizzaFlavorsList();
            return;
        }
        currentPizzaState.selectedFlavors.splice(index, 1);
    } else {
        if (currentPizzaState.selectedFlavors.length >= maxFlavors) {
            showToast(`O tamanho ${size.name} permite no mÃ¡ximo ${maxFlavors} sabor(es).`, 'warning');
            renderPizzaFlavorsList();
            return;
        }
        currentPizzaState.selectedFlavors.push(flavorId);
    }

    renderPizzaFlavorsList();
    updatePizzaPricePreview();
}

function onPizzaRuleChange(rule) {
    currentPizzaState.pricingRule = rule;
    updatePizzaPricePreview();
}

function onPizzaBorderChange(borderId) {
    currentPizzaState.selectedBorder = borderId;
    updatePizzaPricePreview();
}

function onPizzaExtraChange() {
    const checkboxes = document.querySelectorAll('input[name="pizza_extra_checkbox"]:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const config = getActivePizzaConfig();
    currentPizzaState.selectedExtras = selectedIds.map(id => config.extras[id]).filter(Boolean);
    updatePizzaPricePreview();
}

function adjustPizzaQty(delta) {
    if (currentConfiguredProduct) {
        let newQty = (currentConfiguredQuantity || 1) + delta;
        if (newQty < 1) newQty = 1;
        currentConfiguredQuantity = newQty;
        const qtySpan = document.getElementById('pizzaCustomQty');
        if (qtySpan) qtySpan.innerText = newQty;
        updateConfiguredPricePreview();
        return;
    }

    const newQty = (currentPizzaState.quantity || 1) + delta;
    if (newQty < 1) return;
    currentPizzaState.quantity = newQty;
    const qtySpan = document.getElementById('pizzaCustomQty');
    if (qtySpan) qtySpan.innerText = newQty;
    updatePizzaPricePreview();
}

function updatePizzaPricePreview() {
    if (typeof PizzaEngine === 'undefined') return;

    const config = {
        size: currentPizzaState.selectedSize,
        flavors: currentPizzaState.selectedFlavors,
        pricingRule: currentPizzaState.pricingRule,
        border: currentPizzaState.selectedBorder,
        extras: currentPizzaState.selectedExtras,
        quantity: currentPizzaState.quantity
    };

    const activeConfig = getActivePizzaConfig();
    const res = PizzaEngine.buildPizzaItem(config, activeConfig);

    const unitElem = document.getElementById('pizzaModalUnitPrice');
    const totalElem = document.getElementById('pizzaModalTotalPrice');
    const btn = document.getElementById('addPizzaToOrderBtn') || document.getElementById('btnPizzaAddOrder');
    const label = document.getElementById('pizzaAddButtonLabel') || document.getElementById('btnPizzaAddOrderLabel');

    if (!res.success) {
        if (unitElem) unitElem.innerText = 'R$ 0,00';
        if (totalElem) totalElem.innerText = 'R$ 0,00';
        if (label) label.innerText = res.error || 'ConfiguraÃ§Ã£o incompleta';
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        }
        return;
    }

    if (unitElem) unitElem.innerText = `R$ ${res.item.singlePrice.toFixed(2).replace('.', ',')}`;
    if (totalElem) totalElem.innerText = `R$ ${res.item.totalPrice.toFixed(2).replace('.', ',')}`;
    if (label) label.innerText = `Adicionar ao Pedido â€” R$ ${res.item.totalPrice.toFixed(2).replace('.', ',')}`;
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function addPizzaItemToCart() {
    if (typeof PizzaEngine === 'undefined') {
        showToast('Erro: Motor de Pizzas nÃ£o carregado.', 'error');
        return;
    }

    const notesInput = document.getElementById('pizzaCustomNotes');
    const notes = (notesInput && notesInput.value ? notesInput.value.trim() : '') || (currentPizzaState.notes || '').trim();

    const config = {
        size: currentPizzaState.selectedSize,
        flavors: currentPizzaState.selectedFlavors,
        pricingRule: currentPizzaState.pricingRule,
        border: currentPizzaState.selectedBorder,
        extras: currentPizzaState.selectedExtras,
        notes: notes,
        quantity: currentPizzaState.quantity
    };

    const activeConfig = getActivePizzaConfig();
    const res = PizzaEngine.buildPizzaItem(config, activeConfig);

    if (!res.success) {
        showToast(res.error || 'Verifique as opÃ§Ãµes da pizza.', 'warning');
        return;
    }

    cart.push(res.item);
    saveCartToStorage();
    closePizzaCustomizer();
    updateCartUI();
    toggleCart(true);
    showToast(`${res.item.quantity}x ${res.item.name} adicionada ao pedido!`, 'success');

    if (typeof TrackingService !== 'undefined') {
        TrackingService.trackAddToCart(res.item);
    }
}

/* ==========================================================================
   Customizador Dinâmico de Produtos e Pizzas Fina Massa (optionGroups)
   ========================================================================== */

function openGenericProductCustomizer(productId, categoryKey) {
    let product = null;
    if (menuData && menuData.menu_items) {
        if (categoryKey && menuData.menu_items[categoryKey]) {
            const list = Array.isArray(menuData.menu_items[categoryKey]) ? menuData.menu_items[categoryKey] : Object.values(menuData.menu_items[categoryKey]);
            product = list.find(p => String(p.id) === String(productId));
        }
        if (!product) {
            Object.values(menuData.menu_items).forEach(itemsList => {
                if (product) return;
                const arr = Array.isArray(itemsList) ? itemsList : Object.values(itemsList || {});
                const found = arr.find(p => String(p.id) === String(productId));
                if (found) product = found;
            });
        }
    }

    if (!product) {
        showToast('Produto não encontrado no cardápio.', 'warning');
        return;
    }

    currentConfiguredProduct = product;
    currentConfiguredQuantity = 1;
    currentConfiguredComment = '';
    currentConfiguredSelections = {};

    // Inicializa seleções padrão obrigatórias se for crust (seleciona a 1ª opção por padrão)
    const groups = product.optionGroups || [];
    groups.forEach(group => {
        currentConfiguredSelections[group.id] = [];
        const isCrust = group.type === 'crust' || (group.title || '').toLowerCase().includes('preferência');
        if (isCrust && group.options && group.options.length > 0) {
            currentConfiguredSelections[group.id] = [group.options[0]];
        }
    });

    // Atualiza modal headers
    const modal = document.getElementById('pizzaCustomizerModal');
    const title = document.getElementById('pizzaModalTitle');
    const desc = document.getElementById('pizzaModalDesc');
    const img = document.getElementById('pizzaModalHeaderImg');
    const badge = document.getElementById('pizzaModalBadge');
    const priceTag = document.getElementById('pizzaModalPriceTag');
    const qtySpan = document.getElementById('pizzaCustomQty');
    const notesInput = document.getElementById('pizzaCustomNotes');
    const counter = document.getElementById('commentCharCounter');

    if (title) title.innerText = product.name;
    if (desc) desc.innerText = product.description || '';
    if (img) img.src = resolveProductImage(product, categoryKey || product.category);
    if (badge) badge.innerText = product.categoryName || (product.slices ? `${product.slices} Fatias` : 'Fina Massa');
    const displayBase = product.displayPrice !== undefined ? product.displayPrice : (product.basePrice !== undefined ? product.basePrice : (product.price || 0));
    if (priceTag) priceTag.innerText = `R$ ${Number(displayBase).toFixed(2).replace('.', ',')}`;
    if (qtySpan) qtySpan.innerText = '1';
    if (notesInput) notesInput.value = '';
    if (counter) counter.innerText = '0 / 140';

    // Renderiza grupos de opções dinamicamente
    renderDynamicOptionGroups(product);
    updateConfiguredPricePreview();

    if (modal) modal.classList.add('active');
}

function renderDynamicOptionGroups(product) {
    const container = document.getElementById('genericOptionGroupsContainer');
    if (!container) return;
    container.innerHTML = '';

    const groups = product.optionGroups || [];
    if (groups.length === 0) {
        return;
    }

    groups.forEach((group) => {
        const groupCard = document.createElement('div');
        groupCard.className = 'customizer-section';
        groupCard.id = `group_card_${group.id}`;
        groupCard.style.marginBottom = '18px';
        groupCard.style.borderBottom = '1px solid var(--border-color, #eee)';
        groupCard.style.paddingBottom = '16px';

        const max = group.maxSelections || 1;
        const isSingle = max === 1;

        groupCard.innerHTML = `
            <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-color, #222);">${group.title || group.name}</h3>
                    ${group.description ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">${group.description}</p>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="btn-clear-group" id="btn_clear_${group.id}" onclick="clearConfiguredGroup('${group.id}')" style="display: none; font-size: 11px; font-weight: 600; color: #c62828; background: rgba(198, 40, 40, 0.08); border: none; border-radius: 12px; padding: 3px 8px; cursor: pointer;" title="Remover escolha">Limpar</button>
                    <span id="badge_group_${group.id}" style="font-size: 11px; font-weight: 700; background: rgba(0,0,0,0.06); padding: 3px 8px; border-radius: 12px;"></span>
                </div>
            </div>
            <div class="group-options-list" id="group_options_${group.id}" style="display: flex; flex-direction: column; gap: 8px;"></div>
        `;

        const optionsContainer = groupCard.querySelector(`#group_options_${group.id}`);

        (group.options || []).forEach(opt => {
            const optPrice = Number(opt.price || 0);
            const priceLabel = optPrice > 0 
                ? `<strong style="font-size: 13px; color: var(--primary, #74112B); white-space: nowrap;">+ R$ ${optPrice.toFixed(2).replace('.', ',')}</strong>` 
                : '<span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Incluso</span>';

            const optRow = document.createElement('div');
            optRow.className = 'adicional-checkbox-row';
            optRow.id = `opt_row_${group.id}_${opt.id}`;
            optRow.setAttribute('role', 'button');
            optRow.setAttribute('tabindex', '0');
            optRow.style.display = 'flex';
            optRow.style.alignItems = 'center';
            optRow.style.justifyContent = 'space-between';
            optRow.style.padding = '10px 12px';
            optRow.style.border = '1px solid var(--border-color, #eee)';
            optRow.style.borderRadius = '8px';
            optRow.style.cursor = 'pointer';
            optRow.style.background = '#fff';
            optRow.style.transition = 'all 0.15s ease';

            const inputType = isSingle ? 'radio' : 'checkbox';
            const inputName = `opt_group_${group.id}`;
            const imgHTML = opt.image 
                ? `<img src="${opt.image}" alt="${opt.name}" loading="lazy" style="width: 46px; height: 46px; object-fit: cover; border-radius: 8px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.12);" onerror="this.style.display='none'">` 
                : '';

            optRow.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; padding-right: 8px; pointer-events: none;">
                    <input type="${inputType}" id="opt_input_${group.id}_${opt.id}" name="${inputName}" value="${opt.id}" style="margin-top: 0; accent-color: var(--primary, #74112B); flex-shrink: 0; pointer-events: none;">
                    ${imgHTML}
                    <div>
                        <div style="font-weight: 600; font-size: 14px; color: var(--text-color, #222);">${opt.name}</div>
                        ${opt.ingredients ? `<div style="font-size: 12px; color: var(--text-muted); line-height: 1.3; margin-top: 2px;">${opt.ingredients}</div>` : ''}
                    </div>
                </div>
                <div style="pointer-events: none;">${priceLabel}</div>
            `;

            optRow.addEventListener('click', (e) => {
                e.preventDefault();
                onOptionSelectionChange(group, opt, isSingle);
            });

            optRow.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOptionSelectionChange(group, opt, isSingle);
                }
            });

            optionsContainer.appendChild(optRow);
        });

        container.appendChild(groupCard);
        updateOptionGroupUI(group.id);
    });
}

function updateOptionGroupUI(groupId) {
    if (!currentConfiguredProduct) return;
    const group = (currentConfiguredProduct.optionGroups || []).find(g => g.id === groupId);
    if (!group) return;

    const selections = currentConfiguredSelections[groupId] || [];
    const max = group.maxSelections || 1;
    const min = group.minSelections || (group.required ? 1 : 0);
    const isSingle = max === 1;

    (group.options || []).forEach(opt => {
        const row = document.getElementById(`opt_row_${group.id}_${opt.id}`);
        const input = document.getElementById(`opt_input_${group.id}_${opt.id}`);
        const isSelected = selections.some(s => s.id === opt.id);

        if (input) {
            input.checked = isSelected;
        }
        if (row) {
            row.style.border = isSelected ? '1.5px solid var(--primary, #74112B)' : '1px solid var(--border-color, #eee)';
            row.style.background = isSelected ? 'rgba(116, 17, 43, 0.04)' : '#fff';
            row.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        }
    });

    const badge = document.getElementById(`badge_group_${group.id}`);
    const btnClear = document.getElementById(`btn_clear_${group.id}`);

    if (badge) {
        if (selections.length > 0) {
            badge.innerText = isSingle ? '✓ Selecionado' : `✓ ${selections.length}/${max}`;
            badge.style.color = '#2e7d32';
            badge.style.background = 'rgba(46, 125, 50, 0.1)';
        } else {
            const badgeText = group.required ? (isSingle ? 'Obrigatório (1)' : `Obrigatório (${min})`) : 'Opcional';
            const badgeColor = group.required ? 'var(--primary, #74112B)' : 'var(--text-muted, #888)';
            badge.innerText = badgeText;
            badge.style.color = badgeColor;
            badge.style.background = 'rgba(0,0,0,0.06)';
        }
    }

    if (btnClear) {
        btnClear.style.display = selections.length > 0 ? 'inline-block' : 'none';
    }
}

function onOptionSelectionChange(group, option, isSingle) {
    if (!currentConfiguredSelections[group.id]) {
        currentConfiguredSelections[group.id] = [];
    }

    const currentList = currentConfiguredSelections[group.id];
    const isCurrentlySelected = currentList.some(s => s.id === option.id);

    if (isSingle) {
        if (isCurrentlySelected) {
            // Clique na mesma opção já selecionada: remove/deseleciona
            currentConfiguredSelections[group.id] = [];
        } else {
            // Troca ou seleciona o novo sabor
            currentConfiguredSelections[group.id] = [option];
            if (option.image) {
                const modalImg = document.getElementById('pizzaModalHeaderImg');
                if (modalImg) {
                    modalImg.src = option.image;
                }
            }
        }
    } else {
        const max = group.maxSelections || 999;
        const idx = currentList.findIndex(s => s.id === option.id);
        if (!isCurrentlySelected) {
            if (currentList.length >= max) {
                showToast(`Você pode selecionar no máximo ${max} opção(ões) neste grupo.`, 'warning');
                return;
            }
            currentList.push(option);
            if (option.image) {
                const modalImg = document.getElementById('pizzaModalHeaderImg');
                if (modalImg) {
                    modalImg.src = option.image;
                }
            }
        } else {
            currentList.splice(idx, 1);
        }
    }

    // Atualização cirúrgica in-place sem recriar o DOM
    updateOptionGroupUI(group.id);
    updateConfiguredPricePreview();
}

function clearConfiguredGroup(groupId) {
    if (!currentConfiguredProduct) return;
    currentConfiguredSelections[groupId] = [];
    updateOptionGroupUI(groupId);
    updateConfiguredPricePreview();
}
window.clearConfiguredGroup = clearConfiguredGroup;

function onCommentTextInput(el) {
    currentConfiguredComment = (el ? el.value : '').slice(0, 140);
    const counter = document.getElementById('commentCharCounter');
    if (counter) {
        counter.innerText = `${currentConfiguredComment.length} / 140`;
    }
}

function updateConfiguredPricePreview() {
    if (!currentConfiguredProduct || typeof PizzaEngine === 'undefined') return;

    const res = PizzaEngine.buildConfiguredItem(
        currentConfiguredProduct,
        currentConfiguredSelections,
        currentConfiguredComment,
        currentConfiguredQuantity
    );

    const btn = document.getElementById('addPizzaToOrderBtn');
    const label = document.getElementById('pizzaAddButtonLabel');

    if (!res.success) {
        if (label) label.innerText = res.error || 'Configuração incompleta';
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        }
        return;
    }

    if (label) {
        label.innerText = `Adicionar ao Pedido — R$ ${res.item.totalPrice.toFixed(2).replace('.', ',')}`;
    }
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function addConfiguredItemToCart() {
    if (!currentConfiguredProduct) {
        addPizzaItemToCart();
        return;
    }

    if (typeof PizzaEngine === 'undefined') {
        showToast('Erro: Motor de Pizzas não carregado.', 'error');
        return;
    }

    const notesInput = document.getElementById('pizzaCustomNotes');
    const comment = notesInput ? notesInput.value.trim() : currentConfiguredComment;

    const res = PizzaEngine.buildConfiguredItem(
        currentConfiguredProduct,
        currentConfiguredSelections,
        comment,
        currentConfiguredQuantity
    );

    if (!res.success) {
        showToast(res.error || 'Verifique as opções selecionadas.', 'warning');
        return;
    }

    cart.push(res.item);
    saveCartToStorage();
    closePizzaCustomizer();
    updateCartUI();
    toggleCart(true);
    showToast(`${res.item.quantity}x ${res.item.name} adicionado ao pedido!`, 'success');

    if (typeof TrackingService !== 'undefined') {
        TrackingService.trackAddToCart(res.item);
    }
}

function openProductCustomizer(categoryKey, itemId) {
    const itemsObj = menuData?.menu_items?.[categoryKey] || DEFAULT_MENU_FALLBACK.menu_items[categoryKey] || [];
    const items = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj);
    const item = items.find(i => String(i.id) === String(itemId));

    if (!item) return;

    currentCustomizingProduct = { ...item, categoryKey };
    customizerQuantity = 1;

    const modal = document.getElementById('customizerModal');
    const title = document.getElementById('customizerTitle');
    const desc = document.getElementById('customizerDesc');
    const img = document.getElementById('customizerHeaderImg');
    const qtySpan = document.getElementById('customizerQty');
    const notesInput = document.getElementById('itemCustomNotes');

    if (title) title.innerText = item.name;
    if (desc) desc.innerText = item.description || 'Escolha os adicionais e observaÃ§Ãµes.';
    if (img) img.src = resolveProductImage(item, categoryKey);
    if (qtySpan) qtySpan.innerText = '1';
    if (notesInput) notesInput.value = '';

    // Render Adicionais Checklist
    const adicionaisList = document.getElementById('customizerAdicionaisList');
    if (adicionaisList) {
        adicionaisList.innerHTML = '';
        
        // Prioriza adicionais especÃ­ficos configurados no item (ex: Cachorro Big), caso existam, ou fallback geral
        let ads = item.adicionais || item.opcionais;
        if (!ads || Object.keys(ads).length === 0) {
            ads = menuData?.adicionais || DEFAULT_MENU_FALLBACK.adicionais || {
                "maionese_caseira": { "name": "Maionese Caseira", "price": 0.0 },
                "sache_mostarda": { "name": "Sache Mostarda", "price": 0.0 },
                "sache_ketchup": { "name": "Sache Ketchup", "price": 0.0 }
            };
        }
        
        Object.keys(ads).forEach(adKey => {
            const ad = ads[adKey];
            const priceVal = Number(ad.price) || 0;
            const priceLabel = priceVal > 0 ? `<strong>+ R$ ${priceVal.toFixed(2)}</strong>` : '';
            
            const adRow = document.createElement('label');
            adRow.className = 'adicional-checkbox-row';
            adRow.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" name="customizer_adicionais" value="${adKey}" data-name="${ad.name}" data-price="${priceVal}">
                    <span>${ad.name}</span>
                </div>
                ${priceLabel}
            `;
            adicionaisList.appendChild(adRow);
        });
    }

    if (modal) modal.classList.add('active');
}

function closeProductCustomizer() {
    currentCustomizingProduct = null;
    const modal = document.getElementById('customizerModal');
    if (modal) modal.classList.remove('active');
}

function adjustCustomizerQty(delta) {
    customizerQuantity += delta;
    if (customizerQuantity < 1) customizerQuantity = 1;
    const span = document.getElementById('customizerQty');
    if (span) span.innerText = customizerQuantity;
}

function addCustomizedProductToCart() {
    if (!currentCustomizingProduct) return;

    const notesInput = document.getElementById('itemCustomNotes');
    const notes = notesInput ? notesInput.value.trim() : '';

    // Coleta adicionais selecionados
    const checkedBoxes = document.querySelectorAll('input[name="customizer_adicionais"]:checked');
    let selectedAdicionais = [];
    let adicionaisTotal = 0;

    checkedBoxes.forEach(cb => {
        const adName = cb.dataset.name;
        const adPrice = parseFloat(cb.dataset.price) || 0;
        selectedAdicionais.push({ name: adName, price: adPrice });
        adicionaisTotal += adPrice;
    });

    const basePrice = Number(currentCustomizingProduct.price || 0);
    const unitPrice = basePrice + adicionaisTotal;
    const totalPrice = unitPrice * customizerQuantity;

    const cartItem = {
        cartItemId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        id: currentCustomizingProduct.id,
        name: currentCustomizingProduct.name,
        category: currentCustomizingProduct.category || currentCustomizingProduct.categoryKey,
        singlePrice: unitPrice,
        basePrice: basePrice,
        adicionais: selectedAdicionais,
        quantity: customizerQuantity,
        totalPrice: totalPrice,
        notes: notes
    };

    cart.push(cartItem);
    saveCartToStorage();
    closeProductCustomizer();
    updateCartUI();
    toggleCart(true);
    showToast(`${cartItem.quantity}x ${cartItem.name} adicionado ao pedido!`, 'success');

    if (typeof TrackingService !== 'undefined') {
        TrackingService.trackAddToCart(cartItem);
    }
}

/* ==========================================================================
   Cart Management
   ========================================================================== */
function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function loadCartFromStorage() {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
        try {
            cart = JSON.parse(stored);
        } catch (e) {
            cart = [];
        }
    } else {
        cart = [];
    }
}

function updateCartUI() {
    const countBadges = document.querySelectorAll('.cart-badge-count, #cartCountBadge');
    let totalItems = 0;
    let subtotal = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
        subtotal += item.totalPrice;
    });

    countBadges.forEach(b => {
        b.innerText = totalItems;
        if (totalItems > 0) b.classList.remove('display-none');
    });

    const emptyState = document.getElementById('cartEmptyState');
    const content = document.getElementById('cartContent');
    const itemsList = document.getElementById('cartItemsList');

    if (cart.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (content) content.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (content) content.style.display = 'flex';

    if (itemsList) {
        itemsList.innerHTML = '';

        cart.forEach(item => {
            const itemElem = document.createElement('div');
            itemElem.className = 'cart-item-row';

            let flavorsHTML = '';
            if (item.pizza && Array.isArray(item.pizza.flavors) && item.pizza.flavors.length > 0) {
                const fLabels = item.pizza.flavors.map(f => (f.fraction && f.fraction !== '1/1' && f.fraction !== '1') ? `${f.fraction} ${f.name}` : f.name);
                flavorsHTML = `<div class="cart-item-flavors" style="font-size: 11px; color: var(--text-color, #444); margin-top: 2px;">Sabores: ${fLabels.join(' + ')}</div>`;
            } else if (Array.isArray(item.flavorNames) && item.flavorNames.length > 1) {
                flavorsHTML = `<div class="cart-item-flavors" style="font-size: 11px; color: var(--text-color, #444); margin-top: 2px;">Sabores: ${item.flavorNames.join(' + ')}</div>`;
            }

            let borderHTML = '';
            const crustObj = (item.pizza && item.pizza.crust) || item.border;
            if (crustObj && crustObj.name) {
                const crustPrice = Number(crustObj.price || 0);
                borderHTML = `<div class="cart-item-border" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Preferência: ${crustObj.name}${crustPrice > 0 ? ' (+R$ ' + crustPrice.toFixed(2).replace('.', ',') + ')' : ' (Incluso)'}</div>`;
            }

            let adicionaisHTML = '';
            if (item.adicionais && item.adicionais.length > 0) {
                adicionaisHTML = `<div class="cart-item-adicionais" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">+ ${item.adicionais.map(a => a.name).join(', ')}</div>`;
            }

            let notesHTML = (item.comment || item.notes) ? `<div class="cart-item-notes" style="font-size: 11px; color: #f5a623; margin-top: 2px;">Obs: "${item.comment || item.notes}"</div>` : '';
            let unitPriceHTML = item.quantity > 1 ? `<span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">(R$ ${item.singlePrice.toFixed(2).replace('.', ',')} un.)</span>` : '';

            itemElem.innerHTML = `
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.name}</h4>
                    ${flavorsHTML}
                    ${borderHTML}
                    ${adicionaisHTML}
                    ${notesHTML}
                    <span class="cart-item-price">R$ ${item.totalPrice.toFixed(2).replace('.', ',')}${unitPriceHTML}</span>
                </div>
                <div class="cart-item-actions">
                    <div class="qty-stepper">
                        <button type="button" onclick="updateCartItemQty('${item.cartItemId}', -1)">
                            <span class="material-symbols-rounded">remove</span>
                        </button>
                        <span>${item.quantity}</span>
                        <button type="button" onclick="updateCartItemQty('${item.cartItemId}', 1)">
                            <span class="material-symbols-rounded">add</span>
                        </button>
                    </div>
                </div>
            `;

            itemsList.appendChild(itemElem);
        });
    }

    const subtotalElem = document.getElementById('cartSubtotal');
    const deliveryElem = document.getElementById('cartDeliveryFee');
    const totalElem = document.getElementById('cartTotal');

    let deliveryFee = getCalculatedDeliveryFee();
    let total = subtotal + deliveryFee;

    if (subtotalElem) subtotalElem.innerText = `R$ ${subtotal.toFixed(2)}`;
    if (deliveryElem) deliveryElem.innerText = deliveryFee === 0 ? 'GrÃ¡tis' : `R$ ${deliveryFee.toFixed(2)}`;
    if (totalElem) totalElem.innerText = `R$ ${total.toFixed(2)}`;
}
function updateCartItemQty(cartItemId, delta) {
    const index = cart.findIndex(i => i.cartItemId === cartItemId);
    if (index === -1) return;

    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].totalPrice = cart[index].singlePrice * cart[index].quantity;
    }

    saveCartToStorage();
    updateCartUI();
}

function toggleCart(open) {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (open) {
        if (drawer) drawer.classList.add('active');
        if (overlay) overlay.classList.add('active');
    } else {
        if (drawer) drawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
}

function getCalculatedDeliveryFee() {
    if (checkoutType === 'pickup') return 0;
    const select = document.getElementById('addressBairro');
    if (!select || !select.selectedOptions || select.selectedOptions.length === 0) return 0;
    const opt = select.selectedOptions[0];
    return opt && opt.dataset.fee ? parseFloat(opt.dataset.fee) : 0;
}

function onNeighborhoodChange() {
    updateCartUI();
    const checkoutTotal = document.getElementById('checkoutTotalValue');
    if (checkoutTotal) {
        let subtotal = 0;
        cart.forEach(i => subtotal += i.totalPrice);
        let total = subtotal + getCalculatedDeliveryFee();
        checkoutTotal.innerText = `R$ ${total.toFixed(2)}`;
    }
}

/* ==========================================================================
   Checkout Logic
   ========================================================================== */
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast('Seu carrinho estÃ¡ vazio!', 'warning');
        return;
    }
    toggleCart(false);
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.add('active');
    onNeighborhoodChange();
    togglePaymentFields();

    if (typeof TrackingService !== 'undefined') {
        TrackingService.trackInitiateCheckout(cart);
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('active');
}

function setCheckoutType(type) {
    checkoutType = type;
    const delTab = document.getElementById('deliveryTab');
    const pickTab = document.getElementById('pickupTab');
    const addrSec = document.getElementById('addressSection');
    const nameLabel = document.querySelector('label[for="clientName"]');
    const phoneLabel = document.querySelector('label[for="clientPhone"]');

    if (type === 'delivery') {
        if (delTab) delTab.classList.add('active');
        if (pickTab) pickTab.classList.remove('active');
        if (addrSec) addrSec.style.display = 'block';
        if (nameLabel) nameLabel.innerHTML = 'Seu Nome *';
        if (phoneLabel) phoneLabel.innerHTML = 'WhatsApp com DDD *';
    } else {
        if (pickTab) pickTab.classList.add('active');
        if (delTab) delTab.classList.remove('active');
        if (addrSec) addrSec.style.display = 'none';
        if (nameLabel) nameLabel.innerHTML = 'Seu Nome <span style="font-weight: normal; color: var(--text-muted); font-size: 12px;">(Opcional)</span>';
        if (phoneLabel) phoneLabel.innerHTML = 'WhatsApp <span style="font-weight: normal; color: var(--text-muted); font-size: 12px;">(Opcional)</span>';
    }

    onNeighborhoodChange();
}

function togglePaymentFields() {
    const selected = document.querySelector('input[name="payment-method"]:checked')?.value;
    const changeGroup = document.getElementById('cashChangeGroup');
    const pixInst = document.getElementById('pixInstructions');

    if (changeGroup) changeGroup.classList.toggle('display-none', selected !== 'cash');
    if (pixInst) pixInst.classList.toggle('display-none', selected !== 'pix');
}

function captureCustomerLocation() {
    const statusDiv = document.getElementById('locationStatus');
    const btn = document.getElementById('btnGetLocation');

    if (!navigator.geolocation) {
        alert("GeolocalizaÃ§Ã£o nÃ£o suportada no seu navegador.");
        return;
    }

    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.innerText = 'Obtendo localizaÃ§Ã£o GPS...';
    }

    navigator.geolocation.getCurrentPosition((pos) => {
        customerLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        };
        if (statusDiv) {
            statusDiv.style.color = '#25d366';
            statusDiv.innerText = 'âœ“ LocalizaÃ§Ã£o GPS capturada com sucesso!';
        }
        if (btn) btn.classList.add('location-success');
    }, (err) => {
        if (statusDiv) {
            statusDiv.style.color = '#ef5350';
            statusDiv.innerText = 'NÃ£o foi possÃ­vel obter a localizaÃ§Ã£o. Preencha seu endereÃ§o normalmente.';
        }
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function submitOrder() {
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');

    let clientName = nameInput ? nameInput.value.trim() : '';
    let clientPhone = phoneInput ? phoneInput.value.trim() : '';

    if (checkoutType === 'delivery') {
        if (!clientName || !clientPhone) {
            showToast('Preencha seu nome e WhatsApp para a entrega!', 'warning');
            if (!clientName && nameInput) nameInput.focus();
            else if (!clientPhone && phoneInput) phoneInput.focus();
            return;
        }
    } else {
        // Retirada no balcÃ£o sem necessidade de cadastro obrigatÃ³rio
        if (!clientName) clientName = 'Cliente Retirada';
        if (!clientPhone) clientPhone = 'BalcÃ£o';
    }

    let addressData = null;
    if (checkoutType === 'delivery') {
        const street = document.getElementById('addressStreet')?.value.trim();
        const number = document.getElementById('addressNumber')?.value.trim();
        const selectBairro = document.getElementById('addressBairro');
        const neighborhood = selectBairro?.value || 'Centro';
        const reference = document.getElementById('addressRef')?.value.trim() || '';

        if (!street || !number) {
            showToast('Preencha a rua e o nÃºmero da sua entrega!', 'warning');
            return;
        }

        addressData = { street, number, neighborhood, reference };
    }

    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'pix';
    const cashChange = document.getElementById('cashChange')?.value.trim() || '';

    let subtotal = 0;
    cart.forEach(i => subtotal += i.totalPrice);
    const deliveryFee = getCalculatedDeliveryFee();
    const total = subtotal + deliveryFee;

    const orderId = Date.now();
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = now.toLocaleDateString('pt-BR');

    const orderData = {
        id: orderId,
        clientName: clientName,
        clientPhone: clientPhone,
        checkoutType: checkoutType,
        address: addressData,
        location: customerLocation,
        cart: cart,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        total: total,
        paymentMethod: paymentMethod,
        cashChange: cashChange,
        status: 'Pendente',
        timestamp: orderId,
        time: timeFormatted,
        date: dateFormatted
    };

    showGlobalLoading('Gravando seu pedido...');

    function proceedToWhatsApp() {
        hideGlobalLoading();
        closeCheckoutModal();
        cart = [];
        saveCartToStorage();
        updateCartUI();

        if (typeof TrackingService !== 'undefined') {
            TrackingService.trackPurchase(orderData);
        }

        // WhatsApp do restaurante ou fallback
        let targetPhone = (menuData?.settings?.whatsapp || '').replace(/\D/g, '');
        if (!targetPhone) targetPhone = '5554999999999';
        if (targetPhone.length === 10 || targetPhone.length === 11) targetPhone = '55' + targetPhone;

        const message = buildOrderWhatsAppMessage(orderData);
        const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`;
        try {
            const win = window.open(url, '_blank');
            if (!win || win.closed || typeof win.closed === 'undefined') {
                window.location.href = url;
            }
        } catch (e) {
            window.location.href = url;
        }
    }

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('orders/' + orderId).set(orderData)
            .then(() => proceedToWhatsApp())
            .catch(() => proceedToWhatsApp());
    } else {
        proceedToWhatsApp();
    }
}

function buildOrderWhatsAppMessage(order) {
    let text = `ðŸ• *NOVO PEDIDO - FINA MASSA PIZZARIA* ðŸ•\n`;
    text += `*Pedido:* #${order.id}\n`;
    text += `*Data:* ${order.date} Ã s ${order.time}\n\n`;
    text += `ðŸ‘¤ *Cliente:* ${order.clientName}\n`;
    text += `ðŸ“± *Telefone:* ${order.clientPhone}\n`;
    text += `ðŸ“  *Tipo:* ${order.checkoutType === 'delivery' ? 'Entrega (Delivery)' : 'Retirada no BalcÃ£o'}\n`;

    if (order.checkoutType === 'delivery' && order.address) {
        text += `📍 *EndereÃ§o:* ${order.address.street}, NÂº ${order.address.number} - Bairro ${order.address.neighborhood}\n`;
        if (order.address.reference) text += `📌 *Ref:* ${order.address.reference}\n`;
    }

    text += `\n📋 *ITENS DO PEDIDO:*\n`;
    order.cart.forEach(item => {
        const itemTotalStr = (Number(item.totalPrice) || 0).toFixed(2).replace('.', ',');
        text += `• *${item.quantity}x ${item.name}* - R$ ${itemTotalStr}\n`;

        // Sabores / Frações da Pizza
        if (item.pizza && Array.isArray(item.pizza.flavors) && item.pizza.flavors.length > 0) {
            const fLabels = item.pizza.flavors.map(f => (f.fraction && f.fraction !== '1/1' && f.fraction !== '1') ? `${f.fraction} ${f.name}` : f.name);
            text += `   🍕 Sabores: ${fLabels.join(' + ')}\n`;
        } else if (Array.isArray(item.flavorNames) && item.flavorNames.length > 1) {
            text += `   🍕 Sabores: ${item.flavorNames.join(' + ')}\n`;
        }

        // Borda / Preferência
        const crustObj = (item.pizza && item.pizza.crust) || item.border;
        if (crustObj && crustObj.name) {
            const crustPrice = Number(crustObj.price || 0);
            const crustPriceStr = crustPrice > 0 ? ` (+R$ ${crustPrice.toFixed(2).replace('.', ',')})` : ' (Incluso)';
            text += `   🥖 Preferência: ${crustObj.name}${crustPriceStr}\n`;
        }

        // Adicionais
        if (item.adicionais && item.adicionais.length > 0) {
            text += `   + Adicionais: ${item.adicionais.map(a => a.name).join(', ')}\n`;
        }

        // Observação / Comentário
        const comment = item.comment || item.notes;
        if (comment) {
            text += `   📝 Obs: "${comment}"\n`;
        }
    });

    text += `\n💰 *VALORES:*\n`;
    text += `Subtotal: R$ ${(Number(order.subtotal) || 0).toFixed(2).replace('.', ',')}\n`;
    text += `Taxa de Entrega: ${order.deliveryFee === 0 ? 'Grátis' : `R$ ${(Number(order.deliveryFee) || 0).toFixed(2).replace('.', ',')}`}\n`;
    text += `*TOTAL: R$ ${(Number(order.total) || 0).toFixed(2).replace('.', ',')}*\n\n`;

    const payMap = { pix: 'Pix', card: 'CartÃ£o na Entrega', cash: 'Dinheiro' };
    text += `💳 *Forma de Pagamento:* ${payMap[order.paymentMethod] || order.paymentMethod}\n`;
    if (order.paymentMethod === 'pix') {
        const pixKey = menuData?.settings?.pixKey || '';
        if (pixKey) {
            text += `ðŸ”‘ *Chave Pix:* ${pixKey}\n`;
        }
    }
    if (order.paymentMethod === 'cash' && order.cashChange) {
        text += `ðŸ’µ *Troco para:* ${order.cashChange}\n`;
    }

    return text;
}

/* ==========================================================================
   Helpers
   ========================================================================= */
function setActiveCategoryTab(event, sectionId) {
    if (event) event.preventDefault();
    const links = document.querySelectorAll('.categories-nav .nav-link');
    links.forEach(l => l.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    const target = document.getElementById(sectionId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }
}

function onSearchInput() {
    const input = document.getElementById('searchInput');
    const term = (input ? input.value : '').toLowerCase().trim();
    const cards = document.querySelectorAll('.menu-item-card');

    cards.forEach(card => {
        const title = card.querySelector('.product-title')?.innerText.toLowerCase() || '';
        const desc = card.querySelector('.product-desc')?.innerText.toLowerCase() || '';
        if (title.includes(term) || desc.includes(term)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function openPromoModal() {
    const modal = document.getElementById('promoModal');
    if (modal) modal.classList.add('active');
}

function closePromoModal() {
    const modal = document.getElementById('promoModal');
    if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="material-symbols-rounded">check_circle</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showGlobalLoading(text = 'Carregando...') {
    const overlay = document.getElementById('globalLoading');
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.innerText = text;
    if (overlay) overlay.classList.remove('display-none');
}

function hideGlobalLoading() {
    const overlay = document.getElementById('globalLoading');
    if (overlay) overlay.classList.add('display-none');
}



