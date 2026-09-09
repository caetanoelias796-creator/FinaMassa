/**
 * ==============================================================================
 * CustomerAuth.js — Módulo de Identificação e Gestão de Clientes por WhatsApp
 * Fina Massa Pizzaria
 * ==============================================================================
 * Responsabilidades:
 * - Normalização e formatação de números de telefone (Brasil/WhatsApp).
 * - Identificação, cadastro e persistência de sessão de clientes (localStorage).
 * - Atualização atômica de métricas de pedidos (totalOrders, totalSpent, lastOrderAt).
 * - Consulta privada de pedidos do cliente autenticado.
 * ==============================================================================
 */

(function (global) {
    'use strict';

    const CUSTOMER_STORAGE_KEY = 'fina_massa_customer_session';

    const CustomerAuth = {
        version: '1.0.0',

        /**
         * Normaliza número de telefone removendo todos os caracteres não numéricos.
         * Remove também o DDI '55' caso o número tenha 12 ou 13 dígitos para manter
         * o padrão DDD + 8 ou 9 dígitos (ex: 54999999999).
         * @param {string|number} phone
         * @returns {string}
         */
        normalizePhone: function (phone) {
            if (!phone) return '';
            let digits = String(phone).replace(/\D/g, '');
            // Se vier com prefixo do Brasil 55 e tiver 12 ou 13 dígitos, remove o 55 inicial
            if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
                digits = digits.substring(2);
            }
            return digits;
        },

        /**
         * Formata número no padrão brasileiro:
         * Celular (11 dígitos): (54) 99999-9999
         * Fixo (10 dígitos): (54) 3333-3333
         * @param {string|number} phone
         * @returns {string}
         */
        formatPhone: function (phone) {
            const digits = this.normalizePhone(phone);
            if (!digits) return '';
            if (digits.length === 11) {
                return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
            }
            if (digits.length === 10) {
                return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
            }
            return digits;
        },

        /**
         * Valida se o número possui quantidade válida de dígitos para um telefone brasileiro com DDD.
         * Válido: 10 ou 11 dígitos numéricos com DDD válido (11 a 99).
         * @param {string|number} phone
         * @returns {boolean}
         */
        validatePhone: function (phone) {
            const digits = this.normalizePhone(phone);
            if (digits.length !== 10 && digits.length !== 11) {
                return false;
            }
            const ddd = parseInt(digits.substring(0, 2), 10);
            if (isNaN(ddd) || ddd < 11 || ddd > 99) {
                return false;
            }
            return true;
        },

        /**
         * Obtém a sessão do cliente do localStorage.
         * @returns {object|null}
         */
        getSession: function () {
            try {
                const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
                if (!raw) return null;
                const cust = JSON.parse(raw);
                if (cust && cust.id && cust.normalizedPhone) {
                    return cust;
                }
                return null;
            } catch (e) {
                console.warn('[CustomerAuth] Falha ao ler sessão do cliente:', e);
                return null;
            }
        },

        /**
         * Salva a sessão do cliente no localStorage.
         * @param {object} customer
         */
        saveSession: function (customer) {
            if (!customer) return;
            try {
                const sessionData = {
                    id: customer.id || customer.normalizedPhone,
                    customerId: customer.id || customer.normalizedPhone,
                    name: customer.name || 'Cliente',
                    normalizedPhone: customer.normalizedPhone || this.normalizePhone(customer.phone),
                    phoneFormatted: customer.phoneFormatted || this.formatPhone(customer.phone || customer.normalizedPhone),
                    loginTimestamp: Date.now()
                };
                localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(sessionData));
            } catch (e) {
                console.warn('[CustomerAuth] Falha ao salvar sessão do cliente:', e);
            }
        },

        /**
         * Encerra a sessão ativa do cliente.
         */
        clearSession: function () {
            try {
                localStorage.removeItem(CUSTOMER_STORAGE_KEY);
            } catch (e) {
                console.warn('[CustomerAuth] Falha ao limpar sessão:', e);
            }
        },

        /**
         * Identifica se um cliente já existe no Firebase Realtime Database.
         * @param {string} rawPhone
         * @returns {Promise<{exists: boolean, customer?: object, error?: string}>}
         */
        identifyCustomer: function (rawPhone) {
            const self = this;
            return new Promise((resolve) => {
                if (!self.validatePhone(rawPhone)) {
                    resolve({ exists: false, error: 'Digite um número de WhatsApp válido.' });
                    return;
                }

                const cleanPhone = self.normalizePhone(rawPhone);

                if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
                    // Fallback se Firebase estiver indisponível ou offline
                    const current = self.getSession();
                    if (current && current.normalizedPhone === cleanPhone) {
                        resolve({ exists: true, customer: current });
                    } else {
                        resolve({ exists: false });
                    }
                    return;
                }

                // Busca prioritária no nó oficial 'customers/{cleanPhone}'
                const db = firebase.database();
                db.ref('customers/' + cleanPhone).once('value')
                    .then((snapshot) => {
                        const data = snapshot.val();
                        if (data && data.name) {
                            data.id = data.id || cleanPhone;
                            data.normalizedPhone = cleanPhone;
                            data.phoneFormatted = self.formatPhone(data.phone || cleanPhone);
                            resolve({ exists: true, customer: data });
                            return;
                        }

                        // Busca secundária de retrocompatibilidade em 'menu/customers/{cleanPhone}'
                        return db.ref('menu/customers/' + cleanPhone).once('value');
                    })
                    .then((menuSnap) => {
                        if (!menuSnap) return; // Já resolveu antes
                        const menuData = menuSnap.val();
                        if (menuData && menuData.name) {
                            menuData.id = menuData.id || cleanPhone;
                            menuData.normalizedPhone = cleanPhone;
                            menuData.phoneFormatted = self.formatPhone(menuData.phone || cleanPhone);
                            resolve({ exists: true, customer: menuData });
                        } else {
                            resolve({ exists: false });
                        }
                    })
                    .catch((err) => {
                        console.warn('[CustomerAuth] Erro na consulta do cliente:', err);
                        resolve({ exists: false });
                    });
            });
        },

        /**
         * Cadastra um novo cliente com nome e WhatsApp normalizado.
         * @param {string} rawPhone
         * @param {string} name
         * @returns {Promise<{success: boolean, customer?: object, error?: string}>}
         */
        registerCustomer: function (rawPhone, name) {
            const self = this;
            return new Promise((resolve) => {
                if (!self.validatePhone(rawPhone)) {
                    resolve({ success: false, error: 'Digite um número de WhatsApp válido.' });
                    return;
                }

                const cleanName = String(name || '').trim();
                if (!cleanName || cleanName.length < 2) {
                    resolve({ success: false, error: 'Por favor, informe seu nome.' });
                    return;
                }

                const cleanPhone = self.normalizePhone(rawPhone);
                const formattedPhone = self.formatPhone(cleanPhone);
                const now = Date.now();

                const customerData = {
                    id: cleanPhone,
                    customerId: cleanPhone,
                    name: cleanName,
                    normalizedPhone: cleanPhone,
                    phoneFormatted: formattedPhone,
                    phone: formattedPhone,
                    createdAt: now,
                    updatedAt: now,
                    lastOrderAt: null,
                    totalOrders: 0,
                    totalSpent: 0
                };

                // Salva na sessão local imediatamente
                self.saveSession(customerData);

                // Persiste no Firebase caso conectado
                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                    const db = firebase.database();
                    Promise.all([
                        db.ref('customers/' + cleanPhone).set(customerData),
                        db.ref('menu/customers/' + cleanPhone).set(customerData)
                    ]).then(() => {
                        resolve({ success: true, customer: customerData });
                    }).catch((err) => {
                        console.warn('[CustomerAuth] Aviso ao persistir cliente no Firebase:', err);
                        // Mesmo com erro de gravação pontual, o cliente pode prosseguir localmente
                        resolve({ success: true, customer: customerData });
                    });
                } else {
                    resolve({ success: true, customer: customerData });
                }
            });
        },

        /**
         * Atualiza o nome do cliente autenticado.
         * @param {string} cleanPhone
         * @param {string} newName
         * @returns {Promise<boolean>}
         */
        updateCustomerName: function (cleanPhone, newName) {
            const self = this;
            return new Promise((resolve) => {
                const name = String(newName || '').trim();
                if (!name || name.length < 2) {
                    resolve(false);
                    return;
                }

                const session = self.getSession();
                if (session && session.normalizedPhone === cleanPhone) {
                    session.name = name;
                    self.saveSession(session);
                }

                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                    const updates = {
                        [`customers/${cleanPhone}/name`]: name,
                        [`customers/${cleanPhone}/updatedAt`]: Date.now(),
                        [`menu/customers/${cleanPhone}/name`]: name,
                        [`menu/customers/${cleanPhone}/updatedAt`]: Date.now()
                    };
                    firebase.database().ref().update(updates)
                        .then(() => resolve(true))
                        .catch(() => resolve(true));
                } else {
                    resolve(true);
                }
            });
        },

        /**
         * Atualiza métricas do cliente com segurança atômica (transação)
         * ao confirmar um novo pedido.
         * @param {string} cleanPhone
         * @param {number} orderTotal
         * @param {string|number} orderId
         */
        updateCustomerStatsOnOrder: function (cleanPhone, orderTotal, orderId) {
            if (!cleanPhone) return;
            cleanPhone = this.normalizePhone(cleanPhone);
            const total = Number(orderTotal) || 0;
            const now = Date.now();

            if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
                return;
            }

            const db = firebase.database();
            const custRef = db.ref('customers/' + cleanPhone);

            custRef.transaction((current) => {
                if (!current) {
                    const session = this.getSession();
                    return {
                        id: cleanPhone,
                        customerId: cleanPhone,
                        name: (session && session.name) ? session.name : 'Cliente',
                        normalizedPhone: cleanPhone,
                        phoneFormatted: this.formatPhone(cleanPhone),
                        createdAt: now,
                        updatedAt: now,
                        lastOrderAt: now,
                        lastOrderId: orderId || now,
                        totalOrders: 1,
                        totalSpent: Math.round(total * 100) / 100
                    };
                }

                current.lastOrderAt = now;
                current.lastOrderId = orderId || now;
                current.totalOrders = (Number(current.totalOrders) || 0) + 1;
                current.totalSpent = Math.round(((Number(current.totalSpent) || 0) + total) * 100) / 100;
                current.updatedAt = now;
                return current;
            }, (error, committed) => {
                if (error) {
                    console.warn('[CustomerAuth] Falha na transação de métricas do cliente:', error);
                } else if (committed) {
                    // Espelha também em menu/customers para o painel legado
                    db.ref('customers/' + cleanPhone).once('value', (snap) => {
                        const val = snap.val();
                        if (val) {
                            db.ref('menu/customers/' + cleanPhone).set(val).catch(() => {});
                        }
                    });
                }
            });
        },

        /**
         * Consulta segura e privada dos pedidos de UM cliente específico.
         * Respeita a Regra 22: nunca carrega pedidos de terceiros no navegador do cliente.
         * @param {string} cleanPhone
         * @returns {Promise<Array>}
         */
        getCustomerOrders: function (cleanPhone) {
            const self = this;
            return new Promise((resolve) => {
                cleanPhone = self.normalizePhone(cleanPhone);
                if (!cleanPhone) {
                    resolve([]);
                    return;
                }

                if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
                    resolve([]);
                    return;
                }

                const db = firebase.database();
                const ordersRef = db.ref('orders');

                // 1. Tenta consulta filtrada por customerPhone
                ordersRef.orderByChild('customerPhone').equalTo(cleanPhone).once('value')
                    .then((snap) => {
                        const val = snap.val();
                        let list = [];
                        if (val) {
                            list = Object.values(val);
                        }

                        // Se a consulta indexada retornou pedidos, ordena e retorna
                        if (list.length > 0) {
                            list.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
                            resolve(list);
                            return;
                        }

                        // 2. Consulta de fallback por clientPhone formatado
                        const formattedPhone = self.formatPhone(cleanPhone);
                        return ordersRef.orderByChild('clientPhone').equalTo(formattedPhone).once('value');
                    })
                    .then((snap2) => {
                        if (!snap2) return;
                        const val2 = snap2.val();
                        let list2 = [];
                        if (val2) {
                            list2 = Object.values(val2);
                        }

                        // 3. Fallback adicional por clientPhone sem formatação
                        if (list2.length === 0) {
                            return ordersRef.orderByChild('clientPhone').equalTo(cleanPhone).once('value');
                        }

                        list2.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
                        resolve(list2);
                    })
                    .then((snap3) => {
                        if (!snap3) return;
                        const val3 = snap3.val();
                        const list3 = val3 ? Object.values(val3) : [];
                        list3.sort((a, b) => (Number(b.timestamp || b.id) || 0) - (Number(a.timestamp || a.id) || 0));
                        resolve(list3);
                    })
                    .catch((err) => {
                        console.warn('[CustomerAuth] Erro ao consultar pedidos do cliente:', err);
                        resolve([]);
                    });
            });
        }
    };

    global.CustomerAuth = CustomerAuth;

})(typeof window !== 'undefined' ? window : this);
