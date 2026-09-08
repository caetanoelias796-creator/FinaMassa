
/* ==========================================================================
   Date & Period Filter Helpers & Global State
   ========================================================================== */
let currentPeriodFilter = 'todos'; // 'todos', 'hoje', 'ontem', 'semana', 'mes', 'custom'
let customFilterStartDate = null;
let customFilterEndDate = null;

function getStatusPriority(status) {
    const s = String(status || '').toLowerCase().trim();
    if (s.includes('pendente') || s.includes('pending')) return 1;
    if (s.includes('prepar') || s.includes('cozinha')) return 2;
    if (s.includes('entrega') || s.includes('pronto') || s.includes('delivery')) return 3;
    if (s.includes('entregue') || s.includes('concl') || s.includes('finaliz')) return 4;
    if (s.includes('cancel') || s.includes('recus')) return 5;
    return 6;
}

function getOrderTimestamp(order) {
    if (!order) return 0;
    if (order.timestamp && !isNaN(Number(order.timestamp))) {
        return Number(order.timestamp);
    }
    if (order.id && !isNaN(Number(order.id)) && Number(order.id) > 1500000000000) {
        return Number(order.id);
    }
    if (order.date) {
        const parts = String(order.date).split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
            } else {
                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
            }
        }
    }
    return 0;
}

function matchesOrderDatePeriod(order) {
    if (currentPeriodFilter === 'todos') return true;
    const ts = getOrderTimestamp(order);
    if (!ts) return true; // Se nÃ£o tiver timestamp identificÃ¡vel, inclui para nÃ£o ocultar

    const orderDate = new Date(ts);
    const now = new Date();

    if (currentPeriodFilter === 'hoje') {
        return orderDate.getFullYear() === now.getFullYear() &&
               orderDate.getMonth() === now.getMonth() &&
               orderDate.getDate() === now.getDate();
    }

    if (currentPeriodFilter === 'ontem') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return orderDate.getFullYear() === yesterday.getFullYear() &&
               orderDate.getMonth() === yesterday.getMonth() &&
               orderDate.getDate() === yesterday.getDate();
    }

    if (currentPeriodFilter === 'semana') {
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return orderDate >= sevenDaysAgo;
    }

    if (currentPeriodFilter === 'mes') {
        return orderDate.getFullYear() === now.getFullYear() &&
               orderDate.getMonth() === now.getMonth();
    }

    if (currentPeriodFilter === 'custom') {
        if (customFilterStartDate && orderDate < customFilterStartDate) return false;
        if (customFilterEndDate && orderDate > customFilterEndDate) return false;
        return true;
    }

    return true;
}

function matchesOrderStatusFilter(order) {
    if (!filterStatus || filterStatus === 'Todos') return true;
    if (filterStatus === 'Mesas') {
        const isTable = isTableOrderEntity(order);
        const isActive = isTableComandaOpen(order);
        return isTable && isActive;
    }
    return order.status === filterStatus;
}

function setPeriodFilter(period) {
    currentPeriodFilter = period;

    const periodButtons = {
        'todos': document.getElementById('btnPeriodTodos'),
        'hoje': document.getElementById('btnPeriodHoje'),
        'ontem': document.getElementById('btnPeriodOntem'),
        'semana': document.getElementById('btnPeriodSemana'),
        'mes': document.getElementById('btnPeriodMes'),
        'custom': document.getElementById('btnPeriodCustom')
    };

    Object.keys(periodButtons).forEach(k => {
        const btn = periodButtons[k];
        if (btn) {
            if (k === period) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });

    const customRow = document.getElementById('customDateRangeRow');
    if (period !== 'custom' && customRow) {
        customRow.classList.add('display-none');
        const badge = document.getElementById('activeFilterBadge');
        if (badge) badge.innerText = '';
    }

    updateIndicators();
    renderOrdersList();
}

function toggleCustomDateFilter() {
    const customRow = document.getElementById('customDateRangeRow');
    if (!customRow) return;

    if (customRow.classList.contains('display-none')) {
        customRow.classList.remove('display-none');
        const btnCustom = document.getElementById('btnPeriodCustom');
        if (btnCustom) btnCustom.classList.add('active');
    } else {
        customRow.classList.add('display-none');
    }
}

function applyCustomDateFilter() {
    const startInput = document.getElementById('customStartDate');
    const endInput = document.getElementById('customEndDate');
    const badge = document.getElementById('activeFilterBadge');

    if (!startInput || !endInput) return;

    const sVal = startInput.value;
    const eVal = endInput.value;

    if (!sVal && !eVal) {
        showToast('Selecione ao menos uma data inicial ou final.', 'warning');
        return;
    }

    if (sVal) {
        const [y, m, d] = sVal.split('-').map(Number);
        customFilterStartDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
        customFilterStartDate = null;
    }

    if (eVal) {
        const [y, m, d] = eVal.split('-').map(Number);
        customFilterEndDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
        customFilterEndDate = null;
    }

    currentPeriodFilter = 'custom';

    document.querySelectorAll('.btn-period-filter').forEach(btn => btn.classList.remove('active'));
    const btnCustom = document.getElementById('btnPeriodCustom');
    if (btnCustom) btnCustom.classList.add('active');

    if (badge) {
        const sTxt = sVal ? sVal.split('-').reverse().join('/') : 'InÃ­cio';
        const eTxt = eVal ? eVal.split('-').reverse().join('/') : 'Hoje';
        badge.innerText = `Filtro ativo: ${sTxt} atÃ© ${eTxt}`;
    }

    updateIndicators();
    renderOrdersList();
    showToast('Filtro de perÃ­odo personalizado aplicado!', 'success');
}

function clearCustomDateFilter() {
    const startInput = document.getElementById('customStartDate');
    const endInput = document.getElementById('customEndDate');
    const badge = document.getElementById('activeFilterBadge');

    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    if (badge) badge.innerText = '';

    customFilterStartDate = null;
    customFilterEndDate = null;

    setPeriodFilter('todos');
}

function onOrderStatusFilterChange(status) {
    setFilter(status);
}

/* ==========================================================================
   Firebase Initialization (Centralizada e Segura)
   ========================================================================== */
if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && firebase.apps && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

/* ==========================================================================
   State Variables
   ========================================================================== */
let orders = [];
let filterStatus = 'Todos';
let soundEnabled = true;
let lastOrdersCount = 0;
let knownOrderIds = new Set();
let firebaseTablesState = {}; // Realtime /tables node from Firebase (tables 01 to 20)

/* ==========================================================================
   Table & Comanda Canonical Identification Helpers
   ========================================================================== */
function getCanonicalTableNumber(orderOrVal) {
    if (!orderOrVal && orderOrVal !== 0) return '';
    
    let rawVal = orderOrVal;
    if (typeof orderOrVal === 'object' && orderOrVal !== null) {
        // Extrai de campos de um pedido na ordem de prioridade
        rawVal = orderOrVal.mesa || orderOrVal.table || orderOrVal.tableSessionId || orderOrVal.comandaId || '';
    }
    
    const str = String(rawVal).trim();
    if (!str) return '';
    
    // 1. Padrão com prefixo de sessão: "mesa-01-xyz", "mesa_01_123", "mesa-01", "mesa_1"
    const sessionMatch = str.match(/^mesa[-_](\d+)(?:[-_].*)?$/i);
    if (sessionMatch && sessionMatch[1]) {
        return sessionMatch[1].padStart(2, '0');
    }
    
    // 2. Padrão "Mesa 01", "Mesa 1", "Mesa01", "mesa 1"
    const numMatch = str.match(/^mesa\s*(\d+)$/i);
    if (numMatch && numMatch[1]) {
        return numMatch[1].padStart(2, '0');
    }
    
    // 3. Qualquer formato com a palavra 'mesa' e dígitos (ex: "Mesa 01 (Garçom)", "mesa: 1", etc.)
    const genericMesaMatch = str.match(/mesa\D*(\d+)/i);
    if (genericMesaMatch && genericMesaMatch[1]) {
        return genericMesaMatch[1].padStart(2, '0');
    }
    
    // 4. Apenas dígitos (ex: "01", "1", 1, 01)
    const onlyDigitsMatch = str.match(/^(\d+)$/);
    if (onlyDigitsMatch && onlyDigitsMatch[1]) {
        return onlyDigitsMatch[1].padStart(2, '0');
    }
    
    // 5. Extração de 1 a 3 dígitos (ex: "#1", "T01")
    const onlyDigits = str.replace(/\D/g, '');
    if (onlyDigits && onlyDigits.length <= 3) {
        return onlyDigits.padStart(2, '0');
    }
    
    return str.toLowerCase().replace(/\s+/g, '_');
}

function normalizeTableNumber(val) {
    return getCanonicalTableNumber(val);
}

function isTableOrderEntity(order) {
    if (!order) return false;
    if (order.checkoutType === 'mesa' || order.origin === 'Garçom') return true;
    if (order.mesa !== undefined && order.mesa !== null && String(order.mesa).trim() !== '') return true;
    if (order.tableSessionId || order.comandaId) return true;
    if (order.table && /mesa/i.test(String(order.table))) return true;
    return false;
}

function isTableComandaOpen(order) {
    if (!order || !isTableOrderEntity(order)) return false;
    if (order.status === 'Cancelado') return false;
    if (order.comandaStatus === 'fechada' || order.comandaStatus === 'encerrada' || order.comandaStatus === 'paga' || order.status === 'Encerrado' || order.status === 'Finalizado') {
        return false;
    }
    if (order.closedAt) return false;
    if (order.comandaStatus === 'aberta') return true;
    return order.status !== 'Entregue';
}

function getTableGroupingKey(order) {
    if (!isTableOrderEntity(order)) return null;
    const norm = getCanonicalTableNumber(order);
    if (norm) {
        return `mesa_${norm}`;
    }
    return `mesa_${order.id || 'desconhecido'}`;
}

function isTableOccupied(tableNumOrKey) {
    const normNum = getCanonicalTableNumber(tableNumOrKey);
    if (!normNum) return false;

    const allOrders = Array.isArray(orders) ? orders : [];
    const hasActiveOrders = allOrders.some(o => {
        return isTableOrderEntity(o) && isTableComandaOpen(o) && getCanonicalTableNumber(o) === normNum;
    });
    if (hasActiveOrders) return true;

    const tableState = (firebaseTablesState && (firebaseTablesState[normNum] || firebaseTablesState[`mesa_${normNum}`])) || null;
    if (tableState && tableState.status === 'aberta' && (Number(tableState.comandasCount) > 0 || Number(tableState.total) > 0)) {
        return true;
    }

    return false;
}

let isUnifyingDuplicates = false;
function unifyDuplicateTableOrdersInFirebase(ordersArray) {
    if (isUnifyingDuplicates) return;
    if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) return;
    if (!Array.isArray(ordersArray) || ordersArray.length === 0) return;

    // Agrupa apenas tickets que pertencem à MESMA COMANDA ID para evitar unificar comandas diferentes da mesma mesa
    const activeComandasMap = {};
    ordersArray.forEach(ord => {
        if (!isTableOrderEntity(ord) || !isTableComandaOpen(ord)) return;
        const tableNum = getCanonicalTableNumber(ord);
        if (!tableNum) return;
        const comandaKey = ord.tableSessionId || ord.comandaId || `mesa_${tableNum}_c${ord.comandaNum || ord.id}`;
        if (!activeComandasMap[comandaKey]) {
            activeComandasMap[comandaKey] = [];
        }
        activeComandasMap[comandaKey].push(ord);
    });

    const comandasWithDuplicates = Object.keys(activeComandasMap).filter(k => activeComandasMap[k].length > 1);
    if (comandasWithDuplicates.length === 0) return;

    isUnifyingDuplicates = true;

    comandasWithDuplicates.forEach(comandaKey => {
        const comandaOrders = activeComandasMap[comandaKey];
        comandaOrders.sort((a, b) => (Number(a.timestamp || a.id) || 0) - (Number(b.timestamp || b.id) || 0));

        const primaryOrder = comandaOrders[0];
        const primaryKey = primaryOrder.firebaseKey || primaryOrder.id;
        const primarySession = primaryOrder.tableSessionId || primaryOrder.comandaId || comandaKey;

        const consolidatedCart = [];
        let maxRound = 1;
        let notesCombined = '';

        comandaOrders.forEach((ticket, tIdx) => {
            const tCart = Array.isArray(ticket.cart) ? ticket.cart : Object.values(ticket.cart || {});
            const ticketRound = Number(ticket.round || ticket.roundsCount) || (tIdx + 1);
            if (ticketRound > maxRound) maxRound = ticketRound;

            tCart.forEach(item => {
                const itemRound = Number(item.round) || ticketRound;
                if (itemRound > maxRound) maxRound = itemRound;
                consolidatedCart.push({
                    ...item,
                    round: itemRound
                });
            });

            if (ticket.generalNotes && !notesCombined.includes(ticket.generalNotes)) {
                notesCombined += (notesCombined ? ' | ' : '') + ticket.generalNotes;
            }
        });

        const totalConsolidado = consolidatedCart.reduce((sum, it) => {
            return sum + (Number(it.totalPrice) || (Number(it.singlePrice) * Number(it.quantity)) || 0);
        }, 0);

        const primaryUpdate = {
            tableSessionId: primarySession,
            comandaId: primarySession,
            cart: consolidatedCart,
            total: totalConsolidado,
            subtotal: totalConsolidado,
            round: maxRound,
            roundsCount: maxRound,
            comandaStatus: 'aberta',
            generalNotes: notesCombined || primaryOrder.generalNotes || '',
            relatedOrderIds: comandaOrders.map(t => t.id)
        };

        firebase.database().ref(`orders/${primaryKey}`).update(primaryUpdate).catch(e => console.warn("Aviso ao unificar primário:", e));

        for (let i = 1; i < comandaOrders.length; i++) {
            const secOrder = comandaOrders[i];
            const secKey = secOrder.firebaseKey || secOrder.id;
            firebase.database().ref(`orders/${secKey}`).update({
                comandaStatus: 'fechada',
                status: 'Entregue',
                closedAt: Date.now(),
                mergedInto: String(primaryKey),
                hasNewItems: false
            }).catch(e => console.warn("Aviso ao unificar secundário:", e));
        }
    });

    setTimeout(() => { isUnifyingDuplicates = false; }, 3000);
}

/* ==========================================================================
   Initialization & Authentication
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});

function checkAuthentication() {
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardWrapper = document.querySelector('.dashboard-wrapper');
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log("✅ Firebase Auth: Usuário autenticado verificado!");
                console.log("• User UID:", user.uid);
                console.log("• User Email:", user.email);
                
                if (loginOverlay) loginOverlay.style.display = 'none';
                if (dashboardWrapper) dashboardWrapper.style.display = 'grid';
                
                if (!appStarted) {
                    startApp();
                } else {
                    setupFirebaseRealtime();
                }
            } else {
                console.log("🔒 Firebase Auth: Nenhum usuário autenticado. Exibindo tela de login...");
                if (loginOverlay) loginOverlay.style.display = 'flex';
                if (dashboardWrapper) dashboardWrapper.style.display = 'none';
            }
        });
    } else {
        console.error("❌ Firebase Auth não encontrado.");
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (dashboardWrapper) dashboardWrapper.style.display = 'none';
    }
}

let appStarted = false;
function startApp() {
    if (appStarted) return;
    appStarted = true;
    
    initPWA();
    initMenuSync(); // Synchronize menu items and prices
    if (typeof initCustomersSync === 'function') initCustomersSync();
    initShopStatus(); // Synchronize shop status (open/closed)
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        setupFirebaseRealtime();
    } else {
        fetchOrders(true); // First load, suppress chime sound
        
        // Set up polling every 5 seconds
        setInterval(() => {
            fetchOrders(false);
        }, 5000);
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorDiv = document.getElementById('loginError');
    
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    
    if (!email || !password) {
        showToast('Informe seu e-mail e senha para acessar.', 'warning');
        return;
    }
    
    showLoading('Autenticando no Firebase...');
    if (errorDiv) errorDiv.classList.add('display-none');
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                hideLoading();
                const user = userCredential.user;
                console.log("✅ Firebase Auth: Login efetuado com sucesso!", user?.email);
                if (errorDiv) errorDiv.classList.add('display-none');
                showToast('Acesso autorizado!', 'success');
            })
            .catch((err) => {
                hideLoading();
                console.error("❌ Erro Firebase Auth:", err.code, err.message);
                
                let msg = 'E-mail ou senha incorretos.';
                switch (err.code) {
                    case 'auth/user-not-found':
                        msg = 'Usuário não encontrado no Firebase Authentication.';
                        break;
                    case 'auth/wrong-password':
                        msg = 'Senha incorreta.';
                        break;
                    case 'auth/invalid-credential':
                        msg = 'E-mail ou senha inválidos.';
                        break;
                    case 'auth/invalid-email':
                        msg = 'E-mail inválido.';
                        break;
                    case 'auth/too-many-requests':
                        msg = 'Muitas tentativas. Aguarde alguns minutos.';
                        break;
                    case 'auth/network-request-failed':
                        msg = 'Não foi possível conectar ao Firebase. Verifique sua internet.';
                        break;
                    case 'auth/unauthorized-domain':
                        msg = 'Este domínio ainda não está autorizado no Firebase Authentication.';
                        break;
                    case 'auth/user-disabled':
                        msg = 'Esta conta de usuário foi desativada no Firebase.';
                        break;
                    default:
                        msg = err.message || 'Falha ao autenticar no Firebase Authentication.';
                        break;
                }
                
                if (errorDiv) {
                    errorDiv.innerHTML = `<span class="material-symbols-rounded">error</span> ${msg}`;
                    errorDiv.classList.remove('display-none');
                }
                if (passwordInput) {
                    passwordInput.value = '';
                    passwordInput.focus();
                }
                showToast(msg, 'error', 6000);
            });
    } else {
        hideLoading();
        const msg = 'Serviço Firebase Auth indisponível no navegador. Recarregue a página.';
        if (errorDiv) {
            errorDiv.innerHTML = `<span class="material-symbols-rounded">error</span> ${msg}`;
            errorDiv.classList.remove('display-none');
        }
        showToast(msg, 'error', 6000);
    }
}

function handleLogout(event) {
    if (event) event.preventDefault();
    if (confirm("Deseja realmente sair do painel do Fina Massa Pizzaria?")) {
        showLoading('Encerrando sessão...');
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut()
                .then(() => {
                    hideLoading();
                    const loginOverlay = document.getElementById('loginOverlay');
                    const dashboardWrapper = document.querySelector('.dashboard-wrapper');
                    if (loginOverlay) loginOverlay.style.display = 'flex';
                    if (dashboardWrapper) dashboardWrapper.style.display = 'none';
                    showToast('Sessão encerrada com sucesso.', 'info');
                })
                .catch(err => {
                    hideLoading();
                    console.error("Erro ao fazer logout:", err);
                    window.location.reload();
                });
        } else {
            hideLoading();
            window.location.reload();
        }
    }
}

function autoProvisionTablesIfEmpty(snapshotVal) {
    if (!snapshotVal || Object.keys(snapshotVal).length === 0) {
        const initialTables = {};
        for (let i = 1; i <= 20; i++) {
            const num = String(i).padStart(2, '0');
            initialTables[num] = {
                tableNum: num,
                tableName: `Mesa ${num}`,
                status: 'livre',
                tableSessionId: null,
                waiterName: null,
                openedAt: null,
                lastOrderAt: null,
                total: 0,
                orderIds: []
            };
        }
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            firebase.database().ref('tables').set(initialTables);
        }
        return initialTables;
    }
    return snapshotVal;
}

function setupFirebaseRealtime() {
    if (typeof firebase === 'undefined' || firebase.apps.length === 0) return;
    
    // 1. Escuta em tempo real do nó centralizado /tables
    const tablesRef = firebase.database().ref('tables');
    tablesRef.off();
    tablesRef.on('value', (snapshot) => {
        const val = snapshot.val();
        firebaseTablesState = autoProvisionTablesIfEmpty(val);
        if (currentSection === 'tables') {
            renderTablesDashboard();
        }
    }, (err) => {
        console.error("Erro na escuta de /tables no Firebase:", err);
    });

    // 2. Escuta em tempo real de /orders
    const ordersRef = firebase.database().ref('orders');
    ordersRef.off();
    
    ordersRef.on('value', (snapshot) => {
        const data = snapshot.val();
        let ordersArray = [];
        
        if (data) {
            ordersArray = Object.keys(data).map(key => {
                return {
                    ...data[key],
                    firebaseKey: key
                };
            });
        }
        
        // Sort newest first
        ordersArray.sort((a, b) => b.timestamp - a.timestamp);
        
        const oldOrders = [...orders];
        orders = ordersArray;
        
        // Auto-unifica registros legados duplicados no Firebase
        unifyDuplicateTableOrdersInFirebase(ordersArray);
        
        // Check for new orders or updated tables with new items to play chime sound
        let hasNewPending = false;
        orders.forEach(order => {
            const isNew = !knownOrderIds.has(order.id);
            const isTableNewItems = order.hasNewItems && order.status === 'Pendente';
            if ((order.status === 'Pendente' && isNew) || isTableNewItems) {
                hasNewPending = true;
            }
            knownOrderIds.add(order.id);
        });
        
        if (hasNewPending && oldOrders.length > 0) {
            playNotificationSound();
        }
        
        updateIndicators();
        renderOrdersList();
        if (currentSection === 'tables') {
            renderTablesDashboard();
        }
        
        // Trigger background debounced auto-backup of order snapshot safely
        triggerCentralAutoBackup();
        
        // Update server status text to Cloud
        const serverStatus = document.querySelector('.server-status');
        if (serverStatus) {
            serverStatus.className = 'server-status active';
            serverStatus.innerHTML = '<span class="dot" style="background-color: #81c784;"></span> Firebase Cloud';
        }
    }, (error) => {
        console.error("Erro na escuta dos pedidos no Realtime Database (/orders):", error);
        if (error.code === 'PERMISSION_DENIED') {
            console.warn("Aviso: Conexão temporária negada. O listener será re-anexado após validação de auth.");
        }
    });
}

/* ==========================================================================
   Data Fetching & Polling
   ========================================================================== */
function fetchOrders(isFirstLoad = false) {
    fetch('/api/orders')
        .then(res => res.json())
        .then(data => {
            const oldOrders = [...orders];
            orders = data;
            
            // Check for new orders to play chime sound
            let hasNewPending = false;
            orders.forEach(order => {
                if (order.status === 'Pendente' && !knownOrderIds.has(order.id)) {
                    hasNewPending = true;
                    knownOrderIds.add(order.id);
                }
                // Also ensure we keep track of already seen orders
                knownOrderIds.add(order.id);
            });
            
            if (hasNewPending && !isFirstLoad) {
                playNotificationSound();
            }
            
            updateIndicators();
            renderOrdersList();
            if (currentSection === 'tables') {
                renderTablesDashboard();
            }
        })
        .catch(err => {
            console.error("Error fetching orders:", err);
            const serverStatus = document.querySelector('.server-status');
            if (serverStatus) {
                serverStatus.className = 'server-status';
                serverStatus.innerHTML = '<span class="dot" style="background-color: #c62828;"></span> Offline';
            }
        });
}

/* ==========================================================================
   Update Dashboard Metrics
   ========================================================================== */
function updateIndicators() {
    const periodOrders = (orders || []).filter(matchesOrderDatePeriod);

    const pendingCount = periodOrders.filter(o => o.status === 'Pendente').length;
    const preparandoCount = periodOrders.filter(o => o.status === 'Preparando').length;
    const entregaCount = periodOrders.filter(o => o.status === 'Entrega' || o.status === 'Pronto').length;
    
    // Revenue counts delivered orders in this period
    const revenue = periodOrders
        .filter(o => o.status === 'Entregue' || o.status === 'Finalizado')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        
    const pendingEl = document.getElementById('pendingCount');
    const prepEl = document.getElementById('preparandoCount');
    const entEl = document.getElementById('entregaCount');
    const revEl = document.getElementById('revenueCount');
    const revLabel = document.getElementById('revenueCardLabel');

    if (pendingEl) pendingEl.innerText = pendingCount;
    if (prepEl) prepEl.innerText = preparandoCount;
    if (entEl) entEl.innerText = entregaCount;
    if (revEl) revEl.innerText = `R$ ${revenue.toFixed(2).replace('.', ',')}`;

    if (revLabel) {
        if (currentPeriodFilter === 'hoje') revLabel.innerText = 'Faturamento de Hoje';
        else if (currentPeriodFilter === 'ontem') revLabel.innerText = 'Faturamento de Ontem';
        else if (currentPeriodFilter === 'semana') revLabel.innerText = 'Faturamento da Semana';
        else if (currentPeriodFilter === 'mes') revLabel.innerText = 'Faturamento do MÃªs';
        else if (currentPeriodFilter === 'custom') revLabel.innerText = 'Faturamento no PerÃ­odo';
        else revLabel.innerText = 'Faturamento Total';
    }
}

/* ==========================================================================
   Sound Notification (Web Audio API Synthesizer)
   ========================================================================== */
function playNotificationSound() {
    if (!soundEnabled) return;
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        
        // Chime: Rising double beep (E5 then A5)
        const osc1 = context.createOscillator();
        const gain1 = context.createGain();
        osc1.connect(gain1);
        gain1.connect(context.destination);
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, context.currentTime); // E5
        gain1.gain.setValueAtTime(0, context.currentTime);
        gain1.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
        osc1.start(context.currentTime);
        osc1.stop(context.currentTime + 0.35);
        
        const osc2 = context.createOscillator();
        const gain2 = context.createGain();
        osc2.connect(gain2);
        gain2.connect(context.destination);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, context.currentTime + 0.12); // A5
        gain2.gain.setValueAtTime(0, context.currentTime + 0.12);
        gain2.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.17);
        gain2.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.45);
        osc2.start(context.currentTime + 0.12);
        osc2.stop(context.currentTime + 0.5);
    } catch (e) {
        console.warn("AudioContext notification failed:", e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('soundIcon');
    const label = document.querySelector('#soundToggle span:not(.material-symbols-rounded)');
    
    if (soundEnabled) {
        icon.innerText = 'volume_up';
        label.innerText = 'Som Ligado';
        document.getElementById('soundToggle').classList.remove('disabled');
    } else {
        icon.innerText = 'volume_off';
        label.innerText = 'Som Mutado';
        document.getElementById('soundToggle').classList.add('disabled');
    }
}

/* ==========================================================================
   Filter & Rendering
   ========================================================================== */
function setFilter(status) {
    filterStatus = status;
    
    // Toggle active tab class
    document.querySelectorAll('.filter-tab').forEach(tab => {
        if (tab.getAttribute('data-status') === status) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const statusSelect = document.getElementById('orderStatusFilterSelect');
    if (statusSelect) {
        statusSelect.value = status;
    }
    
    renderOrdersList();
}

function getItemAdicionaisText(item) {
    if (!item) return '';
    const ads = item.adicionais || item.opcionais || item.additionals || item.extras;
    if (!ads) return '';
    if (typeof ads === 'string') return ads.trim();
    if (Array.isArray(ads)) {
        return ads.map(a => {
            if (typeof a === 'string') return a.trim();
            if (a && typeof a === 'object') {
                const name = a.name || a.nome || a.title || a.label || '';
                const price = Number(a.price || a.preco || a.valor || 0);
                if (price > 0) {
                    return `${name} (+R$ ${price.toFixed(2).replace('.', ',')})`;
                }
                return name;
            }
            return String(a);
        }).filter(Boolean).join(', ');
    }
    if (typeof ads === 'object') {
        return Object.values(ads).map(a => {
            if (typeof a === 'string') return a.trim();
            if (a && typeof a === 'object') {
                const name = a.name || a.nome || a.title || a.label || '';
                const price = Number(a.price || a.preco || a.valor || 0);
                if (price > 0) {
                    return `${name} (+R$ ${price.toFixed(2).replace('.', ',')})`;
                }
                return name;
            }
            return '';
        }).filter(Boolean).join(', ');
    }
    return '';
}

function getItemAdicionaisPriceSum(item) {
    if (!item) return 0;
    const ads = item.adicionais || item.opcionais || item.additionals || item.extras;
    if (!ads) return 0;
    let sum = 0;
    if (Array.isArray(ads)) {
        ads.forEach(a => {
            if (a && typeof a === 'object') {
                sum += Number(a.price || a.preco || a.valor || 0);
            }
        });
    } else if (typeof ads === 'object') {
        Object.values(ads).forEach(a => {
            if (a && typeof a === 'object') {
                sum += Number(a.price || a.preco || a.valor || 0);
            }
        });
    }
    return sum;
}

function getItemCalculatedTotal(item) {
    if (!item) return 0;
    const qty = Number(item.quantity) || 1;
    const addsSum = getItemAdicionaisPriceSum(item);
    
    let single = Number(item.singlePrice) || Number(item.price) || 0;
    let total = Number(item.totalPrice) || 0;
    
    if (addsSum > 0) {
        const base = Number(item.basePrice || (item.singlePrice ? item.singlePrice : item.price) || 0);
        // Se singlePrice já engloba base + addsSum
        if (item.basePrice && single >= (base + addsSum)) {
            total = single * qty;
        } else if (item.singlePrice && !item.basePrice && single > addsSum) {
            // singlePrice pode já ser o valor final ou base
            if (total > (single * qty)) {
                // total já foi gravado corretamente
            } else {
                total = (single + addsSum) * qty;
            }
        } else {
            total = (base + addsSum) * qty;
        }
    } else if (total <= 0) {
        total = single * qty;
    }
    
    return total;
}

function renderOrdersList() {
    const grid = document.getElementById('ordersListGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '';
    
    // Agrupa pedidos de mesa abertos usando chave canônica de comanda para cards individuais na cozinha
    const processedTableKeys = new Set();
    const processedOrderIds = new Set();
    const displayList = [];

    orders.forEach(order => {
        if (!order) return;
        const orderIdStr = String(order.id);
        const fbKeyStr = order.firebaseKey ? String(order.firebaseKey) : null;
        
        if (processedOrderIds.has(orderIdStr) || (fbKeyStr && processedOrderIds.has(fbKeyStr))) {
            return;
        }

        const isTable = isTableOrderEntity(order);
        const isComandaAberta = isTable && isTableComandaOpen(order);

        if (isTable && isComandaAberta) {
            const tableNum = getCanonicalTableNumber(order);
            const canonicalComandaKey = order.tableSessionId || order.comandaId || `mesa_${tableNum}_c${order.comandaNum || order.id}`;
            const cNum = order.comandaNum || 1;
            const cName = order.clientName || `Comanda ${String(cNum).padStart(2, '0')}`;
            const formattedTableLabel = `Mesa ${tableNum || '01'} • ${cName}`;

            if (processedTableKeys.has(canonicalComandaKey)) {
                return;
            }
            processedTableKeys.add(canonicalComandaKey);

            // Reúne os registros que pertencem a ESTA mesma comanda específica
            const relatedTickets = orders.filter(o => {
                if (!o) return false;
                const oIsTable = isTableOrderEntity(o);
                const oIsOpen = isTableComandaOpen(o);
                if (!oIsTable || !oIsOpen) return false;

                const oKey = o.tableSessionId || o.comandaId || `mesa_${getCanonicalTableNumber(o)}_c${o.comandaNum || o.id}`;
                return oKey === canonicalComandaKey || String(o.id) === String(order.id) || (o.firebaseKey && String(o.firebaseKey) === String(order.firebaseKey));
            });

            // Marca todos os tickets relacionados como processados
            relatedTickets.forEach(t => {
                processedOrderIds.add(String(t.id));
                if (t.firebaseKey) processedOrderIds.add(String(t.firebaseKey));
            });

            // Ordena por data/timestamp mais antigo primeiro (primeiro pedido/rodada primeiro)
            relatedTickets.sort((a, b) => (Number(a.timestamp || a.id) || 0) - (Number(b.timestamp || b.id) || 0));

            const consolidatedCart = [];
            let notesCombined = '';
            let hasAnyPending = false;
            let maxRound = 1;
            const roundsBreakdown = [];

            relatedTickets.forEach((ticket, ticketIndex) => {
                const tCart = Array.isArray(ticket.cart) ? ticket.cart : Object.values(ticket.cart || {});
                const ticketRound = Number(ticket.round || ticket.roundsCount) || (ticketIndex + 1);
                if (ticketRound > maxRound) maxRound = ticketRound;

                let roundSubtotal = 0;
                tCart.forEach(item => {
                    const itemRound = Number(item.round) || ticketRound;
                    if (itemRound > maxRound) maxRound = itemRound;
                    const itemPrice = getItemCalculatedTotal(item);
                    roundSubtotal += itemPrice;
                    consolidatedCart.push({
                        ...item,
                        round: itemRound
                    });
                });

                roundsBreakdown.push({
                    roundNumber: ticketRound,
                    orderId: ticket.id,
                    status: ticket.status || 'Pendente',
                    time: ticket.time || ticket.addedAt || '',
                    total: (roundSubtotal > 0 ? roundSubtotal : Number(ticket.total || 0)),
                    itemsCount: tCart.length
                });

                if (ticket.generalNotes && !notesCombined.includes(ticket.generalNotes)) {
                    notesCombined += (notesCombined ? ' | ' : '') + ticket.generalNotes;
                }
                if (ticket.status === 'Pendente' || ticket.hasNewItems) {
                    hasAnyPending = true;
                }
            });

            // CÁLCULO PRECISO DO TOTAL DA COMANDA INCLUINDO ADICIONAIS
            let totalSum = consolidatedCart.reduce((sum, it) => sum + getItemCalculatedTotal(it), 0);
            if (totalSum === 0 && Number(order.total) > 0) {
                totalSum = Number(order.total);
            }

            const mainTicket = relatedTickets[0] || order;
            const latestTicket = relatedTickets[relatedTickets.length - 1] || mainTicket;
            const sessionKey = mainTicket.tableSessionId || mainTicket.comandaId || canonicalComandaKey;

            let overallStatus = 'Preparando';
            if (hasAnyPending) {
                overallStatus = 'Pendente';
            } else if (relatedTickets.some(t => t.status === 'Preparando')) {
                overallStatus = 'Preparando';
            } else if (relatedTickets.some(t => t.status === 'Entrega' || t.status === 'Pronto')) {
                overallStatus = 'Entrega';
            }

            const consolidatedOrder = {
                ...mainTicket,
                id: mainTicket.id,
                firebaseKey: mainTicket.firebaseKey,
                relatedOrderIds: relatedTickets.map(t => t.id),
                relatedFirebaseKeys: relatedTickets.map(t => t.firebaseKey || t.id),
                relatedTickets: relatedTickets,
                roundsBreakdown: roundsBreakdown,
                checkoutType: 'mesa',
                table: formattedTableLabel,
                mesa: tableNum,
                clientName: cName,
                clientPhone: 'Mesa / Salão',
                origin: mainTicket.origin || 'Garçom',
                waiterName: latestTicket.waiterName || mainTicket.waiterName || 'Garçom',
                comandaId: sessionKey,
                tableSessionId: sessionKey,
                comandaStatus: 'aberta',
                cart: consolidatedCart,
                total: totalSum,
                subtotal: totalSum,
                status: overallStatus,
                hasNewItems: hasAnyPending && (consolidatedCart.length > 1 || relatedTickets.length > 1),
                roundsCount: maxRound,
                round: maxRound,
                generalNotes: notesCombined || mainTicket.generalNotes || '',
                openedAt: mainTicket.openedAt || mainTicket.time || 'Recente',
                time: latestTicket.time || mainTicket.time,
                date: latestTicket.date || mainTicket.date,
                timestamp: mainTicket.timestamp || mainTicket.id
            };

            displayList.push(consolidatedOrder);
        } else {
            // Delivery, Balcão ou Comandas já encerradas
            processedOrderIds.add(String(order.id));
            if (order.firebaseKey) processedOrderIds.add(String(order.firebaseKey));
            displayList.push(order);
        }
    });

        // Combina filtros de Data/PerÃ­odo e Status
    const filtered = displayList.filter(order => {
        return matchesOrderDatePeriod(order) && matchesOrderStatusFilter(order);
    });

    // OrdenaÃ§Ã£o PrioritÃ¡ria: Pendentes Primeiro -> Em Preparo -> Para Entrega -> ConcluÃ­dos -> Cancelados
    // Dentro de cada status, pedidos mais recentes primeiro (timestamp decrescente)
    filtered.sort((a, b) => {
        const prioA = getStatusPriority(a.status);
        const prioB = getStatusPriority(b.status);
        if (prioA !== prioB) {
            return prioA - prioB;
        }
        const timeA = getOrderTimestamp(a);
        const timeB = getOrderTimestamp(b);
        return timeB - timeA;
    });
    
    if (filtered.length === 0) {
        emptyState.classList.remove('display-none');
        grid.classList.add('display-none');
        return;
    }
    
    emptyState.classList.add('display-none');
    grid.classList.remove('display-none');
    
    filtered.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        
        const isTableOrder = isTableOrderEntity(order);
        const normTable = normalizeTableNumber(order.mesa || order.table || order.tableSessionId || order.comandaId);
        const tableLabel = isTableOrder ? (normTable ? `Mesa ${normTable}` : (order.table || 'Mesa Salão')) : (order.table || 'Balcão');

        // Items list formatting
        let itemsHTML = '';
        const orderCart = order.cart || [];
        orderCart.forEach(item => {
            const roundBadge = item.round ? `<span style="display: inline-block; font-size: 10px; background: rgba(245, 166, 35, 0.2); color: #f5a623; border: 1px solid rgba(245, 166, 35, 0.4); padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: 700;">Rodada ${item.round}</span>` : '';
            const itemComment = item.comment || item.notes || '';
            if (item.type === 'pizza') {
                let flavorsText = '';
                if (item.pizza && Array.isArray(item.pizza.flavors) && item.pizza.flavors.length > 0) {
                    flavorsText = item.pizza.flavors.map(f => (f.fraction && f.fraction !== '1/1' && f.fraction !== '1') ? `${f.fraction} ${f.name}` : f.name).join(' + ');
                } else if (Array.isArray(item.flavorNames) && item.flavorNames.length > 0) {
                    flavorsText = item.flavorNames.join(' + ');
                } else {
                    flavorsText = item.name;
                }

                const crustObj = (item.pizza && item.pizza.crust) || item.border;
                const borderText = (crustObj && crustObj.name) ? crustObj.name : (item.borderName || 'Tradicional');
                const displayName = item.sizeName ? `Pizza ${item.sizeName}` : (item.name || 'Pizza');

                itemsHTML += `
                    <div class="order-item-row">
                        <span class="order-item-qty-name">${item.quantity}x ${displayName} ${roundBadge}</span>
                        <span class="order-item-price">R$ ${Number(item.totalPrice || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="order-item-details">
                        Sabores: ${flavorsText}<br>
                        Borda: ${borderText}
                        ${itemComment ? `<br><strong style="color: #f5a623;">Obs:</strong> "${itemComment}"` : ''}
                    </div>
                `;
            } else {
                const adicionaisText = getItemAdicionaisText(item);
                itemsHTML += `
                    <div class="order-item-row">
                        <span class="order-item-qty-name">${item.quantity}x ${item.name} ${roundBadge}</span>
                        <span class="order-item-price">R$ ${getItemCalculatedTotal(item).toFixed(2).replace('.', ',')}</span>
                    </div>
                    ${adicionaisText ? `<div class="order-item-adicionais" style="font-size: 12px; color: var(--primary, #e65100); font-weight: 700; margin-top: 2px; padding-left: 4px;">+ ${adicionaisText}</div>` : ''}
                    ${itemComment ? `<div class="order-item-details" style="color: #f5a623; font-weight: 500;"><strong style="color: #f5a623;">Obs:</strong> "${itemComment}"</div>` : ''}
                `;
            }
        });
        
        // Status button progression
        let actionButtonHTML = '';
        let cancelButtonHTML = '';
        let closeComandaBtnHTML = '';
        const isComandaAberta = isTableOrder && isTableComandaOpen(order);
        
        // Compute accumulated total for comanda if active
        let totalDisplayVal = Number(order.total || 0);
        let totalLabelText = isTableOrder ? 'Total da Comanda' : (order.checkoutType === 'delivery' ? 'Total Pedido' : 'Total Geral');
        if (isTableOrder && isComandaAberta) {
            if (order.roundsCount > 1 || (order.relatedOrderIds && order.relatedOrderIds.length > 1)) {
                const countRounds = order.roundsCount || order.relatedOrderIds.length;
                totalLabelText = `Total da Comanda (${countRounds} rodadas)`;
            }
        }

        if (isComandaAberta) {
            const comandaTargetId = order.mesa || order.table || order.comandaId || order.id;
            closeComandaBtnHTML = `
                <button type="button" class="btn-close-comanda" onclick="finalizeTableComanda('${comandaTargetId}')" title="Encerrar comanda e liberar a mesa para novos clientes" style="background: linear-gradient(135deg, #2e7d32, #1b5e20); color: #ffffff; border: 1px solid rgba(76, 175, 80, 0.4); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-rounded" style="font-size: 16px;">point_of_sale</span>
                    <span>Encerrar Mesa</span>
                </button>
            `;
        }

        if (order.status === 'Pendente') {
            actionButtonHTML = `
                <button class="btn-status-next" onclick="updateOrderStatus(${order.id}, 'Preparando')">
                    <span class="material-symbols-rounded">play_arrow</span>
                    ${isTableOrder ? 'Aceitar Pedido' : 'Aceitar'}
                </button>
            `;
            cancelButtonHTML = `<button class="btn-cancel" onclick="updateOrderStatus(${order.id}, 'Cancelado')">Recusar</button>`;
        } else if (order.status === 'Preparando') {
            actionButtonHTML = `
                <button class="btn-status-next" onclick="updateOrderStatus(${order.id}, 'Entrega')">
                    <span class="material-symbols-rounded">${isTableOrder ? 'restaurant' : 'delivery_dining'}</span>
                    ${isTableOrder ? 'Pronto (Servir)' : 'Pronto'}
                </button>
            `;
            cancelButtonHTML = `<button class="btn-cancel" onclick="updateOrderStatus(${order.id}, 'Cancelado')">Cancelar</button>`;
        } else if (order.status === 'Entrega') {
            const notifyBtn = (!isTableOrder && order.clientPhone && order.clientPhone !== 'Mesa / Salão') ? `
                <button class="btn-whatsapp-notify" onclick="notifyCustomerReady(${order.id})" title="Enviar WhatsApp avisando que está pronto">
                    <span class="material-symbols-rounded">chat</span>
                    Avisar Cliente
                </button>
            ` : '';
            actionButtonHTML = `
                ${notifyBtn}
                <button class="btn-status-next" onclick="updateOrderStatus(${order.id}, 'Entregue')">
                    <span class="material-symbols-rounded">check</span>
                    ${isTableOrder ? 'Servido (Mesa)' : 'Entregar'}
                </button>
            `;
        }
        
        // Address formatted
        let addressHTML = 'Retirada no Balcão';
        if (order.checkoutType === 'delivery' && order.address) {
            const addr = order.address;
            addressHTML = `${addr.street}, nº ${addr.number}<br>Bairro: ${addr.neighborhood}${addr.reference ? `<br>Ref: ${addr.reference}` : ''}`;
        } else if (isTableOrder) {
            addressHTML = `Consumo no Local • Mesa ${tableLabel}`;
        }
        
        // Payment formatted
        const payments = { 'pix': 'Pix', 'card': 'Cartão (Maquininha)', 'cash': 'Dinheiro', 'mesa': 'Pagamento na Mesa / Caixa' };
        let paymentHTML = payments[order.paymentMethod] || (order.paymentMethod ? order.paymentMethod.toUpperCase() : 'Na Mesa / Caixa');
        if (order.paymentMethod === 'cash' && order.cashChange) {
            paymentHTML += ` (Troco para R$ ${Number(order.cashChange).toFixed(2)})`;
        }
        
        const activeMotoboysList = getActiveMotoboys();
        let assignedId = order.assignedMotoboyId || '';
        let currentFeeVal = (order.motoboyFee !== undefined && order.motoboyFee !== null) ? Number(order.motoboyFee) : Number(order.deliveryFee || 0);

        let motoboySelectOptionsHTML = `<option value="">-- Selecionar Motoboy --</option>`;
        activeMotoboysList.forEach(m => {
            const isSel = String(m.id) === String(assignedId) ? 'selected' : '';
            motoboySelectOptionsHTML += `<option value="${m.id}" ${isSel}>${m.name}</option>`;
        });

        let motoboyAssignmentHTML = '';
        if (order.checkoutType === 'delivery' && order.address) {
            motoboyAssignmentHTML = `
                <div style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 10px; margin-top: 8px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 170px;">
                        <span class="material-symbols-rounded" style="color: #25d366; font-size: 16px;">two_wheeler</span>
                        <span style="font-weight: 600; color: var(--text-light);">Motoboy:</span>
                        <select style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 12px; flex: 1;" onchange="assignMotoboyToOrder('${order.id}', this.value)">
                            ${motoboySelectOptionsHTML}
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-weight: 600; color: var(--text-light);">Corrida (R$):</span>
                        <input type="number" step="0.50" value="${currentFeeVal.toFixed(2)}" style="width: 70px; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 12px;" onchange="updateOrderMotoboyFee('${order.id}', this.value)" title="Valor da corrida pago a este motoboy">
                    </div>
                </div>
            `;
        }

        // Destaque visual especial para mesa
        let tableHeaderBadge = '';
        let tableCustomerDetailsHTML = '';
        let tipoDisplay = order.checkoutType === 'delivery' ? '🚗 Tele-Entrega' : '🏪 Retirada no Balcão';

        if (isTableOrder) {
            tipoDisplay = `🍽️ Mesa / Salão (Origem: ${order.origin || 'Garçom'})`;
            const roundsTag = (Number(order.roundsCount || order.round) > 1) ? ` (${order.roundsCount || order.round}º Pedido)` : '';
            const newItemsBadge = (order.hasNewItems && order.status === 'Pendente') ? `<span class="status-badge" style="background: #e53935; color: #fff; font-weight: 800; animation: pulse 1.5s infinite; margin-left: 4px;">🔥 NOVO PEDIDO</span>` : '';
            const comandaBadge = isComandaAberta
                ? `<span class="status-badge" style="background: rgba(37, 211, 102, 0.2); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.4); font-weight: 700; margin-left: 4px;">Conta Aberta${roundsTag}</span>`
                : `<span class="status-badge" style="background: rgba(255, 255, 255, 0.1); color: #aaa; margin-left: 4px;">Conta Encerrada</span>`;

            tableHeaderBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #e65100, #f57c00); color: #ffffff; font-weight: 800; border: 1px solid rgba(255,255,255,0.2); margin-right: 6px;">🍽️ ${tableLabel.toUpperCase()}</span> ${comandaBadge} ${newItemsBadge}`;
            
            // Resumo visual das rodadas/pedidos se houver consolidação
            let roundsBreakdownHTML = '';
            if (order.roundsBreakdown && order.roundsBreakdown.length > 1) {
                roundsBreakdownHTML = `
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(245, 166, 35, 0.3); border-radius: 6px; padding: 6px 10px; margin-top: 6px; margin-bottom: 6px;">
                        <div style="font-weight: 700; color: #f5a623; font-size: 11px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                            <span>📋 Pedidos/Rodadas Consolidadas:</span>
                            <span>${order.roundsBreakdown.length} rodadas</span>
                        </div>
                        ${order.roundsBreakdown.map((r, idx) => `
                            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; color: var(--text-light); border-bottom: 1px dashed rgba(255,255,255,0.06);">
                                <span><strong>${idx === 0 ? 'Pedido A' : (idx === 1 ? 'Pedido B' : `Pedido ${idx + 1}`)} (Rodada ${r.roundNumber}):</strong> ${r.itemsCount} item(ns)</span>
                                <span style="font-weight: 700; color: #ffffff;">R$ ${Number(r.total || 0).toFixed(2).replace('.', ',')}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            tableCustomerDetailsHTML = `
                <div class="customer-row" style="background: rgba(245, 166, 35, 0.12); padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(245, 166, 35, 0.3); margin-bottom: 6px;">
                    <span class="label" style="color: #f5a623; font-weight: 700;">🍽️ Mesa:</span>
                    <span class="value" style="color: #ffffff; font-weight: 800; font-size: 14px;">${tableLabel} • ${isComandaAberta ? '🟢 Conta Aberta' : '⚪ Conta Fechada'} • Garçom: ${order.waiterName || 'Garçom'}</span>
                </div>
                ${roundsBreakdownHTML}
            `;
        }

        const generalNotesHTML = (order.generalNotes || (isTableOrder && order.notes)) ? `
            <div style="background: rgba(255, 193, 7, 0.1); border-left: 3px solid #ffc107; padding: 6px 10px; border-radius: 4px; margin-top: 8px; font-size: 12px; color: #ffe082;">
                <strong>Obs. Geral da Mesa:</strong> ${order.generalNotes || order.notes}
            </div>
        ` : '';

        // Horário de Retirada / Previsão Combinada
        let pickupTimeHTML = '';
        const currentPickupTime = (order.pickupTime || order.horarioRetirada || '').trim();
        pickupTimeHTML = `
            <div class="customer-row" style="background: rgba(245, 166, 35, 0.12); padding: 7px 10px; border-radius: 6px; border: 1.5px dashed rgba(245, 166, 35, 0.45); margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
                <span class="label" style="color: #f5a623; font-weight: 700; display: flex; align-items: center; gap: 4px; font-size: 12px;">
                    <span class="material-symbols-rounded" style="font-size: 16px;">schedule</span>
                    <span>Previsão / Horário Combinado:</span>
                </span>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="pickupInput_${order.id}" value="${currentPickupTime}" placeholder="Ex: 20:30" style="width: 85px; padding: 5px 8px; font-size: 12px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); text-align: center;" onkeydown="if(event.key==='Enter') saveOrderPickupTime('${order.id}')">
                    <button type="button" onclick="saveOrderPickupTime('${order.id}')" style="background: #f5a623; color: #111; border: none; padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer;" title="Salvar Horário">Salvar</button>
                    ${currentPickupTime && order.clientPhone ? `
                        <button type="button" onclick="notifyCustomerPickupTime('${order.id}')" style="background: #25d366; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 2px;" title="Avisar cliente no WhatsApp">
                            <span class="material-symbols-rounded" style="font-size: 15px;">send</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        let manualHeaderBadge = '';
        if (order.origin === 'manual' || order.origem === 'manual' || order.canalOrigem) {
            const canal = order.canalOrigem || 'Atendimento';
            manualHeaderBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #7b1fa2, #9c27b0); color: #ffffff; font-weight: 800; border: 1px solid rgba(255,255,255,0.25); margin-right: 6px;"><span class="material-symbols-rounded" style="font-size: 13px; vertical-align: middle; margin-right: 3px;">headset_mic</span> MANUAL • ${canal.toUpperCase()}</span>`;
            if (!isTableOrder) {
                tipoDisplay = `${order.checkoutType === 'delivery' ? '🚗 Tele-Entrega' : '🏪 Retirada no Balcão'} (Manual: ${canal})`;
            }
        }

        card.innerHTML = `
            <div class="order-card-header">
                <div>
                    <span class="order-id">#${order.id}</span>
                    <span class="order-time">${order.time}</span>
                    ${tableHeaderBadge}
                    ${manualHeaderBadge}
                </div>
                <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
            </div>
            
            <div class="order-customer-details">
                ${tableCustomerDetailsHTML}
                <div class="customer-row">
                    <span class="label">Cliente:</span>
                    <span class="value">${order.clientName}</span>
                </div>
                ${!isTableOrder ? `
                <div class="customer-row">
                    <span class="label">Telefone:</span>
                    <span class="value">
                        <a href="https://wa.me/55${order.clientPhone.replace(/\D/g, '')}" target="_blank" style="color: var(--primary); text-decoration: none;">
                            ${order.clientPhone}
                        </a>
                    </span>
                </div>
                ` : ''}
                <div class="customer-row">
                    <span class="label">Tipo:</span>
                    <span class="value">${tipoDisplay}</span>
                </div>
                <div class="customer-row">
                    <span class="label">Entrega:</span>
                    <div class="value" style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                        <span>${addressHTML}</span>
                        ${order.checkoutType === 'delivery' && order.address ? `
                            <div style="display: flex; gap: 6px; margin-top: 4px;">
                                <button type="button" class="btn-motoboy-link-share" onclick="sendCustomMotoboyWhatsApp('${order.id}')" title="Enviar corrida completa para o WhatsApp de qualquer entregador" style="background: #25d366; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600;">
                                    <span class="material-symbols-rounded" style="font-size: 16px;">chat</span>
                                    <span>WhatsApp Motoboy</span>
                                </button>
                                ${(order.location && order.location.latitude && order.location.longitude) ? `
                                    <button type="button" class="btn-motoboy-link-gps" onclick="openGoogleMapsLink('${order.id}')" title="Abrir localização GPS real do cliente no Google Maps" style="background: #e53935; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600;">
                                        <span class="material-symbols-rounded" style="font-size: 16px;">location_on</span>
                                        <span>📍 ABRIR LOCALIZAÇÃO</span>
                                    </button>
                                ` : `
                                    <button type="button" class="btn-motoboy-link-share" onclick="openGoogleMapsLink('${order.id}')" title="Abrir localização no Google Maps" style="background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 12px;">
                                        <span class="material-symbols-rounded" style="font-size: 16px;">map</span>
                                    </button>
                                `}
                            </div>
                        ` : ''}
                        ${motoboyAssignmentHTML}
                    </div>
                </div>
                <div class="customer-row">
                    <span class="label">Pagamento:</span>
                    <span class="value">${paymentHTML}</span>
                </div>
                ${pickupTimeHTML}
                ${generalNotesHTML}
            </div>
            
            <div class="order-items-summary">
                <div class="summary-title">Itens do Pedido</div>
                <div class="order-item-list">
                    ${itemsHTML}
                </div>
            </div>
            
            <div class="order-card-footer">
                <div class="footer-total">
                    <span class="label">${totalLabelText}</span>
                    <h5 class="value">R$ ${totalDisplayVal.toFixed(2)}</h5>
                </div>
                
                <div class="footer-actions">
                    ${cancelButtonHTML}
                    ${order.checkoutType === 'delivery' && order.address ? `
                        <button class="btn-motoboy" onclick="sendToMotoboy('${order.id}')" title="Enviar para Motoboy (Google Maps)">
                            <span class="material-symbols-rounded">two_wheeler</span>
                            <span>Motoboy</span>
                        </button>
                    ` : ''}
                    <button class="btn-print" onclick="printOrderTicket(${order.id})" title="Imprimir Cupom Completo">
                        <span class="material-symbols-rounded">print</span>
                    </button>
                    <button class="btn-print btn-print-kitchen" onclick="printKitchenTicket(${order.id})" title="Imprimir Via Cozinha">
                        <span class="material-symbols-rounded">local_pizza</span>
                    </button>
                    ${closeComandaBtnHTML}
                    ${actionButtonHTML}
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
    
    // Update reports in real-time when orders list is updated
    if (typeof renderReportsDashboard === 'function') {
        renderReportsDashboard();
    }
}

/* ==========================================================================
   Motoboy Navigation & Location Helper Functions
   ========================================================================== */
function buildMotoboyAddressQuery(order) {
    if (!order || order.checkoutType !== 'delivery' || !order.address) return '';
    const addr = order.address;
    
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.number) parts.push(`nº ${addr.number}`);
    if (addr.neighborhood) parts.push(`Bairro ${addr.neighborhood}`);
    
    const city = addr.city || 'Nova Petrópolis';
    const state = addr.state || 'RS';
    parts.push(`${city}, ${state}`);
    
    return parts.join(', ');
}

function getActiveMotoboys() {
    const list = [];
    const settings = (menuData && menuData.settings) ? menuData.settings : {};
    
    for (let i = 1; i <= 10; i++) {
        const nameKey = i === 1 ? (settings.motoboy1Name ? 'motoboy1Name' : (settings.motoboyName ? 'motoboyName' : 'motoboy1Name')) : `motoboy${i}Name`;
        const wspKey = i === 1 ? (settings.motoboy1Whatsapp ? 'motoboy1Whatsapp' : (settings.motoboyWhatsapp ? 'motoboyWhatsapp' : 'motoboy1Whatsapp')) : `motoboy${i}Whatsapp`;
        
        const mName = (settings[nameKey] || '').trim();
        const mWsp = (settings[wspKey] || '').trim();
        if (mName || mWsp) {
            list.push({ id: i, name: mName || `Motoboy ${i}`, whatsapp: mWsp.replace(/\D/g, '') });
        }
    }

    return list;
}

function assignMotoboyToOrder(orderId, motoboyId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    
    const motoboys = getActiveMotoboys();
    const sel = motoboys.find(m => String(m.id) === String(motoboyId));
    
    if (sel) {
        order.assignedMotoboyId = sel.id;
        order.assignedMotoboyName = sel.name;
        order.assignedMotoboyWhatsapp = sel.whatsapp;
    } else {
        order.assignedMotoboyId = '';
        order.assignedMotoboyName = '';
        order.assignedMotoboyWhatsapp = '';
    }
    
    if (order.motoboyFee === undefined || order.motoboyFee === null) {
        order.motoboyFee = Number(order.deliveryFee || 0);
    }

    const updates = {
        assignedMotoboyId: order.assignedMotoboyId,
        assignedMotoboyName: order.assignedMotoboyName,
        assignedMotoboyWhatsapp: order.assignedMotoboyWhatsapp,
        motoboyFee: Number(order.motoboyFee)
    };

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const refKey = order.firebaseKey || order.id;
        firebase.database().ref(`orders/${refKey}`).update(updates);
    } else {
        fetch(`/api/orders/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    }

    renderOrders();
    renderReportsDashboard();
}

function updateOrderMotoboyFee(orderId, feeVal) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    
    const fee = parseFloat(feeVal) || 0;
    order.motoboyFee = fee;

    const updates = { motoboyFee: fee };
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const refKey = order.firebaseKey || order.id;
        firebase.database().ref(`orders/${refKey}`).update(updates);
    } else {
        fetch(`/api/orders/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    }

    renderReportsDashboard();
}

function buildGoogleMapsUrl(order) {
    if (order && order.location && order.location.latitude && order.location.longitude) {
        return `https://www.google.com/maps/dir/?api=1&destination=${order.location.latitude},${order.location.longitude}`;
    }
    const addressStr = buildMotoboyAddressQuery(order) || buildCustomerAddress(order);
    if (!addressStr) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressStr)}`;
}

function openGoogleMapsLink(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order || order.checkoutType !== 'delivery' || (!order.address && !order.location)) {
        alert('Este pedido não possui endereço de entrega.');
        return;
    }
    
    const mapsUrl = buildGoogleMapsUrl(order);
    if (!mapsUrl) {
        alert('Não foi possível gerar a localização para este endereço.');
        return;
    }
    
    window.open(mapsUrl, '_blank');
}

function buildCustomerAddress(order) {
    if (!order) return '';
    if (typeof order.address === 'string' && order.address.trim()) {
        return order.address.trim();
    }
    const addr = order.address || order.endereco || {};
    if (typeof addr === 'string' && addr.trim()) return addr.trim();

    const rua = addr.street || addr.rua || addr.logradouro || '';
    const numero = addr.number || addr.numero || '';
    const bairro = addr.neighborhood || addr.bairro || '';
    const cidade = addr.city || addr.cidade || '';
    const estado = addr.state || addr.estado || addr.uf || '';
    const cep = addr.cep || addr.zip || '';
    const ref = addr.reference || addr.complemento || addr.referencia || addr.obs || '';

    const parts = [];
    if (rua) {
        if (numero) {
            parts.push(`${rua}, ${numero}`);
        } else {
            parts.push(rua);
        }
    } else if (numero) {
        parts.push(`Número ${numero}`);
    }

    if (bairro) parts.push(`Bairro ${bairro}`);
    if (cidade) parts.push(cidade);
    if (estado) parts.push(estado);
    if (cep) parts.push(`CEP ${cep}`);
    if (ref) parts.push(`Ref: ${ref}`);

    if (parts.length === 0 && order.fullAddress) {
        return String(order.fullAddress).trim();
    }

    return parts.join(', ');
}

function sendToMotoboy(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) {
        alert('Pedido não encontrado.');
        return;
    }
    
    const fullAddress = buildCustomerAddress(order);
    if (!fullAddress || fullAddress.trim() === '') {
        alert("Endereço do cliente não informado.");
        return;
    }

    const motoboys = getActiveMotoboys();
    let assignedName = order.assignedMotoboyName || '';
    let assignedWhatsapp = (order.assignedMotoboyWhatsapp || '').replace(/\D/g, '');
    
    if (!assignedWhatsapp) {
        if (motoboys.length === 1) {
            assignedName = motoboys[0].name;
            assignedWhatsapp = (motoboys[0].whatsapp || '').replace(/\D/g, '');
            if (assignedWhatsapp) {
                assignMotoboyToOrder(order.id, motoboys[0].id);
            }
        } else if (motoboys.length > 1) {
            let promptText = `Selecione o Motoboy para esta entrega:\n\n`;
            motoboys.forEach((m, idx) => {
                promptText += `${idx + 1}. ${m.name}\n`;
            });
            const choice = prompt(promptText + `\nDigite o número do motoboy (1 a ${motoboys.length}):`, '1');
            const choiceIdx = parseInt(choice) - 1;
            if (motoboys[choiceIdx] && motoboys[choiceIdx].whatsapp) {
                assignedName = motoboys[choiceIdx].name;
                assignedWhatsapp = (motoboys[choiceIdx].whatsapp || '').replace(/\D/g, '');
                assignMotoboyToOrder(order.id, motoboys[choiceIdx].id);
            }
        }
    }

    if (!assignedWhatsapp) {
        alert("Nenhum motoboy selecionado ou sem WhatsApp cadastrado.");
        return;
    }

    let mapsUrl = '';
    let mapsLabel = '🗺️ ABRIR NO GOOGLE MAPS:';
    if (order.location && order.location.latitude && order.location.longitude) {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${order.location.latitude},${order.location.longitude}`;
        mapsLabel = '📍 LOCALIZAÇÃO GPS:';
    } else {
        mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(fullAddress);
    }

    const clientName = order.clientName || order.nomeCliente || order.customerName || 'Cliente';
    const clientPhone = order.clientPhone || order.telefoneCliente || order.phone || 'Não informado';

    const motoboyFeeVal = (order.motoboyFee !== undefined && order.motoboyFee !== null)
        ? Number(order.motoboyFee)
        : Number(order.deliveryFee || order.taxaEntrega || 0);

    const deliveryFeeVal = Number(order.deliveryFee || order.taxaEntrega || 0);

    let itemsText = '';
    const orderItems = order.items || order.cart || [];
    if (Array.isArray(orderItems) && orderItems.length > 0) {
        itemsText = orderItems.map(item => {
            if (item.type === 'custom_pizza') {
                const flavors = item.flavorNames ? item.flavorNames.join(' / ') : (item.name || item.titulo);
                const border = item.borderName ? ` (${item.borderName})` : '';
                const notes = item.notes ? ` [Obs: ${item.notes}]` : '';
                return `• ${item.quantity || 1}x ${item.name || item.titulo} (${flavors})${border}${notes}`;
            } else {
                const adicionaisText = getItemAdicionaisText(item);
                const adds = adicionaisText ? ` (+ ${adicionaisText})` : '';
                const notes = item.notes ? ` [Obs: ${item.notes}]` : '';
                return `• ${item.quantity || 1}x ${item.name || item.titulo || 'Item'}${adds}${notes}`;
            }
        }).join('\n');
    } else if (typeof orderItems === 'string') {
        itemsText = orderItems;
    } else {
        itemsText = 'Não especificado';
    }

    const msg = `🛵 FINA MASSA PIZZARIA

📦 NOVA ENTREGA

📋 Pedido #${order.id}

👤 Cliente:
${clientName}

📞 WhatsApp:
${clientPhone}

📍 Endereço:
${fullAddress}

${mapsLabel}
${mapsUrl}

💰 Corrida:
R$ ${motoboyFeeVal.toFixed(2).replace('.', ',')}

🛍️ Itens:
${itemsText}

💵 Taxa de entrega:
R$ ${deliveryFeeVal.toFixed(2).replace('.', ',')}`;

    let phoneNum = assignedWhatsapp.replace(/\D/g, '');
    if (phoneNum.length === 10 || phoneNum.length === 11) {
        phoneNum = '55' + phoneNum;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
}

function shareAddressToMotoboy(orderId) {
    sendToMotoboy(orderId);
}

/* ==========================================================================
   Order State Updates
   ========================================================================== */
function updateOrderStatus(id, newStatus) {
    const order = orders.find(o => String(o.id) === String(id) || String(o.firebaseKey) === String(id));
    
    // Se for comanda de mesa, atualiza todos os pedidos ativos vinculados a essa mesa
    let ticketsToUpdate = [];
    if (order && isTableOrderEntity(order)) {
        const tableNum = getCanonicalTableNumber(order);
        const isActive = isTableComandaOpen(order);
        if (isActive) {
            ticketsToUpdate = orders.filter(o => {
                const oIsTable = isTableOrderEntity(o);
                const oIsActive = isTableComandaOpen(o);
                const oTableNum = getCanonicalTableNumber(o);
                return oIsTable && oIsActive && oTableNum === tableNum;
            });
        }
    }
    if (ticketsToUpdate.length === 0 && order) {
        ticketsToUpdate = [order];
    }

    const updates = { 
        status: newStatus,
        hasNewItems: false 
    };
    // Para entrega ou balcão, 'Entregue' encerra o pedido; para mesa, 'Entregue' apenas indica item servido
    if (newStatus === 'Entregue' && (!order || !isTableOrderEntity(order))) {
        updates.closedAt = Date.now();
    }

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const promises = ticketsToUpdate.map(t => {
            const refKey = t.firebaseKey || t.id;
            return firebase.database().ref(`orders/${refKey}`).update(updates);
        });

        Promise.all(promises)
        .then(() => {
            triggerCentralAutoBackup();
        })
        .catch(err => {
            alert("Erro ao atualizar status no Firebase.");
            console.error(err);
        });
    } else {
        const promises = ticketsToUpdate.map(t => {
            return fetch(`/api/orders/${t.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        });
        Promise.all(promises)
        .then(() => {
            triggerCentralAutoBackup();
            fetchOrders(true); // Update silently
        })
        .catch(err => {
            alert("Erro ao atualizar status do pedido.");
            console.error(err);
        });
    }
}

/* ==========================================================================
   Gestão de Mesas e Comandas Contínuas (Salão)
   ========================================================================== */

function renderTablesDashboard() {
    const grid = document.getElementById('tablesDashboardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const allConfigured = getAllConfiguredTables();
    const totalTables = allConfigured.length;
    const tableCardsData = [];
    let occupiedCount = 0;
    let totalRevenueMesas = 0;

    const allOrders = Array.isArray(orders) ? orders : [];

    allConfigured.forEach(tableConf => {
        const numFormatted = tableConf.tableNum;
        const tableName = tableConf.tableName || `Mesa ${numFormatted}`;
        const isActiveTable = tableConf.active !== false;
        const tableState = (firebaseTablesState && (firebaseTablesState[numFormatted] || firebaseTablesState[`mesa_${numFormatted}`])) || null;

        const activeOrders = allOrders.filter(o => {
            const isTable = isTableOrderEntity(o);
            const isActive = isTableComandaOpen(o);
            if (!isTable || !isActive) return false;

            const oTableNum = getCanonicalTableNumber(o);
            return oTableNum === numFormatted;
        });

        const isOccupied = (tableState && tableState.status === 'aberta' && (Number(tableState.comandasCount) > 0 || Number(tableState.total) > 0)) || (activeOrders.length > 0);

        if (isOccupied) {
            occupiedCount++;
            activeOrders.sort((a, b) => (Number(a.timestamp || a.id) || 0) - (Number(b.timestamp || b.id) || 0));
            
            // ÚNICA FONTE DE VERDADE PARA O TOTAL DA MESA: Soma de todas as comandas ativas incluindo adicionais
            let totalMesa = 0;
            activeOrders.forEach(ord => {
                const cartArr = Array.isArray(ord.cart) ? ord.cart : Object.values(ord.cart || {});
                if (cartArr.length > 0) {
                    totalMesa += cartArr.reduce((sum, it) => sum + getItemCalculatedTotal(it), 0);
                } else {
                    totalMesa += Number(ord.total || 0);
                }
            });

            if (totalMesa === 0 && tableState && Number(tableState.total) > 0) {
                totalMesa = Number(tableState.total);
            }

            totalRevenueMesas += totalMesa;

            const firstOrder = activeOrders[0] || {};
            const comandaId = (tableState && tableState.tableSessionId) ? tableState.tableSessionId : (firstOrder.tableSessionId || firstOrder.comandaId || `mesa-${numFormatted}`);

            tableCardsData.push({
                num: numFormatted,
                name: tableName,
                isOccupied: true,
                isActive: isActiveTable,
                tableSessionId: comandaId,
                comandaId: comandaId,
                orders: activeOrders,
                total: totalMesa,
                comandasCount: activeOrders.length,
                waiterName: (tableState && tableState.waiterName) || firstOrder.waiterName || 'Garçom',
                openedAt: (tableState && tableState.openedAt) || firstOrder.time || 'Recente'
            });
        } else {
            tableCardsData.push({
                num: numFormatted,
                name: tableName,
                isOccupied: false,
                isActive: isActiveTable,
                tableSessionId: null,
                comandaId: null,
                orders: [],
                total: 0,
                comandasCount: 0,
                waiterName: null,
                openedAt: null
            });
        }
    });

    // Atualiza indicadores do cabeçalho
    const activeTablesCount = allConfigured.filter(t => t.active !== false).length;
    const occupiedEl = document.getElementById('tablesOccupiedCount');
    const freeEl = document.getElementById('tablesFreeCount');
    const revEl = document.getElementById('tablesTotalRevenue');

    if (occupiedEl) occupiedEl.innerText = occupiedCount;
    if (freeEl) freeEl.innerText = Math.max(0, activeTablesCount - occupiedCount);
    if (revEl) revEl.innerText = `R$ ${totalRevenueMesas.toFixed(2).replace('.', ',')}`;

    // Renderiza cada card de mesa
    tableCardsData.forEach(table => {
        const card = document.createElement('div');
        card.className = `table-dashboard-card ${table.isOccupied ? 'occupied' : 'free'}`;

        if (table.isOccupied) {
            card.style.cssText = 'background: var(--bg-card); border: 1px solid rgba(245, 166, 35, 0.45); box-shadow: 0 6px 20px rgba(245, 166, 35, 0.12); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 14px; position: relative;';

            let comandasListHTML = '';
            table.orders.forEach((ord, oIdx) => {
                const cNum = ord.comandaNum || (oIdx + 1);
                const cClient = ord.clientName || `Comanda ${String(cNum).padStart(2, '0')}`;
                const cRound = Number(ord.roundsCount || ord.round) || 1;
                const cTotal = Number(ord.total || 0).toFixed(2).replace('.', ',');
                const itemsListStr = (ord.cart || []).map(it => `• ${it.quantity}x ${it.name}${it.round ? ` (R${it.round})` : ''}`).join('<br>');
                const orderKey = ord.firebaseKey || ord.id;

                comandasListHTML += `
                    <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: var(--text-main); font-size: 13px; margin-bottom: 4px;">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <span style="background: var(--primary-light); color: #ffb74d; font-size: 11px; padding: 1px 5px; border-radius: 3px;">#${cNum}</span>
                                <strong>${cClient}</strong>
                                <span style="font-size: 11px; color: var(--accent-gold); background: var(--accent-gold-light); padding: 1px 6px; border-radius: 10px;">${cRound}ª Rodada</span>
                            </span>
                            <span style="color: #81c784; font-size: 14px; font-weight: 800;">R$ ${cTotal}</span>
                        </div>
                        <div style="color: var(--text-light); font-size: 11px; line-height: 1.4; margin: 6px 0;">
                            ${itemsListStr || 'Nenhum item'}
                        </div>
                        ${(ord.generalNotes || ord.notes) ? `
                            <div style="color: #ffe082; font-size: 11px; margin-top: 4px; border-top: 1px dashed var(--border-color); padding-top: 2px;">
                                Obs: ${ord.generalNotes || ord.notes}
                            </div>
                        ` : ''}
                        <div style="display: flex; justify-content: flex-end; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
                            <button type="button" onclick="finalizeTableComanda('${orderKey}')" style="background: rgba(46, 125, 50, 0.2); color: #81c784; border: 1px solid rgba(76, 175, 80, 0.4); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <span class="material-symbols-rounded" style="font-size: 14px;">receipt_long</span>
                                <span>Finalizar Comanda</span>
                            </button>
                        </div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px; color: var(--text-main); display: flex; align-items: center; gap: 8px; font-weight: 800;">
                            <span class="material-symbols-rounded" style="color: #f5a623;">restaurant</span>
                            ${table.name}
                        </h3>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                            Garçom: <strong style="color: var(--text-light);">${table.waiterName}</strong> • Aberta às ${table.openedAt}
                        </div>
                    </div>
                    <span style="background: rgba(76, 175, 80, 0.15); color: #4caf50; border: 1px solid rgba(76, 175, 80, 0.4); font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">
                        🔴 ${table.comandasCount} COMANDA${table.comandasCount > 1 ? 'S' : ''}
                    </span>
                </div>

                <div style="background: rgba(245, 166, 35, 0.08); border: 1px solid rgba(245, 166, 35, 0.25); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: 600; color: var(--text-light);">Total Geral da Mesa:</span>
                    <span style="font-size: 22px; font-weight: 900; color: #ffb74d; font-family: var(--font-display);">
                        R$ ${table.total.toFixed(2).replace('.', ',')}
                    </span>
                </div>

                <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                    Comandas na Mesa (${table.orders.length}):
                </div>

                <div style="max-height: 220px; overflow-y: auto; padding-right: 4px;">
                    ${comandasListHTML || '<div style="color: var(--text-muted); font-size: 11px;">Aguardando pedidos...</div>'}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-color);">
                    <button type="button" onclick="printTableComandaSummary('${table.num}')" style="background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-color); padding: 9px 10px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 16px;">print</span>
                        <span>Imprimir</span>
                    </button>
                    <button type="button" onclick="finalizeTableComanda('${table.num}')" style="background: linear-gradient(135deg, #2e7d32, #1b5e20); color: #ffffff; border: 1px solid rgba(76, 175, 80, 0.4); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(46, 125, 50, 0.3);">
                        <span class="material-symbols-rounded" style="font-size: 16px;">point_of_sale</span>
                        <span>Finalizar Mesa</span>
                    </button>
                </div>
            `;
        } else if (!table.isActive) {
            card.style.cssText = 'background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 160px; opacity: 0.55;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; font-weight: 700;">
                        <span class="material-symbols-rounded" style="color: var(--text-muted);">block</span>
                        ${table.name}
                    </h3>
                    <span style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border-color); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                        ⚪ Desativada
                    </span>
                </div>
                <div style="margin: 20px 0; color: var(--text-muted); font-size: 12px;">
                    Mesa desativada. Não aparece para atendimento no Garçom.
                </div>
                <div style="border-top: 1px dashed var(--border-color); padding-top: 8px; font-size: 11px; color: var(--text-light); font-weight: 600;">
                    Ative em "Gerenciar Mesas" para liberar.
                </div>
            `;
        } else {
            card.style.cssText = 'background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 160px; opacity: 0.85;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px; color: var(--text-main); display: flex; align-items: center; gap: 8px; font-weight: 700;">
                        <span class="material-symbols-rounded" style="color: var(--text-muted);">table_restaurant</span>
                        ${table.name}
                    </h3>
                    <span style="background: rgba(76, 175, 80, 0.15); color: #4caf50; border: 1px solid rgba(76, 175, 80, 0.4); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                        🟢 Livre
                    </span>
                </div>
                <div style="margin: 20px 0; color: var(--text-muted); font-size: 12px;">
                    Mesa disponível para atendimento e novas comandas pelo Garçom.
                </div>
                <div style="border-top: 1px dashed var(--border-color); padding-top: 8px; font-size: 11px; color: #81c784; font-weight: 600;">
                    ✓ Pronta para novos clientes
                </div>
            `;
        }

        grid.appendChild(card);
    });
}

function finalizeTableComanda(targetIdOrTableNum) {
    // 1. Verifica se o parâmetro é um ID de pedido/comanda individual ou o número da mesa
    const isIndividualOrder = orders.some(o => String(o.id) === String(targetIdOrTableNum) || String(o.firebaseKey) === String(targetIdOrTableNum));

    let relatedOrders = [];
    let tableNum = null;
    let isSingleComandaFinalize = false;

    if (isIndividualOrder) {
        // Finalizar comanda individual
        const singleOrder = orders.find(o => String(o.id) === String(targetIdOrTableNum) || String(o.firebaseKey) === String(targetIdOrTableNum));
        tableNum = getCanonicalTableNumber(singleOrder);
        const sessionKey = singleOrder.tableSessionId || singleOrder.comandaId || singleOrder.id;
        relatedOrders = orders.filter(o => isTableOrderEntity(o) && isTableComandaOpen(o) && (o.tableSessionId === sessionKey || o.comandaId === sessionKey || String(o.id) === String(singleOrder.id) || String(o.firebaseKey) === String(singleOrder.firebaseKey)));
        isSingleComandaFinalize = true;
    } else {
        // Finalizar todas as comandas da mesa
        tableNum = getCanonicalTableNumber(targetIdOrTableNum);
        relatedOrders = orders.filter(o => isTableOrderEntity(o) && isTableComandaOpen(o) && getCanonicalTableNumber(o) === tableNum);
        isSingleComandaFinalize = false;
    }

    if (relatedOrders.length === 0) {
        alert("Nenhum pedido aberto encontrado.");
        return;
    }

    const tableState = firebaseTablesState[tableNum];
    const firstOrder = relatedOrders[0];
    const clientName = isSingleComandaFinalize ? (firstOrder.clientName || `Comanda ${firstOrder.comandaNum || 1}`) : `Mesa ${tableNum}`;

    let totalAcumulado = 0;
    relatedOrders.forEach(ord => {
        const cartArr = Array.isArray(ord.cart) ? ord.cart : Object.values(ord.cart || {});
        if (cartArr.length > 0) {
            totalAcumulado += cartArr.reduce((sum, it) => sum + getItemCalculatedTotal(it), 0);
        } else {
            totalAcumulado += Number(ord.total || 0);
        }
    });

    const totalFormatted = `R$ ${totalAcumulado.toFixed(2).replace('.', ',')}`;

    const promptTitle = isSingleComandaFinalize 
        ? `🧾 FINALIZAR COMANDA — ${clientName.toUpperCase()} (MESA ${tableNum})`
        : `🧾 FINALIZAR TODAS AS COMANDAS — MESA ${tableNum}`;

    const choice = prompt(
        `${promptTitle}\n\n` +
        `Total a Pagar: ${totalFormatted}\n\n` +
        `Selecione a forma de pagamento do cliente:\n` +
        `1 — Pix\n` +
        `2 — Cartão (Maquininha)\n` +
        `3 — Dinheiro\n\n` +
        `Digite 1, 2 ou 3 para confirmar o recebimento:`,
        '1'
    );

    if (choice === null) return;

    let paymentMethod = 'pix';
    let paymentLabel = 'Pix';
    if (choice.trim() === '2') {
        paymentMethod = 'card';
        paymentLabel = 'Cartão (Maquininha)';
    } else if (choice.trim() === '3') {
        paymentMethod = 'cash';
        paymentLabel = 'Dinheiro';
    }

    const orderUpdates = {
        status: 'Entregue',
        comandaStatus: 'fechada',
        paymentMethod: paymentMethod,
        closedAt: Date.now(),
        hasNewItems: false
    };

    // Identifica outras comandas que ainda continuam abertas na mesma mesa
    const remainingOpenOrders = orders.filter(o => {
        if (!isTableOrderEntity(o) || !isTableComandaOpen(o)) return false;
        if (getCanonicalTableNumber(o) !== tableNum) return false;
        return !relatedOrders.some(ro => String(ro.id) === String(o.id) || String(ro.firebaseKey) === String(o.firebaseKey));
    });

    let newTablePayload;
    if (remainingOpenOrders.length > 0) {
        // Mesa continua aberta com as comandas restantes
        const remainingTotal = remainingOpenOrders.reduce((sum, o) => {
            const cArr = Array.isArray(o.cart) ? o.cart : Object.values(o.cart || {});
            if (cArr.length > 0) {
                return sum + cArr.reduce((s, it) => s + (Number(it.totalPrice) || (Number(it.singlePrice) * (Number(it.quantity) || 1)) || 0), 0);
            }
            return sum + Number(o.total || 0);
        }, 0);

        newTablePayload = {
            tableNum: tableNum,
            tableName: `Mesa ${tableNum}`,
            status: 'aberta',
            tableSessionId: remainingOpenOrders[0].tableSessionId || remainingOpenOrders[0].comandaId || `mesa-${tableNum}`,
            waiterName: remainingOpenOrders[0].waiterName || 'Garçom',
            openedAt: remainingOpenOrders[0].openedAt || remainingOpenOrders[0].time,
            lastOrderAt: remainingOpenOrders[remainingOpenOrders.length - 1].lastOrderAt || remainingOpenOrders[remainingOpenOrders.length - 1].time,
            total: remainingTotal,
            comandasCount: remainingOpenOrders.length,
            orderIds: remainingOpenOrders.map(o => o.id || o.firebaseKey)
        };
    } else {
        // Mesa fica livre
        newTablePayload = {
            tableNum: tableNum,
            tableName: `Mesa ${tableNum}`,
            status: 'livre',
            tableSessionId: null,
            waiterName: null,
            openedAt: null,
            lastOrderAt: null,
            total: 0,
            comandasCount: 0,
            orderIds: [],
            lastClosedSession: {
                total: totalAcumulado,
                closedAt: Date.now(),
                paymentMethod: paymentMethod
            }
        };
    }

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const promises = relatedOrders.map(tOrder => {
            const refKey = (tOrder && tOrder.firebaseKey) ? tOrder.firebaseKey : tOrder.id;
            return firebase.database().ref(`orders/${refKey}`).update(orderUpdates);
        });

        promises.push(
            firebase.database().ref(`tables/${tableNum}`).set(newTablePayload)
        );

        Promise.all(promises)
        .then(() => {
            firebaseTablesState[tableNum] = newTablePayload;
            triggerCentralAutoBackup();
            showToast(`${clientName} encerrada (${paymentLabel}) com sucesso!`, 'success');
            renderTablesDashboard();
            renderOrdersList();
        })
        .catch(err => {
            console.error("Erro ao encerrar comanda no Firebase:", err);
            alert("Erro ao encerrar comanda no Firebase.");
        });
    } else {
        const promises = relatedOrders.map(tOrder => {
            return fetch(`/api/orders/${tOrder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderUpdates)
            });
        });

        Promise.all(promises)
        .then(() => {
            triggerCentralAutoBackup();
            fetchOrders(true);
            showToast(`${clientName} encerrada (${paymentLabel}) com sucesso!`, 'success');
            renderTablesDashboard();
            renderOrdersList();
        })
        .catch(err => {
            console.error("Erro ao encerrar comanda:", err);
            alert("Erro ao encerrar comanda.");
        });
    }
}

function printTableComandaSummary(comandaIdOrTable) {
    const tableNum = getCanonicalTableNumber(comandaIdOrTable);
    const relatedOrders = orders.filter(o => {
        const isTableOrder = isTableOrderEntity(o);
        if (!isTableOrder) return false;
        const oTableNum = getCanonicalTableNumber(o);
        const isMatchComanda = o.comandaId && (o.comandaId === comandaIdOrTable);
        const isMatchTable = oTableNum === tableNum;
        const isMatchId = String(o.id) === String(comandaIdOrTable) || String(o.firebaseKey) === String(comandaIdOrTable);
        return (isMatchComanda || isMatchTable || isMatchId);
    });

    if (relatedOrders.length === 0) {
        alert("Comanda não encontrada para impressão.");
        return;
    }

    const firstOrder = relatedOrders[0];
    const normNum = getCanonicalTableNumber(firstOrder) || tableNum;
    const tableLabel = normNum ? `Mesa ${normNum}` : (firstOrder.table || 'Mesa');
    const comandaId = firstOrder.comandaId || comandaIdOrTable;
    
    const tableState = firebaseTablesState[normNum];
    let totalAcumulado = 0;
    if (tableState && Number(tableState.total) > 0 && tableState.status === 'aberta') {
        totalAcumulado = Number(tableState.total);
    } else {
        const consolidatedCart = [];
        relatedOrders.forEach(ord => {
            const cartArr = Array.isArray(ord.cart) ? ord.cart : Object.values(ord.cart || {});
            cartArr.forEach(it => consolidatedCart.push(it));
        });
        if (consolidatedCart.length > 0) {
            totalAcumulado = consolidatedCart.reduce((sum, it) => sum + getItemCalculatedTotal(it), 0);
        } else if (relatedOrders.length > 0) {
            totalAcumulado = Number(relatedOrders[0].total || 0);
        }
    }

    let allItemsHTML = '';
    relatedOrders.forEach((ord) => {
        allItemsHTML += `
            <div style="margin-top: 8px; padding-bottom: 6px; border-bottom: 1px dashed #777;">
                <div style="font-weight: 800; font-size: 12px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>PEDIDO #${ord.id} (${ord.time || ''})</span>
                    <span>${ord.waiterName ? `Garçom: ${ord.waiterName}` : 'Salão'}</span>
                </div>
        `;
        (ord.cart || []).forEach(item => {
            const itemTotal = getItemCalculatedTotal(item);
            const adicionaisText = getItemAdicionaisText(item);
            allItemsHTML += `
                <div class="ticket-item" style="margin-bottom: 5px;">
                    <div class="ticket-item-header">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>R$ ${itemTotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    ${adicionaisText ? `<div class="ticket-item-adicionais" style="font-size: 11px; font-weight: bold; margin-top: 2px; padding-left: 6px;">+ ADICIONAIS: ${adicionaisText.toUpperCase()}</div>` : ''}
                    ${item.notes ? `<div class="ticket-item-notes">OBS: "${item.notes}"</div>` : ''}
                </div>
            `;
        });
        allItemsHTML += `</div>`;
    });

    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR');
    const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const ticketHTML = `
        <div class="ticket-header">
            <div class="ticket-title">${(menuData?.settings?.companyName || 'FINA MASSA PIZZARIA').toUpperCase()}</div>
            <div class="ticket-subtitle">Pizzas Artesanais • Porções • Bebidas</div>
            <div class="ticket-subtitle">${menuData?.settings?.address || 'Atendimento Presencial'}</div>
            <div class="ticket-contact">WhatsApp: ${menuData?.settings?.whatsappFormatted || menuData?.settings?.whatsapp || '(54) 99698-5724'}</div>
            <div class="ticket-separator"></div>
            <div class="ticket-order-badge">EXTRATO DE CONTA • ${tableLabel.toUpperCase()}</div>
            <div class="ticket-meta-info">Comanda / Cliente: <b>${(firstOrder.clientName || 'Cliente').toUpperCase()}</b></div>
            <div class="ticket-meta-info">Emissão: ${formattedDate} às ${formattedTime}</div>
            ${(firstOrder.pickupTime || firstOrder.horarioRetirada) ? `
                <div class="ticket-meta-info" style="margin-top: 4px; font-weight: 900; border: 1.5px dashed #000; padding: 3px 6px; background: #f5f5f5;">
                    🕐 PREVISÃO / HORÁRIO: ${(firstOrder.pickupTime || firstOrder.horarioRetirada).toUpperCase()}
                </div>
            ` : ''}
        </div>
        
        <div class="ticket-separator"></div>
        
        <div>
            <div class="ticket-section-title">Consumo Detalhado da Mesa</div>
            <div>
                ${allItemsHTML}
            </div>
        </div>
        
        <div class="ticket-totals" style="margin-top: 10px; border-top: 2px solid #000; padding-top: 6px;">
            <div class="ticket-total-row grand-total">
                <span>TOTAL DA MESA:</span>
                <span>R$ ${totalAcumulado.toFixed(2).replace('.', ',')}</span>
            </div>
        </div>
        
        <div class="ticket-footer" style="margin-top: 14px;">
            <span>CONFERÊNCIA DE CONTA • NÃO É DOCUMENTO FISCAL</span><br>
            <span>FINA MASSA PIZZARIA - OBRIGADO PELA PREFERÊNCIA!</span>
        </div>
    `;

    openThermalPrintWindow(ticketHTML, `Extrato - ${tableLabel}`);
}

function closeTableComanda(orderId) {
    finalizeTableComanda(orderId);
}


function notifyCustomerReady(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        alert("Pedido não encontrado.");
        return;
    }
    
    let phone = order.clientPhone.replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) {
        phone = '55' + phone;
    }
    
    let text = '';
    if (order.checkoutType === 'delivery') {
        text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* da Fina Massa Pizzaria está pronto e saindo para entrega! 🛵💨`;
    } else {
        text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* da Fina Massa Pizzaria está pronto e você já pode vir retirar! 🍔🥤`;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

/* ==========================================================================
   Horário de Retirada / Previsão Combinada (Manual pela Equipe)
   ========================================================================== */
function saveOrderPickupTime(orderId, customVal = null) {
    const order = orders.find(o => String(o.id) === String(orderId) || String(o.firebaseKey) === String(orderId));
    if (!order) {
        console.warn("Pedido não encontrado para salvar horário:", orderId);
        return;
    }
    
    let timeVal = customVal;
    if (timeVal === null) {
        const input = document.getElementById(`pickupInput_${order.id}`) || document.getElementById(`pickupInput_${orderId}`);
        timeVal = input ? input.value.trim() : '';
    }
    
    order.pickupTime = timeVal;
    order.horarioRetirada = timeVal;
    
    const updates = { 
        pickupTime: timeVal,
        horarioRetirada: timeVal
    };
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const refKey = order.firebaseKey || order.id;
        firebase.database().ref(`orders/${refKey}`).update(updates)
        .then(() => {
            triggerCentralAutoBackup();
            if (timeVal) {
                showToast(`Horário combinado (${timeVal}) salvo com sucesso!`, 'success');
            } else {
                showToast('Horário combinado removido.', 'warning');
            }
            renderOrdersList();
        })
        .catch(err => {
            console.error("Erro ao salvar horário no Firebase:", err);
            alert("Erro ao salvar horário no Firebase: " + err.message);
        });
    } else {
        triggerCentralAutoBackup();
        if (timeVal) {
            showToast(`Horário combinado (${timeVal}) salvo localmente!`, 'success');
        } else {
            showToast('Horário combinado removido.', 'warning');
        }
        renderOrdersList();
    }
}

function savePickupTime(orderId, customVal = null) {
    saveOrderPickupTime(orderId, customVal);
}
window.savePickupTime = savePickupTime;
window.saveOrderPickupTime = saveOrderPickupTime;

function editOrderPickupTime(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    
    const currentVal = order.pickupTime || order.horarioRetirada || '';
    const newTime = prompt("Informe o novo horário combinado de retirada (ex: 19:50) ou deixe em branco para limpar:", currentVal);
    if (newTime === null) return; // cancelado
    
    saveOrderPickupTime(orderId, newTime.trim());
}

function notifyCustomerPickupTime(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order || !order.clientPhone) {
        alert("Telefone do cliente não encontrado.");
        return;
    }
    
    let phone = order.clientPhone.replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) {
        phone = '55' + phone;
    }
    
    const pickupTime = (order.pickupTime || order.horarioRetirada || '').trim();
    if (!pickupTime) {
        alert("Defina o horário de retirada antes de avisar o cliente.");
        return;
    }

    const text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* da Fina Massa Pizzaria foi recebido. Devido ao volume de pedidos, combinamos a retirada para às *${pickupTime}*. Obrigado! 🍔`;
    
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

/* ==========================================================================
   Clear/Reset All Orders Functionality
   ========================================================================== */
function confirmClearAllOrders() {
    const confirmation = confirm("⚠️ ATENÇÃO: Tem certeza absoluta de que deseja ZERAR todos os pedidos do painel? \n\nEsta ação apagará permanentemente todos os registros de pedidos e é irreversível!");
    
    if (confirmation) {
        const doubleConfirmation = confirm("Confirme novamente: Deseja REALMENTE excluir todos os pedidos de forma permanente?");
        if (doubleConfirmation) {
            clearAllOrders();
        }
    }
}

function clearAllOrders() {
    showLoading('Zerando pedidos no servidor...');
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        // Clear from Firebase Realtime Database
        firebase.database().ref('orders').remove()
        .then(() => {
            hideLoading();
            alert("Sucesso: Todos os pedidos foram apagados no Firebase!");
            orders = [];
            knownOrderIds.clear();
            updateIndicators();
            renderOrdersList();
            triggerCentralAutoBackup();
        })
        .catch(err => {
            console.warn("Remoção direta ref('orders') falhou, tentando exclusão por nós individuais...", err);
            
            // Fallback: Delete each order node individually if root delete was restricted
            if (orders.length === 0) {
                hideLoading();
                alert("Nenhum pedido para apagar.");
                return;
            }
            
            const promises = orders.map(o => {
                const key = o.firebaseKey || o.id;
                return firebase.database().ref(`orders/${key}`).remove();
            });
            
            Promise.all(promises)
            .then(() => {
                hideLoading();
                alert("Sucesso: Todos os pedidos foram apagados!");
                orders = [];
                knownOrderIds.clear();
                updateIndicators();
                renderOrdersList();
                triggerCentralAutoBackup();
            })
            .catch(fallbackErr => {
                hideLoading();
                alert("Erro ao zerar pedidos no Firebase. Verifique suas permissões.");
                console.error("Erro no fallback de exclusão de pedidos:", fallbackErr);
            });
        });
    } else {
        // Clear from Local Express API
        fetch('/api/orders', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => {
            if (!res.ok) throw new Error("Erro na requisição ao servidor.");
            return res.json();
        })
        .then(data => {
            hideLoading();
            alert("Sucesso: Todos os pedidos locais foram apagados!");
            orders = [];
            knownOrderIds.clear();
            updateIndicators();
            renderOrdersList();
            triggerCentralAutoBackup();
        })
        .catch(err => {
            hideLoading();
            alert("Erro ao zerar pedidos locais.");
            console.error(err);
        });
    }
}

/* ==========================================================================
   Thermal Receipt Printing Integration (Pop-up Window & Pro Formatting)
   ========================================================================== */
function getThermalPrintCSS() {
    return `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #eef1f5;
            font-family: 'Courier New', Courier, monospace, sans-serif;
            color: #000000;
            font-size: 13px;
            line-height: 1.35;
            padding: 20px 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .thermal-ticket-wrapper {
            background: #ffffff;
            width: 80mm;
            max-width: 100%;
            padding: 16px 14px;
            border: 1px dashed #777777;
            box-shadow: 0 4px 15px rgba(0,0,0,0.12);
        }
        .screen-buttons-bar {
            margin-top: 16px;
            display: flex;
            gap: 12px;
            justify-content: center;
        }
        .btn-print-action {
            background: #74112B;
            color: #ffffff;
            border: none;
            padding: 10px 22px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(116, 17, 43, 0.35);
        }
        .btn-close-action {
            background: #555555;
            color: #ffffff;
            border: none;
            padding: 10px 18px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }
        .ticket-header { text-align: center; margin-bottom: 8px; }
        .ticket-title { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; }
        .ticket-subtitle { font-size: 11px; color: #222; margin-top: 2px; }
        .ticket-contact { font-size: 11.5px; font-weight: 700; margin-top: 2px; }
        .ticket-separator { border-top: 1px dashed #000000; margin: 8px 0; }
        .ticket-double-separator { border-top: 2px solid #000000; margin: 8px 0; }
        .ticket-order-badge {
            display: inline-block;
            border: 2px solid #000000;
            padding: 4px 10px;
            font-size: 15px;
            font-weight: 900;
            margin: 6px 0;
            text-align: center;
        }
        .ticket-meta-info { font-size: 11.5px; margin-top: 2px; }
        .ticket-section-title {
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            border-bottom: 1px solid #000000;
            padding-bottom: 2px;
            margin-bottom: 6px;
        }
        .ticket-info-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
        .ticket-info-label { font-weight: 800; color: #000000; }
        .ticket-item { margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px dotted #cccccc; }
        .ticket-item:last-child { border-bottom: none; }
        .ticket-item-header { display: flex; justify-content: space-between; font-weight: 800; font-size: 13.5px; }
        .ticket-item-adicionais {
            font-size: 12px;
            font-weight: 800;
            color: #000000;
            margin-top: 2px;
            padding-left: 4px;
            line-height: 1.3;
        }
        .ticket-item-notes {
            font-size: 11.5px;
            font-style: italic;
            background: #f4f4f4;
            border-left: 2px solid #000000;
            padding: 2px 6px;
            margin-top: 3px;
        }
        .ticket-totals { margin-top: 8px; }
        .ticket-total-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px; }
        .ticket-total-row.grand-total {
            font-size: 16px;
            font-weight: 900;
            border-top: 2px solid #000000;
            border-bottom: 2px solid #000000;
            padding: 6px 0;
            margin-top: 6px;
        }
        .ticket-footer {
            text-align: center;
            font-size: 11px;
            font-weight: 700;
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px dashed #000000;
        }
        @media print {
            body { background: transparent; padding: 0; }
            .thermal-ticket-wrapper { border: none; box-shadow: none; padding: 0; width: 100%; }
            .no-print { display: none !important; }
        }
    `;
}

function openThermalPrintWindow(contentHtml, documentTitle = 'Impressão - Fina Massa Pizzaria') {
    const oldSection = document.getElementById('printSection');
    if (oldSection) oldSection.innerHTML = '';

    const printWindow = window.open('', '_blank', 'width=460,height=720,menubar=no,toolbar=no,location=no,status=no');
    if (!printWindow) {
        let printIframe = document.getElementById('thermalPrintIframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'thermalPrintIframe';
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = 'none';
            document.body.appendChild(printIframe);
        }
        const doc = printIframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${documentTitle}</title><style>${getThermalPrintCSS()}</style></head><body><div class="thermal-ticket-wrapper">${contentHtml}</div></body></html>`);
        doc.close();
        setTimeout(() => {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        }, 350);
        return;
    }

    printWindow.document.open();
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>${documentTitle}</title>
            <style>
                ${getThermalPrintCSS()}
            </style>
        </head>
        <body>
            <div class="thermal-ticket-wrapper">
                ${contentHtml}
            </div>
            <div class="screen-buttons-bar no-print">
                <button onclick="window.print()" class="btn-print-action">🖨️ Imprimir</button>
                <button onclick="window.close()" class="btn-close-action">Fechar Janela</button>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.focus();
                        window.print();
                    }, 350);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printOrderTicket(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    
    const isTableOrder = order.checkoutType === 'mesa' || !!order.table || !!order.mesa || order.origin === 'Garçom';
    const tableLabel = order.table || (order.mesa ? (String(order.mesa).toLowerCase().includes('mesa') ? order.mesa : `Mesa ${order.mesa}`) : 'Mesa Salão');

    let itemsHTML = '';
    const orderCart = order.cart || [];
    orderCart.forEach(item => {
        const itemPrice = getItemCalculatedTotal(item);
        const adicionaisText = getItemAdicionaisText(item);
        itemsHTML += `
            <div class="ticket-item">
                <div class="ticket-item-header">
                    <span>${item.quantity}x ${item.name}</span>
                    <span>R$ ${itemPrice.toFixed(2).replace('.', ',')}</span>
                </div>
                ${adicionaisText ? `<div class="ticket-item-adicionais">+ ADICIONAIS: ${adicionaisText.toUpperCase()}</div>` : ''}
                ${item.notes ? `<div class="ticket-item-notes">OBS: "${item.notes}"</div>` : ''}
            </div>
        `;
    });
    
    let addressHTML = 'RETIRADA NO BALCÃO';
    let entregaLabel = 'NÃO - RETIRADA NO BALCÃO';
    if (order.checkoutType === 'delivery' && order.address) {
        const addr = order.address;
        addressHTML = `
            ${addr.street ? addr.street.toUpperCase() : ''}, Nº ${addr.number || 'S/N'}<br>
            BAIRRO: ${addr.neighborhood ? addr.neighborhood.toUpperCase() : ''}
            ${addr.reference ? `<br>REF: ${addr.reference.toUpperCase()}` : ''}
        `;
        entregaLabel = 'SIM - TELE-ENTREGA';
    } else if (isTableOrder) {
        addressHTML = `MESA ${tableLabel.toUpperCase()} (CONSUMO NO LOCAL)`;
        entregaLabel = `CONSUMO NA MESA (${order.origin ? order.origin.toUpperCase() : 'GARÇOM'})`;
    }
    
    const pixKey = menuData?.settings?.pixKey || '';
    const payments = { 
        'pix': `PIX (CHAVE: ${pixKey})`, 
        'card': 'CARTÃO (MAQUININHA)', 
        'cash': 'DINHEIRO', 
        'mesa': 'PAGAMENTO NA MESA / CAIXA' 
    };
    let paymentHTML = payments[order.paymentMethod] || (order.paymentMethod ? (String(order.paymentMethod).toLowerCase() === 'pix' ? `PIX (CHAVE: ${pixKey})` : order.paymentMethod.toUpperCase()) : 'NA MESA / CAIXA');
    if (order.paymentMethod === 'cash' && order.cashChange) {
        paymentHTML += ` (TROCO PARA ${order.cashChange})`;
    }

    const generalNotesTicketHTML = (order.generalNotes || (isTableOrder && order.notes)) ? `
        <div style="margin-top: 6px; font-size: 11.5px; font-weight: bold; border: 1px dashed #000; padding: 4px; background: #fafafa;">
            OBS. GERAIS: ${(order.generalNotes || order.notes).toUpperCase()}
        </div>
    ` : '';
    
    const ticketHTML = `
        <div class="ticket-header">
            <div class="ticket-title">${(menuData?.settings?.companyName || 'FINA MASSA PIZZARIA').toUpperCase()}</div>
            <div class="ticket-subtitle">Pizzas Artesanais • Porções • Bebidas</div>
            <div class="ticket-subtitle">${menuData?.settings?.address || 'Atendimento Presencial & Delivery'}</div>
            <div class="ticket-contact">WhatsApp: ${menuData?.settings?.whatsappFormatted || menuData?.settings?.whatsapp || '(54) 99698-5724'}</div>
            <div class="ticket-separator"></div>
            <div class="ticket-order-badge">PEDIDO #${order.id} ${isTableOrder ? `• ${tableLabel.toUpperCase()}` : ''}</div>
            <div class="ticket-meta-info">Status: <b>${order.status.toUpperCase()}</b></div>
            <div class="ticket-meta-info">Data: ${order.date} | Horário: ${order.time}</div>
        </div>
        
        <div>
            <div class="ticket-section-title">Dados do Atendimento</div>
            <div class="ticket-info-row">
                <span class="ticket-info-label">CLIENTE/MESA:</span>
                <span style="font-weight: bold;">${order.clientName.toUpperCase()}</span>
            </div>
            ${!isTableOrder && order.clientPhone ? `
            <div class="ticket-info-row">
                <span class="ticket-info-label">TELEFONE:</span>
                <span>${order.clientPhone}</span>
            </div>
            ` : ''}
            <div class="ticket-info-row">
                <span class="ticket-info-label">TIPO:</span>
                <span>${entregaLabel}</span>
            </div>
            ${(order.origin === 'manual' || order.origem === 'manual' || order.canalOrigem) ? `
            <div class="ticket-info-row" style="background: #f0f0f0; padding: 3px 6px; font-weight: bold; border-left: 3px solid #000; margin: 4px 0;">
                <span class="ticket-info-label">ORIGEM:</span>
                <span>PEDIDO MANUAL (${(order.canalOrigem || 'ATENDIMENTO').toUpperCase()})</span>
            </div>
            ` : ''}
            ${(order.pickupTime || order.horarioRetirada) ? `
            <div class="ticket-info-row" style="margin-top: 5px; background: #eee; padding: 4px 6px; border: 1.5px dashed #000;">
                <span class="ticket-info-label" style="font-weight: 900; font-size: 12.5px;">🕐 PREVISÃO / HORÁRIO:</span>
                <span style="font-weight: 900; font-size: 13.5px;">${(order.pickupTime || order.horarioRetirada).toUpperCase()}</span>
            </div>
            ` : ''}
            <div style="margin-top: 5px;">
                <span class="ticket-info-label">LOCAL / ENDEREÇO:</span><br>
                <span style="font-size: 12px; font-weight: bold; line-height: 1.3;">${addressHTML}</span>
            </div>
            <div class="ticket-info-row" style="margin-top: 5px;">
                <span class="ticket-info-label">PAGAMENTO:</span>
                <span>${paymentHTML}</span>
            </div>
            ${generalNotesTicketHTML}
        </div>
        
        <div class="ticket-separator"></div>
        
        <div>
            <div class="ticket-section-title">Itens do Pedido</div>
            <div style="margin-top: 4px;">
                ${itemsHTML}
            </div>
        </div>
        
        <div class="ticket-totals">
            <div class="ticket-total-row">
                <span>SUBTOTAL:</span>
                <span>R$ ${Number(order.subtotal || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="ticket-total-row">
                <span>TAXA DE ENTREGA:</span>
                <span>${Number(order.deliveryFee || 0) === 0 ? 'GRÁTIS' : `R$ ${Number(order.deliveryFee).toFixed(2).replace('.', ',')}`}</span>
            </div>
            <div class="ticket-total-row grand-total">
                <span>TOTAL A PAGAR:</span>
                <span>R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}</span>
            </div>
        </div>
        
        <div class="ticket-footer">
            <span>OBRIGADO PELA PREFERÊNCIA!</span><br>
            <span>${isTableOrder ? 'FINA MASSA PIZZARIA - ATENDIMENTO DE MESA' : 'FINA MASSA PIZZARIA'}</span>
        </div>
    `;
    
    openThermalPrintWindow(ticketHTML, `Pedido #${order.id}`);
}

function printKitchenTicket(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    
    const isTableOrder = order.checkoutType === 'mesa' || !!order.table || !!order.mesa || order.origin === 'Garçom';
    const tableLabel = order.table || (order.mesa ? (String(order.mesa).toLowerCase().includes('mesa') ? order.mesa : `Mesa ${order.mesa}`) : 'Mesa Salão');

    let itemsHTML = '';
    const orderCart = order.cart || [];
    orderCart.forEach(item => {
        const adicionaisText = getItemAdicionaisText(item);
        itemsHTML += `
            <div style="margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px dashed #000;">
                <div style="font-weight: 900; font-size: 15px;">
                    <span>${item.quantity}x ${item.name.toUpperCase()}</span>
                </div>
                ${adicionaisText ? `
                    <div style="font-size: 13.5px; line-height: 1.4; margin-top: 4px; padding-left: 6px; font-weight: 900;">
                        ➕ ADICIONAIS: <span style="border: 1.5px solid #000; padding: 2px 6px; background: #fff; text-transform: uppercase;">${adicionaisText.toUpperCase()}</span>
                    </div>
                ` : ''}
                ${item.notes ? `
                    <div style="font-size: 13px; line-height: 1.4; margin-top: 4px; padding-left: 6px;">
                        • OBS: <span style="border: 1px solid #000; padding: 1px 5px; font-weight: bold; background: #f0f0f0;">"${item.notes.toUpperCase()}"</span>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    let tipoCozinha = order.checkoutType === 'delivery' ? '🚗 DELIVERY' : '🏪 RETIRADA NO BALCÃO';
    if (isTableOrder) {
        tipoCozinha = `🍽️ MESA / SALÃO (${order.origin ? order.origin.toUpperCase() : 'GARÇOM'})`;
    } else if (order.origin === 'manual' || order.origem === 'manual' || order.canalOrigem) {
        tipoCozinha += ` • MANUAL (${(order.canalOrigem || 'ATENDIMENTO').toUpperCase()})`;
    }

    const pickupKitchenHTML = (order.pickupTime || order.horarioRetirada) ? `
        <div style="margin-bottom: 10px; font-size: 15px; font-weight: 900; border: 2px solid #000; padding: 5px 8px; text-align: center; background: #f0f0f0;">
            🕐 PREVISÃO / HORÁRIO: ${(order.pickupTime || order.horarioRetirada).toUpperCase()}
        </div>
    ` : '';

    const generalNotesKitchenHTML = (order.generalNotes || (isTableOrder && order.notes)) ? `
        <div style="margin-bottom: 10px; font-size: 13px; font-weight: bold; border: 2px solid #000; padding: 6px; text-align: center; background: #fff;">
            OBS. DA MESA: ${(order.generalNotes || order.notes).toUpperCase()}
        </div>
    ` : '';

    const ticketHTML = `
        <div class="ticket-header" style="text-align: center; margin-bottom: 12px; border-bottom: 2px dashed #000; padding-bottom: 8px;">
            <div class="ticket-title" style="font-size: 19px; font-weight: 900; letter-spacing: 1px;">COZINHA &amp; PRODUÇÃO</div>
            <div class="ticket-separator"></div>
            <div style="font-size: 22px; font-weight: 900; margin: 4px 0;">PEDIDO #${order.id}</div>
            ${isTableOrder ? `<div style="font-size: 17px; font-weight: 900; background: #000; color: #fff; padding: 4px; margin: 4px 0; border-radius: 3px;">🍽️ ${tableLabel.toUpperCase()}</div>` : ''}
            <div style="font-size: 11.5px; font-family: monospace;">Data: ${order.date} | Horário: ${order.time}</div>
        </div>
        
        <div style="margin-bottom: 10px; font-size: 13px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: bold;">IDENTIFICAÇÃO:</span>
                <span style="font-weight: bold; font-size: 14px;">${order.clientName.toUpperCase()}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: bold;">ORIGEM/TIPO:</span>
                <span style="font-weight: bold;">${tipoCozinha}</span>
            </div>
        </div>

        ${pickupKitchenHTML}
        ${generalNotesKitchenHTML}
        
        <div class="ticket-separator" style="border-top: 2px dashed #000; margin: 10px 0;"></div>
        
        <div>
            <div class="ticket-section-title" style="font-weight: 900; font-size: 13px; margin-bottom: 8px;">Itens da Cozinha</div>
            <div style="margin-top: 4px;">
                ${itemsHTML}
            </div>
        </div>
        
        <div class="ticket-separator" style="border-top: 2px dashed #000; margin: 10px 0;"></div>
        
        <div class="ticket-footer" style="text-align: center; font-size: 13px; font-weight: bold; margin-top: 12px; border: 1px solid #000; padding: 5px; letter-spacing: 1px;">
            VIA DA COZINHA ${isTableOrder ? '• MESA' : ''}
        </div>
    `;
    
    openThermalPrintWindow(ticketHTML, `Cozinha - Pedido #${order.id}`);
}

/* ==========================================================================
   State Variables for Menu Management
   ========================================================================== */
let menuData = null;
let currentSection = 'orders'; // 'orders' or 'menu'
let currentMenuTab = 'flavors'; // 'flavors' or 'prices'

const DEFAULT_MENU_DATA = {
    "menu_items": {},
    "adicionais": {},
    "settings": {
        "companyName": "Fina Massa Pizzaria",
        "pixKey": "",
        "slogan": "Pizzas Artesanais | Delivery & Salão",
        "whatsapp": "",
        "whatsappFormatted": "",
        "address": "",
        "operatingHours": "Terça a Domingo das 18h às 23h30",
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
   Menu & Products Manager (Lanchonete Dynamic Catalog)
   ========================================================================== */
let activeMenuCategory = 'todos';

function switchSection(section) {
    currentSection = section;
    const btnNavOrders = document.getElementById('btnNavOrders');
    const btnNavCustomers = document.getElementById('btnNavCustomers');
    const btnNavTables = document.getElementById('btnNavTables');
    const btnNavMenu = document.getElementById('btnNavMenu');
    const btnNavDeliveryFees = document.getElementById('btnNavDeliveryFees');
    const btnNavReports = document.getElementById('btnNavReports');
    const btnNavSettings = document.getElementById('btnNavSettings');
    const sectionOrders = document.getElementById('section-orders');
    const sectionCustomers = document.getElementById('section-customers');
    const sectionTables = document.getElementById('section-tables');
    const sectionMenu = document.getElementById('section-menu');
    const sectionDeliveryFees = document.getElementById('section-delivery-fees');
    const sectionReports = document.getElementById('section-reports');
    const sectionSettings = document.getElementById('section-settings');
    
    // Reset active states
    if (btnNavOrders) btnNavOrders.classList.remove('active');
    if (btnNavCustomers) btnNavCustomers.classList.remove('active');
    if (btnNavTables) btnNavTables.classList.remove('active');
    if (btnNavMenu) btnNavMenu.classList.remove('active');
    if (btnNavDeliveryFees) btnNavDeliveryFees.classList.remove('active');
    if (btnNavReports) btnNavReports.classList.remove('active');
    if (btnNavSettings) btnNavSettings.classList.remove('active');
    
    // Hide sections
    if (sectionOrders) sectionOrders.classList.add('display-none');
    if (sectionCustomers) sectionCustomers.classList.add('display-none');
    if (sectionTables) sectionTables.classList.add('display-none');
    if (sectionMenu) sectionMenu.classList.add('display-none');
    if (sectionDeliveryFees) sectionDeliveryFees.classList.add('display-none');
    if (sectionReports) sectionReports.classList.add('display-none');
    if (sectionSettings) sectionSettings.classList.add('display-none');
    
    if (section === 'orders') {
        if (btnNavOrders) btnNavOrders.classList.add('active');
        if (sectionOrders) sectionOrders.classList.remove('display-none');
    } else if (section === 'customers') {
        if (btnNavCustomers) btnNavCustomers.classList.add('active');
        if (sectionCustomers) {
            sectionCustomers.classList.remove('display-none');
            if (typeof renderCustomersManager === 'function') renderCustomersManager();
        }
    } else if (section === 'tables') {
        if (btnNavTables) btnNavTables.classList.add('active');
        if (sectionTables) {
            sectionTables.classList.remove('display-none');
            renderTablesDashboard();
        }
    } else if (section === 'menu') {
        if (btnNavMenu) btnNavMenu.classList.add('active');
        if (sectionMenu) {
            sectionMenu.classList.remove('display-none');
            if (!menuData) {
                initMenuSync();
            } else {
                renderMenuManager();
            }
        }
    } else if (section === 'deliveryFees') {
        if (btnNavDeliveryFees) btnNavDeliveryFees.classList.add('active');
        if (sectionDeliveryFees) {
            sectionDeliveryFees.classList.remove('display-none');
            if (!menuData) {
                initMenuSync();
            } else {
                renderDeliveryFeesManager();
            }
        }
    } else if (section === 'reports') {
        if (btnNavReports) btnNavReports.classList.add('active');
        if (sectionReports) {
            sectionReports.classList.remove('display-none');
            renderReportsDashboard();
        }
    } else if (section === 'settings') {
        if (btnNavSettings) btnNavSettings.classList.add('active');
        if (sectionSettings) {
            sectionSettings.classList.remove('display-none');
            renderSettingsDashboard();
        }
    }
}

let trackingSettingsListenerAttached = false;

function setupTrackingSettingsRealtime() {
    if (trackingSettingsListenerAttached) return;
    if (typeof firebase === 'undefined' || firebase.apps.length === 0) return;

    const trackingRef = firebase.database().ref('menu/settings/tracking');
    trackingRef.on('value', (snapshot) => {
        const tracking = snapshot.val();
        if (!tracking || typeof tracking !== 'object') return;

        if (!menuData) menuData = {};
        if (!menuData.settings) menuData.settings = {};
        menuData.settings.tracking = {
            ...(menuData.settings.tracking || {}),
            ...tracking
        };

        if (currentSection === 'settings') {
            renderSettingsDashboard();
        }
    });

    trackingSettingsListenerAttached = true;
}

function mergeDefaultMenuItems(remoteMenu) {
    if (!remoteMenu || typeof remoteMenu !== 'object') return DEFAULT_MENU_DATA;
    const merged = { ...remoteMenu };
    if (!merged.menu_items || typeof merged.menu_items !== 'object') {
        merged.menu_items = {};
    }
    if (!merged.adicionais || typeof merged.adicionais !== 'object') {
        merged.adicionais = {};
    }
    if (!merged.settings || typeof merged.settings !== 'object') {
        merged.settings = { ...DEFAULT_MENU_DATA.settings };
    }
    // Não reinjeta hambúrgueres nem sobrescreve o Firebase automaticamente
    return merged;
}

function initMenuSync() {
    menuData = DEFAULT_MENU_DATA;
    renderMenuManager();

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        setupTrackingSettingsRealtime();

        const menuRef = firebase.database().ref('menu');
        menuRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && typeof data === 'object' && data.menu_items) {
                const confirmedTracking = menuData?.settings?.tracking;
                menuData = mergeDefaultMenuItems(data);
                if (confirmedTracking && typeof confirmedTracking === 'object') {
                    menuData.settings = menuData.settings || {};
                    menuData.settings.tracking = {
                        ...(menuData.settings.tracking || {}),
                        ...confirmedTracking
                    };
                }
                renderMenuManager();
            } else {
                console.log("[Fina Massa Painel] Cardápio no Firebase aguardando sincronização de produtos. Carregando ../menu.json como fallback...");
                fetch('../menu.json', { cache: 'no-cache' })
                    .then(r => r.json())
                    .then(localData => {
                        menuData = mergeDefaultMenuItems(localData || DEFAULT_MENU_DATA);
                        renderMenuManager();
                    })
                    .catch(() => renderMenuManager());
            }
        });
    } else {
        fetch('../menu.json', { cache: 'no-cache' })
            .then(res => res.json())
            .then(data => {
                menuData = mergeDefaultMenuItems(data || DEFAULT_MENU_DATA);
                renderMenuManager();
            })
            .catch(err => {
                console.error("Erro ao buscar cardápio local, usando DEFAULT_MENU_DATA:", err);
                menuData = DEFAULT_MENU_DATA;
                renderMenuManager();
            });
    }
}

function renderMenuManager() {
    if (!menuData) return;
    renderCategoryFilterTabs();
    renderProductsList();
    renderAdicionaisList();
    if (typeof renderSettingsDashboard === 'function') {
        renderSettingsDashboard();
    }
    if (typeof renderDeliveryFeesManager === 'function') {
        renderDeliveryFeesManager();
    }
}


function getCategoryDisplayName(catKey) {
    const names = {
        'pizzas_tradicionais': 'Pizzas Tradicionais',
        'pizzas_especiais': 'Pizzas Especiais',
        'pizzas_salgadas': 'Pizzas Salgadas',
        'pizzas_doces': 'Pizzas Doces',
        'calzones': 'Calzones',
        'bebidas': 'Bebidas'
    };
    return names[catKey] || catKey.charAt(0).toUpperCase() + catKey.slice(1);
}

function renderCategoryFilterTabs() {
    const nav = document.getElementById('menuCategoriesNav');
    if (!nav) return;
    
    nav.innerHTML = '';
    
    const menuItems = menuData.menu_items || {};
    const categories = Object.keys(menuItems);
    
    categories.forEach(catKey => {
        const count = Array.isArray(menuItems[catKey]) ? menuItems[catKey].length : 0;
        const btnCat = document.createElement('button');
        btnCat.className = `filter-tab ${activeMenuCategory === catKey ? 'active' : ''}`;
        btnCat.innerText = `${getCategoryDisplayName(catKey)} (${count})`;
        btnCat.onclick = () => setMenuCategoryFilter(catKey);
        nav.appendChild(btnCat);
    });
    
    // Tab "Adicionais"
    const btnAds = document.createElement('button');
    btnAds.className = `filter-tab ${activeMenuCategory === 'tab_adicionais' ? 'active' : ''}`;
    btnAds.innerText = 'Adicionais / Opcionais';
    btnAds.onclick = () => setMenuCategoryFilter('tab_adicionais');
    nav.appendChild(btnAds);
    
    // Tab "Pop-up Promoções"
    const btnPromo = document.createElement('button');
    btnPromo.className = `filter-tab ${activeMenuCategory === 'tab_promo' ? 'active' : ''}`;
    btnPromo.innerText = 'Pop-up Promoções';
    btnPromo.onclick = () => setMenuCategoryFilter('tab_promo');
    nav.appendChild(btnPromo);
}

function setMenuCategoryFilter(categoryKey) {
    activeMenuCategory = categoryKey;
    
    const prodSection = document.getElementById('menuTabProducts');
    const adsSection = document.getElementById('menuTabAdicionais');
    const promoSection = document.getElementById('menuTabPromo');
    
    if (categoryKey === 'tab_adicionais') {
        if (prodSection) prodSection.classList.add('display-none');
        if (adsSection) adsSection.classList.remove('display-none');
        if (promoSection) promoSection.classList.add('display-none');
        renderAdicionaisList();
    } else if (categoryKey === 'tab_promo') {
        if (prodSection) prodSection.classList.add('display-none');
        if (adsSection) adsSection.classList.add('display-none');
        if (promoSection) promoSection.classList.remove('display-none');
        loadPromoConfigIntoUI();
    } else {
        if (prodSection) prodSection.classList.remove('display-none');
        if (adsSection) adsSection.classList.add('display-none');
        if (promoSection) promoSection.classList.add('display-none');
        renderProductsList();
    }
    
    renderCategoryFilterTabs();
}

function renderProductsList() {
    const grid = document.getElementById('productsListGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    if (!menuData || !menuData.menu_items) return;
    
    const searchVal = (document.getElementById('searchMenuProduct')?.value || '').toLowerCase().trim();
    
    let allItems = [];
    const menuItems = menuData.menu_items || {};
    
    Object.keys(menuItems).forEach(catKey => {
        if (activeMenuCategory !== 'todos' && activeMenuCategory !== catKey) return;
        
        const items = menuItems[catKey] || [];
        items.forEach(it => {
            allItems.push({ ...it, categoryKey: catKey });
        });
    });
    
    if (searchVal) {
        allItems = allItems.filter(it => 
            (it.name && it.name.toLowerCase().includes(searchVal)) ||
            (it.description && it.description.toLowerCase().includes(searchVal))
        );
    }
    
    if (allItems.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: var(--bg-card); border: 1.5px dashed var(--border-color); border-radius: var(--radius-lg); color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size: 40px; color: var(--accent-gold); margin-bottom: 8px;">search_off</span>
                <h4 style="color: var(--text-main); font-size: 16px; margin-bottom: 4px;">Nenhum produto encontrado</h4>
                <p style="font-size: 13px;">Tente buscar com outro termo ou adicione um novo produto nesta categoria.</p>
            </div>
        `;
        return;
    }
    
    allItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (item.available === false) {
            card.style.opacity = '0.65';
        }
        
        const isChecked = item.available !== false ? 'checked' : '';
        const badgeHTML = item.badge ? `<span class="flavor-badge-label">${item.badge}</span>` : '';
        const imgPath = resolveProductImage(item, item.categoryKey);
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
                    <img src="${imgPath}" alt="${item.name}" style="width: 48px; height: 48px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border-color); background: #fff;" onerror="this.onerror=null; this.src='../assets/pizza_hero.png';">
                    <div class="flavor-card-info" style="flex: 1;">
                        <h4 style="margin: 0; color: var(--text-main); font-size: 15px; font-weight: 700;">${item.name}</h4>
                        <span class="category-tag salgada">
                            ${getCategoryDisplayName(item.categoryKey)}
                        </span>
                    </div>
                </div>
                
                <label class="switch" title="${item.available !== false ? 'DisponÃ­vel no Site' : 'Pausado/IndisponÃ­vel'}">
                    <input type="checkbox" ${isChecked} onchange="toggleProductAvailability('${item.id}', '${item.categoryKey}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            
            <p class="flavor-card-desc" style="margin: 8px 0; flex: 1; font-size: 12.5px; color: var(--text-body); line-height: 1.4;">${item.description || 'Sem descriÃ§Ã£o cadastrada.'}</p>
            
            <div class="flavor-card-meta" style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px;">
                <span class="flavor-price-tier" style="font-weight: 800; color: var(--primary); font-size: 16px;">
                    R$ ${Number(item.price || 0).toFixed(2).replace('.', ',')}
                </span>
                ${badgeHTML}
            </div>
            
            <div class="flavor-card-actions" style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                <button class="btn-icon-action" onclick="openEditProductModal('${item.id}', '${item.categoryKey}')" title="Editar Produto">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteProduct('${item.id}', '${item.categoryKey}')" title="Excluir Produto">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterProductsList() {
    renderProductsList();
}

function openAddProductModal(defaultCat = null) {
    document.getElementById('productModalTitle').innerText = 'Adicionar Novo Produto';
    document.getElementById('productEditId').value = '';
    document.getElementById('productEditOldCategory').value = '';
    document.getElementById('productForm').reset();
    
    populateCategoryDropdown(defaultCat || (activeMenuCategory !== 'todos' && !activeMenuCategory.startsWith('tab_') ? activeMenuCategory : 'lanches'));
    
    const cat = document.getElementById('productCategorySelect').value || 'pizzas_salgadas';
    const defImg = getDefaultProductImageForCategory(cat);
    document.getElementById('productImage').value = defImg;
    updateProductImagePreview(defImg);
    populateProductImageSuggestions(cat);
    
    openModal('productModal');
}

function openEditProductModal(id, categoryKey) {
    if (!menuData || !menuData.menu_items) return;
    const list = menuData.menu_items[categoryKey] || [];
    const item = list.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('productModalTitle').innerText = 'Editar Produto';
    document.getElementById('productEditId').value = item.id;
    document.getElementById('productEditOldCategory').value = categoryKey;
    
    document.getElementById('productName').value = item.name || '';
    document.getElementById('productDescription').value = item.description || '';
    document.getElementById('productPrice').value = Number(item.price || 0).toFixed(2);
    document.getElementById('productBadge').value = item.badge || '';
    
    populateCategoryDropdown(categoryKey);
    
    const imgVal = item.image || getDefaultProductImageForCategory(categoryKey);
    document.getElementById('productImage').value = imgVal;
    updateProductImagePreview(imgVal);
    populateProductImageSuggestions(categoryKey);
    
    openModal('productModal');
}

function closeProductModal() {
    closeModal('productModal');
}

function toggleProductAvailability(id, categoryKey, isChecked) {
    if (!menuData || !menuData.menu_items) return;
    const list = menuData.menu_items[categoryKey];
    if (!list) return;
    
    const index = list.findIndex(i => i.id === id);
    if (index === -1) return;
    
    list[index].available = isChecked;
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/menu_items/${categoryKey}/${index}/available`).set(isChecked)
        .then(() => {
            triggerCentralAutoBackup();
            showToast(`Disponibilidade de "${list[index].name}" atualizada!`, 'success');
        })
        .catch(err => {
            console.error("Erro ao atualizar disponibilidade:", err);
            showToast("Erro ao atualizar no Firebase.", "error");
        });
    } else {
        saveLocalMenu(() => {
            renderProductsList();
            showToast(`Disponibilidade atualizada localmente!`, 'success');
        });
    }
}

function saveProduct(event) {
    event.preventDefault();
    if (!menuData) return;
    if (!menuData.menu_items) menuData.menu_items = {};
    
    const editId = document.getElementById('productEditId').value;
    const oldCategory = document.getElementById('productEditOldCategory').value;
    
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const categoryKey = document.getElementById('productCategorySelect').value.toLowerCase().trim();
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const badge = document.getElementById('productBadge').value.trim();
    const image = document.getElementById('productImage').value.trim() || getDefaultProductImageForCategory(categoryKey);
    
    if (!menuData.menu_items[categoryKey]) {
        menuData.menu_items[categoryKey] = [];
    }
    
    if (editId) {
        if (oldCategory && oldCategory !== categoryKey && menuData.menu_items[oldCategory]) {
            const oldList = menuData.menu_items[oldCategory];
            const oldIdx = oldList.findIndex(i => i.id === editId);
            let prevItem = {};
            if (oldIdx !== -1) {
                prevItem = oldList[oldIdx];
                oldList.splice(oldIdx, 1);
            }
            
            const updatedItem = {
                ...prevItem,
                id: editId,
                name,
                description,
                category: categoryKey,
                price,
                image,
                available: prevItem.available !== false
            };
            if (badge) {
                updatedItem.badge = badge;
            } else {
                delete updatedItem.badge;
            }
            
            menuData.menu_items[categoryKey].push(updatedItem);
        } else {
            const list = menuData.menu_items[categoryKey];
            const idx = list.findIndex(i => i.id === editId);
            if (idx !== -1) {
                list[idx].name = name;
                list[idx].description = description;
                list[idx].category = categoryKey;
                list[idx].price = price;
                list[idx].image = image;
                if (badge) {
                    list[idx].badge = badge;
                } else {
                    delete list[idx].badge;
                }
            }
        }
    } else {
        const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const list = menuData.menu_items[categoryKey];
        
        if (list.some(i => i.id === id)) {
            alert("JÃ¡ existe um produto cadastrado com um nome muito parecido nesta categoria.");
            return;
        }
        
        const newItem = {
            id,
            name,
            description,
            category: categoryKey,
            price,
            image,
            available: true
        };
        if (badge) newItem.badge = badge;
        
        list.push(newItem);
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/menu_items').set(menuData.menu_items)
        .then(() => {
            closeProductModal();
            triggerCentralAutoBackup();
            showToast("Produto salvo com sucesso no Firebase!", "success");
            renderMenuManager();
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao gravar produto no Firebase.");
        });
    } else {
        saveLocalMenu(() => {
            closeProductModal();
            triggerCentralAutoBackup();
            showToast("Produto salvo localmente com sucesso!", "success");
            renderMenuManager();
        });
    }
}

function deleteProduct(id, categoryKey) {
    if (!menuData || !menuData.menu_items) return;
    const list = menuData.menu_items[categoryKey];
    if (!list) return;
    
    const item = list.find(i => i.id === id);
    if (!item) return;
    
    if (!confirm(`Tem certeza que deseja excluir o produto "${item.name}" permanentemente?`)) return;
    
    menuData.menu_items[categoryKey] = list.filter(i => i.id !== id);
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/menu_items/${categoryKey}`).set(menuData.menu_items[categoryKey])
        .then(() => {
            triggerCentralAutoBackup();
            showToast(`Produto "${item.name}" excluÃ­do com sucesso!`, "success");
            renderMenuManager();
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao excluir produto no Firebase.");
        });
    } else {
        saveLocalMenu(() => {
            triggerCentralAutoBackup();
            showToast(`Produto "${item.name}" excluÃ­do localmente!`, "success");
            renderMenuManager();
        });
    }
}

function renderAdicionaisList() {
    const tbody = document.getElementById('adicionaisTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const ads = menuData?.adicionais || {};
    
    Object.keys(ads).forEach(key => {
        const ad = ads[key];
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        tr.innerHTML = `
            <td style="padding: 10px; font-family: monospace; font-size: 12px; color: var(--text-light);">${key}</td>
            <td style="padding: 8px 10px;">
                <input type="text" class="adicional-name-input" data-key="${key}" value="${ad.name}" style="width: 100%; max-width: 250px; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 13px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="adicional-price-input" data-key="${key}" value="${Number(ad.price || 0).toFixed(2)}" style="width: 90px; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 13px;">
            </td>
            <td style="padding: 8px 10px; text-align: center;">
                <button type="button" onclick="deleteAdicional('${key}')" class="btn-img-action danger" title="Remover Adicional">
                    <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveAdicionais() {
    if (!menuData) return;
    if (!menuData.adicionais) menuData.adicionais = {};
    
    const nameInputs = document.querySelectorAll('.adicional-name-input');
    const priceInputs = document.querySelectorAll('.adicional-price-input');
    
    nameInputs.forEach(input => {
        const key = input.getAttribute('data-key');
        if (menuData.adicionais[key]) {
            menuData.adicionais[key].name = input.value.trim() || menuData.adicionais[key].name;
        }
    });
    
    priceInputs.forEach(input => {
        const key = input.getAttribute('data-key');
        if (menuData.adicionais[key]) {
            menuData.adicionais[key].price = parseFloat(input.value) || 0;
        }
    });
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/adicionais').set(menuData.adicionais)
        .then(() => {
            triggerCentralAutoBackup();
            showToast("Adicionais salvos com sucesso no Firebase!", "success");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar adicionais no Firebase.");
        });
    } else {
        saveLocalMenu(() => {
            showToast("Adicionais salvos localmente!", "success");
        });
    }
}

function addAdicionalRow() {
    const idInput = document.getElementById('newAdicionalId');
    const nameInput = document.getElementById('newAdicionalName');
    const priceInput = document.getElementById('newAdicionalPrice');
    
    const name = nameInput.value.trim();
    const key = (idInput.value.trim() || name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const price = parseFloat(priceInput.value) || 0;
    
    if (!key || !name) {
        alert("Preencha o nome do adicional.");
        return;
    }
    
    if (!menuData.adicionais) menuData.adicionais = {};
    menuData.adicionais[key] = { name, price };
    
    idInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    
    saveAdicionais();
    renderAdicionaisList();
}

function deleteAdicional(key) {
    if (!menuData || !menuData.adicionais) return;
    if (!confirm(`Deseja remover o adicional "${menuData.adicionais[key]?.name || key}"?`)) return;
    
    delete menuData.adicionais[key];
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/adicionais/${key}`).remove()
        .then(() => {
            triggerCentralAutoBackup();
            showToast("Adicional removido!", "success");
            renderAdicionaisList();
        })
        .catch(err => console.error(err));
    } else {
        saveLocalMenu(() => {
            renderAdicionaisList();
        });
    }
}

function getDefaultProductImageForCategory(catKey) {
    const defaults = {
        'pizzas_salgadas': '../assets/pizza_hero.png',
        'pizzas_doces': '../assets/gourmet_doce_morango.png',
        'calzones': '../assets/pizza_media.jpg',
        'bebidas': '../assets/gourmet_bebida.png'
    };
    return defaults[catKey] || '../assets/pizza_hero.png';
}

function resolveProductImage(item, categoryKey = 'lanches') {
    if (!item) return getDefaultProductImageForCategory(categoryKey);
    let img = item.image || item.imagem || '';
    if (img && typeof img === 'string' && img.trim() !== '') {
        img = img.trim();
        if (img.startsWith('assets/')) {
            img = '../' + img;
        }
        return img;
    }
    const cat = categoryKey || item.category || 'pizzas_salgadas';
    return getDefaultProductImageForCategory(cat);
}

function populateCategoryDropdown(selectedCat = 'pizzas_salgadas') {
    const select = document.getElementById('productCategorySelect');
    if (!select) return;
    
    select.innerHTML = '';
    const defaultCats = ['pizzas_salgadas', 'pizzas_doces', 'calzones', 'bebidas'];
    const menuItems = menuData?.menu_items || {};
    const catKeys = Array.from(new Set([...defaultCats, ...Object.keys(menuItems)]));
    
    catKeys.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = getCategoryDisplayName(cat);
        if (cat === selectedCat) opt.selected = true;
        select.appendChild(opt);
    });
}

function populateProductImageSuggestions(category) {
    const container = document.getElementById('productImageSuggestions');
    if (!container) return;
    
    container.innerHTML = '';
    let suggestions = [];
    
    if (category === 'pizzas_salgadas') {
        suggestions = [
            { label: 'Pizza Artesanal', value: 'assets/pizza_hero.png' },
            { label: 'Pizza MÃ©dia', value: 'assets/pizza_media.jpg' }
        ];
    } else if (category === 'pizzas_doces') {
        suggestions = [
            { label: 'Pizza Doce Morango', value: 'assets/gourmet_doce_morango.png' }
        ];
    } else if (category === 'calzones') {
        suggestions = [
            { label: 'Calzone Especial', value: 'assets/pizza_media.jpg' }
        ];
    } else if (category === 'bebidas') {
        suggestions = [
            { label: 'Bebidas em Geral', value: 'assets/gourmet_bebida.png' }
        ];
    }
    
    suggestions.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-suggestion';
        btn.innerText = s.label;
        btn.onclick = () => {
            const imgInput = document.getElementById('productImage');
            if (imgInput) {
                imgInput.value = s.value;
                updateProductImagePreview(s.value);
            }
        };
        container.appendChild(btn);
    });
}

function handleProductFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
        return;
    }
    
    showLoading('Otimizando imagem...');
    compressAndProcessImage(file, 800, 800, 0.82, (err, compressedDataUrl) => {
        hideLoading();
        if (err) {
            console.error(err);
            showToast('Não foi possível processar a imagem.', 'error');
            return;
        }
        
        const input = document.getElementById('productImage');
        if (input) {
            input.value = compressedDataUrl;
            updateProductImagePreview(compressedDataUrl, file.name);
            showToast('Imagem enviada e otimizada com sucesso!', 'success');
        }
    });
}

function updateProductImagePreview(url, fileName = '') {
    const card = document.getElementById('productImagePreviewCard');
    const thumb = document.getElementById('productImagePreviewThumb');
    const nameEl = document.getElementById('productImagePreviewName');
    
    if (!card || !thumb) return;
    
    if (url && url.trim().length > 0) {
        let displayUrl = url.trim();
        if (displayUrl.startsWith('assets/')) {
            displayUrl = '../' + displayUrl;
        }
        thumb.onerror = function() {
            this.onerror = null;
            this.src = '../assets/pizza_hero.png';
        };
        thumb.src = displayUrl;
        nameEl.innerText = fileName || (url.length > 40 ? url.substring(0, 37) + '...' : url);
        card.classList.remove('display-none');
    } else {
        card.classList.add('display-none');
    }
}

function removeProductImage() {
    const input = document.getElementById('productImage');
    const fileInput = document.getElementById('productFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    updateProductImagePreview('');
    showToast('Imagem removida.', 'info');
}

function loadPromoConfigIntoUI() {
    const promo = menuData?.promo_config || {};
    const chk = document.getElementById('promoShowPopup');
    const input = document.getElementById('promoFacebookUrl');
    if (chk) chk.checked = !!promo.show_popup;
    if (input) input.value = promo.facebook_url || '';
}

function savePromoConfig(event) {
    if (event) event.preventDefault();
    if (!menuData) return;
    
    const show = document.getElementById('promoShowPopup')?.checked || false;
    const url = document.getElementById('promoFacebookUrl')?.value.trim() || '';
    
    menuData.promo_config = {
        show_popup: show,
        facebook_url: url
    };
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/promo_config').set(menuData.promo_config)
        .then(() => {
            triggerCentralAutoBackup();
            showToast('Configurações de promoção salvas no Firebase!', 'success');
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar configurações de promoção.");
        });
    } else {
        saveLocalMenu(() => {
            showToast('Configurações de promoção salvas localmente!', 'success');
        });
    }
}

function initShopStatus() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('status/isOpen').on('value', (snapshot) => {
            const isOpen = snapshot.val();
            const toggle = document.getElementById('shopStatusToggle');
            const label = document.getElementById('shopStatusLabel');
            
            if (isOpen !== null) {
                if (toggle) toggle.checked = isOpen;
                if (label) {
                    label.innerText = isOpen ? "Aberto" : "Fechado";
                    label.style.color = isOpen ? "#81c784" : "#ef5350";
                }
            }
        });
    } else {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                const toggle = document.getElementById('shopStatusToggle');
                const label = document.getElementById('shopStatusLabel');
                if (data && typeof data.isOpen === 'boolean') {
                    if (toggle) toggle.checked = data.isOpen;
                    if (label) {
                        label.innerText = data.isOpen ? "Aberto" : "Fechado";
                        label.style.color = data.isOpen ? "#81c784" : "#ef5350";
                    }
                }
            })
            .catch(err => console.error("Erro ao carregar status local:", err));
    }
}

function toggleShopStatus(isOpen) {
    const label = document.getElementById('shopStatusLabel');
    if (label) {
        label.innerText = isOpen ? "Aberto" : "Fechado";
        label.style.color = isOpen ? "#81c784" : "#ef5350";
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('status').set({ isOpen: isOpen })
        .catch(err => console.error("Erro ao salvar status no Firebase:", err));
    } else {
        fetch('/api/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOpen: isOpen })
        })
        .catch(err => console.error("Erro ao atualizar status local:", err));
    }
}

function saveLocalMenu(callback) {
    fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuData)
    })
    .then(res => res.json())
    .then(data => {
        if (callback) callback();
    })
    .catch(err => {
        console.error("Erro ao salvar cardÃ¡pio localmente:", err);
        if (callback) callback();
    });
}

function openModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.classList.remove('display-none');
    setTimeout(() => {
        overlay.classList.add('active');
        overlay.style.pointerEvents = 'auto';
        overlay.style.opacity = '1';
    }, 10);
}

function closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.classList.add('display-none');
    }, 300);
}
/* ==========================================================================
   Store Settings Functions
   ========================================================================== */
function updateTrackingStatusUI() {
    const badge = document.getElementById('trackingGlobalStatusBadge');
    const badgeText = document.getElementById('trackingGlobalStatusText');
    if (!badge || !badgeText) return;

    const gtmEnabled = document.getElementById('settingsGtmEnabled')?.checked;
    const metaPixelEnabled = document.getElementById('settingsMetaPixelEnabled')?.checked;
    const ga4Enabled = document.getElementById('settingsGa4Enabled')?.checked;
    const googleAdsEnabled = document.getElementById('settingsGoogleAdsEnabled')?.checked;

    const isAnyActive = gtmEnabled || metaPixelEnabled || ga4Enabled || googleAdsEnabled;

    if (isAnyActive) {
        badge.style.background = 'rgba(76, 175, 80, 0.15)';
        badge.style.color = '#4CAF50';
        badge.style.borderColor = 'rgba(76, 175, 80, 0.3)';
        badgeText.textContent = '🟢 Rastreamento ativo';
    } else {
        badge.style.background = 'rgba(239, 83, 80, 0.15)';
        badge.style.color = '#ef5350';
        badge.style.borderColor = 'rgba(239, 83, 80, 0.3)';
        badgeText.textContent = '🔴 Rastreamento desativado';
    }
}

function renderSettingsDashboard() {
    if (!menuData) return;
    
    if (!menuData.settings) {
        menuData.settings = {
            whatsapp: '5554996985724',
            whatsappFormatted: '(54) 99698-5724',
            deliveryFees: {}
        };
        if (DEFAULT_MENU_DATA.settings && DEFAULT_MENU_DATA.settings.deliveryFees) {
            menuData.settings.deliveryFees = JSON.parse(JSON.stringify(DEFAULT_MENU_DATA.settings.deliveryFees));
        }
    }
    
    const settings = menuData.settings;
    const settingsWhatsapp = document.getElementById('settingsWhatsapp');
    const settingsWhatsappFormatted = document.getElementById('settingsWhatsappFormatted');
    const settingsPixKey = document.getElementById('settingsPixKey');
    
    if (settingsWhatsapp) settingsWhatsapp.value = settings.whatsapp || '';
    if (settingsWhatsappFormatted) settingsWhatsappFormatted.value = settings.whatsappFormatted || '';
    if (settingsPixKey) settingsPixKey.value = settings.pixKey || '';
    
    // Marketing Tracking Settings
    const tracking = settings.tracking || {};
    const settingsGtmEnabled = document.getElementById('settingsGtmEnabled');
    const settingsGtmId = document.getElementById('settingsGtmId');
    const settingsMetaPixelEnabled = document.getElementById('settingsMetaPixelEnabled');
    const settingsMetaPixelId = document.getElementById('settingsMetaPixelId');
    const settingsGa4Enabled = document.getElementById('settingsGa4Enabled');
    const settingsGa4Id = document.getElementById('settingsGa4Id');
    const settingsGoogleAdsEnabled = document.getElementById('settingsGoogleAdsEnabled');
    const settingsGoogleAdsId = document.getElementById('settingsGoogleAdsId');
    const settingsGoogleAdsPurchaseLabel = document.getElementById('settingsGoogleAdsPurchaseLabel');

    const gtmActive = tracking.gtmEnabled === true || tracking.gtmEnabled === 'true' || (tracking.enabled && !!tracking.gtmId);
    const pixelActive = tracking.metaPixelEnabled === true || tracking.metaPixelEnabled === 'true' || (tracking.enabled && !!tracking.metaPixelId);
    const ga4Active = tracking.ga4Enabled === true || tracking.ga4Enabled === 'true' || (tracking.enabled && (!!tracking.ga4Id || !!tracking.ga4MeasurementId));
    const googleAdsActive = tracking.googleAdsEnabled === true || tracking.googleAdsEnabled === 'true';

    if (settingsGtmEnabled) settingsGtmEnabled.checked = gtmActive;
    if (settingsGtmId) settingsGtmId.value = tracking.gtmId || '';

    if (settingsMetaPixelEnabled) settingsMetaPixelEnabled.checked = pixelActive;
    if (settingsMetaPixelId) settingsMetaPixelId.value = tracking.metaPixelId || '';

    if (settingsGa4Enabled) settingsGa4Enabled.checked = ga4Active;
    if (settingsGa4Id) settingsGa4Id.value = tracking.ga4Id || tracking.ga4MeasurementId || '';

    if (settingsGoogleAdsEnabled) settingsGoogleAdsEnabled.checked = googleAdsActive;
    if (settingsGoogleAdsId) settingsGoogleAdsId.value = tracking.googleAdsId || '';
    if (settingsGoogleAdsPurchaseLabel) settingsGoogleAdsPurchaseLabel.value = (tracking.googleAdsConversionLabels && tracking.googleAdsConversionLabels.purchase) || '';

    updateTrackingStatusUI();

    for (let i = 1; i <= 10; i++) {
        const nameElem = document.getElementById(`settingsMotoboy${i}Name`);
        const wspElem = document.getElementById(`settingsMotoboy${i}Whatsapp`);
        const nameVal = i === 1 ? (settings.motoboy1Name || settings.motoboyName || '') : (settings[`motoboy${i}Name`] || '');
        const wspVal = i === 1 ? (settings.motoboy1Whatsapp || settings.motoboyWhatsapp || '') : (settings[`motoboy${i}Whatsapp`] || '');
        if (nameElem) nameElem.value = nameVal;
        if (wspElem) wspElem.value = wspVal;
    }
    
    renderSettingsFeesTable();
}

/* ==========================================================================
   Delivery Fees & Neighborhoods Manager (Taxas por Bairro)
   ========================================================================== */
let currentDeliveryFeeFilter = 'all';

function setDeliveryFeeFilter(filter) {
    currentDeliveryFeeFilter = filter;
    
    const btnAll = document.getElementById('filterBairroAll');
    const btnActive = document.getElementById('filterBairroActive');
    const btnInactive = document.getElementById('filterBairroInactive');
    
    if (btnAll) btnAll.classList.toggle('active', filter === 'all');
    if (btnActive) btnActive.classList.toggle('active', filter === 'active');
    if (btnInactive) btnInactive.classList.toggle('active', filter === 'inactive');
    
    renderDeliveryFeesManager();
}

function filterDeliveryFeesList() {
    renderDeliveryFeesManager();
}

function normalizeBairroKey(name) {
    if (!name) return `bairro_${Date.now()}`;
    return name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || `bairro_${Date.now()}`;
}

function renderDeliveryFeesManager() {
    if (!menuData) return;
    if (!menuData.settings) {
        menuData.settings = {
            whatsapp: '',
            whatsappFormatted: '',
            deliveryFees: {}
        };
    }
    if (!menuData.settings.deliveryFees) {
        menuData.settings.deliveryFees = {};
    }

    const fees = menuData.settings.deliveryFees;
    const allKeys = Object.keys(fees);
    
    // Calculate counters & KPIs
    let totalCount = allKeys.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let feeSum = 0;
    let feeCount = 0;

    allKeys.forEach(key => {
        const item = fees[key];
        if (!item) return;
        const isActive = item.active !== false;
        if (isActive) {
            activeCount++;
            feeSum += (Number(item.fee) || 0);
            feeCount++;
        } else {
            inactiveCount++;
        }
    });

    const avgFee = feeCount > 0 ? (feeSum / feeCount) : 0;

    // Update KPI indicators
    const elTotal = document.getElementById('bairrosTotalCount');
    const elActive = document.getElementById('bairrosActiveCount');
    const elInactive = document.getElementById('bairrosInactiveCount');
    const elAvg = document.getElementById('bairrosAverageFee');

    if (elTotal) elTotal.innerText = totalCount;
    if (elActive) elActive.innerText = activeCount;
    if (elInactive) elInactive.innerText = inactiveCount;
    if (elAvg) elAvg.innerText = `R$ ${avgFee.toFixed(2).replace('.', ',')}`;

    // Update filter tab counts
    const elCountAll = document.getElementById('countFilterAll');
    const elCountActive = document.getElementById('countFilterActive');
    const elCountInactive = document.getElementById('countFilterInactive');

    if (elCountAll) elCountAll.innerText = totalCount;
    if (elCountActive) elCountActive.innerText = activeCount;
    if (elCountInactive) elCountInactive.innerText = inactiveCount;

    // Search query & filter
    const searchInput = document.getElementById('searchDeliveryFee');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const tbody = document.getElementById('deliveryFeesTableBody');
    const emptyState = document.getElementById('emptyDeliveryFeesState');
    const table = document.getElementById('deliveryFeesTable');

    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort alphabetically by name
    const sortedKeys = allKeys.sort((a, b) => {
        const nameA = (fees[a]?.name || a).toLowerCase();
        const nameB = (fees[b]?.name || b).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const filteredKeys = sortedKeys.filter(key => {
        const item = fees[key];
        if (!item) return false;
        const itemName = (item.name || key).toLowerCase();
        const matchesQuery = !query || itemName.includes(query) || key.toLowerCase().includes(query);
        const isActive = item.active !== false;

        if (!matchesQuery) return false;
        if (currentDeliveryFeeFilter === 'active' && !isActive) return false;
        if (currentDeliveryFeeFilter === 'inactive' && isActive) return false;
        return true;
    });

    if (filteredKeys.length === 0) {
        if (emptyState) {
            emptyState.classList.remove('display-none');
            const h3 = emptyState.querySelector('h3');
            const p = emptyState.querySelector('p');
            if (query || currentDeliveryFeeFilter !== 'all') {
                if (h3) h3.innerText = 'Nenhum bairro encontrado para esta busca';
                if (p) p.innerText = 'Tente pesquisar com outro termo ou alterar o filtro de status.';
            } else {
                if (h3) h3.innerText = 'Nenhum bairro cadastrado';
                if (p) p.innerText = 'Cadastre os bairros atendidos pelo delivery clicando no botÃ£o abaixo.';
            }
        }
        if (table) table.style.display = totalCount === 0 ? 'none' : 'table';
    } else {
        if (emptyState) emptyState.classList.add('display-none');
        if (table) table.style.display = 'table';

        filteredKeys.forEach(key => {
            const item = fees[key];
            const name = item.name || key;
            const fee = Number(item.fee) || 0;
            const isActive = item.active !== false;
            const formattedFee = fee === 0 ? '<span style="color: #2E7D32; font-weight: 700;">GrÃ¡tis (R$ 0,00)</span>' : `R$ ${fee.toFixed(2).replace('.', ',')}`;

            const tr = document.createElement('tr');
            tr.className = 'delivery-fee-row';
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 14px 14px; font-weight: 600; color: var(--text-main); font-size: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-symbols-rounded" style="color: var(--primary); font-size: 20px;">pin_drop</span>
                        <div>
                            <span style="font-size: 14px; font-weight: 600;">${name}</span>
                            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace; font-weight: normal;">ID: ${key}</div>
                        </div>
                    </div>
                </td>
                <td style="padding: 14px 14px; font-size: 14px; font-weight: 600;">
                    ${formattedFee}
                </td>
                <td style="padding: 14px 14px; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <span class="delivery-fee-badge ${isActive ? 'ativo' : 'inativo'}">
                            <span class="dot"></span>
                            ${isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        <label class="switch" style="transform: scale(0.85);" title="${isActive ? 'Desativar entrega neste bairro' : 'Ativar entrega neste bairro'}">
                            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleDeliveryFeeStatus('${key}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                </td>
                <td style="padding: 14px 14px; text-align: center;">
                    <div class="delivery-fee-actions">
                        <button type="button" class="btn-table-action" onclick="openEditDeliveryFeeModal('${key}')" title="Editar Bairro">
                            <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                        </button>
                        <button type="button" class="btn-table-action danger" onclick="deleteDeliveryFee('${key}')" title="Excluir Bairro">
                            <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Also update settings table if present
    renderSettingsFeesTable();
}

function renderSettingsFeesTable() {
    const feesBody = document.getElementById('settingsFeesBody');
    if (!feesBody || !menuData || !menuData.settings) return;
    
    feesBody.innerHTML = '';
    const fees = menuData.settings.deliveryFees || {};
    const sortedKeys = Object.keys(fees).sort((a, b) => ((fees[a]?.name || a).localeCompare(fees[b]?.name || b)));
    
    if (sortedKeys.length === 0) {
        feesBody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 13px;">Nenhum bairro cadastrado.</td></tr>';
    } else {
        sortedKeys.forEach(key => {
            const item = fees[key];
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 8px 5px; color: var(--text-muted); font-size: 12px; font-family: monospace;">${key}</td>
                <td style="padding: 8px 5px; font-weight: 500; font-size: 14px;">${item.name || key}</td>
                <td style="padding: 8px 5px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 13px; color: var(--text-muted);">R$</span>
                        <input type="number" step="0.50" value="${item.fee !== undefined ? item.fee : 0}" class="bairro-fee-input" data-id="${key}" style="width: 75px; padding: 6px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 13px;">
                    </div>
                </td>
                <td style="padding: 8px 5px; text-align: center;">
                    <button type="button" onclick="deleteDeliveryFee('${key}')" style="background: transparent; border: none; color: #ef5350; cursor: pointer; display: inline-flex; align-items: center;" title="Excluir Bairro">
                        <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                    </button>
                </td>
            `;
            feesBody.appendChild(tr);
        });
    }
}

function openAddDeliveryFeeModal() {
    const title = document.getElementById('deliveryFeeModalTitle');
    const keyInput = document.getElementById('deliveryFeeEditKey');
    const nameInput = document.getElementById('deliveryFeeName');
    const feeInput = document.getElementById('deliveryFeeValue');
    const activeToggle = document.getElementById('deliveryFeeActiveToggle');
    
    if (title) title.innerHTML = '<span class="material-symbols-rounded">add_location_alt</span><span>Adicionar Novo Bairro</span>';
    if (keyInput) keyInput.value = '';
    if (nameInput) {
        nameInput.value = '';
        nameInput.readOnly = false;
    }
    if (feeInput) feeInput.value = '';
    if (activeToggle) activeToggle.checked = true;
    updateDeliveryFeeModalStatusLabel(true);
    
    openModal('deliveryFeeModal');
    setTimeout(() => {
        if (nameInput) nameInput.focus();
    }, 150);
}

function openEditDeliveryFeeModal(key) {
    if (!menuData || !menuData.settings || !menuData.settings.deliveryFees) return;
    const item = menuData.settings.deliveryFees[key];
    if (!item) return;

    const title = document.getElementById('deliveryFeeModalTitle');
    const keyInput = document.getElementById('deliveryFeeEditKey');
    const nameInput = document.getElementById('deliveryFeeName');
    const feeInput = document.getElementById('deliveryFeeValue');
    const activeToggle = document.getElementById('deliveryFeeActiveToggle');
    
    if (title) title.innerHTML = '<span class="material-symbols-rounded">edit_location</span><span>Editar Bairro</span>';
    if (keyInput) keyInput.value = key;
    if (nameInput) {
        nameInput.value = item.name || key;
        nameInput.readOnly = false;
    }
    if (feeInput) feeInput.value = item.fee !== undefined ? item.fee : 0;
    const isActive = item.active !== false;
    if (activeToggle) activeToggle.checked = isActive;
    updateDeliveryFeeModalStatusLabel(isActive);
    
    openModal('deliveryFeeModal');
    setTimeout(() => {
        if (feeInput) feeInput.focus();
    }, 150);
}

function closeDeliveryFeeModal() {
    closeModal('deliveryFeeModal');
}

function updateDeliveryFeeModalStatusLabel(isChecked) {
    const help = document.getElementById('deliveryFeeStatusHelpText');
    if (help) {
        help.textContent = isChecked ? 'Bairro ativo recebe pedidos para entrega.' : 'Bairro inativo/pausado nÃ£o aceita entregas temporariamente.';
    }
}

function saveDeliveryFee(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (!menuData) return;
    if (!menuData.settings) menuData.settings = {};
    if (!menuData.settings.deliveryFees) menuData.settings.deliveryFees = {};

    const keyInput = document.getElementById('deliveryFeeEditKey');
    const nameInput = document.getElementById('deliveryFeeName');
    const feeInput = document.getElementById('deliveryFeeValue');
    const activeToggle = document.getElementById('deliveryFeeActiveToggle');

    const editKey = keyInput ? keyInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const rawFee = feeInput ? parseFloat(feeInput.value) : 0;
    const fee = isNaN(rawFee) ? 0 : Math.max(0, rawFee);
    const active = activeToggle ? activeToggle.checked : true;

    if (!name) {
        showToast('Informe o nome do bairro.', 'warning');
        if (nameInput) nameInput.focus();
        return;
    }

    let key = editKey;
    if (!key) {
        key = normalizeBairroKey(name);
        if (menuData.settings.deliveryFees[key]) {
            if (!confirm(`JÃ¡ existe um bairro com o identificador "${key}". Deseja sobrescrever os dados?`)) {
                return;
            }
        }
    }

    const bairroRecord = {
        id: key,
        name: name,
        fee: fee,
        active: active,
        updatedAt: Date.now()
    };

    menuData.settings.deliveryFees[key] = bairroRecord;

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        showLoading('Salvando bairro no Firebase...');
        firebase.database().ref(`menu/settings/deliveryFees/${key}`).set(bairroRecord)
        .then(() => {
            hideLoading();
            closeDeliveryFeeModal();
            renderDeliveryFeesManager();
            triggerCentralAutoBackup();
            showToast(`Bairro "${name}" salvo com sucesso!`, 'success');
        })
        .catch(err => {
            hideLoading();
            console.error("Erro ao salvar bairro no Firebase:", err);
            showToast('Erro ao salvar no Firebase: ' + err.message, 'error');
        });
    } else {
        closeDeliveryFeeModal();
        renderDeliveryFeesManager();
        triggerCentralAutoBackup();
        showToast(`Bairro "${name}" salvo localmente!`, 'success');
    }
}

function toggleDeliveryFeeStatus(key, isActive) {
    if (!menuData || !menuData.settings || !menuData.settings.deliveryFees) return;
    const item = menuData.settings.deliveryFees[key];
    if (!item) return;

    item.active = isActive;
    item.updatedAt = Date.now();

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/settings/deliveryFees/${key}/active`).set(isActive)
        .then(() => {
            renderDeliveryFeesManager();
            triggerCentralAutoBackup();
            showToast(`Bairro "${item.name || key}" ${isActive ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        })
        .catch(err => {
            console.error("Erro ao atualizar status do bairro:", err);
            item.active = !isActive; // Rollback
            renderDeliveryFeesManager();
            showToast('Erro ao atualizar status no Firebase.', 'error');
        });
    } else {
        renderDeliveryFeesManager();
        triggerCentralAutoBackup();
        showToast(`Bairro "${item.name || key}" ${isActive ? 'ativado' : 'desativado'}!`, 'success');
    }
}

function deleteDeliveryFee(key) {
    if (!menuData || !menuData.settings || !menuData.settings.deliveryFees) return;
    const item = menuData.settings.deliveryFees[key];
    const name = item?.name || key;

    if (!confirm(`Deseja realmente excluir o cadastro do bairro "${name}"?`)) {
        return;
    }

    delete menuData.settings.deliveryFees[key];

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        showLoading('Excluindo bairro...');
        firebase.database().ref(`menu/settings/deliveryFees/${key}`).remove()
        .then(() => {
            hideLoading();
            renderDeliveryFeesManager();
            triggerCentralAutoBackup();
            showToast(`Bairro "${name}" excluÃ­do com sucesso!`, 'success');
        })
        .catch(err => {
            hideLoading();
            console.error("Erro ao excluir bairro no Firebase:", err);
            showToast('Erro ao excluir no Firebase: ' + err.message, 'error');
        });
    } else {
        renderDeliveryFeesManager();
        triggerCentralAutoBackup();
        showToast(`Bairro "${name}" excluÃ­do!`, 'success');
    }
}

function addBairroRow() {
    openAddDeliveryFeeModal();
}

function deleteBairroRow(key) {
    deleteDeliveryFee(key);
}

function saveSettings(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (!menuData || !menuData.settings) return;
    
    const whatsapp = document.getElementById('settingsWhatsapp').value.trim();
    const whatsappFormatted = document.getElementById('settingsWhatsappFormatted').value.trim();
    const pixKey = (document.getElementById('settingsPixKey')?.value || '').trim();
    
    if (!whatsapp) {
        alert("O número de WhatsApp da empresa é obrigatório.");
        return;
    }
    
    menuData.settings.whatsapp = whatsapp;
    menuData.settings.whatsappFormatted = whatsappFormatted;
    menuData.settings.pixKey = pixKey;

    // Marketing Tracking Settings
    const gtmEnabled = document.getElementById('settingsGtmEnabled')?.checked || false;
    let gtmId = (document.getElementById('settingsGtmId')?.value || '').trim().toUpperCase();

    const metaPixelEnabled = document.getElementById('settingsMetaPixelEnabled')?.checked || false;
    let metaPixelId = (document.getElementById('settingsMetaPixelId')?.value || '').trim().replace(/\D/g, '');

    const ga4Enabled = document.getElementById('settingsGa4Enabled')?.checked || false;
    let ga4Id = (document.getElementById('settingsGa4Id')?.value || '').trim().toUpperCase();

    const googleAdsEnabled = document.getElementById('settingsGoogleAdsEnabled')?.checked || false;
    let googleAdsId = (document.getElementById('settingsGoogleAdsId')?.value || '').trim().toUpperCase();
    let googleAdsPurchaseLabel = (document.getElementById('settingsGoogleAdsPurchaseLabel')?.value || '').trim();

    // Auto-prefixação inteligente se o usuário esquecer de digitar o prefixo
    if (gtmId && !gtmId.startsWith('GTM-')) gtmId = 'GTM-' + gtmId;
    if (ga4Id && !ga4Id.startsWith('G-')) ga4Id = 'G-' + ga4Id;
    if (googleAdsId && !googleAdsId.startsWith('AW-')) googleAdsId = 'AW-' + googleAdsId;

    // Validations: If enabled, check strict format
    if (gtmEnabled && gtmId) {
        if (!/^GTM-[A-Z0-9]{4,12}$/.test(gtmId)) {
            alert('Google Tag Manager ID inválido. Formato esperado: GTM-XXXXXXX');
            return;
        }
    }

    if (metaPixelEnabled && metaPixelId) {
        if (!/^\d{6,20}$/.test(metaPixelId)) {
            alert('Meta Pixel ID inválido. Use apenas números (ex: 123456789012345).');
            return;
        }
    }

    if (ga4Enabled && ga4Id) {
        if (!/^G-[A-Z0-9]{6,15}$/.test(ga4Id)) {
            alert('GA4 Measurement ID inválido. Formato esperado: G-XXXXXXXXXX');
            return;
        }
    }

    if (googleAdsEnabled) {
        if (!googleAdsId || !/^AW-[0-9]{6,12}$/.test(googleAdsId)) {
            alert('ID de Conversão do Google Ads inválido. Formato esperado: AW-XXXXXXXXX');
            return;
        }
    }

    const trackingActive = (gtmEnabled && !!gtmId) || (metaPixelEnabled && !!metaPixelId) || (ga4Enabled && !!ga4Id) || (googleAdsEnabled && !!googleAdsId);

    menuData.settings.tracking = {
        enabled: trackingActive,
        gtmEnabled: gtmEnabled,
        gtmId: gtmId,
        metaPixelEnabled: metaPixelEnabled,
        metaPixelId: metaPixelId,
        ga4Enabled: ga4Enabled,
        ga4Id: ga4Id,
        ga4MeasurementId: ga4Id,
        googleAdsEnabled: googleAdsEnabled,
        googleAdsId: googleAdsId,
        googleAdsConversionLabels: {
            purchase: googleAdsPurchaseLabel
        }
    };
    
    for (let i = 1; i <= 10; i++) {
        const nameElem = document.getElementById(`settingsMotoboy${i}Name`);
        const wspElem = document.getElementById(`settingsMotoboy${i}Whatsapp`);
        const mName = nameElem ? nameElem.value.trim() : '';
        const mWsp = wspElem ? wspElem.value.trim() : '';
        
        menuData.settings[`motoboy${i}Name`] = mName;
        menuData.settings[`motoboy${i}Whatsapp`] = mWsp;
        if (i === 1) {
            menuData.settings.motoboyName = mName;
            menuData.settings.motoboyWhatsapp = mWsp;
        }
    }
    
    const inputs = document.querySelectorAll('.bairro-fee-input');
    inputs.forEach(input => {
        const key = input.getAttribute('data-id');
        const fee = parseFloat(input.value);
        if (menuData.settings.deliveryFees && menuData.settings.deliveryFees[key]) {
            menuData.settings.deliveryFees[key].fee = isNaN(fee) ? 0 : fee;
        }
    });
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const settingsRef = firebase.database().ref('menu/settings');
        
        settingsRef.set(menuData.settings)
        .then(() => {
            renderSettingsDashboard();
            triggerCentralAutoBackup();
            alert("Configurações salvas com sucesso no Firebase!");
        })
        .catch(err => {
            alert("Erro ao salvar configurações no Firebase: " + err.message);
            console.error(err);
        });
    } else {
        saveLocalMenu(() => {
            triggerCentralAutoBackup();
            alert("Configurações salvas localmente com sucesso!");
        });
    }
}

/* ==========================================================================
   Reports Dashboard Functionality
   ========================================================================== */
function renderReportsDashboard() {
    const filterVal = document.getElementById('reportsPeriodFilter')?.value || 'all';
    
    // Time calculations
    const now = Date.now();
    const millisecondsInDay = 24 * 60 * 60 * 1000;
    
    const filteredOrders = orders.filter(order => {
        if (!order.timestamp) return filterVal === 'all';
        
        const diffDays = (now - order.timestamp) / millisecondsInDay;
        
        if (filterVal === 'today') {
            const orderDate = new Date(order.timestamp).toDateString();
            const todayDate = new Date().toDateString();
            return orderDate === todayDate;
        } else if (filterVal === '7days') {
            return diffDays <= 7;
        } else if (filterVal === 'month') {
            return diffDays <= 30;
        }
        return true; // all
    });

    // 1. Sales summary (status: Entregue)
    const completedOrders = filteredOrders.filter(o => o.status === 'Entregue');
    const canceledOrders = filteredOrders.filter(o => o.status === 'Cancelado');
    
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrder = completedOrders.length > 0 ? (totalRevenue / completedOrders.length) : 0;
    
    // Update summary cards
    const repTotalRevenueEl = document.getElementById('repTotalRevenue');
    const repCompletedOrdersEl = document.getElementById('repCompletedOrders');
    const repAverageOrderEl = document.getElementById('repAverageOrder');
    const repCanceledOrdersEl = document.getElementById('repCanceledOrders');
    
    if (repTotalRevenueEl) repTotalRevenueEl.innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
    if (repCompletedOrdersEl) repCompletedOrdersEl.innerText = completedOrders.length;
    if (repAverageOrderEl) repAverageOrderEl.innerText = `R$ ${avgOrder.toFixed(2).replace('.', ',')}`;
    if (repCanceledOrdersEl) repCanceledOrdersEl.innerText = canceledOrders.length;

    // 2. Payment Methods distribution
    const paymentsCount = { pix: 0, card: 0, cash: 0 };
    const paymentsRevenue = { pix: 0, card: 0, cash: 0 };
    completedOrders.forEach(o => {
        const method = o.paymentMethod;
        if (paymentsCount[method] !== undefined) {
            paymentsCount[method]++;
            paymentsRevenue[method] += (o.total || 0);
        }
    });
    
    const totalPaymentsRevenue = paymentsRevenue.pix + paymentsRevenue.card + paymentsRevenue.cash;
    
    const paymentsContainer = document.getElementById('paymentMethodsDistribution');
    if (paymentsContainer) {
        paymentsContainer.innerHTML = '';
        
        const labels = { pix: 'Pix', card: 'Cartão (Maquininha)', cash: 'Dinheiro' };
        const classes = { pix: 'pix', card: 'card', cash: 'cash' };
        
        ['pix', 'card', 'cash'].forEach(method => {
            const rev = paymentsRevenue[method];
            const pct = totalPaymentsRevenue > 0 ? (rev / totalPaymentsRevenue) * 100 : 0;
            const count = paymentsCount[method];
            
            const html = `
                <div class="report-bar-row">
                    <div class="report-bar-label">
                        <span>${labels[method]} (${count} ped.)</span>
                        <span class="value">R$ ${rev.toFixed(2).replace('.', ',')} (${pct.toFixed(0)}%)</span>
                    </div>
                    <div class="report-bar-track">
                        <div class="report-bar-fill ${classes[method]}" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
            paymentsContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    // 3. Top 5 Best Sellers
    const itemQuantities = {};
    completedOrders.forEach(o => {
        if (!o.cart) return;
        o.cart.forEach(item => {
            if (item.type === 'pizza') {
                if (item.flavorNames && item.flavorNames.length > 0) {
                    item.flavorNames.forEach(flavor => {
                        const key = `Pizza Sabor: ${flavor}`;
                        itemQuantities[key] = (itemQuantities[key] || 0) + (item.quantity || 1);
                    });
                } else {
                    const key = `Pizza ${item.sizeName || 'Montada'}`;
                    itemQuantities[key] = (itemQuantities[key] || 0) + (item.quantity || 1);
                }
            } else {
                const key = item.name;
                itemQuantities[key] = (itemQuantities[key] || 0) + (item.quantity || 1);
            }
        });
    });
    
    const sortedItems = Object.keys(itemQuantities)
        .map(key => ({ name: key, qty: itemQuantities[key] }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
        
    const topProductsContainer = document.getElementById('topSellingProductsList');
    if (topProductsContainer) {
        topProductsContainer.innerHTML = '';
        
        if (sortedItems.length === 0) {
            topProductsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Nenhum produto vendido no período selecionado.</div>';
        } else {
            const maxQty = Math.max(...sortedItems.map(i => i.qty));
            
            sortedItems.forEach(item => {
                const pct = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;
                const html = `
                    <div class="report-bar-row">
                        <div class="report-bar-label">
                            <span>${item.name}</span>
                            <span class="value">${item.qty} un.</span>
                        </div>
                        <div class="report-bar-track">
                            <div class="report-bar-fill item" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                `;
                topProductsContainer.insertAdjacentHTML('beforeend', html);
            });
        }
    }

    // 4. Motoboys Payment Report
    renderMotoboysPaymentReport(filteredOrders);
}

function renderMotoboysPaymentReport(filteredOrders) {
    const container = document.getElementById('motoboysPaymentReportContainer');
    if (!container) return;
    
    const motoboys = getActiveMotoboys();
    const deliveryOrders = filteredOrders.filter(o => o.checkoutType === 'delivery' && o.status !== 'Cancelado');
    
    const motoboyStats = {};
    motoboys.forEach(m => {
        motoboyStats[m.id] = { id: m.id, name: m.name, whatsapp: m.whatsapp, count: 0, totalFees: 0, ordersList: [] };
    });
    motoboyStats['unassigned'] = { id: 'unassigned', name: 'Sem Motoboy Atribuído', whatsapp: '', count: 0, totalFees: 0, ordersList: [] };

    deliveryOrders.forEach(o => {
        const mId = o.assignedMotoboyId;
        const fee = (o.motoboyFee !== undefined && o.motoboyFee !== null) ? Number(o.motoboyFee) : Number(o.deliveryFee || 0);
        
        if (mId && motoboyStats[mId]) {
            motoboyStats[mId].count++;
            motoboyStats[mId].totalFees += fee;
            motoboyStats[mId].ordersList.push({ id: o.id, fee: fee, neighborhood: o.address?.neighborhood || '' });
        } else {
            motoboyStats['unassigned'].count++;
            motoboyStats['unassigned'].totalFees += fee;
            motoboyStats['unassigned'].ordersList.push({ id: o.id, fee: fee, neighborhood: o.address?.neighborhood || '' });
        }
    });

    let tableRowsHTML = '';
    let grandTotalCount = 0;
    let grandTotalFees = 0;

    Object.keys(motoboyStats).forEach(key => {
        const stat = motoboyStats[key];
        if (stat.count === 0 && stat.id === 'unassigned') return;
        if (stat.count === 0 && motoboys.length > 0 && stat.id !== 'unassigned') return;
        
        grandTotalCount += stat.count;
        grandTotalFees += stat.totalFees;

        const whatsappBtnHTML = stat.whatsapp ? `
            <button type="button" onclick="sendMotoboySummaryWhatsApp('${stat.id}')" style="background: #25d366; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;" title="Enviar extrato de corridas no WhatsApp do Motoboy">
                <span class="material-symbols-rounded" style="font-size: 16px;">chat</span>
                Enviar Extrato
            </button>
        ` : `<span style="color: var(--text-muted); font-size: 12px;">-</span>`;

        tableRowsHTML += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px 10px; font-weight: 600; color: var(--text-main);">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="color: #25d366; font-size: 18px;">two_wheeler</span>
                        ${stat.name}
                    </span>
                </td>
                <td style="padding: 12px 10px; text-align: center; font-weight: 600; color: var(--text-main); font-size: 14px;">${stat.count} entregas</td>
                <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: #81c784; font-size: 15px;">R$ ${stat.totalFees.toFixed(2).replace('.', ',')}</td>
                <td style="padding: 12px 10px; text-align: center;">${whatsappBtnHTML}</td>
            </tr>
        `;
    });

    if (tableRowsHTML === '') {
        tableRowsHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">Nenhuma tele-entrega registrada no período selecionado.</td></tr>`;
    }

    container.innerHTML = `
        <div class="prices-table-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h3 style="margin: 0; color: var(--text-main); font-family: var(--font-display); font-size: 18px; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded" style="color: #25d366;">two_wheeler</span>
                    Fechamento de Motoboys (Valores de Corridas a Pagar)
                </h3>
                <div style="background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.3); padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 14px;">
                    Total a Pagar aos Motoboys: R$ ${grandTotalFees.toFixed(2).replace('.', ',')}
                </div>
            </div>
            
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-main); font-weight: bold; font-size: 13px;">
                            <th style="padding: 10px;">Motoboy</th>
                            <th style="padding: 10px; text-align: center;">Total de Corridas</th>
                            <th style="padding: 10px; text-align: right;">Total Corridas a Pagar (R$)</th>
                            <th style="padding: 10px; text-align: center;">Enviar Extrato</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function sendMotoboySummaryWhatsApp(motoboyId) {
    const filterVal = document.getElementById('reportsPeriodFilter')?.value || 'all';
    const now = Date.now();
    const millisecondsInDay = 24 * 60 * 60 * 1000;
    
    const filteredOrders = orders.filter(order => {
        if (!order.timestamp) return filterVal === 'all';
        const diffDays = (now - order.timestamp) / millisecondsInDay;
        if (filterVal === 'today') {
            return new Date(order.timestamp).toDateString() === new Date().toDateString();
        } else if (filterVal === '7days') return diffDays <= 7;
        else if (filterVal === 'month') return diffDays <= 30;
        return true;
    });

    const motoboys = getActiveMotoboys();
    const motoboy = motoboys.find(m => String(m.id) === String(motoboyId));
    if (!motoboy || !motoboy.whatsapp) {
        alert('Motoboy não encontrado ou sem WhatsApp cadastrado.');
        return;
    }

    const motoboyOrders = filteredOrders.filter(o => o.checkoutType === 'delivery' && o.status !== 'Cancelado' && String(o.assignedMotoboyId) === String(motoboyId));
    
    if (motoboyOrders.length === 0) {
        alert(`Nenhuma entrega encontrada para ${motoboy.name} no período.`);
        return;
    }

    let totalFees = 0;
    let listLines = motoboyOrders.map(o => {
        const fee = (o.motoboyFee !== undefined && o.motoboyFee !== null) ? Number(o.motoboyFee) : Number(o.deliveryFee || 0);
        totalFees += fee;
        const neigh = o.address?.neighborhood ? ` (${o.address.neighborhood})` : '';
        return `• Pedido #${o.id}${neigh} - R$ ${fee.toFixed(2)}`;
    }).join('\n');

    let msg = `📊 *EXTRATO DE CORRIDAS - FINA MASSA PIZZARIA*\n`;
    msg += `👤 *Entregador:* ${motoboy.name}\n`;
    msg += `📦 *Total de Entregas:* ${motoboyOrders.length}\n`;
    msg += `💵 *TOTAL A RECEBER (CORRIDAS):* R$ ${totalFees.toFixed(2)}\n\n`;
    msg += `📋 *Detalhamento das entregas:*\n${listLines}`;

    let phoneNum = motoboy.whatsapp.replace(/\D/g, '');
    if (phoneNum.length === 10 || phoneNum.length === 11) phoneNum = '55' + phoneNum;
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
}

function loadPromoConfigIntoUI() {
    if (!menuData) return;
    const config = menuData.promo_config || { show_popup: false, facebook_url: "" };
    
    const showCheckbox = document.getElementById('promoShowPopup');
    const urlInput = document.getElementById('promoFacebookUrl');
    
    if (showCheckbox) showCheckbox.checked = !!config.show_popup;
    if (urlInput) urlInput.value = config.facebook_url || "";
}

function savePromoConfig(event) {
    event.preventDefault();
    if (!menuData) return;
    
    const show_popup = document.getElementById('promoShowPopup').checked;
    const facebook_url = document.getElementById('promoFacebookUrl').value.trim();
    
    if (!menuData.promo_config) {
        menuData.promo_config = {};
    }
    
    menuData.promo_config.show_popup = show_popup;
    menuData.promo_config.facebook_url = facebook_url;
    
    // Save to Firebase or local server
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/promo_config').set(menuData.promo_config)
        .then(() => {
            triggerCentralAutoBackup();
            alert("Configurações do Pop-up salvas com sucesso!");
        })
        .catch(err => {
            console.error("Erro ao salvar config no Firebase:", err);
            alert("Erro ao salvar configurações no Firebase.");
        });
    } else {
        // Local API save
        fetch('/api/menu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(menuData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                triggerCentralAutoBackup();
                alert("Configurações do Pop-up salvas localmente!");
            } else {
                alert("Erro ao salvar configurações localmente.");
            }
        })
        .catch(err => {
            console.error("Erro ao salvar localmente:", err);
            alert("Erro de conexão ao salvar localmente.");
        });
    }
}

/* ==========================================================================
   PWA & Service Worker Integration for Admin Panel
   ========================================================================== */
let swRegistration = null;

function initPWA() {
    if ('serviceWorker' in navigator) {
        const swPath = window.location.pathname.includes('/painel/') ? '../sw.js' : './sw.js';
        const swScope = window.location.pathname.includes('/painel/') ? '../' : './';
        navigator.serviceWorker.register(swPath, { scope: swScope, updateViaCache: 'none' }).then(reg => {
            swRegistration = reg;
            if (reg.waiting) {
                promptUpdate(reg.waiting);
            }
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            promptUpdate(newWorker);
                        }
                    });
                }
            });
        }).catch(err => {
            console.warn('Admin Service Worker registration failed:', err);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }
}

function promptUpdate(worker) {
    const banner = document.getElementById('updateBanner');
    if (banner) banner.classList.remove('display-none');
}

function applyAppUpdate() {
    if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
        window.location.reload();
    }
}

/* ==========================================================================
   Toast Notifications & Standardized Loading Spinner Overlay
   ========================================================================== */
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    toast.innerHTML = `
        <span class="material-symbols-rounded">${icons[type] || 'info'}</span>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showLoading(message = 'Processando...') {
    const overlay = document.getElementById('globalLoading');
    const textSpan = document.getElementById('loadingText');
    if (overlay) {
        if (textSpan) textSpan.innerText = message;
        overlay.classList.remove('display-none');
    }
}

function hideLoading() {
    const overlay = document.getElementById('globalLoading');
    if (overlay) {
        overlay.classList.add('display-none');
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Image Manager: Client-Side Canvas Compression, Preview & Removal
   ========================================================================== */
function compressAndProcessImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            callback(null, dataUrl);
        };
        img.onerror = function() {
            callback(new Error('Erro ao carregar imagem para compressão'));
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        callback(new Error('Erro ao ler arquivo de imagem'));
    };
    reader.readAsDataURL(file);
}

function handleFlavorFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
        return;
    }
    
    showLoading('Otimizando imagem...');
    compressAndProcessImage(file, 800, 800, 0.82, (err, compressedDataUrl) => {
        hideLoading();
        if (err) {
            console.error(err);
            showToast('Não foi possível processar a imagem.', 'error');
            return;
        }
        
        const input = document.getElementById('flavorImage');
        if (input) {
            input.value = compressedDataUrl;
            updateFlavorImagePreview(compressedDataUrl, file.name);
            showToast('Imagem enviada e otimizada com sucesso!', 'success');
        }
    });
}

function updateFlavorImagePreview(url, fileName = '') {
    const card = document.getElementById('flavorImagePreviewCard');
    const thumb = document.getElementById('flavorImagePreviewThumb');
    const nameEl = document.getElementById('flavorImagePreviewName');
    
    if (!card || !thumb) return;
    
    if (url && url.trim().length > 0) {
        thumb.src = url;
        nameEl.innerText = fileName || (url.length > 40 ? url.substring(0, 37) + '...' : url);
        card.classList.remove('display-none');
    } else {
        card.classList.add('display-none');
    }
}

function removeFlavorImage() {
    const input = document.getElementById('flavorImage');
    const fileInput = document.getElementById('flavorFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    updateFlavorImagePreview('');
    showToast('Imagem removida.', 'info');
}

function handleSimpleItemFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
        return;
    }
    
    showLoading('Otimizando imagem...');
    compressAndProcessImage(file, 800, 800, 0.82, (err, compressedDataUrl) => {
        hideLoading();
        if (err) {
            console.error(err);
            showToast('Não foi possível processar a imagem.', 'error');
            return;
        }
        
        const input = document.getElementById('simpleItemImage');
        if (input) {
            input.value = compressedDataUrl;
            updateSimpleItemImagePreview(compressedDataUrl, file.name);
            showToast('Imagem enviada e otimizada com sucesso!', 'success');
        }
    });
}

function updateSimpleItemImagePreview(url, fileName = '') {
    const card = document.getElementById('simpleItemImagePreviewCard');
    const thumb = document.getElementById('simpleItemImagePreviewThumb');
    const nameEl = document.getElementById('simpleItemImagePreviewName');
    
    if (!card || !thumb) return;
    
    if (url && url.trim().length > 0) {
        thumb.src = url;
        nameEl.innerText = fileName || (url.length > 40 ? url.substring(0, 37) + '...' : url);
        card.classList.remove('display-none');
    } else {
        card.classList.add('display-none');
    }
}

function removeSimpleItemImage() {
    const input = document.getElementById('simpleItemImage');
    const fileInput = document.getElementById('simpleItemFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    updateSimpleItemImagePreview('');
    showToast('Imagem removida.', 'info');
}

/* ==========================================================================
   Backup & Export/Import Manager (JSON)
   ========================================================================== */
function exportMenuBackup() {
    try {
        if (!menuData) {
            showToast('Dados do cardápio não disponíveis para exportação.', 'warning');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(menuData, null, 2));
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `fina-massa-cardapio-${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Backup do cardápio exportado com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao exportar cardápio:", e);
        showToast('Não foi possível exportar o backup do cardápio.', 'error');
    }
}

function exportSettingsBackup() {
    try {
        const settingsBackup = {
            settings: menuData?.settings || {},
            deliveryFees: menuData?.settings?.deliveryFees || {},
            promo_config: menuData?.promo_config || {}
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settingsBackup, null, 2));
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `fina-massa-configuracoes-${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Backup das configurações exportado com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao exportar configurações:", e);
        showToast('Não foi possível exportar o backup das configurações.', 'error');
    }
}

function exportOrdersBackup() {
    try {
        if (!orders || orders.length === 0) {
            showToast('Nenhum pedido registrado para exportação.', 'warning');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `fina-massa-pedidos-${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Backup de pedidos exportado com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao exportar pedidos:", e);
        showToast('Não foi possível exportar o backup de pedidos.', 'error');
    }
}

function validateMenuBackupData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'O arquivo não é um objeto JSON válido.' };
    }
    
    if (!data.menu_items || typeof data.menu_items !== 'object') {
        return { valid: false, error: 'O arquivo não contém a estrutura "menu_items".' };
    }
    
    const categories = Object.keys(data.menu_items);
    if (categories.length === 0) {
        return { valid: false, error: 'Nenhuma categoria de produtos encontrada no arquivo de backup.' };
    }
    
    let totalItems = 0;
    categories.forEach(cat => {
        if (Array.isArray(data.menu_items[cat])) {
            totalItems += data.menu_items[cat].length;
        }
    });

    if (totalItems === 0) {
        return { valid: false, error: 'Nenhum item ou produto válido encontrado no arquivo de backup.' };
    }

    return { valid: true, error: null };
}

function handleImportMenuBackup(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // 1. Strict JSON Schema Validation BEFORE changing any data or database state
            const validation = validateMenuBackupData(importedData);
            if (!validation.valid) {
                showToast(`Falha na validação do backup: ${validation.error}`, 'error', 6000);
                fileInput.value = '';
                return;
            }
            
            const categories = Object.keys(importedData.menu_items);
            let summaryLines = [];
            let totalCount = 0;
            categories.forEach(cat => {
                if (Array.isArray(importedData.menu_items[cat])) {
                    const count = importedData.menu_items[cat].length;
                    totalCount += count;
                    summaryLines.push(`• ${count} itens em "${cat}"`);
                }
            });
            
            // 2. Explicit User Confirmation with Data Summary
            const userConfirmed = confirm(
                `⚠️ CONFIRMAÇÃO DE RESTAURAÇÃO DE BACKUP:\n\n` +
                `Foi encontrado no arquivo:\n` +
                summaryLines.join('\n') + `\n` +
                `• Total de ${totalCount} produtos cadastrados\n\n` +
                `Deseja aplicar estas alterações ao cardápio da Fina Massa Pizzaria?`
            );
            
            if (!userConfirmed) {
                showToast('Restauração de backup cancelada pelo usuário.', 'info');
                fileInput.value = '';
                return;
            }
            
            const finalConfirm = confirm("⚠️ ATENÇÃO: Os dados do cardápio serão atualizados com as informações do backup. Confirmar?");
            if (!finalConfirm) {
                showToast('Restauração cancelada.', 'info');
                fileInput.value = '';
                return;
            }
            
            // 3. Apply changes ONLY after 100% validation and double confirmation
            showLoading('Restaurando cardápio...');
            menuData = importedData;
            
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                firebase.database().ref('menu').set(importedData)
                .then(() => {
                    hideLoading();
                    renderMenuManager();
                    showToast('Cardápio restaurado e sincronizado com sucesso no Firebase!', 'success');
                })
                .catch(err => {
                    hideLoading();
                    console.error("Erro ao salvar no Firebase:", err);
                    showToast('Erro de conexão ao salvar cardápio no Firebase.', 'error');
                });
            } else {
                hideLoading();
                renderMenuManager();
                showToast('Cardápio restaurado localmente com sucesso!', 'success');
            }
        } catch (err) {
            console.error("Erro na leitura do JSON:", err);
            showToast('O arquivo selecionado não é um JSON válido.', 'error');
        } finally {
            fileInput.value = '';
        }
    };
    reader.readAsText(file);
}

/* ==========================================================================
   Centralized Automatic Background Backup System (Debounced & Full Recoverable Payload)
   ========================================================================== */
let centralAutoBackupTimer = null;

function triggerCentralAutoBackup() {
    if (centralAutoBackupTimer) clearTimeout(centralAutoBackupTimer);
    
    // 3000ms Debounce: Groups rapid user edits together before saving to DB
    centralAutoBackupTimer = setTimeout(() => {
        performCentralAutoBackgroundBackup();
    }, 3000);
}

function performCentralAutoBackgroundBackup() {
    try {
        if (!menuData) return;
        
        // Deep safe snapshot copy of all live orders
        const ordersSnapshot = (orders || []).map(order => ({
            id: order.id,
            timestamp: order.timestamp || Date.now(),
            date: order.date || '',
            time: order.time || '',
            clientName: order.clientName || '',
            clientPhone: order.clientPhone || '',
            checkoutType: order.checkoutType || 'delivery',
            address: order.address ? { ...order.address } : null,
            paymentMethod: order.paymentMethod || '',
            cashChange: order.cashChange || '',
            subtotal: order.subtotal || 0,
            deliveryFee: order.deliveryFee || 0,
            total: order.total || 0,
            status: order.status || 'Pendente',
            cart: Array.isArray(order.cart) ? order.cart.map(item => ({ ...item })) : []
        }));
        
        // Full recoverable data snapshot containing 100% of catalog, prices, borders, settings, fees, promo config AND complete orders
        const fullBackupSnapshot = {
            timestamp: new Date().toISOString(),
            menu_items: menuData.menu_items || {},
            adicionais: menuData.adicionais || {},
            settings: menuData?.settings || {},
            deliveryFees: menuData?.settings?.deliveryFees || {},
            promo_config: menuData.promo_config || {},
            orders: ordersSnapshot,
            orders_summary: {
                totalOrdersCount: ordersSnapshot.length,
                pendingCount: ordersSnapshot.filter(o => o.status === 'Pendente').length
            }
        };
        
        // 1. Save locally in localStorage (latest backup + history rotation of last 5 snapshots)
        const historyStr = localStorage.getItem('auto_backup_history');
        let history = [];
        if (historyStr) {
            try { history = JSON.parse(historyStr); } catch (e) {}
        }
        
        history.unshift(fullBackupSnapshot);
        if (history.length > 5) history = history.slice(0, 5);
        
        localStorage.setItem('auto_backup_latest', JSON.stringify(fullBackupSnapshot));
        localStorage.setItem('auto_backup_history', JSON.stringify(history));
        
        // 2. Safe write to Firebase Realtime Database at /backups/latest
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            firebase.database().ref('backups/latest').set(fullBackupSnapshot)
            .then(() => {
                console.log("Auto-backup centralizado completo (com catálogo e pedidos) gravado no Firebase.");
            })
            .catch(err => {
                console.warn("Aviso: Auto-backup Firebase em segundo plano adiado (offline):", err);
            });
        }
    } catch (e) {
        console.warn("Erro no auto-backup centralizado:", e);
    }
}








/* ==========================================================================
   Table Management (Gerenciador de Mesas CRUD)
   ========================================================================== */
function openTablesManagerModal() {
    renderTablesManagerList();
    const modal = document.getElementById('tablesManagerModal');
    if (modal) modal.style.display = 'flex';
}

function closeTablesManagerModal() {
    const modal = document.getElementById('tablesManagerModal');
    if (modal) modal.style.display = 'none';
}

function getAllConfiguredTables() {
    const tableKeys = new Set();
    // PadrÃ£o inicial: Mesas 01 a 20
    for (let i = 1; i <= 20; i++) {
        tableKeys.add(String(i).padStart(2, '0'));
    }
    // Todas as mesas existentes no nÃ³ /tables do Firebase
    Object.keys(firebaseTablesState || {}).forEach(k => {
        const norm = getCanonicalTableNumber(k);
        if (norm) tableKeys.add(norm);
    });
    // Qualquer mesa encontrada no histÃ³rico de pedidos
    (orders || []).forEach(o => {
        if (isTableOrderEntity(o)) {
            const norm = getCanonicalTableNumber(o);
            if (norm) tableKeys.add(norm);
        }
    });

    const list = Array.from(tableKeys).map(key => {
        const data = (firebaseTablesState && firebaseTablesState[key]) || {};
        const isOccupied = isTableOccupied(key);
        const isActive = data.active !== false;
        const name = data.tableName || `Mesa ${key}`;
        return {
            tableNum: key,
            tableName: name,
            active: isActive,
            isOccupied: isOccupied,
            status: isOccupied ? 'aberta' : (data.status || 'livre')
        };
    });

    // OrdenaÃ§Ã£o natural numÃ©rica
    list.sort((a, b) => {
        const numA = parseInt(a.tableNum, 10);
        const numB = parseInt(b.tableNum, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.tableNum.localeCompare(b.tableNum);
    });

    return list;
}

function renderTablesManagerList() {
    const tbody = document.getElementById('tablesManagerTableBody');
    const totalCountEl = document.getElementById('tablesManagerTotalCount');
    if (!tbody) return;

    const tables = getAllConfiguredTables();
    if (totalCountEl) totalCountEl.innerText = `${tables.length} mesas cadastradas`;

    tbody.innerHTML = '';

    tables.forEach(t => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-main);';

        const statusBadge = t.isOccupied
            ? '<span style="background: rgba(245, 166, 35, 0.15); color: #f5a623; border: 1px solid rgba(245, 166, 35, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">ðŸŸ¡ Ocupada</span>'
            : '<span style="background: rgba(76, 175, 80, 0.15); color: #4caf50; border: 1px solid rgba(76, 175, 80, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">ðŸŸ¢ Livre</span>';

        const hasHistory = (orders || []).some(o => isTableOrderEntity(o) && getCanonicalTableNumber(o) === t.tableNum);

        tr.innerHTML = `
            <td style="padding: 10px 14px; font-weight: 800; color: var(--primary);">#${t.tableNum}</td>
            <td style="padding: 10px 14px; font-weight: 600;">${t.tableName}</td>
            <td style="padding: 10px 14px;">${statusBadge}</td>
            <td style="padding: 10px 14px; text-align: center;">
                <label class="switch" style="transform: scale(0.85);" title="${t.active ? 'Mesa ativa no GarÃ§om' : 'Mesa desativada'}">
                    <input type="checkbox" ${t.active ? 'checked' : ''} onchange="toggleTableActiveState('${t.tableNum}', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td style="padding: 10px 14px; text-align: center;">
                <button type="button" onclick="deleteTableFromSystem('${t.tableNum}')" title="${hasHistory ? 'Mesa possui histÃ³rico e nÃ£o pode ser apagada (desative-a)' : 'Excluir mesa'}" style="background: transparent; border: none; color: ${hasHistory ? 'var(--text-light)' : '#e53935'}; cursor: ${hasHistory ? 'not-allowed' : 'pointer'}; padding: 4px 6px; border-radius: var(--radius-sm); display: inline-flex; align-items: center;" ${hasHistory ? 'disabled' : ''}>
                    <span class="material-symbols-rounded" style="font-size: 18px;">${hasHistory ? 'lock' : 'delete'}</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleAddNewTableSubmit(e) {
    if (e) e.preventDefault();
    const numInput = document.getElementById('newTableNumInput');
    const nameInput = document.getElementById('newTableNameInput');
    if (!numInput) return;

    const rawNum = numInput.value.trim();
    if (!rawNum) {
        showToast('Informe o nÃºmero ou identificaÃ§Ã£o da mesa.', 'warning');
        return;
    }

    const normNum = getCanonicalTableNumber(rawNum);
    const tableName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : `Mesa ${normNum}`;

    const existingTables = getAllConfiguredTables();
    if (existingTables.some(t => t.tableNum === normNum)) {
        showToast(`A Mesa #${normNum} jÃ¡ estÃ¡ cadastrada!`, 'warning');
        return;
    }

    const payload = {
        tableNum: normNum,
        tableName: tableName,
        status: 'livre',
        active: true,
        total: 0,
        comandasCount: 0,
        orderIds: []
    };

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref(`tables/${normNum}`).set(payload)
            .then(() => {
                firebaseTablesState[normNum] = payload;
                showToast(`Mesa "${tableName}" (#${normNum}) cadastrada com sucesso!`, 'success');
                numInput.value = '';
                if (nameInput) nameInput.value = '';
                renderTablesManagerList();
                renderTablesDashboard();
            })
            .catch(err => {
                console.error("Erro ao cadastrar mesa no Firebase:", err);
                showToast('Erro ao cadastrar mesa no Firebase.', 'error');
            });
    } else {
        firebaseTablesState[normNum] = payload;
        showToast(`Mesa "${tableName}" (#${normNum}) cadastrada localmente!`, 'success');
        numInput.value = '';
        if (nameInput) nameInput.value = '';
        renderTablesManagerList();
        renderTablesDashboard();
    }
}

function toggleTableActiveState(tableNum, isActive) {
    const normNum = getCanonicalTableNumber(tableNum);
    if (!normNum) return;

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref(`tables/${normNum}/active`).set(isActive)
            .then(() => {
                if (!firebaseTablesState[normNum]) {
                    firebaseTablesState[normNum] = { tableNum: normNum, tableName: `Mesa ${normNum}`, status: 'livre', total: 0, comandasCount: 0, orderIds: [] };
                }
                firebaseTablesState[normNum].active = isActive;
                showToast(`Mesa #${normNum} ${isActive ? 'ativada' : 'desativada'} com sucesso!`, 'success');
                renderTablesDashboard();
            })
            .catch(err => {
                console.error("Erro ao alterar status da mesa:", err);
                showToast('Erro ao sincronizar com o Firebase.', 'error');
            });
    } else {
        if (!firebaseTablesState[normNum]) {
            firebaseTablesState[normNum] = { tableNum: normNum, tableName: `Mesa ${normNum}`, status: 'livre', total: 0, comandasCount: 0, orderIds: [] };
        }
        firebaseTablesState[normNum].active = isActive;
        showToast(`Mesa #${normNum} ${isActive ? 'ativada' : 'desativada'}!`, 'success');
        renderTablesDashboard();
    }
}

function deleteTableFromSystem(tableNum) {
    const normNum = getCanonicalTableNumber(tableNum);
    if (!normNum) return;

    const hasHistory = (orders || []).some(o => isTableOrderEntity(o) && getCanonicalTableNumber(o) === normNum);
    const isOccupied = isTableOccupied(normNum);

    if (hasHistory || isOccupied) {
        alert(`A Mesa #${normNum} nÃ£o pode ser excluÃ­da pois possui pedidos ou comandas vinculados a ela.\n\nPara nÃ£o utilizÃ¡-la em novos atendimentos, basta desativar o botÃ£o de ativaÃ§Ã£o.`);
        return;
    }

    if (!confirm(`Deseja realmente excluir a Mesa #${normNum} do sistema?`)) {
        return;
    }

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref(`tables/${normNum}`).remove()
            .then(() => {
                delete firebaseTablesState[normNum];
                showToast(`Mesa #${normNum} excluÃ­da com sucesso!`, 'success');
                renderTablesManagerList();
                renderTablesDashboard();
            })
            .catch(err => {
                console.error("Erro ao excluir mesa no Firebase:", err);
                showToast('Erro ao excluir mesa no Firebase.', 'error');
            });
    } else {
        delete firebaseTablesState[normNum];
        showToast(`Mesa #${normNum} excluÃ­da!`, 'success');
        renderTablesManagerList();
        renderTablesDashboard();
    }
}


