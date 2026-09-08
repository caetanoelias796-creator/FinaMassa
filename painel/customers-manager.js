/**
 * ==============================================================================
 * FINA MASSA PIZZARIA — GERENCIADOR DE CLIENTES (CUSTOMERS MANAGER)
 * ==============================================================================
 * Gerenciamento centralizado de clientes, histórico de pedidos, busca
 * inteligente e integração com o módulo de pedidos manuais.
 */

let allCustomersMap = {};
let allCustomersList = [];
let customerSearchFilter = '';
let currentViewingCustomerPhone = null;

// Normaliza texto para busca insensivel a maiusculas, minusculas e acentos
function normalizeCustomerText(str) {
    if (!str) return '';
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/* ==========================================================================
   Inicializacao e Carregamento de Clientes
   ========================================================================== */
function initCustomersSync() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        // Listener em menu/customers (100% garantido por regras)
        firebase.database().ref('menu/customers').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            allCustomersMap = { ...allCustomersMap, ...data };
            buildFullCustomersList();
            if (typeof currentSection !== 'undefined' && currentSection === 'customers') {
                renderCustomersManager();
            }
        }, (err) => console.warn("Aviso ao ler menu/customers:", err));

        // Listener em customers
        firebase.database().ref('customers').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            allCustomersMap = { ...allCustomersMap, ...data };
            buildFullCustomersList();
            if (typeof currentSection !== 'undefined' && currentSection === 'customers') {
                renderCustomersManager();
            }
        }, (err) => console.warn("Aviso ao ler customers:", err));
    } else {
        buildFullCustomersList();
        renderCustomersManager();
    }
}

// Constroi a lista combinando Firebase e o historico de /orders
function buildFullCustomersList() {
    const map = { ...allCustomersMap };

    // Varre pedidos da memoria para incluir clientes historicos
    if (typeof orders !== 'undefined' && Array.isArray(orders)) {
        orders.forEach(order => {
            if (!order || !order.clientPhone || order.clientPhone === 'Mesa / Salão') return;
            const cleanPhone = String(order.clientPhone).replace(/\D/g, '');
            if (cleanPhone.length < 8) return;

            if (!map[cleanPhone]) {
                map[cleanPhone] = {
                    id: cleanPhone,
                    name: order.clientName || 'Cliente',
                    phone: order.clientPhone,
                    street: order.address ? order.address.street : '',
                    number: order.address ? order.address.number : '',
                    complement: order.address ? (order.address.reference || order.address.complement || '') : '',
                    neighborhood: order.address ? order.address.neighborhood : '',
                    bairroKey: order.address ? order.address.bairroKey : '',
                    createdAt: order.timestamp || order.id || Date.now(),
                    lastOrderId: order.id,
                    lastOrderDate: order.date || '',
                    ordersCount: 1
                };
            }
        });
    }

    allCustomersList = Object.values(map);

    // Calcula quantidade total de pedidos para cada cliente
    if (typeof orders !== 'undefined' && Array.isArray(orders)) {
        allCustomersList.forEach(cust => {
            const cleanP = String(cust.phone || cust.id).replace(/\D/g, '');
            const custOrders = orders.filter(o => {
                if (!o || !o.clientPhone) return false;
                const oP = String(o.clientPhone).replace(/\D/g, '');
                return oP === cleanP || (cust.name && o.clientName && normalizeCustomerText(o.clientName) === normalizeCustomerText(cust.name));
            });
            cust.ordersCount = custOrders.length;
            if (custOrders.length > 0) {
                custOrders.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
                cust.lastOrderDate = custOrders[0].date || cust.lastOrderDate || '';
                cust.lastOrderId = custOrders[0].id || cust.lastOrderId;
            }
        });
    }

    // Ordena por ordem alfabetica
    allCustomersList.sort((a, b) => {
        return (normalizeCustomerText(a.name) || '').localeCompare(normalizeCustomerText(b.name) || '');
    });
}

/* ==========================================================================
   Renderizacao da Secao "Clientes" no Painel
   ========================================================================== */
function renderCustomersManager() {
    buildFullCustomersList();

    const tbody = document.getElementById('customersTableBody');
    const emptyState = document.getElementById('emptyCustomersState');
    const totalCountEl = document.getElementById('customersTotalCountHeader');
    const withOrdersCountEl = document.getElementById('customersWithOrdersCount');

    if (totalCountEl) totalCountEl.textContent = allCustomersList.length;
    if (withOrdersCountEl) {
        const withOrders = allCustomersList.filter(c => (c.ordersCount || 0) > 0).length;
        withOrdersCountEl.textContent = withOrders;
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    const query = normalizeCustomerText(customerSearchFilter);
    let filtered = allCustomersList;

    if (query) {
        const queryDigits = query.replace(/\D/g, '');
        filtered = allCustomersList.filter(c => {
            const nameNorm = normalizeCustomerText(c.name);
            const phoneDigits = String(c.phone || c.id || '').replace(/\D/g, '');
            const neighNorm = normalizeCustomerText(c.neighborhood);

            const nameMatch = nameNorm.includes(query);
            const phoneMatch = queryDigits && phoneDigits.includes(queryDigits);
            const neighMatch = neighNorm.includes(query);

            return nameMatch || phoneMatch || neighMatch;
        });
    }

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove('display-none');
        return;
    }

    if (emptyState) emptyState.classList.add('display-none');

    filtered.forEach(cust => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.style.transition = 'var(--transition)';

        const cleanPhone = String(cust.phone || cust.id).replace(/\D/g, '');
        const formattedPhone = cust.phone || cleanPhone;
        const addressText = cust.street 
            ? `${cust.street}, Nº ${cust.number || 'S/N'}${cust.neighborhood ? ` - ${cust.neighborhood}` : ''}`
            : (cust.neighborhood || 'Endereço não informado');

        const ordersBadge = (cust.ordersCount && cust.ordersCount > 0)
            ? `<span class="status-badge" style="background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.35); font-weight: 700;">${cust.ordersCount} pedido(s)</span>`
            : `<span class="status-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);">Sem pedidos</span>`;

        tr.innerHTML = `
            <td style="padding: 12px 14px; font-weight: 700; color: var(--text-main);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(156, 39, 176, 0.2); color: #ce93d8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">
                        ${(cust.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div>${cust.name || 'Sem Nome'}</div>
                        <small style="color: var(--text-muted); font-size: 11px;">Cadastrado</small>
                    </div>
                </div>
            </td>
            <td style="padding: 12px 14px;">
                <a href="https://wa.me/55${cleanPhone}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Abrir conversa no WhatsApp">
                    <span class="material-symbols-rounded" style="font-size: 16px;">chat</span>
                    <span>${formattedPhone}</span>
                </a>
            </td>
            <td style="padding: 12px 14px; color: var(--text-light); font-size: 12.5px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${addressText}
            </td>
            <td style="padding: 12px 14px; color: var(--text-muted); font-size: 12px;">
                ${cust.lastOrderDate ? `Último: ${cust.lastOrderDate}` : 'Recente'}
            </td>
            <td style="padding: 12px 14px; text-align: center;">
                ${ordersBadge}
            </td>
            <td style="padding: 12px 14px; text-align: center;">
                <div style="display: flex; justify-content: center; gap: 6px;">
                    <button type="button" class="btn-table-action" onclick="openCustomerDetailsModal('${cleanPhone}')" title="Ver Perfil & Histórico de Pedidos" style="background: rgba(33, 150, 243, 0.15); color: #64b5f6; border: 1px solid rgba(33, 150, 243, 0.35); padding: 5px 8px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700;">
                        <span class="material-symbols-rounded" style="font-size: 15px;">visibility</span>
                        <span>Detalhes</span>
                    </button>
                    <button type="button" class="btn-table-action" onclick="openCustomerEditModal('${cleanPhone}')" title="Editar Dados do Cliente" style="background: rgba(255, 255, 255, 0.08); color: var(--text-main); border: 1px solid var(--border-color); padding: 5px 8px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center;">
                        <span class="material-symbols-rounded" style="font-size: 15px;">edit</span>
                    </button>
                    <button type="button" class="btn-table-action" onclick="startOrderForCustomerFromDetails('${cleanPhone}')" title="Lançar Novo Pedido para este Cliente" style="background: rgba(123, 31, 162, 0.18); color: #ce93d8; border: 1px solid rgba(156, 39, 176, 0.35); padding: 5px 8px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center;">
                        <span class="material-symbols-rounded" style="font-size: 15px;">add_shopping_cart</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleCustomersSearchFilter(query) {
    customerSearchFilter = query;
    renderCustomersManager();
}

/* ==========================================================================
   Modal de Detalhes & Historico do Cliente
   ========================================================================== */
function openCustomerDetailsModal(cleanPhone) {
    cleanPhone = String(cleanPhone || '').replace(/\D/g, '');
    currentViewingCustomerPhone = cleanPhone;

    const customer = allCustomersList.find(c => String(c.phone || c.id).replace(/\D/g, '') === cleanPhone);
    if (!customer) {
        if (typeof showToast === 'function') showToast('Cliente não encontrado.', 'error');
        return;
    }

    const modal = document.getElementById('customerDetailsModal');
    if (!modal) return;

    const nameEl = document.getElementById('custDetailsName');
    const phoneEl = document.getElementById('custDetailsPhone');
    const addressEl = document.getElementById('custDetailsAddress');
    const ordersCountEl = document.getElementById('custDetailsOrdersCount');

    if (nameEl) nameEl.textContent = customer.name || 'Cliente';
    if (phoneEl) {
        phoneEl.innerHTML = `
            <a href="https://wa.me/55${cleanPhone}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-rounded" style="font-size: 16px;">chat</span>
                <span>${customer.phone || cleanPhone}</span>
            </a>
        `;
    }

    const fullAddr = customer.street 
        ? `${customer.street}, Nº ${customer.number || 'S/N'}${customer.complement ? ` (${customer.complement})` : ''} - Bairro: ${customer.neighborhood || 'Não informado'}`
        : (customer.neighborhood ? `Bairro: ${customer.neighborhood}` : 'Endereço não cadastrado');

    if (addressEl) addressEl.textContent = fullAddr;

    let custOrders = [];
    if (typeof orders !== 'undefined' && Array.isArray(orders)) {
        custOrders = orders.filter(o => {
            if (!o || !o.clientPhone) return false;
            const oPhone = String(o.clientPhone).replace(/\D/g, '');
            return oPhone === cleanPhone || (customer.name && o.clientName && normalizeCustomerText(o.clientName) === normalizeCustomerText(customer.name));
        });
        custOrders.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
    }

    if (ordersCountEl) ordersCountEl.textContent = `${custOrders.length} pedido(s) realizados`;

    const historyList = document.getElementById('custDetailsHistoryList');
    const historyEmpty = document.getElementById('custDetailsHistoryEmpty');

    if (historyList) {
        historyList.innerHTML = '';
        if (custOrders.length === 0) {
            if (historyEmpty) historyEmpty.classList.remove('display-none');
        } else {
            if (historyEmpty) historyEmpty.classList.add('display-none');

            custOrders.forEach(ord => {
                const card = document.createElement('div');
                card.className = 'customer-history-order-card';

                const cartItems = Array.isArray(ord.cart) ? ord.cart : Object.values(ord.cart || {});
                let itemsListHTML = '';
                cartItems.forEach(it => {
                    const adds = (it.adicionais && it.adicionais.length > 0) ? ` (+ ${it.adicionais.map(a => a.name).join(', ')})` : '';
                    const obs = it.notes ? ` <em style="color: #f5a623;">[Obs: "${it.notes}"]</em>` : '';
                    itemsListHTML += `<li style="font-size: 12px; margin-bottom: 3px; color: var(--text-light);">• <strong>${it.quantity}x ${it.name}</strong>${adds}${obs}</li>`;
                });

                const isDelivery = ord.checkoutType === 'delivery';
                const typeLabel = isDelivery ? '🚗 Tele-Entrega' : '🏪 Retirada no Balcão';

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                        <div>
                            <strong style="color: var(--text-main); font-size: 13px;">Pedido #${ord.id}</strong>
                            <span style="color: var(--text-muted); font-size: 11.5px; margin-left: 6px;">${ord.date || ''} às ${ord.time || ''}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="status-badge" style="background: rgba(255,255,255,0.06); font-size: 11px;">${typeLabel}</span>
                            <span style="color: #f5a623; font-weight: 800; font-size: 13px;">R$ ${Number(ord.total || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0 0 10px 0;">
                        ${itemsListHTML || '<li style="color: var(--text-muted); font-size: 12px;">Itens não detalhados</li>'}
                    </ul>
                    <div style="display: flex; justify-content: flex-end;">
                        <button type="button" class="btn-repeat-order" onclick="repeatOrderFromCustomerHistory('${ord.id}', '${cleanPhone}')" title="Copiar este pedido para um novo atendimento">
                            <span class="material-symbols-rounded" style="font-size: 16px;">replay</span>
                            <span>Repetir Este Pedido</span>
                        </button>
                    </div>
                `;
                historyList.appendChild(card);
            });
        }
    }

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

function closeCustomerDetailsModal() {
    const modal = document.getElementById('customerDetailsModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 200);
}

function startOrderForCustomerFromDetails(cleanPhone) {
    closeCustomerDetailsModal();
    if (typeof openManualOrderModal === 'function') {
        openManualOrderModal();
        setTimeout(() => {
            if (typeof selectManualOrderCustomer === 'function') {
                selectManualOrderCustomer(cleanPhone);
            }
        }, 200);
    }
}

function repeatOrderFromCustomerHistory(orderId, cleanPhone) {
    closeCustomerDetailsModal();
    if (typeof openManualOrderModal === 'function') {
        openManualOrderModal();
        setTimeout(() => {
            if (typeof selectManualOrderCustomer === 'function') {
                selectManualOrderCustomer(cleanPhone);
            }
            if (typeof repeatPreviousOrder === 'function') {
                repeatPreviousOrder(orderId);
            }
        }, 250);
    }
}

/* ==========================================================================
   Modal de Cadastro / Edicao de Cliente
   ========================================================================== */
function openCustomerEditModal(cleanPhone) {
    const modal = document.getElementById('customerEditModal');
    if (!modal) return;

    const titleEl = document.getElementById('custEditModalTitle');
    const phoneInput = document.getElementById('custEditPhone');
    const nameInput = document.getElementById('custEditName');
    const streetInput = document.getElementById('custEditStreet');
    const numberInput = document.getElementById('custEditNumber');
    const compInput = document.getElementById('custEditComplement');
    const bairroSelect = document.getElementById('custEditBairro');

    if (bairroSelect) {
        bairroSelect.innerHTML = '<option value="">-- Selecione o Bairro --</option>';
        if (menuData && menuData.settings && menuData.settings.deliveryFees) {
            Object.entries(menuData.settings.deliveryFees)
                .filter(([k, b]) => b.active !== false)
                .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''))
                .forEach(([k, b]) => {
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.setAttribute('data-name', b.name || k);
                    opt.textContent = b.name || k;
                    bairroSelect.appendChild(opt);
                });
        }
    }

    if (cleanPhone) {
        cleanPhone = String(cleanPhone).replace(/\D/g, '');
        const cust = allCustomersList.find(c => String(c.phone || c.id).replace(/\D/g, '') === cleanPhone);
        if (cust) {
            if (titleEl) titleEl.innerHTML = `<span class="material-symbols-rounded">edit</span> <span>Editar Cliente</span>`;
            if (phoneInput) {
                phoneInput.value = cust.phone || cleanPhone;
                phoneInput.setAttribute('data-original-phone', cleanPhone);
            }
            if (nameInput) nameInput.value = cust.name || '';
            if (streetInput) streetInput.value = cust.street || '';
            if (numberInput) numberInput.value = cust.number || '';
            if (compInput) compInput.value = cust.complement || '';

            if (bairroSelect && (cust.bairroKey || cust.neighborhood)) {
                for (let i = 0; i < bairroSelect.options.length; i++) {
                    const opt = bairroSelect.options[i];
                    if (opt.value === cust.bairroKey || opt.text.toLowerCase().includes(String(cust.neighborhood).toLowerCase())) {
                        bairroSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<span class="material-symbols-rounded">person_add</span> <span>Cadastrar Novo Cliente</span>`;
        if (phoneInput) {
            phoneInput.value = '';
            phoneInput.removeAttribute('data-original-phone');
        }
        if (nameInput) nameInput.value = '';
        if (streetInput) streetInput.value = '';
        if (numberInput) numberInput.value = '';
        if (compInput) compInput.value = '';
        if (bairroSelect) bairroSelect.selectedIndex = 0;
    }

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

function closeCustomerEditModal() {
    const modal = document.getElementById('customerEditModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 200);
}

function saveCustomerEditForm(event) {
    if (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    const phoneInput = document.getElementById('custEditPhone');
    const nameInput = document.getElementById('custEditName');
    const streetInput = document.getElementById('custEditStreet');
    const numberInput = document.getElementById('custEditNumber');
    const compInput = document.getElementById('custEditComplement');
    const bairroSelect = document.getElementById('custEditBairro');

    const rawPhone = phoneInput ? phoneInput.value.trim() : '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        if (typeof showToast === 'function') showToast('Informe o nome do cliente!', 'error');
        if (nameInput) nameInput.focus();
        return false;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
        if (typeof showToast === 'function') showToast('Informe um telefone válido!', 'error');
        if (phoneInput) phoneInput.focus();
        return false;
    }

    const selectedBairroOpt = bairroSelect ? bairroSelect.options[bairroSelect.selectedIndex] : null;
    const bairroKey = selectedBairroOpt ? selectedBairroOpt.value : '';
    const neighborhood = selectedBairroOpt ? (selectedBairroOpt.getAttribute('data-name') || selectedBairroOpt.text) : '';

    const customerData = {
        id: cleanPhone,
        name: name,
        phone: rawPhone,
        street: (streetInput && streetInput.value) ? streetInput.value.trim() : '',
        number: (numberInput && numberInput.value) ? numberInput.value.trim() : '',
        complement: (compInput && compInput.value) ? compInput.value.trim() : '',
        neighborhood: (neighborhood && neighborhood !== '-- Selecione o Bairro --') ? neighborhood : '',
        bairroKey: bairroKey || '',
        updatedAt: Date.now()
    };

    // Atualiza imediatamente localmente para feedback instantaneo
    allCustomersMap[cleanPhone] = { ...(allCustomersMap[cleanPhone] || {}), ...customerData };
    buildFullCustomersList();
    renderCustomersManager();
    closeCustomerEditModal();

    if (typeof showToast === 'function') {
        showToast(`Cliente "${name}" salvo com sucesso!`, 'success');
    }

    // Salva no Firebase em menu/customers e customers
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/customers/${cleanPhone}`).set(customerData).catch(e => console.warn("Aviso ao salvar em menu/customers:", e));
        firebase.database().ref(`customers/${cleanPhone}`).set(customerData).catch(e => console.warn("Aviso ao salvar em customers:", e));
    }

    return false;
}

