/**
 * ==============================================================================
 * FINA MASSA PIZZARIA — GERENCIADOR DE CLIENTES & CRM
 * ==============================================================================
 * Central de CRM, métricas de fidelização, segmentação comportamental,
 * histórico de pedidos com ticket médio, consentimento WhatsApp (LGPD)
 * e exportação de clientes em CSV.
 * ==============================================================================
 */

let allCustomersMap = {};
let allCustomersList = [];
let customerSearchFilter = '';
let customerActiveFilter = 'all'; // all, bought, never_bought, new_30d, inactive_30d, inactive_60d, frequent, authorized, refused
let currentViewingCustomerPhone = null;

// Normaliza texto para busca insensível a maiúsculas, minúsculas e acentos
function normalizeCustomerText(str) {
    if (!str) return '';
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/* ==========================================================================
   Inicialização e Carregamento de Clientes
   ========================================================================== */
function initCustomersSync() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        // Listener em menu/customers
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

// Constrói a lista combinando Firebase e o histórico de /orders
function buildFullCustomersList() {
    const map = { ...allCustomersMap };

    // Varre pedidos da memória para incluir clientes históricos
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
                    lastOrderAt: order.timestamp || null,
                    ordersCount: 1,
                    totalSpent: Number(order.total || 0),
                    marketingWhatsApp: false
                };
            }
        });
    }

    allCustomersList = Object.values(map);

    // Calcula quantidade total de pedidos, total gasto e ticket médio
    if (typeof orders !== 'undefined' && Array.isArray(orders)) {
        allCustomersList.forEach(cust => {
            const cleanP = String(cust.phone || cust.id).replace(/\D/g, '');
            const custOrders = orders.filter(o => {
                if (!o || !o.clientPhone) return false;
                const oP = String(o.clientPhone).replace(/\D/g, '');
                return oP === cleanP || (cust.name && o.clientName && normalizeCustomerText(o.clientName) === normalizeCustomerText(cust.name));
            });

            cust.ordersCount = custOrders.length || cust.totalOrders || 0;

            if (custOrders.length > 0) {
                custOrders.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
                cust.lastOrderDate = custOrders[0].date || cust.lastOrderDate || '';
                cust.lastOrderId = custOrders[0].id || cust.lastOrderId;
                cust.lastOrderAt = custOrders[0].timestamp || cust.lastOrderAt || null;

                let sum = 0;
                custOrders.forEach(o => sum += (Number(o.total) || 0));
                cust.totalSpent = Math.round(sum * 100) / 100;
            } else if (cust.totalSpent !== undefined) {
                cust.totalSpent = Number(cust.totalSpent) || 0;
            } else {
                cust.totalSpent = 0;
            }

            // Ticket Médio
            cust.averageTicket = cust.ordersCount > 0 ? (cust.totalSpent / cust.ordersCount) : 0;
            // Booleano estrito para marketingWhatsApp
            cust.marketingWhatsApp = cust.marketingWhatsApp === true;
        });
    }

    // Ordena por ordem alfabética por padrão
    allCustomersList.sort((a, b) => {
        return (normalizeCustomerText(a.name) || '').localeCompare(normalizeCustomerText(b.name) || '');
    });
}

/* ==========================================================================
   Renderização da Seção "Clientes / CRM" no Painel
   ========================================================================== */
function renderCustomersManager() {
    buildFullCustomersList();

    const tbody = document.getElementById('customersTableBody');
    const emptyState = document.getElementById('emptyCustomersState');

    // Indicadores do CRM
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    const totalCount = allCustomersList.length;
    const new30dCount = allCustomersList.filter(c => Number(c.createdAt || 0) >= thirtyDaysAgo).length;

    // Clientes ativos: compraram nos últimos 30 dias
    const activeCount = allCustomersList.filter(c => {
        const lastTime = Number(c.lastOrderAt || 0);
        return lastTime > 0 && lastTime >= thirtyDaysAgo;
    }).length;

    // Clientes inativos: sem pedidos nos últimos 30 dias (ou nunca compraram)
    const inactiveCount = allCustomersList.filter(c => {
        const lastTime = Number(c.lastOrderAt || 0);
        return lastTime === 0 || lastTime < thirtyDaysAgo;
    }).length;

    // WhatsApp Autorizado e % da base
    const authorizedCount = allCustomersList.filter(c => c.marketingWhatsApp === true).length;
    const authorizedPercent = totalCount > 0 ? Math.round((authorizedCount / totalCount) * 100) : 0;

    // Compradores frequentes (3+ pedidos)
    const frequentCount = allCustomersList.filter(c => (c.ordersCount || 0) >= 3).length;

    // Atualiza cards de métricas na tela
    const elTotal = document.getElementById('crmStatTotal');
    const elNew = document.getElementById('crmStatNew');
    const elActive = document.getElementById('crmStatActive');
    const elInactive = document.getElementById('crmStatInactive');
    const elAuthorized = document.getElementById('crmStatAuthorized');
    const elFrequent = document.getElementById('crmStatFrequent');

    if (elTotal) elTotal.textContent = totalCount;
    if (elNew) elNew.textContent = new30dCount;
    if (elActive) elActive.textContent = activeCount;
    if (elInactive) elInactive.textContent = inactiveCount;
    if (elAuthorized) elAuthorized.textContent = `${authorizedCount} (${authorizedPercent}%)`;
    if (elFrequent) elFrequent.textContent = frequentCount;

    // Atualiza contadores nas abas/pills de segmentação
    updateCrmFilterPillCounters();

    if (!tbody) return;
    tbody.innerHTML = '';

    // Aplica busca por texto e filtro ativo
    const query = normalizeCustomerText(customerSearchFilter);
    let filtered = allCustomersList;

    // Filtro comportamental
    switch (customerActiveFilter) {
        case 'bought':
            filtered = filtered.filter(c => (c.ordersCount || 0) > 0);
            break;
        case 'never_bought':
            filtered = filtered.filter(c => (c.ordersCount || 0) === 0);
            break;
        case 'new_30d':
            filtered = filtered.filter(c => Number(c.createdAt || 0) >= thirtyDaysAgo);
            break;
        case 'inactive_30d':
            filtered = filtered.filter(c => {
                const lastTime = Number(c.lastOrderAt || 0);
                return lastTime === 0 || lastTime < thirtyDaysAgo;
            });
            break;
        case 'inactive_60d':
            filtered = filtered.filter(c => {
                const lastTime = Number(c.lastOrderAt || 0);
                return lastTime === 0 || lastTime < sixtyDaysAgo;
            });
            break;
        case 'frequent':
            filtered = filtered.filter(c => (c.ordersCount || 0) >= 3);
            break;
        case 'authorized':
            filtered = filtered.filter(c => c.marketingWhatsApp === true);
            break;
        case 'refused':
            filtered = filtered.filter(c => c.marketingWhatsApp !== true);
            break;
        case 'all':
        default:
            break;
    }

    // Busca textual
    if (query) {
        const queryDigits = query.replace(/\D/g, '');
        filtered = filtered.filter(c => {
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
            ? `<span class="crm-badge crm-badge-success">${cust.ordersCount} pedido(s)</span>`
            : `<span class="crm-badge crm-badge-secondary">0 pedidos</span>`;

        const marketingBadge = cust.marketingWhatsApp === true
            ? `<span class="crm-badge crm-badge-success" title="Cliente autorizou promoções no WhatsApp"><span class="material-symbols-rounded" style="font-size: 13px; vertical-align: middle;">check_circle</span> Sim</span>`
            : `<span class="crm-badge crm-badge-danger" title="Cliente não autorizou ou não optou"><span class="material-symbols-rounded" style="font-size: 13px; vertical-align: middle;">cancel</span> Não</span>`;

        const ticketMedioFormatted = cust.averageTicket > 0
            ? `R$ ${cust.averageTicket.toFixed(2).replace('.', ',')}`
            : 'R$ 0,00';

        const totalSpentFormatted = cust.totalSpent > 0
            ? `R$ ${cust.totalSpent.toFixed(2).replace('.', ',')}`
            : 'R$ 0,00';

        const registerDate = cust.createdAt ? new Date(cust.createdAt).toLocaleDateString('pt-BR') : '-';

        tr.innerHTML = `
            <td style="padding: 12px 14px; font-weight: 700; color: var(--text-main);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(156, 39, 176, 0.2); color: #ce93d8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">
                        ${(cust.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div>${cust.name || 'Sem Nome'}</div>
                        <small style="color: var(--text-muted); font-size: 11px;">Desde: ${registerDate}</small>
                    </div>
                </div>
            </td>
            <td style="padding: 12px 14px;">
                <a href="https://wa.me/55${cleanPhone}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Abrir conversa no WhatsApp">
                    <span class="material-symbols-rounded" style="font-size: 16px;">chat</span>
                    <span>${formattedPhone}</span>
                </a>
            </td>
            <td style="padding: 12px 14px; color: var(--text-light); font-size: 12.5px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${addressText}
            </td>
            <td style="padding: 12px 14px; color: var(--text-muted); font-size: 12px;">
                ${cust.lastOrderDate ? `Último: ${cust.lastOrderDate}` : 'Sem compras'}
            </td>
            <td style="padding: 12px 14px; text-align: center;">
                ${ordersBadge}
            </td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: var(--text-main); font-size: 12.5px;">
                ${totalSpentFormatted}
            </td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 600; color: #f5a623; font-size: 12.5px;">
                ${ticketMedioFormatted}
            </td>
            <td style="padding: 12px 14px; text-align: center;">
                ${marketingBadge}
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

function setCrmFilter(filterKey) {
    customerActiveFilter = filterKey;
    document.querySelectorAll('.crm-filter-pill').forEach(el => {
        if (el.getAttribute('data-filter') === filterKey) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    renderCustomersManager();
}

function updateCrmFilterPillCounters() {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    const counts = {
        all: allCustomersList.length,
        bought: allCustomersList.filter(c => (c.ordersCount || 0) > 0).length,
        never_bought: allCustomersList.filter(c => (c.ordersCount || 0) === 0).length,
        new_30d: allCustomersList.filter(c => Number(c.createdAt || 0) >= thirtyDaysAgo).length,
        inactive_30d: allCustomersList.filter(c => {
            const lastTime = Number(c.lastOrderAt || 0);
            return lastTime === 0 || lastTime < thirtyDaysAgo;
        }).length,
        inactive_60d: allCustomersList.filter(c => {
            const lastTime = Number(c.lastOrderAt || 0);
            return lastTime === 0 || lastTime < sixtyDaysAgo;
        }).length,
        frequent: allCustomersList.filter(c => (c.ordersCount || 0) >= 3).length,
        authorized: allCustomersList.filter(c => c.marketingWhatsApp === true).length,
        refused: allCustomersList.filter(c => c.marketingWhatsApp !== true).length
    };

    Object.keys(counts).forEach(key => {
        const badge = document.getElementById(`crmCountBadge_${key}`);
        if (badge) badge.textContent = counts[key];
    });
}

/* ==========================================================================
   Exportação de Clientes em CSV (Compatível Excel com UTF-8 BOM)
   ========================================================================== */
function exportCustomersCSV() {
    buildFullCustomersList();

    if (allCustomersList.length === 0) {
        if (typeof showToast === 'function') showToast('Nenhum cliente disponível para exportação.', 'warning');
        return;
    }

    const headers = [
        'Nome',
        'WhatsApp',
        'Data de Cadastro',
        'Ultimo Pedido',
        'Qtd Pedidos',
        'Total Gasto (R$)',
        'Ticket Medio (R$)',
        'Endereco',
        'Bairro',
        'Autorizacao WhatsApp (LGPD)'
    ];

    const rows = allCustomersList.map(c => {
        const cleanPhone = String(c.phone || c.id || '').replace(/\D/g, '');
        const regDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '';
        const lastOrder = c.lastOrderDate || (c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('pt-BR') : 'Nunca');
        const ordersCount = c.ordersCount || 0;
        const totalSpent = (c.totalSpent || 0).toFixed(2).replace('.', ',');
        const ticketMedio = (c.averageTicket || 0).toFixed(2).replace('.', ',');
        const address = `${c.street || ''} ${c.number || ''}`.trim();
        const bairro = c.neighborhood || '';
        const consent = c.marketingWhatsApp === true ? 'SIM' : 'NAO';

        return [
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${cleanPhone}"`,
            `"${regDate}"`,
            `"${lastOrder}"`,
            ordersCount,
            `"${totalSpent}"`,
            `"${ticketMedio}"`,
            `"${address.replace(/"/g, '""')}"`,
            `"${bairro.replace(/"/g, '""')}"`,
            `"${consent}"`
        ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);

    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_fina_massa_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof showToast === 'function') {
        showToast(`Exportação concluída com ${allCustomersList.length} clientes!`, 'success');
    }
}

/* ==========================================================================
   Modal de Detalhes & Histórico do Cliente
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
    const marketingConsentEl = document.getElementById('custDetailsMarketingConsent');

    if (nameEl) nameEl.textContent = customer.name || 'Cliente';
    if (phoneEl) {
        phoneEl.innerHTML = `
            <a href="https://wa.me/55${cleanPhone}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-rounded" style="font-size: 16px;">chat</span>
                <span>${customer.phone || cleanPhone}</span>
            </a>
        `;
    }

    if (marketingConsentEl) {
        if (customer.marketingWhatsApp === true) {
            marketingConsentEl.innerHTML = `<span class="crm-badge crm-badge-success"><span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">check_circle</span> Autorizado receber promoções via WhatsApp</span>`;
        } else {
            marketingConsentEl.innerHTML = `<span class="crm-badge crm-badge-danger"><span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">cancel</span> Não autorizou promoções no WhatsApp</span>`;
        }
    }

    const fullAddr = customer.street 
        ? `${customer.street}, Nº ${customer.number || 'S/N'}${customer.complement ? ` (${customer.complement})` : ''} - Bairro: ${customer.neighborhood || 'Não informado'}`
        : (customer.neighborhood ? `Bairro: ${customer.neighborhood}` : 'Endereço não cadastrado');

    if (addressEl) addressEl.textContent = fullAddr;

    let custOrders = [];
    let totalSpent = Number(customer.totalSpent || 0);
    if (typeof orders !== 'undefined' && Array.isArray(orders)) {
        custOrders = orders.filter(o => {
            if (!o || !o.clientPhone) return false;
            const oPhone = String(o.clientPhone).replace(/\D/g, '');
            return oPhone === cleanPhone || (customer.name && o.clientName && normalizeCustomerText(o.clientName) === normalizeCustomerText(customer.name));
        });
        custOrders.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
        if (custOrders.length > 0) {
            let sum = 0;
            custOrders.forEach(o => sum += (Number(o.total) || 0));
            totalSpent = sum;
        }
    }

    const totalOrdersCount = custOrders.length || customer.totalOrders || 0;
    const averageTicket = totalOrdersCount > 0 ? (totalSpent / totalOrdersCount) : 0;
    const lastOrderText = (custOrders.length > 0 && custOrders[0].date) 
        ? `${custOrders[0].date} ${custOrders[0].time ? 'às ' + custOrders[0].time : ''}` 
        : (customer.lastOrderDate || (customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString('pt-BR') : 'Nunca'));

    const ordersTotalEl = document.getElementById('custDetailsOrdersTotal');
    const spentTotalEl = document.getElementById('custDetailsSpentTotal');
    const avgTicketEl = document.getElementById('custDetailsAvgTicket');
    const lastOrderEl = document.getElementById('custDetailsLastOrder');

    if (ordersTotalEl) ordersTotalEl.textContent = totalOrdersCount;
    if (spentTotalEl) spentTotalEl.textContent = `R$ ${totalSpent.toFixed(2).replace('.', ',')}`;
    if (avgTicketEl) avgTicketEl.textContent = `R$ ${averageTicket.toFixed(2).replace('.', ',')}`;
    if (lastOrderEl) lastOrderEl.textContent = lastOrderText;
    if (ordersCountEl) ordersCountEl.textContent = `${totalOrdersCount} pedido(s) realizados`;

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
   Modal de Cadastro / Edição de Cliente
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
    const marketingCheckbox = document.getElementById('custEditMarketingCheckbox');

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
            if (titleEl) titleEl.innerHTML = `<span class="material-symbols-rounded">edit</span> <span>Editar Cliente / CRM</span>`;
            if (phoneInput) {
                phoneInput.value = cust.phone || cleanPhone;
                phoneInput.setAttribute('data-original-phone', cleanPhone);
            }
            if (nameInput) nameInput.value = cust.name || '';
            if (streetInput) streetInput.value = cust.street || '';
            if (numberInput) numberInput.value = cust.number || '';
            if (compInput) compInput.value = cust.complement || '';
            if (marketingCheckbox) marketingCheckbox.checked = cust.marketingWhatsApp === true;

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
        if (marketingCheckbox) marketingCheckbox.checked = true;
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
    const marketingCheckbox = document.getElementById('custEditMarketingCheckbox');

    const rawPhone = phoneInput ? phoneInput.value.trim() : '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const name = nameInput ? nameInput.value.trim() : '';
    const marketingConsent = marketingCheckbox ? Boolean(marketingCheckbox.checked) : false;

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

    const existingData = allCustomersMap[cleanPhone] || {};

    const customerData = {
        ...existingData,
        id: cleanPhone,
        name: name,
        phone: rawPhone,
        street: (streetInput && streetInput.value) ? streetInput.value.trim() : '',
        number: (numberInput && numberInput.value) ? numberInput.value.trim() : '',
        complement: (compInput && compInput.value) ? compInput.value.trim() : '',
        neighborhood: (neighborhood && neighborhood !== '-- Selecione o Bairro --') ? neighborhood : '',
        bairroKey: bairroKey || '',
        marketingWhatsApp: marketingConsent,
        marketingConsentAt: marketingConsent ? (existingData.marketingConsentAt || Date.now()) : null,
        updatedAt: Date.now()
    };

    // Atualiza imediatamente localmente para feedback instantâneo
    allCustomersMap[cleanPhone] = customerData;
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
