/**
 * FINA MASSA PIZZARIA - MODULO DE PEDIDO DE ATENDIMENTO / PEDIDO MANUAL
 */
let manualOrderState = {
    origin: 'WhatsApp',
    deliveryType: 'delivery',
    customer: { id: null, name: '', phone: '', street: '', number: '', complement: '', neighborhood: '', bairroKey: '' },
    cart: [],
    selectedCategory: 'all',
    searchProductQuery: '',
    paymentMethod: 'pix',
    cashChange: '',
    deliveryFee: 0,
    subtotal: 0,
    total: 0,
    editingItemIndex: -1
};

let tempCustomizingProduct = null;

function openManualOrderModal() {
    const modal = document.getElementById('manualOrderModal');
    if (!modal) return;

    resetManualOrderForm();
    renderManualOrderCategories();
    renderManualOrderProducts();
    populateManualOrderBairros();

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';

    setTimeout(() => {
        const searchInput = document.getElementById('manualCustomerSearchInput');
        if (searchInput) searchInput.focus();
    }, 150);
}

function closeManualOrderModal() {
    const modal = document.getElementById('manualOrderModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 200);
}

function resetManualOrderForm() {
    manualOrderState = {
        origin: 'WhatsApp',
        deliveryType: 'delivery',
        customer: { id: null, name: '', phone: '', street: '', number: '', complement: '', neighborhood: '', bairroKey: '' },
        cart: [],
        selectedCategory: 'all',
        searchProductQuery: '',
        paymentMethod: 'pix',
        cashChange: '',
        deliveryFee: 0,
        subtotal: 0,
        total: 0,
        editingItemIndex: -1
    };

    const searchInput = document.getElementById('manualCustomerSearchInput');
    const phoneInput = document.getElementById('manualClientPhone');
    const nameInput = document.getElementById('manualClientName');
    const streetInput = document.getElementById('manualClientStreet');
    const numberInput = document.getElementById('manualClientNumber');
    const compInput = document.getElementById('manualClientComplement');
    const bairroSelect = document.getElementById('manualClientBairro');
    const cashChangeInput = document.getElementById('manualCashChange');
    const searchProdInput = document.getElementById('manualSearchProduct');

    if (searchInput) searchInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (nameInput) nameInput.value = '';
    if (streetInput) streetInput.value = '';
    if (numberInput) numberInput.value = '';
    if (compInput) compInput.value = '';
    if (bairroSelect) bairroSelect.value = '';
    if (cashChangeInput) cashChangeInput.value = '';
    if (searchProdInput) searchProdInput.value = '';

    setManualOrderOrigin('WhatsApp');
    setManualOrderDeliveryType('delivery');
    setManualOrderPaymentMethod('pix');

    const foundBadge = document.getElementById('manualCustomerFoundBadge');
    const historyContainer = document.getElementById('manualCustomerHistoryContainer');
    const searchResultsBox = document.getElementById('manualCustomerSearchResultsContainer');

    if (foundBadge) foundBadge.classList.add('display-none');
    if (historyContainer) historyContainer.classList.add('display-none');
    if (searchResultsBox) searchResultsBox.classList.add('display-none');

    updateManualOrderCartUI();
}

function setManualOrderOrigin(origin) {
    manualOrderState.origin = origin;
    const originButtons = document.querySelectorAll('.manual-origin-btn');
    originButtons.forEach(btn => {
        if (btn.getAttribute('data-origin') === origin) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (origin === 'balcao') {
        setManualOrderDeliveryType('pickup');
    }
}

function setManualOrderDeliveryType(type) {
    manualOrderState.deliveryType = type;
    const typeButtons = document.querySelectorAll('.manual-delivery-type-btn');
    typeButtons.forEach(btn => {
        if (btn.getAttribute('data-type') === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const addressSection = document.getElementById('manualAddressFieldsContainer');
    const phoneLabel = document.querySelector('label[for="manualClientPhone"]');
    const nameLabel = document.querySelector('label[for="manualClientName"]');
    const nameInput = document.getElementById('manualClientName');
    const phoneInput = document.getElementById('manualClientPhone');

    if (type === 'delivery') {
        if (addressSection) addressSection.classList.remove('display-none');
        if (phoneLabel) phoneLabel.innerHTML = 'Telefone / WhatsApp <span style="color: #ef5350;">*</span>';
        if (nameLabel) nameLabel.innerHTML = 'Nome do Cliente <span style="color: #ef5350;">*</span>';
        if (nameInput) nameInput.placeholder = 'Ex: João da Silva';
    } else {
        if (addressSection) addressSection.classList.add('display-none');
        if (phoneLabel) phoneLabel.innerHTML = 'Telefone / WhatsApp <span style="color: var(--text-muted); font-size: 11px;">(Opcional no Balcão)</span>';
        if (nameLabel) nameLabel.innerHTML = 'Nome do Cliente <span style="color: var(--text-muted); font-size: 11px;">(Opcional no Balcão)</span>';
        if (nameInput) nameInput.placeholder = 'Cliente Balcão (ou informe nome)';
    }
    recalculateManualOrderTotals();
}

function setManualOrderPaymentMethod(method) {
    manualOrderState.paymentMethod = method;
    const payButtons = document.querySelectorAll('.manual-pay-btn');
    payButtons.forEach(btn => {
        if (btn.getAttribute('data-pay') === method) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const cashChangeContainer = document.getElementById('manualCashChangeContainer');
    if (cashChangeContainer) {
        if (method === 'cash') {
            cashChangeContainer.classList.remove('display-none');
        } else {
            cashChangeContainer.classList.add('display-none');
        }
    }
}

// ==========================================================================
// Busca Unificada: Por Nome ou Por Telefone
// ==========================================================================
function handleCustomerSearchInput(query) {
    const trimmed = (query || '').trim();
    const resultsBox = document.getElementById('manualCustomerSearchResultsContainer');
    const resultsList = document.getElementById('manualCustomerSearchResultsList');

    if (!trimmed || trimmed.length < 2) {
        if (resultsBox) resultsBox.classList.add('display-none');
        return;
    }

    if (typeof buildFullCustomersList === 'function') {
        buildFullCustomersList();
    }

    const normQuery = normalizeCustomerText(trimmed);
    const queryDigits = trimmed.replace(/\D/g, '');

    const matches = allCustomersList.filter(c => {
        const nameNorm = normalizeCustomerText(c.name);
        const phoneDigits = String(c.phone || c.id || '').replace(/\D/g, '');

        const nameMatches = nameNorm.includes(normQuery);
        const phoneMatches = queryDigits.length >= 3 && phoneDigits.includes(queryDigits);

        return nameMatches || phoneMatches;
    });

    if (matches.length > 0) {
        if (resultsList) {
            resultsList.innerHTML = '';
            matches.slice(0, 6).forEach(cust => {
                const item = document.createElement('div');
                item.className = 'manual-search-result-item';

                const cleanP = String(cust.phone || cust.id).replace(/\D/g, '');
                const formattedP = cust.phone || cleanP;
                const addr = cust.neighborhood ? `Bairro: ${cust.neighborhood}` : (cust.street || 'Sem endereço');

                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(156, 39, 176, 0.2); color: #ce93d8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px;">
                            ${(cust.name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">${cust.name || 'Cliente'}</div>
                            <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 6px;">
                                <span>📱 ${formattedP}</span>
                                <span>📍 ${addr}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-select-customer" onclick="selectManualOrderCustomer('${cleanP}')">
                        Selecionar
                    </button>
                `;
                resultsList.appendChild(item);
            });
        }
        if (resultsBox) resultsBox.classList.remove('display-none');
    } else {
        if (resultsBox) resultsBox.classList.add('display-none');
        if (queryDigits.length >= 8) {
            const phoneInput = document.getElementById('manualClientPhone');
            if (phoneInput && !phoneInput.value) phoneInput.value = trimmed;
        } else {
            const nameInput = document.getElementById('manualClientName');
            if (nameInput && !nameInput.value) nameInput.value = trimmed;
        }
    }
}

function selectManualOrderCustomer(cleanPhone) {
    cleanPhone = String(cleanPhone).replace(/\D/g, '');
    const customer = allCustomersList.find(c => String(c.phone || c.id).replace(/\D/g, '') === cleanPhone);
    if (!customer) return;

    const resultsBox = document.getElementById('manualCustomerSearchResultsContainer');
    if (resultsBox) resultsBox.classList.add('display-none');

    manualOrderState.customer = {
        id: cleanPhone,
        name: customer.name || '',
        phone: customer.phone || cleanPhone,
        street: customer.street || '',
        number: customer.number || '',
        complement: customer.complement || '',
        neighborhood: customer.neighborhood || '',
        bairroKey: customer.bairroKey || ''
    };

    const phoneInput = document.getElementById('manualClientPhone');
    const nameInput = document.getElementById('manualClientName');
    const streetInput = document.getElementById('manualClientStreet');
    const numberInput = document.getElementById('manualClientNumber');
    const compInput = document.getElementById('manualClientComplement');
    const bairroSelect = document.getElementById('manualClientBairro');
    const searchInput = document.getElementById('manualCustomerSearchInput');

    if (searchInput) searchInput.value = customer.name || customer.phone || '';
    if (phoneInput) phoneInput.value = customer.phone || cleanPhone;
    if (nameInput) nameInput.value = customer.name || '';
    if (streetInput) streetInput.value = customer.street || '';
    if (numberInput) numberInput.value = customer.number || '';
    if (compInput) compInput.value = customer.complement || '';

    if (bairroSelect && (customer.bairroKey || customer.neighborhood)) {
        for (let i = 0; i < bairroSelect.options.length; i++) {
            const opt = bairroSelect.options[i];
            if (opt.value === customer.bairroKey || opt.text.toLowerCase().includes(String(customer.neighborhood).toLowerCase())) {
                bairroSelect.selectedIndex = i;
                break;
            }
        }
        handleManualBairroChange();
    }

    const foundBadge = document.getElementById('manualCustomerFoundBadge');
    if (foundBadge) {
        foundBadge.innerHTML = `<span class="material-symbols-rounded" style="font-size: 16px;">verified</span> <span>Cliente: <strong>${customer.name}</strong></span>`;
        foundBadge.classList.remove('display-none');
        foundBadge.style.background = 'rgba(46, 125, 50, 0.15)';
        foundBadge.style.borderColor = 'rgba(76, 175, 80, 0.4)';
        foundBadge.style.color = '#81c784';
    }

    loadAndRenderCustomerHistory(cleanPhone, customer.name);
}

function handlePhoneInputMask(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);

    if (value.length > 6) {
        value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
    } else if (value.length > 2) {
        value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
    }
    input.value = value;

    const cleanNumber = input.value.replace(/\D/g, '');
    if (cleanNumber.length >= 10) {
        searchCustomerByPhone(cleanNumber);
    }
}

async function searchCustomerByPhone(phoneQuery) {
    const cleanPhone = String(phoneQuery || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) return;

    if (typeof buildFullCustomersList === 'function') {
        buildFullCustomersList();
    }

    const found = allCustomersList.find(c => String(c.phone || c.id).replace(/\D/g, '') === cleanPhone);
    if (found) {
        selectManualOrderCustomer(cleanPhone);
    }
}

function loadAndRenderCustomerHistory(cleanPhone, customerName) {
    const historyContainer = document.getElementById('manualCustomerHistoryContainer');
    const historyList = document.getElementById('manualCustomerHistoryList');
    if (!historyContainer || !historyList) return;

    let custOrders = [];
    if (typeof orders !== 'undefined' && Array.isArray(orders)) {
        custOrders = orders.filter(o => {
            if (!o || !o.clientPhone) return false;
            const oPhone = String(o.clientPhone).replace(/\D/g, '');
            return oPhone === cleanPhone || (customerName && o.clientName && normalizeCustomerText(o.clientName) === normalizeCustomerText(customerName));
        });
        custOrders.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
    }

    if (custOrders.length > 0) {
        historyList.innerHTML = '';
        custOrders.slice(0, 3).forEach(order => {
            const item = document.createElement('div');
            item.className = 'manual-history-item';
            
            const cartItems = Array.isArray(order.cart) ? order.cart : Object.values(order.cart || {});
            const itemsSummary = cartItems.map(it => `${it.quantity}x ${it.name}`).join(', ');

            item.innerHTML = `
                <div class="manual-history-info">
                    <div class="manual-history-title">
                        <strong>Pedido #${order.id}</strong>
                        <span>${order.date || ''} às ${order.time || ''} • R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="manual-history-desc">${itemsSummary || 'Itens diversos'}</div>
                </div>
                <button type="button" class="btn-repeat-order" onclick="repeatPreviousOrder('${order.id}')" title="Copiar itens deste pedido para o novo pedido">
                    <span class="material-symbols-rounded" style="font-size: 16px;">replay</span>
                    <span>Repetir Pedido</span>
                </button>
            `;
            historyList.appendChild(item);
        });
        historyContainer.classList.remove('display-none');
    } else {
        historyContainer.classList.add('display-none');
    }
}

function repeatPreviousOrder(orderId) {
    if (typeof orders === 'undefined' || !Array.isArray(orders)) return;
    const targetOrder = orders.find(o => String(o.id) === String(orderId));
    if (!targetOrder || !targetOrder.cart) {
        if (typeof showToast === 'function') showToast('Não foi possível carregar os itens do pedido anterior.', 'error');
        return;
    }

    const cartSource = Array.isArray(targetOrder.cart) ? targetOrder.cart : Object.values(targetOrder.cart);
    manualOrderState.cart = cartSource.map(item => {
        return {
            id: item.id || ('prod_' + Math.random().toString(36).substr(2, 6)),
            name: item.name || 'Produto',
            price: Number(item.price || item.singlePrice || 0),
            quantity: Number(item.quantity || 1),
            adicionais: Array.isArray(item.adicionais) ? [...item.adicionais] : [],
            notes: item.notes || '',
            totalPrice: Number(item.totalPrice || (Number(item.price || item.singlePrice || 0) * (Number(item.quantity) || 1)))
        };
    });

    updateManualOrderCartUI();
    if (typeof showToast === 'function') {
        showToast('Itens do pedido anterior carregados no carrinho! Você pode revisar e editar.', 'success');
    }
}

// ==========================================================================
// Catalogo de Produtos e Filtros
// ==========================================================================
function renderManualOrderCategories() {
    const container = document.getElementById('manualCategoryFilterContainer');
    if (!container) return;

    container.innerHTML = '';
    
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `manual-cat-pill ${manualOrderState.selectedCategory === 'all' ? 'active' : ''}`;
    allBtn.textContent = 'Todos';
    allBtn.onclick = () => {
        manualOrderState.selectedCategory = 'all';
        renderManualOrderCategories();
        renderManualOrderProducts();
    };
    container.appendChild(allBtn);

    if (!menuData || !menuData.menu_items) return;

    const catLabels = {
        'pizzas_tradicionais': 'Pizzas Tradicionais',
        'pizzas_especiais': 'Pizzas Especiais',
        'pizzas_salgadas': 'Pizzas Salgadas',
        'pizzas_doces': 'Pizzas Doces',
        'calzones': 'Calzones',
        'bebidas': 'Bebidas'
    };

    Object.keys(menuData.menu_items).forEach(catKey => {
        const label = catLabels[catKey] || catKey.charAt(0).toUpperCase() + catKey.slice(1);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `manual-cat-pill ${manualOrderState.selectedCategory === catKey ? 'active' : ''}`;
        btn.textContent = label;
        btn.onclick = () => {
            manualOrderState.selectedCategory = catKey;
            renderManualOrderCategories();
            renderManualOrderProducts();
        };
        container.appendChild(btn);
    });
}

function renderManualOrderProducts() {
    const grid = document.getElementById('manualProductsGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!menuData || !menuData.menu_items) {
        grid.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center; grid-column: 1 / -1;">Nenhum produto cadastrado no cardápio.</div>';
        return;
    }

    const query = normalizeCustomerText(manualOrderState.searchProductQuery);
    let allProducts = [];

    Object.entries(menuData.menu_items).forEach(([catKey, items]) => {
        if (manualOrderState.selectedCategory !== 'all' && manualOrderState.selectedCategory !== catKey) {
            return;
        }
        if (Array.isArray(items)) {
            items.forEach(item => {
                if (item.available !== false) {
                    allProducts.push({ ...item, categoryKey: catKey });
                }
            });
        }
    });

    if (query) {
        allProducts = allProducts.filter(p => {
            const nameMatch = normalizeCustomerText(p.name).includes(query);
            const descMatch = normalizeCustomerText(p.description).includes(query);
            return nameMatch || descMatch;
        });
    }

    if (allProducts.length === 0) {
        grid.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center; grid-column: 1 / -1;">Nenhum produto encontrado nesta busca.</div>';
        return;
    }

    allProducts.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'manual-product-card';

        const priceVal = Number(prod.price || 0);
        const priceFormatted = `R$ ${priceVal.toFixed(2).replace('.', ',')}`;
        const imageSrc = prod.image ? `../${prod.image}` : '../assets/pizza_hero.png';

        card.innerHTML = `
            <img src="${imageSrc}" alt="${prod.name}" class="manual-product-img" onerror="this.src='../assets/pizza_hero.png'">
            <div class="manual-product-details">
                <div class="manual-product-name">${prod.name}</div>
                <div class="manual-product-desc">${prod.description || ''}</div>
                <div class="manual-product-bottom">
                    <span class="manual-product-price">${priceFormatted}</span>
                    <button type="button" class="manual-product-add-btn" onclick="openProductCustomizationModal('${prod.id}', '${prod.categoryKey}')">
                        <span class="material-symbols-rounded" style="font-size: 16px;">add</span>
                        <span>Adicionar</span>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function handleManualSearchProduct(query) {
    manualOrderState.searchProductQuery = query;
    renderManualOrderProducts();
}

function openProductCustomizationModal(productId, categoryKey) {
    if (!menuData || !menuData.menu_items || !menuData.menu_items[categoryKey]) return;
    const product = menuData.menu_items[categoryKey].find(p => String(p.id) === String(productId));
    if (!product) return;

    tempCustomizingProduct = {
        id: product.id,
        name: product.name,
        basePrice: Number(product.price || 0),
        categoryKey: categoryKey,
        quantity: 1,
        selectedAdicionais: [],
        notes: ''
    };

    const modal = document.getElementById('manualItemCustomizationModal');
    const titleEl = document.getElementById('customModalItemTitle');
    const basePriceEl = document.getElementById('customModalBasePrice');
    const notesInput = document.getElementById('customModalItemNotes');
    const qtyInput = document.getElementById('customModalItemQty');
    const adicionaisList = document.getElementById('customModalAdicionaisList');

    if (titleEl) titleEl.textContent = product.name;
    if (basePriceEl) basePriceEl.textContent = `R$ ${tempCustomizingProduct.basePrice.toFixed(2).replace('.', ',')}`;
    if (notesInput) notesInput.value = '';
    if (qtyInput) qtyInput.value = 1;

    if (adicionaisList) {
        adicionaisList.innerHTML = '';
        let availableAdicionais = [];
        if (product.adicionais && typeof product.adicionais === 'object') {
            Object.entries(product.adicionais).forEach(([k, a]) => {
                availableAdicionais.push({ key: k, name: a.name || k, price: Number(a.price || 0) });
            });
        }
        if (availableAdicionais.length === 0 && menuData.adicionais && typeof menuData.adicionais === 'object') {
            Object.entries(menuData.adicionais).forEach(([k, a]) => {
                availableAdicionais.push({ key: k, name: a.name || k, price: Number(a.price || 0) });
            });
        }
        if (availableAdicionais.length === 0 && Array.isArray(product.optionGroups)) {
            const crustGrp = product.optionGroups.find(g => g.id === 'crust' || g.type === 'crust');
            if (crustGrp && Array.isArray(crustGrp.options)) {
                crustGrp.options.forEach(opt => {
                    if (Number(opt.price || 0) > 0) {
                        availableAdicionais.push({ key: opt.id, name: opt.name, price: Number(opt.price || 0) });
                    }
                });
            }
        }

        if (availableAdicionais.length > 0) {
            availableAdicionais.forEach(add => {
                const addRow = document.createElement('label');
                addRow.className = 'manual-adicional-checkbox-row';
                const addPriceText = add.price > 0 ? `+ R$ ${add.price.toFixed(2).replace('.', ',')}` : 'Grátis';
                addRow.innerHTML = `
                    <input type="checkbox" data-key="${add.key}" data-name="${add.name}" data-price="${add.price}" onchange="updateCustomizingItemSubtotal()">
                    <span class="manual-adicional-name">${add.name}</span>
                    <span class="manual-adicional-price">${addPriceText}</span>
                `;
                adicionaisList.appendChild(addRow);
            });
        } else {
            adicionaisList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 6px 0;">Nenhum adicional específico cadastrado para este item.</div>';
        }
    }

    updateCustomizingItemSubtotal();

    if (modal) {
        modal.classList.remove('display-none');
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
    }
}

function closeProductCustomizationModal() {
    const modal = document.getElementById('manualItemCustomizationModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 150);
}

function changeCustomizingQty(delta) {
    if (!tempCustomizingProduct) return;
    let newQty = (tempCustomizingProduct.quantity || 1) + delta;
    if (newQty < 1) newQty = 1;
    tempCustomizingProduct.quantity = newQty;
    const qtyInput = document.getElementById('customModalItemQty');
    if (qtyInput) qtyInput.value = newQty;
    updateCustomizingItemSubtotal();
}

function updateCustomizingItemSubtotal() {
    if (!tempCustomizingProduct) return;
    const qty = tempCustomizingProduct.quantity || 1;
    let singleTotal = tempCustomizingProduct.basePrice;

    const checkboxes = document.querySelectorAll('#customModalAdicionaisList input[type="checkbox"]:checked');
    const selected = [];
    checkboxes.forEach(cb => {
        const p = Number(cb.getAttribute('data-price') || 0);
        const n = cb.getAttribute('data-name');
        selected.push({ name: n, price: p });
        singleTotal += p;
    });

    tempCustomizingProduct.selectedAdicionais = selected;
    const subtotal = singleTotal * qty;

    const btnTotalEl = document.getElementById('customModalBtnTotal');
    if (btnTotalEl) {
        btnTotalEl.textContent = `Adicionar • R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    }
}

function confirmAddCustomizedProduct() {
    if (!tempCustomizingProduct) return;

    const notesInput = document.getElementById('customModalItemNotes');
    const notes = notesInput ? notesInput.value.trim() : '';

    let singleItemPrice = tempCustomizingProduct.basePrice;
    (tempCustomizingProduct.selectedAdicionais || []).forEach(a => {
        singleItemPrice += Number(a.price || 0);
    });

    const quantity = tempCustomizingProduct.quantity || 1;
    const totalPrice = singleItemPrice * quantity;

    manualOrderState.cart.push({
        id: tempCustomizingProduct.id,
        name: tempCustomizingProduct.name,
        price: tempCustomizingProduct.basePrice,
        singlePrice: singleItemPrice,
        quantity: quantity,
        adicionais: tempCustomizingProduct.selectedAdicionais || [],
        notes: notes,
        totalPrice: totalPrice
    });

    closeProductCustomizationModal();
    updateManualOrderCartUI();

    if (typeof showToast === 'function') {
        showToast(`${quantity}x ${tempCustomizingProduct.name} adicionado ao pedido!`, 'success');
    }
}

function updateManualOrderCartUI() {
    const list = document.getElementById('manualCartItemsList');
    const emptyMsg = document.getElementById('manualCartEmptyMessage');

    if (!list) return;
    list.innerHTML = '';

    if (manualOrderState.cart.length === 0) {
        if (emptyMsg) emptyMsg.classList.remove('display-none');
    } else {
        if (emptyMsg) emptyMsg.classList.add('display-none');

        manualOrderState.cart.forEach((item, index) => {
            const itemRow = document.createElement('div');
            itemRow.className = 'manual-cart-item-row';

            const adicionaisText = (item.adicionais && item.adicionais.length > 0)
                ? `<div class="manual-cart-item-adds">+ ${item.adicionais.map(a => a.name).join(', ')}</div>`
                : '';

            const notesText = item.notes
                ? `<div class="manual-cart-item-notes"><strong style="color: #f5a623;">Obs:</strong> "${item.notes}"</div>`
                : '';

            itemRow.innerHTML = `
                <div class="manual-cart-item-main">
                    <div class="manual-cart-item-title">
                        <span class="manual-cart-item-name">${item.name}</span>
                        <span class="manual-cart-item-price">R$ ${Number(item.totalPrice || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                    ${adicionaisText}
                    ${notesText}
                </div>
                <div class="manual-cart-item-actions">
                    <div class="manual-cart-qty-picker">
                        <button type="button" onclick="changeCartItemQuantity(${index}, -1)" title="Diminuir">-</button>
                        <span>${item.quantity}</span>
                        <button type="button" onclick="changeCartItemQuantity(${index}, 1)" title="Aumentar">+</button>
                    </div>
                    <button type="button" class="manual-cart-item-delete" onclick="removeCartItem(${index})" title="Remover item">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            `;
            list.appendChild(itemRow);
        });
    }

    recalculateManualOrderTotals();
}

function changeCartItemQuantity(index, delta) {
    const item = manualOrderState.cart[index];
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        manualOrderState.cart.splice(index, 1);
    } else {
        const single = item.singlePrice || item.price || 0;
        item.totalPrice = single * item.quantity;
    }
    updateManualOrderCartUI();
}

function removeCartItem(index) {
    manualOrderState.cart.splice(index, 1);
    updateManualOrderCartUI();
}

function populateManualOrderBairros() {
    const select = document.getElementById('manualClientBairro');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecione o Bairro --</option>';

    if (menuData && menuData.settings && menuData.settings.deliveryFees) {
        const bairros = Object.entries(menuData.settings.deliveryFees)
            .filter(([k, b]) => b.active !== false)
            .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''));

        bairros.forEach(([k, b]) => {
            const feeVal = Number(b.fee || 0);
            const feeTxt = feeVal === 0 ? 'Frete Grátis' : `Taxa: R$ ${feeVal.toFixed(2).replace('.', ',')}`;
            const opt = document.createElement('option');
            opt.value = k;
            opt.setAttribute('data-fee', feeVal);
            opt.setAttribute('data-name', b.name || k);
            opt.textContent = `${b.name || k} (${feeTxt})`;
            select.appendChild(opt);
        });
    }
}

function handleManualBairroChange() {
    const select = document.getElementById('manualClientBairro');
    if (!select) return;

    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.value) {
        const fee = Number(selectedOption.getAttribute('data-fee') || 0);
        const name = selectedOption.getAttribute('data-name') || selectedOption.text;
        manualOrderState.customer.bairroKey = selectedOption.value;
        manualOrderState.customer.neighborhood = name;
        manualOrderState.deliveryFee = fee;
    } else {
        manualOrderState.customer.bairroKey = '';
        manualOrderState.customer.neighborhood = '';
        manualOrderState.deliveryFee = 0;
    }

    recalculateManualOrderTotals();
}

function recalculateManualOrderTotals() {
    let subtotal = 0;
    manualOrderState.cart.forEach(item => {
        subtotal += Number(item.totalPrice || 0);
    });

    let deliveryFee = 0;
    if (manualOrderState.deliveryType === 'delivery') {
        deliveryFee = Number(manualOrderState.deliveryFee || 0);
    }

    const total = subtotal + deliveryFee;

    manualOrderState.subtotal = subtotal;
    manualOrderState.total = total;

    const subtotalEl = document.getElementById('manualCartSubtotalDisplay');
    const feeEl = document.getElementById('manualCartDeliveryFeeDisplay');
    const totalEl = document.getElementById('manualCartTotalDisplay');

    if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    if (feeEl) {
        if (manualOrderState.deliveryType === 'delivery') {
            feeEl.textContent = deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`;
        } else {
            feeEl.textContent = 'R$ 0,00 (Retirada)';
        }
    }
    if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

async function finalizeManualOrder(event) {
    if (event) event.preventDefault();

    if (manualOrderState.cart.length === 0) {
        if (typeof showToast === 'function') showToast('Adicione pelo menos 1 produto ao pedido!', 'error');
        return;
    }

    const phoneInput = document.getElementById('manualClientPhone');
    const nameInput = document.getElementById('manualClientName');
    const streetInput = document.getElementById('manualClientStreet');
    const numberInput = document.getElementById('manualClientNumber');
    const compInput = document.getElementById('manualClientComplement');
    const bairroSelect = document.getElementById('manualClientBairro');
    const cashChangeInput = document.getElementById('manualCashChange');

    const clientPhoneRaw = phoneInput ? phoneInput.value.trim() : '';
    let clientName = nameInput ? nameInput.value.trim() : '';
    let clientPhone = clientPhoneRaw;

    if (manualOrderState.deliveryType === 'delivery') {
        if (!clientName) {
            if (typeof showToast === 'function') showToast('Por favor, informe o nome do cliente para a tele-entrega!', 'error');
            if (nameInput) nameInput.focus();
            return;
        }
        if (!clientPhone) {
            if (typeof showToast === 'function') showToast('Por favor, informe o telefone do cliente para a tele-entrega!', 'error');
            if (phoneInput) phoneInput.focus();
            return;
        }
    } else {
        // Retirada no balcão sem necessidade de cadastramento prévio
        if (!clientName) clientName = 'Cliente Balcão';
        if (!clientPhone) clientPhone = 'Balcão';
    }

    let addressData = null;
    if (manualOrderState.deliveryType === 'delivery') {
        const street = streetInput ? streetInput.value.trim() : '';
        const number = numberInput ? numberInput.value.trim() : '';
        const comp = compInput ? compInput.value.trim() : '';
        const selectedBairro = bairroSelect ? bairroSelect.options[bairroSelect.selectedIndex] : null;

        if (!street) {
            if (typeof showToast === 'function') showToast('Informe a rua para a entrega!', 'error');
            if (streetInput) streetInput.focus();
            return;
        }

        if (!selectedBairro || !selectedBairro.value) {
            if (typeof showToast === 'function') showToast('Selecione o bairro da entrega para calcular a taxa!', 'error');
            if (bairroSelect) bairroSelect.focus();
            return;
        }

        const neighborhoodName = selectedBairro.getAttribute('data-name') || selectedBairro.text.split('(')[0].trim();

        addressData = {
            street: street,
            number: number || 'S/N',
            neighborhood: neighborhoodName,
            reference: comp,
            complement: comp,
            bairroKey: selectedBairro.value
        };
    }

    const now = new Date();
    const orderId = Date.now();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let cashChangeVal = null;
    if (manualOrderState.paymentMethod === 'cash' && cashChangeInput && cashChangeInput.value) {
        cashChangeVal = Number(cashChangeInput.value.replace(',', '.'));
    }

    const orderPayload = {
        id: orderId,
        clientName: clientName,
        clientPhone: clientPhone || 'Não informado',
        checkoutType: manualOrderState.deliveryType,
        origin: 'manual',
        origem: 'manual',
        canalOrigem: manualOrderState.origin || 'Atendimento',
        address: addressData,
        cart: manualOrderState.cart,
        subtotal: manualOrderState.subtotal,
        deliveryFee: manualOrderState.deliveryType === 'delivery' ? manualOrderState.deliveryFee : 0,
        total: manualOrderState.total,
        paymentMethod: manualOrderState.paymentMethod,
        cashChange: cashChangeVal,
        status: 'Pendente',
        timestamp: orderId,
        time: timeFormatted,
        date: dateFormatted,
        createdAt: orderId
    };

    if (typeof showLoading === 'function') showLoading('Gravando pedido manual no sistema...');

    try {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            await firebase.database().ref(`orders/${orderId}`).set(orderPayload);

            const cleanPhone = clientPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 8) {
                const customerRecord = {
                    id: cleanPhone,
                    name: clientName,
                    phone: clientPhone,
                    street: addressData ? addressData.street : '',
                    number: addressData ? addressData.number : '',
                    complement: addressData ? addressData.complement : '',
                    neighborhood: addressData ? addressData.neighborhood : '',
                    bairroKey: addressData ? addressData.bairroKey : '',
                    lastOrderId: orderId,
                    lastOrderDate: dateFormatted,
                    updatedAt: Date.now()
                };
                firebase.database().ref(`menu/customers/${cleanPhone}`).set(customerRecord).catch(e => console.warn(e));
                firebase.database().ref(`customers/${cleanPhone}`).set(customerRecord).catch(e => console.warn(e));
            }
        } else {
            if (typeof orders !== 'undefined') {
                orders.unshift(orderPayload);
                if (typeof renderOrdersList === 'function') renderOrdersList();
            }
        }

        if (typeof hideLoading === 'function') hideLoading();
        closeManualOrderModal();

        if (typeof showToast === 'function') {
            showToast(`Pedido #${orderId} cadastrado com sucesso! (${manualOrderState.origin})`, 'success');
        }

        if (typeof playNewOrderSound === 'function') {
            playNewOrderSound();
        }

    } catch (err) {
        if (typeof hideLoading === 'function') hideLoading();
        console.error("Erro ao salvar pedido manual no Firebase:", err);
        if (typeof showToast === 'function') {
            showToast('Erro ao salvar pedido: ' + err.message, 'error');
        }
    }
}

