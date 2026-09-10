/**
 * ==============================================================================
 * FINA MASSA PIZZARIA — WHATSAPP SERVICE
 * ==============================================================================
 * Camada de serviço centralizada e isolada para mensageria WhatsApp.
 * Suporta integração com a WhatsApp Business Platform / Cloud API oficial (Meta),
 * controle de rate limit (pacing), proteção contra duplicidade (idempotência),
 * sanitização de telefones E.164, substituição dinâmica de variáveis e fallback seguro.
 * ==============================================================================
 */

const WhatsAppService = (function () {
    'use strict';

    // Configuração em memória (sincronizada com Firebase / LocalStorage)
    let _config = {
        enabled: false,
        commercialPhone: '',
        phoneNumberId: '',
        wabaId: '',
        apiToken: '',
        apiVersion: 'v21.0',
        webhookVerifyToken: '',
        menuUrl: 'https://pizzariafinamassa.com.br/',
        backendProxyUrl: '',
        dispatchDelayMs: 600 // Pacing seguro de 600ms entre disparos (Meta rate limits)
    };

    // Estados possíveis dos destinatários
    const STATUS = {
        PENDING: 'PENDING',
        PROCESSING: 'PROCESSING',
        SENT: 'SENT',
        DELIVERED: 'DELIVERED',
        READ: 'READ',
        ERROR: 'ERROR',
        INVALID: 'INVALID',
        IGNORED: 'IGNORED',
        UNAUTHORIZED: 'UNAUTHORIZED',
        DUPLICATE: 'DUPLICATE'
    };

    // Controle de execução de lote atual
    let _activeExecution = {
        campaignId: null,
        isExecuting: false,
        isPaused: false,
        isCancelled: false,
        abortController: null
    };

    /* ==========================================================================
       1. Configurações e Inicialização
       ========================================================================== */
    function init(customConfig) {
        if (customConfig && typeof customConfig === 'object') {
            _config = { ..._config, ...customConfig };
        }
        loadStoredConfig();
    }

    function loadStoredConfig() {
        try {
            // Tenta carregar do localStorage primeiro
            const stored = localStorage.getItem('fina_massa_whatsapp_campaigns_config');
            if (stored) {
                const parsed = JSON.parse(stored);
                _config = { ..._config, ...parsed };
            }
        } catch (e) {
            console.warn('[WhatsAppService] Falha ao ler localStorage:', e);
        }

        // Tenta sincronizar com Firebase se disponível
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            try {
                firebase.database().ref('settings/whatsappCampaigns').on('value', (snap) => {
                    const data = snap.val();
                    if (data && typeof data === 'object') {
                        _config = { ..._config, ...data };
                    }
                });
            } catch (err) {
                console.warn('[WhatsAppService] Falha ao sincronizar settings/whatsappCampaigns:', err);
            }
        }
    }

    function saveConfig(newConfig) {
        _config = { ..._config, ...newConfig };
        try {
            // Salva no localStorage
            localStorage.setItem('fina_massa_whatsapp_campaigns_config', JSON.stringify(_config));
        } catch (e) {
            console.warn('[WhatsAppService] Falha ao salvar localStorage:', e);
        }

        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            try {
                return firebase.database().ref('settings/whatsappCampaigns').update(_config);
            } catch (err) {
                console.warn('[WhatsAppService] Falha ao salvar no Firebase:', err);
            }
        }
        return Promise.resolve(_config);
    }

    function getConfig() {
        return { ..._config };
    }

    /**
     * Verifica o estado da integração oficial
     * Retorna { configured: boolean, status: string, message: string }
     */
    function checkIntegrationStatus() {
        const hasPhoneId = Boolean(_config.phoneNumberId && _config.phoneNumberId.trim().length > 5);
        const hasToken = Boolean((_config.apiToken && _config.apiToken.trim().length > 10) ||
                                 (_config.backendProxyUrl && _config.backendProxyUrl.trim().length > 8));

        if (_config.enabled && hasPhoneId && hasToken) {
            return {
                configured: true,
                status: 'READY',
                message: 'WhatsApp Business API configurada e ativa para disparos automáticos.'
            };
        }

        return {
            configured: false,
            status: 'NOT_CONFIGURED',
            message: 'Integração WhatsApp Business API não configurada. Configure o Phone Number ID e Token em Configurações > WhatsApp para envios em massa.'
        };
    }

    /* ==========================================================================
       2. Validação e Normalização Telefônica (E.164)
       ========================================================================== */
    /**
     * Valida e normaliza telefone brasileiro para o formato E.164 da Meta:
     * Exemplo: '5554999201102' (sem +, sem espaços, sem parênteses)
     */
    function normalizePhoneE164(rawPhone) {
        if (!rawPhone) return null;
        let digits = String(rawPhone).replace(/\D/g, '');

        // Remove prefixo 55 se já foi colocado com dígitos adicionais
        if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
            digits = digits.substring(2);
        }

        // Deve conter DDD válido (11 a 99) e número com 8 ou 9 dígitos
        if (digits.length < 10 || digits.length > 11) {
            return null;
        }

        const ddd = parseInt(digits.substring(0, 2), 10);
        if (ddd < 11 || ddd > 99) {
            return null;
        }

        // Formato final E.164 oficial para envio Meta: 55 + DDD + número
        return '55' + digits;
    }

    /**
     * Formatação amigável para exibição visual
     */
    function formatPhoneDisplay(cleanDigits) {
        if (!cleanDigits) return '';
        let d = String(cleanDigits).replace(/\D/g, '');
        if (d.startsWith('55') && d.length > 11) {
            d = d.substring(2);
        }
        if (d.length === 11) {
            return `(${d.substring(0, 2)}) ${d.substring(2, 7)}-${d.substring(7)}`;
        }
        if (d.length === 10) {
            return `(${d.substring(0, 2)}) ${d.substring(2, 6)}-${d.substring(6)}`;
        }
        return cleanDigits;
    }

    /* ==========================================================================
       3. Preparação e Sanitização da Mensagem
       ========================================================================== */
    /**
     * Substitui {nome} e {link} pelos valores correspondentes
     */
    function prepareMessage(template, customer) {
        if (!template) return '';
        const name = (customer && customer.name) ? customer.name.trim() : 'Cliente';
        const firstName = name.split(' ')[0] || 'Cliente';

        let catalogUrl = _config.menuUrl;
        if (!catalogUrl || catalogUrl.trim().length === 0) {
            if (typeof window !== 'undefined' && window.location) {
                catalogUrl = window.location.origin + window.location.pathname.replace(/\/painel\/?.*$/, '/');
            } else {
                catalogUrl = 'https://pizzariafinamassa.com.br/';
            }
        }

        return template
            .replace(/\{nome\}/gi, firstName)
            .replace(/\{link\}/gi, catalogUrl);
    }

    /* ==========================================================================
       4. Envio Direto via WhatsApp Business Cloud API (Meta)
       ========================================================================== */
    /**
     * Dispara uma mensagem de texto via WhatsApp Cloud API oficial
     */
    async function sendTextMessage(toPhone, messageText, options = {}) {
        const e164 = normalizePhoneE164(toPhone);
        if (!e164) {
            return {
                success: false,
                status: STATUS.INVALID,
                error: 'Número de telefone inválido para o padrão E.164 brasileiro'
            };
        }

        const intStatus = checkIntegrationStatus();
        if (!intStatus.configured) {
            return {
                success: false,
                status: STATUS.ERROR,
                error: 'INTEGRAÇÃO WHATSAPP AINDA NÃO CONFIGURADA. Insira o Phone Number ID e Token em Configurações > WhatsApp.'
            };
        }

        // Endpoint: Backend Proxy ou Meta Graph API direta
        let endpoint = '';
        let headers = { 'Content-Type': 'application/json' };
        let body = {};

        if (_config.backendProxyUrl && _config.backendProxyUrl.trim().length > 5) {
            // Se houver backend proxy / Cloud Function
            endpoint = _config.backendProxyUrl;
            body = {
                to: e164,
                type: 'text',
                text: { body: messageText },
                campaignId: options.campaignId || null,
                idempotencyKey: options.idempotencyKey || null
            };
        } else {
            // Chamada direta à Meta Cloud API
            const version = _config.apiVersion || 'v21.0';
            const phoneId = _config.phoneNumberId;
            endpoint = `https://graph.facebook.com/${version}/${phoneId}/messages`;
            headers['Authorization'] = `Bearer ${_config.apiToken}`;

            body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: e164,
                type: 'text',
                text: {
                    preview_url: true,
                    body: messageText
                }
            };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = (data && data.error && data.error.message)
                    ? data.error.message
                    : `Erro HTTP ${response.status}: ${response.statusText}`;
                return {
                    success: false,
                    status: STATUS.ERROR,
                    error: errMsg,
                    rawError: data
                };
            }

            const messageId = (data && data.messages && data.messages[0] && data.messages[0].id)
                ? data.messages[0].id
                : ('meta_' + Date.now());

            return {
                success: true,
                status: STATUS.SENT,
                messageId: messageId,
                timestamp: Date.now()
            };
        } catch (netErr) {
            return {
                success: false,
                status: STATUS.ERROR,
                error: netErr.message || 'Erro de rede ou conexão com a API do WhatsApp',
                rawError: netErr
            };
        }
    }

    /**
     * Dispara uma mensagem baseada em Template oficial aprovado pela Meta
     */
    async function sendTemplateMessage(toPhone, templateName, languageCode = 'pt_BR', components = [], options = {}) {
        const e164 = normalizePhoneE164(toPhone);
        if (!e164) {
            return {
                success: false,
                status: STATUS.INVALID,
                error: 'Número de telefone inválido'
            };
        }

        const intStatus = checkIntegrationStatus();
        if (!intStatus.configured) {
            return {
                success: false,
                status: STATUS.ERROR,
                error: 'INTEGRAÇÃO WHATSAPP AINDA NÃO CONFIGURADA'
            };
        }

        const version = _config.apiVersion || 'v21.0';
        const phoneId = _config.phoneNumberId;
        const endpoint = `https://graph.facebook.com/${version}/${phoneId}/messages`;

        const body = {
            messaging_product: 'whatsapp',
            to: e164,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components: components
            }
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${_config.apiToken}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok) {
                const errMsg = (data && data.error && data.error.message) ? data.error.message : 'Falha no template';
                return { success: false, status: STATUS.ERROR, error: errMsg, rawError: data };
            }

            const messageId = (data && data.messages && data.messages[0] && data.messages[0].id)
                ? data.messages[0].id
                : ('tpl_' + Date.now());

            return { success: true, status: STATUS.SENT, messageId: messageId, timestamp: Date.now() };
        } catch (err) {
            return { success: false, status: STATUS.ERROR, error: err.message };
        }
    }

    /* ==========================================================================
       5. Processamento em Lote com Rate Limiting e Idempotência
       ========================================================================== */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Executa o disparo automático em lote para os destinatários selecionados
     */
    async function dispatchCampaignBatch(campaign, options = {}, callbacks = {}) {
        if (!campaign || !campaign.recipients || !Array.isArray(campaign.recipients)) {
            throw new Error('Campanha inválida ou lista de destinatários vazia.');
        }

        if (_activeExecution.isExecuting) {
            throw new Error('Já existe um lote de disparos em andamento. Aguarde ou pause o lote atual.');
        }

        _activeExecution.campaignId = campaign.id;
        _activeExecution.isExecuting = true;
        _activeExecution.isPaused = false;
        _activeExecution.isCancelled = false;

        const delayMs = Math.max(300, Number(_config.dispatchDelayMs) || 600);
        const onlyErrors = Boolean(options.onlyErrors);

        // Histórico de chaves processadas para idempotência rigorosa
        const processedKeys = new Set();

        const recipients = campaign.recipients;
        const total = recipients.length;

        let processedCount = 0;
        let sentCount = 0;
        let errorCount = 0;
        let ignoredCount = 0;

        // Pré-contagem de itens já finalizados
        recipients.forEach(r => {
            if (r.status === STATUS.SENT || r.status === STATUS.DELIVERED || r.status === STATUS.READ) {
                sentCount++;
                processedCount++;
                const clean = String(r.phone || r.id).replace(/\D/g, '');
                processedKeys.add(`${campaign.id}_${clean}`);
            }
        });

        for (let i = 0; i < total; i++) {
            const recipient = recipients[i];
            const cleanPhone = String(recipient.phone || recipient.id || '').replace(/\D/g, '');
            const idempotencyKey = `${campaign.id}_${cleanPhone}`;

            // Se foi cancelado
            if (_activeExecution.isCancelled) {
                console.log('[WhatsAppService] Disparo cancelado pelo usuário.');
                break;
            }

            // Loop de pausa
            while (_activeExecution.isPaused && !_activeExecution.isCancelled) {
                await sleep(500);
            }

            if (_activeExecution.isCancelled) break;

            // Se estamos reprocessando somente erros, pula os que não deram erro
            if (onlyErrors && recipient.status !== STATUS.ERROR) {
                continue;
            }

            // Proteção contra duplo envio (Idempotência)
            if (recipient.status === STATUS.SENT || recipient.status === STATUS.DELIVERED || recipient.status === STATUS.READ) {
                continue;
            }

            if (processedKeys.has(idempotencyKey)) {
                recipient.status = STATUS.DUPLICATE;
                recipient.error = 'Destinatário duplicado na mesma campanha.';
                if (callbacks.onStatusUpdate) callbacks.onStatusUpdate(i, recipient);
                ignoredCount++;
                processedCount++;
                continue;
            }

            // Validação estrita de consentimento LGPD
            if (recipient.marketingWhatsApp !== true) {
                recipient.status = STATUS.UNAUTHORIZED;
                recipient.error = 'Cliente não autorizou receber comunicações de marketing.';
                if (callbacks.onStatusUpdate) callbacks.onStatusUpdate(i, recipient);
                ignoredCount++;
                processedCount++;
                continue;
            }

            // Validação E.164
            const e164 = normalizePhoneE164(cleanPhone);
            if (!e164) {
                recipient.status = STATUS.INVALID;
                recipient.error = 'Telefone inválido para envio WhatsApp (formato não compatível).';
                if (callbacks.onStatusUpdate) callbacks.onStatusUpdate(i, recipient);
                errorCount++;
                processedCount++;
                continue;
            }

            // Marca como PROCESSANDO
            recipient.status = STATUS.PROCESSING;
            if (callbacks.onStatusUpdate) callbacks.onStatusUpdate(i, recipient);

            // Prepara texto personalizado
            const personalizedMessage = prepareMessage(campaign.template, recipient);

            // Executa envio seguro
            const result = await sendTextMessage(e164, personalizedMessage, {
                campaignId: campaign.id,
                idempotencyKey: idempotencyKey
            });

            if (result.success) {
                recipient.status = STATUS.SENT;
                recipient.messageId = result.messageId;
                recipient.sentAt = result.timestamp || Date.now();
                recipient.error = null;
                sentCount++;
                processedKeys.add(idempotencyKey);
            } else {
                recipient.status = STATUS.ERROR;
                recipient.error = result.error || 'Erro desconhecido ao enviar mensagem.';
                errorCount++;
            }

            processedCount++;

            // Notifica atualização individual do status
            if (callbacks.onStatusUpdate) {
                callbacks.onStatusUpdate(i, recipient);
            }

            // Notifica progresso global
            if (callbacks.onProgress) {
                callbacks.onProgress({
                    total: total,
                    processed: processedCount,
                    sent: sentCount,
                    errors: errorCount,
                    ignored: ignoredCount,
                    percentage: Math.round((processedCount / total) * 100)
                }, recipient);
            }

            // Pacing de rate limiting
            await sleep(delayMs);
        }

        _activeExecution.isExecuting = false;

        const finalStats = {
            total: total,
            processed: processedCount,
            sent: sentCount,
            errors: errorCount,
            ignored: ignoredCount,
            cancelled: _activeExecution.isCancelled,
            paused: _activeExecution.isPaused,
            percentage: Math.round((processedCount / total) * 100)
        };

        if (callbacks.onComplete) {
            callbacks.onComplete(finalStats);
        }

        return finalStats;
    }

    function pauseBatch() {
        if (_activeExecution.isExecuting) {
            _activeExecution.isPaused = true;
            return true;
        }
        return false;
    }

    function resumeBatch() {
        if (_activeExecution.isExecuting && _activeExecution.isPaused) {
            _activeExecution.isPaused = false;
            return true;
        }
        return false;
    }

    function cancelBatch() {
        if (_activeExecution.isExecuting) {
            _activeExecution.isCancelled = true;
            _activeExecution.isPaused = false;
            return true;
        }
        return false;
    }

    function isExecuting() {
        return _activeExecution.isExecuting;
    }

    function isPaused() {
        return _activeExecution.isPaused;
    }

    /* ==========================================================================
       6. Teste de Conexão com a API Meta
       ========================================================================== */
    async function testConnection(testPhone = null) {
        const status = checkIntegrationStatus();
        if (!status.configured) {
            return {
                ok: false,
                message: 'Parâmetros incompletos. Informe o Phone Number ID e o Access Token.'
            };
        }

        const version = _config.apiVersion || 'v21.0';
        const phoneId = _config.phoneNumberId;
        const endpoint = `https://graph.facebook.com/${version}/${phoneId}`;

        try {
            const res = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${_config.apiToken}`
                }
            });
            const data = await res.json();

            if (res.ok && data.id) {
                return {
                    ok: true,
                    message: `Conexão bem-sucedida com a Meta! Número registrado: ${data.display_phone_number || data.id} (${data.verified_name || 'Conta Verificada'}).`,
                    details: data
                };
            } else {
                return {
                    ok: false,
                    message: `Erro de autenticação na Meta: ${data.error ? data.error.message : res.statusText}`,
                    details: data
                };
            }
        } catch (e) {
            return {
                ok: false,
                message: `Não foi possível conectar ao servidor da Meta: ${e.message}`,
                error: e
            };
        }
    }

    // Inicialização automática
    loadStoredConfig();

    return {
        STATUS,
        init,
        getConfig,
        saveConfig,
        checkIntegrationStatus,
        normalizePhoneE164,
        formatPhoneDisplay,
        prepareMessage,
        sendTextMessage,
        sendTemplateMessage,
        dispatchCampaignBatch,
        pauseBatch,
        resumeBatch,
        cancelBatch,
        isExecuting,
        isPaused,
        testConnection
    };
})();

// Expõe globalmente
if (typeof window !== 'undefined') {
    window.WhatsAppService = WhatsAppService;
}
