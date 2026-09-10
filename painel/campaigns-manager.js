/**
 * ==============================================================================
 * FINA MASSA PIZZARIA — MÓDULO DE CAMPANHAS WHATSAPP (CRM & MARKETING)
 * ==============================================================================
 * FASE 5.1: ENVIO AUTOMÁTICO EM LOTE COM WHATSAPP BUSINESS CLOUD API
 * Construtor, segmentação LGPD estrita, personalização ({nome}, {link}),
 * prévia visual, fila controlada com rate limiting, status granular,
 * proteção contra duplo disparo (idempotência), retentativas e contingência 1 a 1.
 * ==============================================================================
 */

let allCampaignsList = [];
let currentCampaignDraft = {
    title: '',
    description: '',
    template: 'Olá, {nome}! 🍕 Tudo bem?\n\nHoje é dia de pizza na Fina Massa! Dá uma olhada nas nossas promoções e faça seu pedido direto pelo nosso cardápio digital:\n\n👉 {link}\n\nEsperamos você! Bom apetite! 😋',
    targetSegment: 'authorized_all',
    selectedRecipients: []
};
let activeDispatchCampaign = null;
let isManualFallbackMode = false;

/* ==========================================================================
   1. Inicialização e Sincronização de Campanhas no Firebase
   ========================================================================== */
function initCampaignsSync() {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        const db = firebase.database();
        db.ref('campaigns').on('value', (snapshot) => {
            const val = snapshot.val() || {};
            allCampaignsList = Object.values(val);
            allCampaignsList.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
            if (typeof currentSection !== 'undefined' && currentSection === 'campaigns') {
                renderCampaignsDashboard();
            }
        }, (err) => console.warn('[Campaigns] Erro ao sincronizar campanhas:', err));
    } else {
        renderCampaignsDashboard();
    }
}

/* ==========================================================================
   2. Renderização do Dashboard de Campanhas (6 Indicadores)
   ========================================================================== */
function renderCampaignsDashboard() {
    if (typeof buildFullCustomersList === 'function') {
        buildFullCustomersList();
    }

    const totalCampaignsEl = document.getElementById('campStatTotalCampaigns');
    const reachableClientsEl = document.getElementById('campStatReachableClients');
    const sentCountEl = document.getElementById('campStatDispatchesSent');
    const sendRateEl = document.getElementById('campStatSendRate');
    const deliveryRateEl = document.getElementById('campStatDeliveryRate');
    const errorCountEl = document.getElementById('campStatErrorCount');
    const campaignsTableBody = document.getElementById('campaignsTableBody');
    const emptyState = document.getElementById('emptyCampaignsState');

    // Clientes autorizados para campanhas (marketingWhatsApp === true)
    const reachableCount = (typeof allCustomersList !== 'undefined' && Array.isArray(allCustomersList))
        ? allCustomersList.filter(c => c.marketingWhatsApp === true).length
        : 0;

    // Métricas consolidadas reais
    let totalTargetRecipients = 0;
    let totalSent = 0;
    let totalDelivered = 0;
    let totalErrors = 0;

    allCampaignsList.forEach(camp => {
        if (camp.recipients && Array.isArray(camp.recipients)) {
            totalTargetRecipients += camp.recipients.length;
            camp.recipients.forEach(r => {
                if (r.status === 'SENT' || r.status === 'OPENED_WA' || r.status === 'DELIVERED' || r.status === 'READ') {
                    totalSent++;
                }
                if (r.status === 'DELIVERED' || r.status === 'READ') {
                    totalDelivered++;
                }
                if (r.status === 'ERROR' || r.status === 'INVALID') {
                    totalErrors++;
                }
            });
        }
    });

    const sendRate = totalTargetRecipients > 0 ? Math.round((totalSent / totalTargetRecipients) * 100) : 0;
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

    if (totalCampaignsEl) totalCampaignsEl.textContent = allCampaignsList.length;
    if (reachableClientsEl) reachableClientsEl.textContent = reachableCount;
    if (sentCountEl) sentCountEl.textContent = totalSent;
    if (sendRateEl) sendRateEl.textContent = `${sendRate}%`;
    if (deliveryRateEl) deliveryRateEl.textContent = `${deliveryRate}%`;
    if (errorCountEl) errorCountEl.textContent = totalErrors;

    if (!campaignsTableBody) return;
    campaignsTableBody.innerHTML = '';

    if (allCampaignsList.length === 0) {
        if (emptyState) emptyState.classList.remove('display-none');
        return;
    }

    if (emptyState) emptyState.classList.add('display-none');

    allCampaignsList.forEach(camp => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        const dateStr = camp.createdAt ? new Date(camp.createdAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
        const totalTarget = camp.recipients ? camp.recipients.length : 0;
        const sentTarget = camp.recipients ? camp.recipients.filter(r => r.status === 'SENT' || r.status === 'OPENED_WA' || r.status === 'DELIVERED' || r.status === 'READ').length : 0;
        const errorTarget = camp.recipients ? camp.recipients.filter(r => r.status === 'ERROR' || r.status === 'INVALID').length : 0;

        const progressPercent = totalTarget > 0 ? Math.round((sentTarget / totalTarget) * 100) : 0;

        let statusBadge = `<span class="crm-badge wa-badge-pending">Rascunho</span>`;
        if (camp.status === 'PROCESSING') {
            statusBadge = `<span class="crm-badge wa-badge-processing">🔄 Em Disparo (${progressPercent}%)</span>`;
        } else if (sentTarget === totalTarget && totalTarget > 0) {
            statusBadge = `<span class="crm-badge wa-badge-sent">🟢 Concluída (${sentTarget}/${totalTarget})</span>`;
        } else if (errorTarget > 0 && sentTarget > 0) {
            statusBadge = `<span class="crm-badge wa-badge-error">⚠️ ${sentTarget} env. / ${errorTarget} err.</span>`;
        } else if (sentTarget > 0) {
            statusBadge = `<span class="crm-badge wa-badge-delivered">${progressPercent}% Enviada (${sentTarget}/${totalTarget})</span>`;
        } else {
            statusBadge = `<span class="crm-badge wa-badge-pending">Pronta (${totalTarget} contatos)</span>`;
        }

        tr.innerHTML = `
            <td style="padding: 12px 14px;">
                <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">${camp.title || 'Sem título'}</div>
                <div style="font-size: 11.5px; color: var(--text-muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${camp.description || camp.template.substring(0, 55) + '...'}
                </div>
            </td>
            <td style="padding: 12px 14px; font-size: 12.5px; color: var(--text-light);">
                ${dateStr}
            </td>
            <td style="padding: 12px 14px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="campaign-progress-bar" style="width: 100px; height: 7px;">
                        <div class="campaign-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                    <span style="font-size: 11.5px; font-weight: 700; color: var(--text-light);">${progressPercent}%</span>
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 3px;">
                    ${sentTarget} de ${totalTarget} processados
                </div>
            </td>
            <td style="padding: 12px 14px; text-align: center;">
                ${statusBadge}
            </td>
            <td style="padding: 12px 14px; text-align: center;">
                <div style="display: flex; justify-content: center; gap: 6px;">
                    <button type="button" class="btn-table-action" onclick="openCampaignDispatchModal('${camp.id}')" title="Abrir Central de Disparo" style="background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.35); padding: 6px 12px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-size: 12px;">
                        <span class="material-symbols-rounded" style="font-size: 16px;">rocket_launch</span>
                        <span>Disparador</span>
                    </button>
                    <button type="button" class="btn-table-action" onclick="deleteCampaign('${camp.id}')" title="Excluir Campanha" style="background: rgba(239, 83, 80, 0.12); color: #ef5350; border: 1px solid rgba(239, 83, 80, 0.3); padding: 6px 9px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center;">
                        <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                    </button>
                </div>
            </td>
        `;
        campaignsTableBody.appendChild(tr);
    });
}

/* ==========================================================================
   3. Abertura do Construtor de Nova Campanha
   ========================================================================== */
function openNewCampaignModal() {
    const modal = document.getElementById('newCampaignModal');
    if (!modal) return;

    // Reset draft
    currentCampaignDraft = {
        title: '',
        description: '',
        template: 'Olá, {nome}! 🍕 Tudo bem?\n\nHoje é dia de pizza na Fina Massa! Dá uma olhada nas nossas promoções e faça seu pedido direto pelo nosso cardápio digital:\n\n👉 {link}\n\nEsperamos você! Bom apetite! 😋',
        targetSegment: 'authorized_all',
        selectedRecipients: []
    };

    const titleInput = document.getElementById('campTitleInput');
    const descInput = document.getElementById('campDescInput');
    const templateTextarea = document.getElementById('campTemplateTextarea');
    const segmentSelect = document.getElementById('campSegmentSelect');

    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (templateTextarea) templateTextarea.value = currentCampaignDraft.template;
    if (segmentSelect) segmentSelect.value = 'authorized_all';

    applyAudienceSegmentation('authorized_all');
    updateWhatsAppPreview();

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

function closeNewCampaignModal() {
    const modal = document.getElementById('newCampaignModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 200);
}

/* ==========================================================================
   4. Inserção de Variáveis ({nome}, {link}) e Prévia WhatsApp
   ========================================================================== */
function insertCampaignVariable(varName) {
    const textarea = document.getElementById('campTemplateTextarea');
    if (!textarea) return;

    const startPos = textarea.selectionStart || 0;
    const endPos = textarea.selectionEnd || 0;
    const currentVal = textarea.value;

    const replacement = `{${varName}}`;
    textarea.value = currentVal.substring(0, startPos) + replacement + currentVal.substring(endPos);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = startPos + replacement.length;

    updateWhatsAppPreview();
}

function updateWhatsAppPreview() {
    const textarea = document.getElementById('campTemplateTextarea');
    const previewBubble = document.getElementById('campWhatsappPreviewBubble');
    const previewTime = document.getElementById('campWhatsappPreviewTime');

    if (!previewBubble) return;

    const rawTemplate = textarea ? textarea.value : currentCampaignDraft.template;
    const sampleCustomer = (currentCampaignDraft.selectedRecipients && currentCampaignDraft.selectedRecipients.length > 0)
        ? currentCampaignDraft.selectedRecipients[0]
        : { name: 'João' };

    let renderedText = '';
    if (typeof WhatsAppService !== 'undefined') {
        renderedText = WhatsAppService.prepareMessage(rawTemplate, sampleCustomer);
    } else {
        const firstName = (sampleCustomer.name || 'Cliente').split(' ')[0];
        const catalogUrl = window.location.origin + window.location.pathname.replace(/\/painel\/?.*$/, '/');
        renderedText = rawTemplate.replace(/\{nome\}/gi, firstName).replace(/\{link\}/gi, catalogUrl);
    }

    // Formata quebras de linha para HTML seguro
    renderedText = renderedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    previewBubble.innerHTML = renderedText;

    if (previewTime) {
        const now = new Date();
        previewTime.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
}

/* ==========================================================================
   5. Segmentação de Público com LGPD Estrita
   ========================================================================== */
function onCampaignSegmentChange(segmentValue) {
    applyAudienceSegmentation(segmentValue);
}

function applyAudienceSegmentation(segmentValue) {
    if (typeof buildFullCustomersList === 'function') {
        buildFullCustomersList();
    }

    const customers = (typeof allCustomersList !== 'undefined' && Array.isArray(allCustomersList))
        ? allCustomersList
        : [];

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    let filtered = [];

    switch (segmentValue) {
        case 'authorized_all':
            filtered = customers.filter(c => c.marketingWhatsApp === true);
            break;

        case 'authorized_bought':
            filtered = customers.filter(c => c.marketingWhatsApp === true && (c.ordersCount || 0) > 0);
            break;

        case 'authorized_frequent':
            filtered = customers.filter(c => c.marketingWhatsApp === true && (c.ordersCount || 0) >= 3);
            break;

        case 'authorized_inactive_30':
            filtered = customers.filter(c => {
                if (c.marketingWhatsApp !== true) return false;
                if (!c.lastOrderAt && !c.lastOrderDate) return true;
                const orderTime = c.lastOrderAt ? Number(c.lastOrderAt) : 0;
                return orderTime > 0 && orderTime < thirtyDaysAgo;
            });
            break;

        case 'authorized_inactive_60':
            filtered = customers.filter(c => {
                if (c.marketingWhatsApp !== true) return false;
                if (!c.lastOrderAt && !c.lastOrderDate) return true;
                const orderTime = c.lastOrderAt ? Number(c.lastOrderAt) : 0;
                return orderTime > 0 && orderTime < sixtyDaysAgo;
            });
            break;

        case 'authorized_new_30':
            filtered = customers.filter(c => {
                if (c.marketingWhatsApp !== true) return false;
                const created = Number(c.createdAt || 0);
                return created >= thirtyDaysAgo;
            });
            break;

        case 'manual':
            filtered = customers.filter(c => c.marketingWhatsApp === true);
            break;

        default:
            filtered = customers.filter(c => c.marketingWhatsApp === true);
            break;
    }

    // Normalização com anti-duplicidade estrita
    const seenPhones = new Set();
    const cleanRecipients = [];

    filtered.forEach(c => {
        const cleanPhone = String(c.phone || c.id || '').replace(/\D/g, '');
        if (cleanPhone.length < 8 || seenPhones.has(cleanPhone)) return;
        seenPhones.add(cleanPhone);

        cleanRecipients.push({
            id: cleanPhone,
            name: c.name || 'Cliente',
            phone: cleanPhone,
            marketingWhatsApp: c.marketingWhatsApp === true,
            status: 'PENDING'
        });
    });

    currentCampaignDraft.selectedRecipients = cleanRecipients;

    updateAudienceCounters();
    renderManualAudienceTable();
    updateWhatsAppPreview();
}

function updateAudienceCounters() {
    const counterEl = document.getElementById('campAudienceCountDisplay');
    if (!counterEl) return;

    const totalSelected = currentCampaignDraft.selectedRecipients.length;
    const totalAuthorized = currentCampaignDraft.selectedRecipients.filter(r => r.marketingWhatsApp).length;
    const unauthorized = totalSelected - totalAuthorized;

    counterEl.innerHTML = `
        <span style="color: #25d366; font-weight: 800;">${totalAuthorized} destinatários autorizados</span>
        ${unauthorized > 0 ? `<span style="color: #ef5350; font-size: 11px; margin-left: 6px;">(${unauthorized} não autorizados removidos)</span>` : ''}
    `;
}

function renderManualAudienceTable() {
    const tableContainer = document.getElementById('campManualTableContainer');
    const tableBody = document.getElementById('campManualTableBody');
    const segmentSelect = document.getElementById('campSegmentSelect');

    if (!tableContainer || !tableBody) return;

    if (segmentSelect && segmentSelect.value === 'manual') {
        tableContainer.classList.remove('display-none');
    } else {
        tableContainer.classList.add('display-none');
        return;
    }

    tableBody.innerHTML = '';
    const customers = (typeof allCustomersList !== 'undefined' && Array.isArray(allCustomersList))
        ? allCustomersList
        : [];

    customers.forEach(cust => {
        const cleanPhone = String(cust.phone || cust.id || '').replace(/\D/g, '');
        if (cleanPhone.length < 8) return;

        const isChecked = currentCampaignDraft.selectedRecipients.some(r => r.phone === cleanPhone);
        const isAuthorized = cust.marketingWhatsApp === true;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 8px 12px; text-align: center;">
                <input type="checkbox" class="camp-manual-chk" data-phone="${cleanPhone}" ${isChecked ? 'checked' : ''} onchange="toggleManualRecipient('${cleanPhone}', this.checked)">
            </td>
            <td style="padding: 8px 12px; font-weight: 600; color: var(--text-main); font-size: 12.5px;">
                ${cust.name || 'Cliente'}
            </td>
            <td style="padding: 8px 12px; font-size: 12px; color: var(--text-light);">
                ${cust.phone || cleanPhone}
            </td>
            <td style="padding: 8px 12px; text-align: center;">
                ${isAuthorized ? '<span class="crm-badge crm-badge-authorized">Autorizado</span>' : '<span class="crm-badge crm-badge-refused">Recusou</span>'}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function toggleManualRecipient(cleanPhone, isSelected) {
    if (isSelected) {
        const cust = allCustomersList.find(c => String(c.phone || c.id || '').replace(/\D/g, '') === cleanPhone);
        if (cust && !currentCampaignDraft.selectedRecipients.some(r => r.phone === cleanPhone)) {
            currentCampaignDraft.selectedRecipients.push({
                id: cleanPhone,
                name: cust.name || 'Cliente',
                phone: cleanPhone,
                marketingWhatsApp: cust.marketingWhatsApp === true,
                status: 'PENDING'
            });
        }
    } else {
        currentCampaignDraft.selectedRecipients = currentCampaignDraft.selectedRecipients.filter(r => r.phone !== cleanPhone);
    }
    updateAudienceCounters();
    updateWhatsAppPreview();
}

/* ==========================================================================
   6. Salvar Campanha no Firebase
   ========================================================================== */
function saveAndPrepareCampaign() {
    const titleInput = document.getElementById('campTitleInput');
    const descInput = document.getElementById('campDescInput');
    const templateTextarea = document.getElementById('campTemplateTextarea');
    const segmentSelect = document.getElementById('campSegmentSelect');

    const title = titleInput ? titleInput.value.trim() : '';
    const desc = descInput ? descInput.value.trim() : '';
    const template = templateTextarea ? templateTextarea.value.trim() : '';

    if (!title) {
        if (typeof showToast === 'function') showToast('Informe o título da campanha!', 'error');
        if (titleInput) titleInput.focus();
        return;
    }

    if (!template) {
        if (typeof showToast === 'function') showToast('O texto da mensagem não pode ficar vazio!', 'error');
        if (templateTextarea) templateTextarea.focus();
        return;
    }

    if (!currentCampaignDraft.selectedRecipients || currentCampaignDraft.selectedRecipients.length === 0) {
        if (typeof showToast === 'function') showToast('Nenhum cliente selecionado para esta campanha.', 'error');
        return;
    }

    // Regra estrita: apenas clientes autorizados
    const authorizedRecipients = currentCampaignDraft.selectedRecipients.filter(r => r.marketingWhatsApp === true);
    if (authorizedRecipients.length === 0) {
        if (typeof showToast === 'function') showToast('Nenhum cliente com consentimento de WhatsApp encontrado no público selecionado.', 'warning');
        return;
    }

    const campaignId = 'camp_' + Date.now();
    const now = Date.now();

    const campaignData = {
        id: campaignId,
        title: title,
        description: desc,
        template: template,
        segment: segmentSelect ? segmentSelect.value : 'authorized_all',
        status: 'AGUARDANDO_ENVIO',
        recipients: authorizedRecipients,
        createdAt: now,
        updatedAt: now,
        statistics: {
            total: authorizedRecipients.length,
            sent: 0,
            delivered: 0,
            read: 0,
            errors: 0
        }
    };

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('campaigns/' + campaignId).set(campaignData)
            .then(() => {
                closeNewCampaignModal();
                if (typeof showToast === 'function') showToast(`Campanha "${title}" criada com sucesso!`, 'success');
                openCampaignDispatchModal(campaignId);
            })
            .catch(err => {
                console.error('[Campaigns] Erro ao salvar campanha:', err);
                closeNewCampaignModal();
                openCampaignDispatchModal(campaignId);
            });
    } else {
        allCampaignsList.unshift(campaignData);
        closeNewCampaignModal();
        renderCampaignsDashboard();
        openCampaignDispatchModal(campaignId);
    }
}

/* ==========================================================================
   7. Central de Disparo: Modal e Painel de Execução
   ========================================================================== */
function openCampaignDispatchModal(campaignId) {
    let camp = allCampaignsList.find(c => c.id === campaignId);
    if (!camp && currentCampaignDraft && currentCampaignDraft.id === campaignId) {
        camp = currentCampaignDraft;
    }

    if (!camp) {
        if (typeof showToast === 'function') showToast('Campanha não encontrada.', 'error');
        return;
    }

    activeDispatchCampaign = camp;

    const modal = document.getElementById('campaignDispatchModal');
    if (!modal) return;

    const titleEl = document.getElementById('dispatchModalTitle');
    const descEl = document.getElementById('dispatchModalDesc');
    const badgeEl = document.getElementById('dispatchCampaignStatusBadge');
    const noticeEl = document.getElementById('dispatchIntegrationNotice');

    if (titleEl) titleEl.textContent = `Campanha: ${camp.title}`;
    if (descEl) descEl.textContent = `${camp.recipients ? camp.recipients.length : 0} contatos autorizados na fila`;

    // Status badge
    updateCampaignStatusBadge(camp.status || 'AGUARDANDO_ENVIO');

    // Verifica status da integração oficial do WhatsApp
    const intStatus = (typeof WhatsAppService !== 'undefined')
        ? WhatsAppService.checkIntegrationStatus()
        : { configured: false, message: 'WhatsAppService não carregado.' };

    if (noticeEl) {
        noticeEl.style.display = 'block';
        if (intStatus.configured) {
            noticeEl.style.background = 'rgba(37, 211, 102, 0.12)';
            noticeEl.style.border = '1px solid rgba(37, 211, 102, 0.35)';
            noticeEl.style.color = '#25d366';
            noticeEl.innerHTML = `<strong>🟢 WhatsApp Business API Conectada</strong>: Disparos automáticos em lote prontos para execução.`;
        } else {
            noticeEl.style.background = 'rgba(245, 166, 35, 0.12)';
            noticeEl.style.border = '1px solid rgba(245, 166, 35, 0.35)';
            noticeEl.style.color = '#f5a623';
            noticeEl.innerHTML = `
                <strong>⚠️ Integração WhatsApp Business API não configurada</strong>:
                Para disparos 100% automáticos em lote, configure o <em>Phone Number ID</em> e o <em>Token</em> em <strong>Configurações &gt; WhatsApp</strong>.
                Você pode utilizar o <strong>Modo Manual 1 a 1 (wa.me)</strong> como contingência.
            `;
        }
    }

    // Renderiza a fila e a barra de progresso
    renderDispatchQueueTable();
    updateDispatchProgressUI();

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

function closeCampaignDispatchModal() {
    const modal = document.getElementById('campaignDispatchModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 200);
}

function updateCampaignStatusBadge(status) {
    const badgeEl = document.getElementById('dispatchCampaignStatusBadge');
    if (!badgeEl) return;

    switch (status) {
        case 'PROCESSANDO':
        case 'PROCESSING':
            badgeEl.className = 'crm-badge wa-badge-processing';
            badgeEl.textContent = '🔄 PROCESSANDO';
            break;
        case 'CONCLUIDA':
        case 'COMPLETED':
            badgeEl.className = 'crm-badge wa-badge-sent';
            badgeEl.textContent = '✅ CONCLUÍDA';
            break;
        case 'CONCLUIDA_COM_ERROS':
            badgeEl.className = 'crm-badge wa-badge-error';
            badgeEl.textContent = '⚠️ CONCLUÍDA COM ERROS';
            break;
        case 'CANCELADA':
            badgeEl.className = 'crm-badge wa-badge-invalid';
            badgeEl.textContent = '🛑 CANCELADA';
            break;
        default:
            badgeEl.className = 'crm-badge wa-badge-pending';
            badgeEl.textContent = '⏳ AGUARDANDO ENVIO';
            break;
    }
}

/* ==========================================================================
   8. Tabela de Destinatários e Status Granular
   ========================================================================== */
function renderDispatchQueueTable() {
    const tbody = document.getElementById('dispatchRecipientsTableBody');
    if (!tbody || !activeDispatchCampaign) return;

    tbody.innerHTML = '';
    const recipients = activeDispatchCampaign.recipients || [];
    const template = activeDispatchCampaign.template || '';

    recipients.forEach((rec, idx) => {
        const tr = document.createElement('tr');
        tr.id = `dispatchRow_${idx}`;
        tr.style.borderBottom = '1px solid var(--border-color)';

        const cleanPhone = String(rec.phone || rec.id).replace(/\D/g, '');
        const formattedPhone = (typeof WhatsAppService !== 'undefined')
            ? WhatsAppService.formatPhoneDisplay(cleanPhone)
            : cleanPhone;

        const statusBadge = getRecipientStatusBadge(rec.status, rec.error);

        const timeStr = rec.sentAt ? new Date(rec.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';

        // Ações de acordo com o modo
        let actionCell = '';
        if (isManualFallbackMode) {
            let preparedMsg = template;
            if (typeof WhatsAppService !== 'undefined') {
                preparedMsg = WhatsAppService.prepareMessage(template, rec);
            }
            const waLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(preparedMsg)}`;
            actionCell = `
                <a href="${waLink}" target="_blank" onclick="markRecipientSent(${idx}, '${cleanPhone}')" class="btn-dispatch-single" style="font-size: 11px; padding: 5px 10px;">
                    <span class="material-symbols-rounded" style="font-size: 15px;">send</span>
                    <span>wa.me</span>
                </a>
            `;
        } else {
            if (rec.status === 'ERROR') {
                actionCell = `
                    <button type="button" onclick="retrySingleRecipient(${idx})" class="btn-table-action" style="background: rgba(66,133,244,0.15); color: #8ab4f8; border: 1px solid rgba(66,133,244,0.35); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 700;">
                        🔄 Tentar
                    </button>
                `;
            } else if (rec.status === 'SENT' || rec.status === 'DELIVERED' || rec.status === 'READ') {
                actionCell = `<span style="color: #25d366; font-size: 11px; font-weight: 700;">✓ Pronto</span>`;
            } else {
                actionCell = `<span style="color: var(--text-muted); font-size: 11px;">Aguardando fila</span>`;
            }
        }

        tr.innerHTML = `
            <td style="padding: 10px 14px; font-weight: 700; color: var(--text-main); font-size: 12.5px;">
                ${rec.name || 'Cliente'}
            </td>
            <td style="padding: 10px 14px; color: var(--text-light); font-size: 12px;">
                ${formattedPhone}
            </td>
            <td style="padding: 10px 14px; text-align: center;" id="recStatusCell_${idx}">
                ${statusBadge}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-size: 11.5px; color: var(--text-muted);" id="recTimeCell_${idx}">
                ${timeStr}
            </td>
            <td style="padding: 10px 14px; text-align: center;" id="recActionCell_${idx}">
                ${actionCell}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateDispatchProgressUI();
}

function getRecipientStatusBadge(status, errorMsg = '') {
    switch (status) {
        case 'PROCESSING':
            return `<span class="crm-badge wa-badge-processing">🔄 Enviando...</span>`;
        case 'SENT':
        case 'OPENED_WA':
            return `<span class="crm-badge wa-badge-sent">✅ Enviado</span>`;
        case 'DELIVERED':
            return `<span class="crm-badge wa-badge-delivered">📩 Entregue</span>`;
        case 'READ':
            return `<span class="crm-badge wa-badge-read">📖 Lido</span>`;
        case 'ERROR':
            return `<span class="crm-badge wa-badge-error" title="${errorMsg || 'Erro no envio'}">❌ Erro</span>`;
        case 'INVALID':
            return `<span class="crm-badge wa-badge-invalid" title="${errorMsg || 'Telefone inválido'}">⚠️ Inválido</span>`;
        case 'UNAUTHORIZED':
            return `<span class="crm-badge wa-badge-unauthorized" title="Sem consentimento de marketing">🚫 Recusado</span>`;
        case 'DUPLICATE':
            return `<span class="crm-badge wa-badge-duplicate" title="Já enviado nesta campanha">🔁 Duplicado</span>`;
        default:
            return `<span class="crm-badge wa-badge-pending">⏳ Pendente</span>`;
    }
}

function updateDispatchProgressUI() {
    if (!activeDispatchCampaign || !activeDispatchCampaign.recipients) return;

    const recipients = activeDispatchCampaign.recipients;
    const total = recipients.length;
    let sent = 0;
    let delivered = 0;
    let read = 0;
    let errors = 0;
    let waiting = 0;

    recipients.forEach(r => {
        if (r.status === 'SENT' || r.status === 'OPENED_WA') sent++;
        else if (r.status === 'DELIVERED') { sent++; delivered++; }
        else if (r.status === 'READ') { sent++; delivered++; read++; }
        else if (r.status === 'ERROR' || r.status === 'INVALID') errors++;
        else waiting++;
    });

    const processed = total - waiting;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    const wrapper = document.getElementById('dispatchProgressWrapper');
    const fill = document.getElementById('dispatchProgressFill');
    const percentEl = document.getElementById('dispatchProgressPercentage');
    const processedEl = document.getElementById('dispatchProcessedCount');
    const totalEl = document.getElementById('dispatchTotalCount');
    const sentEl = document.getElementById('dispatchSentCount');
    const errorEl = document.getElementById('dispatchErrorCount');
    const readEl = document.getElementById('dispatchReadCount');
    const waitEl = document.getElementById('dispatchWaitingCount');
    const retryBtn = document.getElementById('btnRetryErrors');
    const countRetryEl = document.getElementById('countErrorsToRetry');

    if (processed > 0 && wrapper) wrapper.style.display = 'block';

    if (fill) fill.style.width = `${percentage}%`;
    if (percentEl) percentEl.textContent = `${percentage}%`;
    if (processedEl) processedEl.textContent = processed;
    if (totalEl) totalEl.textContent = total;
    if (sentEl) sentEl.textContent = sent;
    if (errorEl) errorEl.textContent = errors;
    if (readEl) readEl.textContent = read;
    if (waitEl) waitEl.textContent = waiting;

    if (retryBtn) {
        if (errors > 0 && !(typeof WhatsAppService !== 'undefined' && WhatsAppService.isExecuting())) {
            retryBtn.style.display = 'inline-flex';
            if (countRetryEl) countRetryEl.textContent = errors;
        } else {
            retryBtn.style.display = 'none';
        }
    }
}

/* ==========================================================================
   9. Modal de Confirmação de Segurança (ENVIAR CAMPANHA?)
   ========================================================================== */
function promptConfirmCampaignDispatch() {
    if (!activeDispatchCampaign) {
        if (typeof showToast === 'function') showToast('Selecione ou abra uma campanha para disparar.', 'error');
        return;
    }

    // Verifica status da API oficial
    const intStatus = (typeof WhatsAppService !== 'undefined')
        ? WhatsAppService.checkIntegrationStatus()
        : { configured: false };

    if (!intStatus.configured) {
        if (confirm('Atenção: A integração oficial da WhatsApp Business API não está configurada.\n\nDeseja abrir o modo manual 1 a 1 de contingência para envio via wa.me?')) {
            toggleManualDispatchMode(true);
        }
        return;
    }

    const modal = document.getElementById('confirmCampaignDispatchModal');
    if (!modal) return;

    const titleEl = document.getElementById('confirmCampTitle');
    const authEl = document.getElementById('confirmCampAuthorized');
    const unauthEl = document.getElementById('confirmCampUnauthorized');

    const totalRec = activeDispatchCampaign.recipients || [];
    const authorizedCount = totalRec.filter(r => r.marketingWhatsApp === true).length;
    const unauthorizedCount = totalRec.length - authorizedCount;

    if (titleEl) titleEl.textContent = activeDispatchCampaign.title || 'Campanha Promocional';
    if (authEl) authEl.textContent = `${authorizedCount} clientes autorizados`;
    if (unauthEl) unauthEl.textContent = `${unauthorizedCount} clientes sem opt-in`;

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

function closeConfirmCampaignDispatchModal() {
    const modal = document.getElementById('confirmCampaignDispatchModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.classList.add('display-none'), 200);
}

/* ==========================================================================
   10. Execução Automática em Lote (Botão: 🚀 ENVIAR CAMPANHA)
   ========================================================================== */
async function confirmAndExecuteDispatch() {
    closeConfirmCampaignDispatchModal();
    executeBatchDispatch();
}

async function executeBatchDispatch(options = {}) {
    if (!activeDispatchCampaign) return;

    if (typeof WhatsAppService === 'undefined') {
        if (typeof showToast === 'function') showToast('WhatsAppService não encontrado.', 'error');
        return;
    }

    const intStatus = WhatsAppService.checkIntegrationStatus();
    if (!intStatus.configured) {
        if (typeof showToast === 'function') {
            showToast('Integração WhatsApp Business API não configurada. Configure o Phone Number ID e Token em Configurações.', 'warning');
        }
        return;
    }

    const startBtn = document.getElementById('btnStartAutoDispatch');
    const pauseBtn = document.getElementById('btnPauseAutoDispatch');
    const resumeBtn = document.getElementById('btnResumeAutoDispatch');
    const cancelBtn = document.getElementById('btnCancelAutoDispatch');
    const progressWrapper = document.getElementById('dispatchProgressWrapper');

    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (progressWrapper) progressWrapper.style.display = 'block';

    updateCampaignStatusBadge('PROCESSANDO');
    activeDispatchCampaign.status = 'PROCESSANDO';
    activeDispatchCampaign.startedAt = activeDispatchCampaign.startedAt || Date.now();

    // Sincroniza status inicial no Firebase
    syncCampaignToFirebase(activeDispatchCampaign);

    try {
        const finalStats = await WhatsAppService.dispatchCampaignBatch(
            activeDispatchCampaign,
            options,
            {
                onProgress: (stats, currentRecipient) => {
                    updateDispatchProgressUI();
                },
                onStatusUpdate: (idx, recipient) => {
                    const statusCell = document.getElementById(`recStatusCell_${idx}`);
                    const timeCell = document.getElementById(`recTimeCell_${idx}`);
                    const actionCell = document.getElementById(`recActionCell_${idx}`);

                    if (statusCell) statusCell.innerHTML = getRecipientStatusBadge(recipient.status, recipient.error);
                    if (timeCell && recipient.sentAt) {
                        timeCell.textContent = new Date(recipient.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }
                    if (actionCell) {
                        if (recipient.status === 'ERROR') {
                            actionCell.innerHTML = `
                                <button type="button" onclick="retrySingleRecipient(${idx})" class="btn-table-action" style="background: rgba(66,133,244,0.15); color: #8ab4f8; border: 1px solid rgba(66,133,244,0.35); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 700;">
                                    🔄 Tentar
                                </button>
                            `;
                        } else if (recipient.status === 'SENT') {
                            actionCell.innerHTML = `<span style="color: #25d366; font-size: 11px; font-weight: 700;">✓ Enviado</span>`;
                        }
                    }

                    // Sincroniza destinatário específico no Firebase
                    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && activeDispatchCampaign.id) {
                        firebase.database().ref(`campaigns/${activeDispatchCampaign.id}/recipients/${idx}`).update({
                            status: recipient.status,
                            messageId: recipient.messageId || null,
                            sentAt: recipient.sentAt || null,
                            error: recipient.error || null
                        }).catch(e => console.warn('[Campaigns] Erro ao sincronizar destinatário:', e));
                    }
                },
                onComplete: (finalStats) => {
                    onDispatchBatchCompleted(finalStats);
                }
            }
        );
    } catch (err) {
        console.error('[Campaigns] Erro durante o disparo:', err);
        if (typeof showToast === 'function') showToast(err.message, 'error');
        resetDispatchControlsUI();
    }
}

function onDispatchBatchCompleted(finalStats) {
    resetDispatchControlsUI();

    if (!activeDispatchCampaign) return;

    const newStatus = (finalStats.errors > 0)
        ? 'CONCLUIDA_COM_ERROS'
        : (finalStats.cancelled ? 'CANCELADA' : 'CONCLUIDA');

    activeDispatchCampaign.status = newStatus;
    activeDispatchCampaign.finishedAt = Date.now();
    activeDispatchCampaign.statistics = {
        total: finalStats.total,
        sent: finalStats.sent,
        delivered: 0,
        read: 0,
        errors: finalStats.errors
    };

    updateCampaignStatusBadge(newStatus);
    syncCampaignToFirebase(activeDispatchCampaign);
    renderCampaignsDashboard();

    // Apresenta o relatório final consolidado
    openCampaignFinalReportModal(finalStats);
}

function resetDispatchControlsUI() {
    const startBtn = document.getElementById('btnStartAutoDispatch');
    const pauseBtn = document.getElementById('btnPauseAutoDispatch');
    const resumeBtn = document.getElementById('btnResumeAutoDispatch');
    const cancelBtn = document.getElementById('btnCancelAutoDispatch');

    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

/* ==========================================================================
   11. Controles de Execução: Pausar, Retomar, Cancelar e Retentar
   ========================================================================== */
function pauseCampaignDispatch() {
    if (typeof WhatsAppService !== 'undefined' && WhatsAppService.pauseBatch()) {
        const pauseBtn = document.getElementById('btnPauseAutoDispatch');
        const resumeBtn = document.getElementById('btnResumeAutoDispatch');
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'inline-flex';
        if (typeof showToast === 'function') showToast('Disparo pausado.', 'info');
    }
}

function resumeCampaignDispatch() {
    if (typeof WhatsAppService !== 'undefined' && WhatsAppService.resumeBatch()) {
        const pauseBtn = document.getElementById('btnPauseAutoDispatch');
        const resumeBtn = document.getElementById('btnResumeAutoDispatch');
        if (pauseBtn) pauseBtn.style.display = 'inline-flex';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (typeof showToast === 'function') showToast('Disparo retomado.', 'success');
    }
}

function cancelCampaignDispatch() {
    if (!confirm('Deseja realmente cancelar o envio dos destinatários pendentes? Mensagens já disparadas não serão afetadas.')) return;

    if (typeof WhatsAppService !== 'undefined') {
        WhatsAppService.cancelBatch();
        resetDispatchControlsUI();
        if (activeDispatchCampaign) {
            activeDispatchCampaign.status = 'CANCELADA';
            updateCampaignStatusBadge('CANCELADA');
            syncCampaignToFirebase(activeDispatchCampaign);
        }
        if (typeof showToast === 'function') showToast('Disparo cancelado pelo usuário.', 'warning');
    }
}

function retryFailedRecipients() {
    if (!activeDispatchCampaign) return;
    executeBatchDispatch({ onlyErrors: true });
}

async function retrySingleRecipient(index) {
    if (!activeDispatchCampaign || !activeDispatchCampaign.recipients[index]) return;

    const recipient = activeDispatchCampaign.recipients[index];
    const cleanPhone = String(recipient.phone || recipient.id).replace(/\D/g, '');
    const template = activeDispatchCampaign.template;

    const statusCell = document.getElementById(`recStatusCell_${index}`);
    if (statusCell) statusCell.innerHTML = `<span class="crm-badge wa-badge-processing">🔄 Tentando...</span>`;

    const prepared = WhatsAppService.prepareMessage(template, recipient);
    const res = await WhatsAppService.sendTextMessage(cleanPhone, prepared, {
        campaignId: activeDispatchCampaign.id,
        idempotencyKey: `${activeDispatchCampaign.id}_${cleanPhone}_retry_${Date.now()}`
    });

    if (res.success) {
        recipient.status = 'SENT';
        recipient.messageId = res.messageId;
        recipient.sentAt = res.timestamp || Date.now();
        recipient.error = null;
        if (typeof showToast === 'function') showToast(`Mensagem reenviada para ${recipient.name}!`, 'success');
    } else {
        recipient.status = 'ERROR';
        recipient.error = res.error;
        if (typeof showToast === 'function') showToast(`Erro ao reenviar: ${res.error}`, 'error');
    }

    renderDispatchQueueTable();
    syncCampaignToFirebase(activeDispatchCampaign);
}

/* ==========================================================================
   12. Modo de Contingência / Fallback Manual 1 a 1 (wa.me)
   ========================================================================== */
function toggleManualDispatchMode(forceEnable = null) {
    if (forceEnable !== null) {
        isManualFallbackMode = forceEnable;
    } else {
        isManualFallbackMode = !isManualFallbackMode;
    }

    const toggleText = document.getElementById('txtManualModeToggle');
    if (toggleText) {
        toggleText.textContent = isManualFallbackMode ? 'Voltar para Modo Automático' : 'Ativar Modo Manual 1 a 1';
    }

    renderDispatchQueueTable();
}

function markRecipientSent(index, cleanPhone) {
    if (!activeDispatchCampaign || !activeDispatchCampaign.recipients) return;
    if (activeDispatchCampaign.recipients[index]) {
        activeDispatchCampaign.recipients[index].status = 'OPENED_WA';
        activeDispatchCampaign.recipients[index].sentAt = Date.now();

        renderDispatchQueueTable();

        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && activeDispatchCampaign.id) {
            firebase.database().ref(`campaigns/${activeDispatchCampaign.id}/recipients/${index}`).update({
                status: 'OPENED_WA',
                sentAt: Date.now()
            }).catch(e => console.warn('[Campaigns] Erro ao sincronizar status:', e));
        }
    }
}

/* ==========================================================================
   13. Relatório Final Pós-Campanha
   ========================================================================== */
function openCampaignFinalReportModal(stats) {
    const modal = document.getElementById('campaignFinalReportModal');
    if (!modal) return;

    const titleEl = document.getElementById('reportCampaignTitle');
    const totEl = document.getElementById('reportMetricTotal');
    const sentEl = document.getElementById('reportMetricSent');
    const delivEl = document.getElementById('reportMetricDelivered');
    const readEl = document.getElementById('reportMetricRead');
    const errEl = document.getElementById('reportMetricErrors');
    const retryErrorsBtn = document.getElementById('btnReportRetryErrors');

    if (titleEl && activeDispatchCampaign) titleEl.textContent = `🍕 ${activeDispatchCampaign.title || 'Campanha Fina Massa'}`;
    if (totEl) totEl.textContent = stats.total || 0;
    if (sentEl) sentEl.textContent = stats.sent || 0;
    if (delivEl) delivEl.textContent = 0; // Entregue oficial depende de webhook
    if (readEl) readEl.textContent = 0;   // Lido oficial depende de webhook
    if (errEl) errEl.textContent = stats.errors || 0;

    if (retryErrorsBtn) {
        retryErrorsBtn.style.display = (stats.errors > 0) ? 'inline-flex' : 'none';
    }

    modal.classList.remove('display-none');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

function closeCampaignFinalReportModal(closeParent = false) {
    const modal = document.getElementById('campaignFinalReportModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => {
        modal.classList.add('display-none');
        if (closeParent) {
            closeCampaignDispatchModal();
        }
    }, 200);
}

function retryFailedRecipientsFromReport() {
    closeCampaignFinalReportModal(false);
    retryFailedRecipients();
}

/* ==========================================================================
   14. Auxiliares e Sincronização
   ========================================================================== */
function syncCampaignToFirebase(campaign) {
    if (!campaign || !campaign.id) return;
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('campaigns/' + campaign.id).update({
            status: campaign.status,
            startedAt: campaign.startedAt || null,
            finishedAt: campaign.finishedAt || null,
            statistics: campaign.statistics || null,
            updatedAt: Date.now()
        }).catch(err => console.warn('[Campaigns] Falha ao atualizar campanha:', err));
    }
}

function deleteCampaign(campaignId) {
    if (!confirm('Deseja realmente excluir esta campanha e todo o histórico de envios dela?')) return;

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('campaigns/' + campaignId).remove()
            .then(() => {
                if (typeof showToast === 'function') showToast('Campanha excluída com sucesso.', 'info');
            });
    } else {
        allCampaignsList = allCampaignsList.filter(c => c.id !== campaignId);
        renderCampaignsDashboard();
    }
}

// Inicialização
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        initCampaignsSync();
    });
}
