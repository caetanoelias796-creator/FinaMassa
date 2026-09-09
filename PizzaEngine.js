/**
 * ============================================================================
 * PizzaEngine.js — Núcleo Central e Universal do Motor de Pizzas
 * ============================================================================
 * Motor oficial de precificação, frações e montagem de pizzas da Fina Massa Pizzaria.
 * 
 * RESPONSABILIDADE EXCLUSIVA:
 * - Regras de negócio puras (tamanhos, frações, sabores, bordas, adicionais).
 * - Validações estritas de consistência, limites e disponibilidade.
 * - Cálculos monetários seguros (prevenção de imprecisões de ponto flutuante).
 * - Estratégias flexíveis de meio a meio ('HIGHEST' e 'AVERAGE').
 * - Construção e normalização de objetos de item de pizza compatíveis com o
 *   Carrinho, Checkout, Firebase e Painel Administrativo.
 * 
 * RESTRIÇÃO ARQUITETURAL:
 * - Código puramente agnóstico: SEM DOM, SEM HTML, SEM CSS, SEM dependências externas.
 * ============================================================================
 */

(function (global) {
    'use strict';

    /**
     * Utilitários Monetários e Numéricos
     */
    const CurrencyUtils = {
        /**
         * Arredonda com segurança para 2 casas decimais, evitando 0.1 + 0.2 = 0.30000000000000004
         */
        roundMoney: function (value) {
            const num = Number(value);
            if (isNaN(num)) return 0.00;
            return Math.round((num + Number.EPSILON) * 100) / 100;
        },

        /**
         * Formata número para o padrão monetário brasileiro (R$ 00,00)
         */
        formatBRL: function (value) {
            const rounded = this.roundMoney(value);
            return 'R$ ' + rounded.toFixed(2).replace('.', ',');
        }
    };

    const PizzaEngine = {
        version: '1.0.0',

        // Regras de precificação para frações / meio a meio
        PRICING_RULES: {
            HIGHEST: 'HIGHEST', // Cobra pelo sabor de maior valor
            AVERAGE: 'AVERAGE'   // Cobra pela média aritmética dos sabores
        },

        /**
         * 1. Validação de Tamanho
         * @param {string|object} sizeInput - Identificador do tamanho ou objeto de tamanho
         * @param {object|array} catalogSizes - Catálogo de tamanhos cadastrados
         * @returns {object} { valid: boolean, size?: object, error?: string }
         */
        validateSize: function (sizeInput, catalogSizes) {
            if (!sizeInput) {
                return { valid: false, error: 'Tamanho da pizza não foi informado.' };
            }

            const sizeId = typeof sizeInput === 'string' ? sizeInput.trim() : (sizeInput.id || '').trim();
            if (!sizeId) {
                return { valid: false, error: 'Identificador do tamanho é inválido.' };
            }

            let found = null;
            if (Array.isArray(catalogSizes)) {
                found = catalogSizes.find(s => s && s.id === sizeId);
            } else if (catalogSizes && typeof catalogSizes === 'object') {
                found = catalogSizes[sizeId] || Object.values(catalogSizes).find(s => s && s.id === sizeId);
            }

            if (!found) {
                return { valid: false, error: `Tamanho "${sizeId}" não foi encontrado no cardápio.` };
            }

            if (found.active === false || found.available === false) {
                return { valid: false, error: `O tamanho "${found.name || sizeId}" está indisponível no momento.` };
            }

            const maxFlavors = parseInt(found.maxFlavors, 10);
            const slices = parseInt(found.slices, 10);

            const normalizedSize = {
                id: found.id || sizeId,
                name: found.name || sizeId,
                slices: !isNaN(slices) && slices > 0 ? slices : 8,
                maxFlavors: !isNaN(maxFlavors) && maxFlavors > 0 ? maxFlavors : 1,
                description: found.description || '',
                order: found.order || 0,
                active: true
            };

            return { valid: true, size: normalizedSize };
        },

        /**
         * 2. Validação de Sabores
         * @param {array} selectedFlavorsInput - Array de IDs ou objetos de sabores
         * @param {object|array} catalogFlavors - Catálogo de sabores disponíveis
         * @param {object} sizeRules - Objeto normalizado do tamanho (com maxFlavors)
         * @returns {object} { valid: boolean, flavors?: array, flavorCount?: number, error?: string }
         */
        validateFlavors: function (selectedFlavorsInput, catalogFlavors, sizeRules) {
            if (!Array.isArray(selectedFlavorsInput) || selectedFlavorsInput.length === 0) {
                return { valid: false, error: 'Selecione pelo menos 1 sabor para a pizza.' };
            }

            const maxAllowed = (sizeRules && sizeRules.maxFlavors) ? sizeRules.maxFlavors : 1;
            if (selectedFlavorsInput.length > maxAllowed) {
                return {
                    valid: false,
                    error: `O tamanho "${sizeRules.name || 'selecionado'}" permite no máximo ${maxAllowed} sabor(es). Você escolheu ${selectedFlavorsInput.length}.`
                };
            }

            // Normaliza o catálogo em mapa para busca rápida O(1)
            let flavorMap = {};
            if (Array.isArray(catalogFlavors)) {
                catalogFlavors.forEach(f => {
                    if (f && f.id) flavorMap[f.id] = f;
                });
            } else if (catalogFlavors && typeof catalogFlavors === 'object') {
                flavorMap = catalogFlavors;
            }

            const resolvedFlavors = [];

            for (let i = 0; i < selectedFlavorsInput.length; i++) {
                const item = selectedFlavorsInput[i];
                const fid = typeof item === 'string' ? item.trim() : (item && item.id ? item.id.trim() : '');

                if (!fid) {
                    return { valid: false, error: `Sabor na posição #${i + 1} possui identificador inválido.` };
                }

                const catalogItem = flavorMap[fid];
                if (!catalogItem) {
                    return { valid: false, error: `Sabor "${fid}" não foi encontrado no cardápio.` };
                }

                if (catalogItem.available === false || catalogItem.active === false) {
                    return { valid: false, error: `O sabor "${catalogItem.name || fid}" está indisponível no momento.` };
                }

                // Preserva o preço específico do sabor, caso já venha resolvido no objeto ou no catálogo
                let priceVal = 0;
                if (typeof item === 'object' && typeof item.price === 'number') {
                    priceVal = item.price;
                } else if (typeof catalogItem.price === 'number') {
                    priceVal = catalogItem.price;
                }

                resolvedFlavors.push({
                    id: catalogItem.id || fid,
                    name: catalogItem.name || fid,
                    description: catalogItem.description || '',
                    category: catalogItem.category || 'salgadas',
                    categoryType: catalogItem.categoryType || 'tradicional',
                    image: catalogItem.image || '',
                    badge: catalogItem.badge || '',
                    price: CurrencyUtils.roundMoney(priceVal)
                });
            }

            return {
                valid: true,
                flavors: resolvedFlavors,
                flavorCount: resolvedFlavors.length
            };
        },

        /**
         * 3. Regra de Precificação dos Sabores (1 Sabor ou Meio a Meio)
         * @param {array} flavors - Array de sabores resolvidos com preço
         * @param {string} pricingRule - 'HIGHEST' ou 'AVERAGE'
         * @returns {object} { flavorsPrice: number, ruleUsed: string, individualPrices: array }
         */
        calculateFlavorPrice: function (flavors, pricingRule) {
            if (!Array.isArray(flavors) || flavors.length === 0) {
                return { flavorsPrice: 0.00, ruleUsed: this.PRICING_RULES.HIGHEST, individualPrices: [] };
            }

            const prices = flavors.map(f => CurrencyUtils.roundMoney(f.price || 0));
            const rule = (pricingRule || this.PRICING_RULES.HIGHEST).toUpperCase();

            let finalFlavorPrice = 0.00;

            if (flavors.length === 1) {
                finalFlavorPrice = prices[0];
            } else if (rule === this.PRICING_RULES.AVERAGE) {
                const sum = prices.reduce((acc, p) => acc + p, 0);
                finalFlavorPrice = CurrencyUtils.roundMoney(sum / prices.length);
            } else {
                // Padrão HIGHEST (Maior Preço)
                finalFlavorPrice = Math.max(...prices);
            }

            return {
                flavorsPrice: CurrencyUtils.roundMoney(finalFlavorPrice),
                ruleUsed: rule === this.PRICING_RULES.AVERAGE ? this.PRICING_RULES.AVERAGE : this.PRICING_RULES.HIGHEST,
                individualPrices: prices
            };
        },

        /**
         * 4. Validação de Borda Recheada
         * @param {string|object} borderInput - Identificador da borda ou objeto
         * @param {object|array} catalogBorders - Catálogo de bordas disponíveis
         * @returns {object} { valid: boolean, border?: object, error?: string }
         */
        validateBorder: function (borderInput, catalogBorders) {
            // Aceita ausência de borda ou borda tradicional
            if (!borderInput || borderInput === 'sem-borda' || (typeof borderInput === 'object' && borderInput.id === 'sem-borda')) {
                return {
                    valid: true,
                    border: {
                        id: 'sem-borda',
                        name: 'Massa Tradicional (Sem Borda)',
                        price: 0.00
                    }
                };
            }

            const borderId = typeof borderInput === 'string' ? borderInput.trim() : (borderInput.id || '').trim();
            if (!borderId) {
                return {
                    valid: true,
                    border: { id: 'sem-borda', name: 'Massa Tradicional (Sem Borda)', price: 0.00 }
                };
            }

            let found = null;
            if (Array.isArray(catalogBorders)) {
                found = catalogBorders.find(b => b && b.id === borderId);
            } else if (catalogBorders && typeof catalogBorders === 'object') {
                found = catalogBorders[borderId] || Object.values(catalogBorders).find(b => b && b.id === borderId);
            }

            if (!found) {
                return { valid: false, error: `Borda "${borderId}" não foi encontrada no cardápio.` };
            }

            if (found.available === false || found.active === false) {
                return { valid: false, error: `A borda "${found.name || borderId}" está indisponível no momento.` };
            }

            const borderPrice = CurrencyUtils.roundMoney(found.price || 0);

            return {
                valid: true,
                border: {
                    id: found.id || borderId,
                    name: found.name || borderId,
                    price: borderPrice
                }
            };
        },

        /**
         * 5. Validação de Adicionais / Extras
         * @param {array} extrasInput - Array de adicionais selecionados
         * @param {object|array} catalogExtras - Catálogo de adicionais do restaurante
         * @returns {object} { valid: boolean, extras: array, extrasPrice: number, error?: string }
         */
        validateExtras: function (extrasInput, catalogExtras) {
            if (!extrasInput || !Array.isArray(extrasInput) || extrasInput.length === 0) {
                return { valid: true, extras: [], extrasPrice: 0.00 };
            }

            let extrasMap = {};
            if (Array.isArray(catalogExtras)) {
                catalogExtras.forEach(e => {
                    if (e && e.id) extrasMap[e.id] = e;
                });
            } else if (catalogExtras && typeof catalogExtras === 'object') {
                extrasMap = catalogExtras;
            }

            const normalizedExtras = [];
            let totalExtrasPrice = 0.00;

            for (let i = 0; i < extrasInput.length; i++) {
                const item = extrasInput[i];
                const eid = typeof item === 'string' ? item.trim() : (item && (item.id || item.key) ? (item.id || item.key).trim() : '');

                if (!eid) continue;

                // Se houver catálogo fornecido, valida disponibilidade e preço
                let extraData = extrasMap[eid];
                if (!extraData && typeof item === 'object') {
                    extraData = item;
                }

                if (!extraData) {
                    return { valid: false, error: `Adicional "${eid}" não foi encontrado no cardápio.` };
                }

                if (extraData.available === false || extraData.active === false) {
                    return { valid: false, error: `O adicional "${extraData.name || eid}" está indisponível.` };
                }

                const qty = parseInt(item.quantity || extraData.quantity || 1, 10);
                const safeQty = !isNaN(qty) && qty > 0 ? qty : 1;
                const price = CurrencyUtils.roundMoney(extraData.price || 0);
                const subtotal = CurrencyUtils.roundMoney(price * safeQty);

                totalExtrasPrice = CurrencyUtils.roundMoney(totalExtrasPrice + subtotal);

                normalizedExtras.push({
                    id: extraData.id || eid,
                    name: extraData.name || eid,
                    price: price,
                    quantity: safeQty,
                    totalPrice: subtotal
                });
            }

            return {
                valid: true,
                extras: normalizedExtras,
                extrasPrice: totalExtrasPrice
            };
        },

        /**
         * 6. Cálculo do Preço Total com Precisão Segura
         * @param {object} params - { flavorsPrice, borderPrice, extrasPrice, quantity }
         * @returns {object} { valid: boolean, pricing?: object, error?: string }
         */
        calculateTotal: function (params) {
            const flavorsPrice = CurrencyUtils.roundMoney(params.flavorsPrice || 0);
            const borderPrice = CurrencyUtils.roundMoney(params.borderPrice || 0);
            const extrasPrice = CurrencyUtils.roundMoney(params.extrasPrice || 0);

            if (flavorsPrice < 0 || borderPrice < 0 || extrasPrice < 0) {
                return { valid: false, error: 'Valores monetários não podem ser negativos.' };
            }

            const rawQty = parseInt(params.quantity, 10);
            const quantity = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;

            if (quantity <= 0) {
                return { valid: false, error: 'A quantidade de pizzas deve ser de no mínimo 1.' };
            }

            const unitPrice = CurrencyUtils.roundMoney(flavorsPrice + borderPrice + extrasPrice);
            const totalPrice = CurrencyUtils.roundMoney(unitPrice * quantity);

            return {
                valid: true,
                pricing: {
                    flavorsPrice: flavorsPrice,
                    borderPrice: borderPrice,
                    extrasPrice: extrasPrice,
                    unitPrice: unitPrice,
                    quantity: quantity,
                    totalPrice: totalPrice,
                    formattedUnitPrice: CurrencyUtils.formatBRL(unitPrice),
                    formattedTotalPrice: CurrencyUtils.formatBRL(totalPrice)
                }
            };
        },

        /**
         * 7. Construtor Principal do Item de Pizza
         * Recebe uma configuração selecionada e o catálogo, e devolve o item normalizado.
         * 
         * @param {object} config - { size, flavors, border, extras, notes, quantity, cartItemId, pricingRule }
         * @param {object} catalogs - { sizes, flavors, borders, extras, priceMatrix }
         * @returns {object} { success: boolean, item?: object, error?: string }
         */
        buildPizzaItem: function (config, catalogs) {
            if (!config || typeof config !== 'object') {
                return { success: false, error: 'ConfiguraÃ§Ã£o da pizza nÃ£o foi informada.' };
            }

            const activeCatalogs = catalogs || {
                sizes: config.catalogSizes || config.sizes,
                flavors: config.catalogFlavors || config.flavorsCatalog || config.flavors,
                borders: config.catalogBorders || config.borders,
                extras: config.catalogExtras || config.extras,
                priceMatrix: config.priceMatrix
            };

            const sizeInput = config.size || config.sizeId;
            const flavorsInput = config.flavors || config.flavorIds;
            const borderInput = config.border || config.borderId;
            const extrasInput = config.extras || config.extraIds || [];
            const pricingRule = config.pricingRule || this.PRICING_RULES.HIGHEST;

            // 1. Valida tamanho
            const sizeRes = this.validateSize(sizeInput, activeCatalogs.sizes);
            if (!sizeRes.valid) return { success: false, error: sizeRes.error };
            const size = sizeRes.size;

            // 2. Resolve preÃ§os dos sabores a partir da matriz de preÃ§os, se fornecida
            let flavorsToValidate = flavorsInput;
            if (Array.isArray(flavorsToValidate) && activeCatalogs.priceMatrix) {
                const matrixForSize = activeCatalogs.priceMatrix[size.id] || {};
                flavorsToValidate = flavorsToValidate.map(f => {
                    if (typeof f === 'string') {
                        const catalogItem = (activeCatalogs.flavors && activeCatalogs.flavors[f]) || (Array.isArray(activeCatalogs.flavors) && activeCatalogs.flavors.find(x => x.id === f)) || {};
                        const catType = catalogItem.categoryType || 'tradicional';
                        const resolvedPrice = matrixForSize[catType] || catalogItem.price || 0;
                        return { id: f, price: resolvedPrice };
                    } else if (typeof f === 'object' && f.id) {
                        const catType = f.categoryType || 'tradicional';
                        const resolvedPrice = matrixForSize[catType] || f.price || 0;
                        return Object.assign({}, f, { price: resolvedPrice });
                    }
                    return f;
                });
            }

            // 3. Valida sabores
            const flavorsRes = this.validateFlavors(flavorsToValidate, activeCatalogs.flavors, size);
            if (!flavorsRes.valid) return { success: false, error: flavorsRes.error };
            const flavors = flavorsRes.flavors;

            // 4. Calcula preÃ§o dos sabores (HIGHEST ou AVERAGE)
            const flavorsPriceRes = this.calculateFlavorPrice(flavors, pricingRule);

            // 5. Valida borda
            const borderRes = this.validateBorder(borderInput, activeCatalogs.borders);
            if (!borderRes.valid) return { success: false, error: borderRes.error };
            const border = borderRes.border;

            // 6. Valida adicionais
            const extrasRes = this.validateExtras(extrasInput, activeCatalogs.extras);
            if (!extrasRes.valid) return { success: false, error: extrasRes.error };
            const extras = extrasRes.extras;

            // 7. Calcula totais monetÃ¡rios
            const totalRes = this.calculateTotal({
                flavorsPrice: flavorsPriceRes.flavorsPrice,
                borderPrice: border.price,
                extrasPrice: extrasRes.extrasPrice,
                quantity: config.quantity || 1
            });
            if (!totalRes.valid) return { success: false, error: totalRes.error };
            const pricing = totalRes.pricing;

            // 8. FormataÃ§Ã£o do nome descritivo do item
            let displayName = `Pizza ${size.name}`;
            if (flavors.length === 1) {
                displayName += ` (${flavors[0].name})`;
            } else if (flavors.length === 2) {
                displayName += ` (Â½ ${flavors[0].name} / Â½ ${flavors[1].name})`;
            } else {
                displayName += ` (${flavors.map(f => f.name).join(' / ')})`;
            }

            // FormataÃ§Ã£o do nome descritivo da borda
            let displayBorderName = border.name;
            if (border.price > 0 && !displayBorderName.includes('+')) {
                displayBorderName += ` (+ ${CurrencyUtils.formatBRL(border.price)})`;
            }

            const cartItemId = config.cartItemId || ('pizza_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

            // Retorna objeto 100% compatÃ­vel com Carrinho atual e Painel Administrativo
            const pizzaItem = {
                type: 'pizza',
                cartItemId: cartItemId,
                id: `pizza_${size.id}`,
                name: displayName,
                category: 'pizzas',
                size: size.id,
                sizeName: size.name,
                slices: size.slices,
                maxFlavors: size.maxFlavors,
                flavorCount: flavors.length,
                flavorIds: flavors.map(f => f.id),
                flavorNames: flavors.map(f => f.name),
                flavors: flavors,
                border: {
                    id: border.id,
                    name: border.name,
                    price: border.price
                },
                borderId: border.id,
                borderName: displayBorderName,
                borderPrice: border.price,
                extras: extras,
                adicionais: extras.map(e => ({ name: e.name, price: e.price })), // Compatibilidade legada
                notes: (config.notes || '').trim(),
                quantity: pricing.quantity,
                basePrice: pricing.flavorsPrice,
                singlePrice: pricing.unitPrice,
                totalPrice: pricing.totalPrice,
                pricingRule: flavorsPriceRes.ruleUsed,
                pricingRuleUsed: flavorsPriceRes.ruleUsed,
                pricing: pricing
            };

            return {
                success: true,
                item: pizzaItem
            };
        },

        normalizePizzaConfiguration: function (item) {
            if (!item || typeof item !== 'object') return null;

            const singlePrice = CurrencyUtils.roundMoney(item.singlePrice || item.price || 0);
            const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
            const totalPrice = CurrencyUtils.roundMoney(item.totalPrice || (singlePrice * qty));

            return {
                type: 'pizza',
                cartItemId: item.cartItemId || ('pizza_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
                id: item.id || 'pizza_custom',
                name: item.name || 'Pizza Personalizada',
                category: 'pizzas',
                size: item.size || 'grande',
                sizeName: item.sizeName || 'Grande',
                slices: item.slices || 8,
                flavorCount: Array.isArray(item.flavorNames) ? item.flavorNames.length : 1,
                flavorIds: Array.isArray(item.flavorIds) ? item.flavorIds : [],
                flavorNames: Array.isArray(item.flavorNames) ? item.flavorNames : [item.name || 'Sabor'],
                border: item.border || 'sem-borda',
                borderName: item.borderName || 'Tradicional',
                borderPrice: CurrencyUtils.roundMoney(item.borderPrice || 0),
                extras: Array.isArray(item.extras) ? item.extras : [],
                adicionais: Array.isArray(item.adicionais) ? item.adicionais : [],
                notes: (item.notes || '').trim(),
                quantity: qty,
                singlePrice: singlePrice,
                basePrice: CurrencyUtils.roundMoney(item.basePrice || singlePrice),
                totalPrice: totalPrice
            };
        },

        /**
         * 8. Validação de Grupos de Opções Genéricos
         * @param {object} product - Produto com optionGroups
         * @param {object} userSelections - Mapa de seleções por grupo { [groupId]: [selectedOptions] }
         * @returns {object} { valid: boolean, error?: string, groupId?: string }
         */
        validateOptionGroups: function (product, userSelections) {
            if (!product) return { valid: false, error: 'Produto não informado.' };
            const groups = product.optionGroups || [];
            const selections = userSelections || {};

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const selected = selections[group.id] || [];
                const count = Array.isArray(selected) ? selected.length : (selected ? 1 : 0);

                const min = typeof group.minSelections === 'number' ? group.minSelections : (group.min !== undefined ? group.min : (group.required ? 1 : 0));
                const max = typeof group.maxSelections === 'number' ? group.maxSelections : (group.max !== undefined ? group.max : 999);

                if (group.required && count === 0) {
                    const titleLower = (group.title || group.name || '').toLowerCase();
                    if (titleLower.includes('preferência') || titleLower.includes('preferencia') || titleLower.includes('borda') || group.type === 'crust') {
                        return { valid: false, error: 'Escolha a sua preferência.', groupId: group.id };
                    }
                    if (titleLower.includes('segundo sabor') || group.id === 'flavor_2' || group.id === 'sabor_2') {
                        return { valid: false, error: 'Escolha o segundo sabor.', groupId: group.id };
                    }
                    if (titleLower.includes('terceiro sabor') || group.id === 'flavor_3' || group.id === 'sabor_3') {
                        return { valid: false, error: 'Escolha o terceiro sabor.', groupId: group.id };
                    }
                    if (titleLower.includes('um sabor') || titleLower.includes('primeiro sabor') || group.id === 'flavor_1' || group.id === 'sabor_1' || group.type === 'flavor') {
                        return { valid: false, error: 'Escolha um sabor.', groupId: group.id };
                    }
                    return { valid: false, error: `Selecione: ${group.title || group.name}.`, groupId: group.id };
                }

                if (count < min) {
                    const titleLower = (group.title || group.name || '').toLowerCase();
                    if (titleLower.includes('preferência') || titleLower.includes('preferencia') || titleLower.includes('borda') || group.type === 'crust') {
                        return { valid: false, error: 'Escolha a sua preferência.', groupId: group.id };
                    }
                    if (titleLower.includes('segundo sabor') || group.id === 'flavor_2' || group.id === 'sabor_2') {
                        return { valid: false, error: 'Escolha o segundo sabor.', groupId: group.id };
                    }
                    if (titleLower.includes('terceiro sabor') || group.id === 'flavor_3' || group.id === 'sabor_3') {
                        return { valid: false, error: 'Escolha o terceiro sabor.', groupId: group.id };
                    }
                    if (titleLower.includes('um sabor') || titleLower.includes('primeiro sabor') || group.id === 'flavor_1' || group.id === 'sabor_1' || group.type === 'flavor') {
                        return { valid: false, error: 'Escolha um sabor.', groupId: group.id };
                    }
                    return { valid: false, error: `Selecione no mínimo ${min} opção(ões) em: ${group.title || group.name}.`, groupId: group.id };
                }

                if (count > max) {
                    return { valid: false, error: `Você pode escolher no máximo ${max} opção(ões) em: ${group.title || group.name}.`, groupId: group.id };
                }
            }

            return { valid: true };
        },

        /**
         * 9. Construtor de Itens Configuráveis com Grupos de Opções
         * Suporta 'fixed', 'base_plus_options' e 'options_sum'
         * @param {object} product - Definição do produto
         * @param {object} userSelections - { [groupId]: [selectedOptions] } ou { [groupId]: optionObject }
         * @param {string} comment - Comentário do cliente (até 140 caracteres)
         * @param {number} quantity - Quantidade
         * @returns {object} { success: boolean, item?: object, error?: string }
         */
        buildConfiguredItem: function (product, userSelections, comment, quantity) {
            if (!product || typeof product !== 'object') {
                return { success: false, error: 'Produto não informado.' };
            }

            const selectionsMap = {};
            if (userSelections && typeof userSelections === 'object') {
                Object.keys(userSelections).forEach(gId => {
                    const sel = userSelections[gId];
                    if (Array.isArray(sel)) {
                        selectionsMap[gId] = sel.filter(Boolean);
                    } else if (sel) {
                        selectionsMap[gId] = [sel];
                    } else {
                        selectionsMap[gId] = [];
                    }
                });
            }

            const valRes = this.validateOptionGroups(product, selectionsMap);
            if (!valRes.valid) {
                return { success: false, error: valRes.error, groupId: valRes.groupId };
            }

            const rawQty = parseInt(quantity, 10);
            const qty = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;
            const pricingMode = product.pricingMode || (product.optionGroups && product.optionGroups.length > 0 ? 'base_plus_options' : 'fixed');
            const basePrice = CurrencyUtils.roundMoney(product.basePrice !== undefined ? product.basePrice : (product.price || 0));

            const allSelectedOptions = [];
            const flavors = [];
            let crust = null;

            const groups = product.optionGroups || [];
            let optionsSum = 0.00;

            groups.forEach(group => {
                const groupSelected = selectionsMap[group.id] || [];
                groupSelected.forEach(opt => {
                    const optPrice = CurrencyUtils.roundMoney(opt.price || 0);
                    optionsSum = CurrencyUtils.roundMoney(optionsSum + optPrice);

                    const optRecord = {
                        groupId: group.id,
                        groupTitle: group.title || group.name || '',
                        id: opt.id,
                        name: opt.name,
                        price: optPrice,
                        fraction: opt.fraction || group.fraction || null,
                        ingredients: opt.ingredients || opt.description || ''
                    };
                    allSelectedOptions.push(optRecord);

                    const titleLower = (group.title || group.name || '').toLowerCase();
                    const isCrust = group.type === 'crust' || titleLower.includes('preferência') || titleLower.includes('preferencia') || titleLower.includes('borda');
                    if (isCrust) {
                        crust = {
                            id: opt.id,
                            name: opt.name,
                            price: optPrice
                        };
                    }

                    const isFlavor = group.type === 'flavor' || titleLower.includes('sabor');
                    if (isFlavor) {
                        flavors.push({
                            id: opt.id,
                            name: opt.name,
                            fraction: opt.fraction || group.fraction || '1/1',
                            price: optPrice,
                            ingredients: opt.ingredients || opt.description || ''
                        });
                    }
                });
            });

            if (!crust && product.category && product.category.includes('pizza')) {
                crust = {
                    id: 'borda_tradicional',
                    name: 'Massa Tradicional + Borda Tradicional',
                    price: 0.00
                };
            }

            let unitPrice = 0.00;
            if (pricingMode === 'fixed') {
                unitPrice = basePrice;
            } else if (pricingMode === 'options_sum') {
                unitPrice = CurrencyUtils.roundMoney(optionsSum);
            } else if (pricingMode === 'base_plus_options') {
                unitPrice = CurrencyUtils.roundMoney(basePrice + optionsSum);
            } else {
                unitPrice = CurrencyUtils.roundMoney(basePrice + optionsSum);
            }

            const totalPrice = CurrencyUtils.roundMoney(unitPrice * qty);
            const cleanComment = (comment || '').toString().trim().slice(0, 140);

            const flavorDisplayNames = flavors.map(f => {
                if (f.fraction && f.fraction !== '1/1' && f.fraction !== '1') {
                    return `${f.fraction} ${f.name}`;
                }
                return f.name;
            });

            const cartItemId = 'cfg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const isPizza = product.type === 'pizza' || (product.category && product.category.includes('pizza')) || (product.slices && product.slices > 0);

            const item = {
                id: cartItemId,
                cartItemId: cartItemId,
                productId: product.id,
                name: product.name,
                category: product.category,
                categoryName: product.categoryName || product.category,
                type: isPizza ? 'pizza' : 'product',
                quantity: qty,
                unitPrice: unitPrice,
                singlePrice: unitPrice,
                basePrice: basePrice,
                totalPrice: totalPrice,
                pricingMode: pricingMode,
                selections: allSelectedOptions,
                comment: cleanComment,
                notes: cleanComment,
                pizza: isPizza ? {
                    slices: product.slices || (product.name.includes('12') ? 12 : 8),
                    totalSlices: product.slices || (product.name.includes('12') ? 12 : 8),
                    flavors: flavors,
                    crust: crust
                } : null,
                slices: product.slices || 8,
                sizeName: product.name,
                flavorNames: flavorDisplayNames,
                flavorIds: flavors.map(f => f.id),
                border: crust,
                borderName: crust ? crust.name : '',
                borderPrice: crust ? crust.price : 0.00,
                adicionais: allSelectedOptions.filter(o => o.groupId !== 'crust' && !o.groupTitle.toLowerCase().includes('preferência') && !o.groupTitle.toLowerCase().includes('sabor')).map(a => ({ name: a.name, price: a.price }))
            };

            return {
                success: true,
                item: item
            };
        },

        CurrencyUtils: CurrencyUtils
    };

    // Exportação Universal (Browser Global ou CommonJS se aplicável)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PizzaEngine;
    }
    if (typeof window !== 'undefined') {
        window.PizzaEngine = PizzaEngine;
    } else if (typeof global !== 'undefined') {
        global.PizzaEngine = PizzaEngine;
    }

})(typeof window !== 'undefined' ? window : this);
